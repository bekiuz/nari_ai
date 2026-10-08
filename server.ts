import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createVerify } from 'crypto';
import { GoogleGenAI, Type, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

let firebaseConfig: any = {};
try {
  const rawConfig = fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8');
  firebaseConfig = JSON.parse(rawConfig);
} catch {
  // fallback if file not available
}

const app = express();

// Support large payload for images & documents
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Helper to get GoogleGenAI client
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing. Please set it in your environment or Secrets panel.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Token verification helper
type FirebaseTokenPayload = {
  aud?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
  user_id?: string;
  email?: string;
};

type GoogleCertCache = {
  keys: Record<string, string>;
  expiresAt: number;
};

let googleCertCache: GoogleCertCache | null = null;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function getFirebaseProjectId(): string {
  const projectId = firebaseConfig.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error('Firebase projectId is missing from firebase-applet-config.json or GOOGLE_CLOUD_PROJECT.');
  }
  return projectId;
}

async function getGoogleCertificateKeys(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();

  if (!forceRefresh && googleCertCache && googleCertCache.expiresAt > now) {
    return googleCertCache.keys;
  }

  const certUrl =
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  const response = await fetch(certUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch Firebase public keys (HTTP ${response.status}).`);
  }

  const keys = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  googleCertCache = {
    keys,
    expiresAt: now + Math.max(60, Math.min(maxAgeSeconds, 86400)) * 1000,
  };

  return keys;
}

async function verifyToken(token: string): Promise<{ uid: string; email?: string } | null> {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(decodeBase64Url(parts[0])) as { alg?: string; kid?: string };
    const payload = JSON.parse(decodeBase64Url(parts[1])) as FirebaseTokenPayload;

    if (header.alg !== 'RS256' || !header.kid) return null;

    const projectId = getFirebaseProjectId();
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.sub.length > 128) return null;
    if (!payload.aud || payload.aud !== projectId) return null;
    if (!payload.iss || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.exp || payload.exp <= now) return null;
    if (!payload.iat || payload.iat > now + 300) return null;

    let keys = await getGoogleCertificateKeys();
    let certificate = keys[header.kid];

    // Refresh once when Google rotates signing keys.
    if (!certificate) {
      keys = await getGoogleCertificateKeys(true);
      certificate = keys[header.kid];
    }

    if (!certificate) return null;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const signature = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!verifier.verify(certificate, signature)) return null;

    return {
      uid: payload.user_id || payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

// Authentication token verification middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const user = await verifyToken(token);

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
      return;
    }

    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }
}

// Model list endpoint
app.get('/api/models', (_req: Request, res: Response) => {
  res.json({
    models: [
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        description: 'Next-gen flagship multimodal model. High accuracy reasoning, vision, and code analysis.',
        badge: 'Recommended',
        contextWindow: '1M tokens',
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'Gemini 3.1 Flash Lite',
        description: 'Ultra-low latency, highly resilient model optimized for agile conversational flow.',
        badge: 'High Speed',
        contextWindow: '1M tokens',
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        description: 'Deep reasoning model specialized in complex logic, architecture, and programming.',
        badge: 'Deep Reasoning',
        contextWindow: '2M tokens',
      },
    ],
  });
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    geminiConfigured: hasKey,
    timestamp: new Date().toISOString(),
  });
});

interface ChatPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: (string | ChatPart)[];
}

interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  stream?: boolean;
  webSearch?: boolean;
}

function formatErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred.';
  const rawMsg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);

  try {
    const parsed = typeof rawMsg === 'string' ? JSON.parse(rawMsg.trim()) : rawMsg;
    if (parsed?.error?.message) {
      const inner = parsed.error.message;
      if (inner.includes('high demand') || inner.includes('503') || inner.includes('UNAVAILABLE')) {
        return 'The AI model is experiencing a temporary spike in demand. Please retry in a few moments.';
      }
      return inner;
    }
  } catch {
    // not direct json
  }

  if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
    return 'The AI model is experiencing a temporary spike in demand. Please retry in a few moments.';
  }
  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return 'Rate limit reached. Please wait a brief moment before sending another message.';
  }
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid')) {
    return 'The Gemini API key appears to be invalid or unconfigured.';
  }

  return rawMsg;
}

// POST /api/chat - Main endpoint supporting both SSE streaming and standard responses (Protected)
app.post('/api/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      messages,
      model = 'gemini-3.8-flash',
      systemInstruction,
      temperature = 0.7,
      stream = true,
      webSearch = false,
    } = req.body as ChatRequestBody;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'At least one message is required.' });
    }

    const ai = getGenAIClient();

    // Map conversation history into Gemini SDK format
    const formattedContents = messages.map((msg) => {
      const parts = msg.parts.map((part) => {
        if (typeof part === 'string') {
          return { text: part };
        }
        if (part.inlineData) {
          return {
            inlineData: {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data,
            },
          };
        }
        if (part.text) {
          return { text: part.text };
        }
        return { text: '' };
      });

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      };
    });

    const defaultSystemPrompt =
      'You are Zuxrash, an advanced, highly intelligent futuristic AI assistant. ' +
      'You communicate with clarity, precision, and elegance. ' +
      'Format code blocks properly with language tags. Use structured Markdown with bolding, lists, and tables where helpful. ' +
      'When analyzing images or files, be thorough, observant, and insightful. If given code, provide clean, idiomatic, bug-free solutions.';

    const voiceCapabilityDirective =
      'Zuxrash System Capabilities: You are fully integrated with real-time bidirectional Voice Mode powered by Google Gemini Live (gemini-3.8-live) and Read Aloud powered by Gemini TTS (gemini-3.8-flash-tts). ' +
      'Real-time voice chat IS active and available in this app right now. If the user asks whether voice chat is available, how to talk to you, or requests voice mode, confirm that real-time voice mode is active and instruct them to click the microphone / Voice Mode button beside the chat composer to start a real-time voice conversation with you.';

    // Generate real runtime clock context for every request
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentIsoString = now.toISOString();
    const currentDateString = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const currentTimeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });

    const runtimeContext = `Current runtime date and time: ${currentDateString}, ${currentTimeString} (UTC) [ISO: ${currentIsoString}]. Current calendar year: ${currentYear}. You must answer time-sensitive user queries accurately according to this runtime clock and current real-world timeline.`;

    const basePrompt = systemInstruction || defaultSystemPrompt;
    const finalSystemInstruction = `${basePrompt}\n\n${voiceCapabilityDirective}\n\n${runtimeContext}`;

    const config: Record<string, unknown> = {
      systemInstruction: finalSystemInstruction,
      temperature: Math.min(Math.max(temperature, 0), 2),
    };

    if (webSearch) {
      // Official Google Search grounding tool for @google/genai SDK
      config.tools = [
        {
          googleSearch: {},
        },
      ];
      console.log(`[WebSearch Diagnostic] Web Search ON for request. Attached official tool: { googleSearch: {} }`);
    } else {
      console.log(`[WebSearch Diagnostic] Web Search OFF for request. No search tool attached.`);
    }

    function extractGrounding(grounding: any) {
      if (!grounding) return null;
      const sources: Array<{ title: string; url: string }> = [];
      const seen = new Set<string>();

      // Extract official citation links from groundingChunks
      if (Array.isArray(grounding.groundingChunks)) {
        grounding.groundingChunks.forEach((c: any) => {
          const uri = c?.web?.uri || c?.maps?.uri;
          if (uri && typeof uri === 'string' && !seen.has(uri)) {
            seen.add(uri);
            sources.push({
              title: c?.web?.title || c?.maps?.title || uri,
              url: uri,
            });
          }
        });
      }

      // Extract from grounding sources if present
      if (Array.isArray(grounding.sources)) {
        grounding.sources.forEach((s: any) => {
          if (s?.url && typeof s.url === 'string' && !seen.has(s.url)) {
            seen.add(s.url);
            sources.push({
              title: s.title || s.url,
              url: s.url,
            });
          }
        });
      }

      const webSearchQueries = Array.isArray(grounding.webSearchQueries) ? grounding.webSearchQueries : [];
      const groundingChunks = Array.isArray(grounding.groundingChunks) ? grounding.groundingChunks : [];
      const groundingSupports = Array.isArray(grounding.groundingSupports) ? grounding.groundingSupports : [];

      if (sources.length === 0 && webSearchQueries.length === 0 && groundingChunks.length === 0) {
        return null;
      }

      return {
        webSearchQueries,
        sources,
        groundingChunks,
        groundingSupports,
        searchEntryPoint: grounding.searchEntryPoint || undefined,
      };
    }

    const fallbackOrder = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
    const modelsToTry = Array.from(new Set([model, ...fallbackOrder]));

    if (stream) {
      // SSE Streaming headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      let streamSuccess = false;
      let lastStreamError: any = null;

      for (const currentModelToAttempt of modelsToTry) {
        for (let attempt = 0; attempt <= 2; attempt++) {
          try {
            console.log(`[Chat Streaming] Attempting model=${currentModelToAttempt}, webSearch=${!!webSearch}, attempt=${attempt}`);
            const responseStream = await ai.models.generateContentStream({
              model: currentModelToAttempt,
              contents: formattedContents,
              config,
            });

            let latestGroundingData: any = null;

            for await (const chunk of responseStream) {
              const chunkText = chunk.text;
              const grounding = chunk.candidates?.[0]?.groundingMetadata;

              const payload: Record<string, unknown> = {};
              if (chunkText) payload.text = chunkText;
              if (grounding) {
                const parsedGrounding = extractGrounding(grounding);
                if (parsedGrounding) {
                  latestGroundingData = parsedGrounding;
                  payload.groundingMetadata = parsedGrounding;
                  console.log(
                    `[WebSearch Grounding Diagnostic] Received grounding: queries=${JSON.stringify(
                      parsedGrounding.webSearchQueries
                    )}, sourcesCount=${parsedGrounding.sources.length}`
                  );
                  if (parsedGrounding.sources.length > 0) {
                    console.log(
                      `[WebSearch Grounding Diagnostic] Source URLs: ${parsedGrounding.sources.map((s) => s.url).join(', ')}`
                    );
                  }
                }
              }

              if (Object.keys(payload).length > 0) {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
              }
            }

            if (latestGroundingData) {
              res.write(`data: ${JSON.stringify({ groundingMetadata: latestGroundingData })}\n\n`);
            }

            res.write('data: [DONE]\n\n');
            streamSuccess = true;
            return res.end();
          } catch (streamError: any) {
            lastStreamError = streamError;
            console.warn(`[Chat Streaming] Model ${currentModelToAttempt} attempt ${attempt} error:`, streamError?.message || streamError);
            const msg = streamError?.message || '';
            // If quota is exhausted or search grounding not permitted, break immediately without waiting
            if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || (webSearch && msg.includes('429'))) {
              break;
            }
            if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }
            break;
          }
        }
        if (streamSuccess) break;
        // If search grounding hit quota exhaustion, break outer loop immediately
        if (webSearch && lastStreamError && (String(lastStreamError?.message).includes('RESOURCE_EXHAUSTED') || String(lastStreamError?.message).includes('429'))) {
          break;
        }
      }

      // If search failed because of Gemini Search Grounding quota exhaustion (429) or search tool error
      if (!streamSuccess && webSearch) {
        console.warn(
          `[WebSearch Diagnostic] Google Search grounding failed (${formatErrorMessage(
            lastStreamError
          )}). Returning explicit user-facing search quota notice (no silent fallback).`
        );
        const searchQuotaNotice =
          'Web Search is temporarily unavailable because the search quota was exceeded. Please retry in a few moments, or toggle Web Search OFF to ask Zuxrash using standard model knowledge.';
        res.write(`data: ${JSON.stringify({ error: searchQuotaNotice, webSearchUnavailable: true })}\n\n`);
        return res.end();
      }

      if (!streamSuccess) {
        console.error('Error during streaming:', lastStreamError);
        const userFriendlyError = formatErrorMessage(lastStreamError);
        res.write(`data: ${JSON.stringify({ error: userFriendlyError })}\n\n`);
        return res.end();
      }
    } else {
      // Non-streaming response with retry and fallback
      let lastError: any = null;

      for (const currentModelToAttempt of modelsToTry) {
        for (let attempt = 0; attempt <= 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: currentModelToAttempt,
              contents: formattedContents,
              config,
            });
            const text = response.text || '';
            const grounding = response.candidates?.[0]?.groundingMetadata;
            const groundingData = extractGrounding(grounding);
            if (groundingData) {
              console.log(
                `[WebSearch Grounding Diagnostic] Non-stream grounding: queries=${JSON.stringify(
                  groundingData.webSearchQueries
                )}, sourcesCount=${groundingData.sources.length}`
              );
            }
            return res.json({ text, groundingMetadata: groundingData });
          } catch (err: any) {
            lastError = err;
            const msg = err?.message || '';
            if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || (webSearch && msg.includes('429'))) {
              break;
            }
            if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
              await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
              continue;
            }
            break;
          }
        }
        if (webSearch && lastError && (String(lastError?.message).includes('RESOURCE_EXHAUSTED') || String(lastError?.message).includes('429'))) {
          break;
        }
      }

      // If search failed because of quota exhaustion in non-streaming, return explicit notice
      if (webSearch) {
        return res.status(429).json({
          error:
            'Web Search is temporarily unavailable because the search quota was exceeded. Please retry in a few moments, or toggle Web Search OFF to ask Zuxrash using standard model knowledge.',
          webSearchUnavailable: true,
        });
      }

      return res.status(500).json({ error: formatErrorMessage(lastError) });
    }
  } catch (error: any) {
    console.error('API Error /api/chat:', error);
    const friendlyError = formatErrorMessage(error);
    return res.status(500).json({ error: friendlyError });
  }
});

// POST /api/files/extract - Extract readable text from PDF, DOCX, CSV, JSON, TXT, MD, and Code files
app.post('/api/files/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, mimeType = '', fileDataBase64 } = req.body;
    if (!fileName || !fileDataBase64) {
      return res.status(400).json({ error: 'fileName and fileDataBase64 are required.' });
    }

    const buffer = Buffer.from(fileDataBase64, 'base64');
    const ext = path.extname(fileName).toLowerCase();

    let text = '';
    let parserType = 'text';

    if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
      parserType = 'docx';
      try {
        const mammothModule: any = await import('mammoth');
        const extractFn = mammothModule.extractRawText || mammothModule.default?.extractRawText;
        const result = await extractFn({ buffer });
        text = result.value || '';
      } catch (docErr: any) {
        console.error('Mammoth extraction error:', docErr);
        return res.status(500).json({ error: 'Failed to extract text from DOCX document.' });
      }
    } else if (ext === '.pdf' || mimeType.includes('pdf')) {
      parserType = 'pdf';
      try {
        const pdfModule: any = await import('pdf-parse');
        const PDFParseClass = pdfModule.PDFParse || pdfModule.default?.PDFParse;
        if (PDFParseClass) {
          const parser = new PDFParseClass(new Uint8Array(buffer));
          await parser.load();
          text = await parser.getText();
        } else {
          const parseFn = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
          if (parseFn) {
            const parsed = await parseFn(buffer);
            text = parsed.text;
          }
        }
      } catch (pdfErr: any) {
        console.warn('PDF parser notice, using fallback preview:', pdfErr?.message);
        text = `[PDF Document: ${fileName} (${buffer.length} bytes ready for multimodal analysis)]`;
      }
    } else {
      // Code, JSON, CSV, Text, Markdown
      parserType = ext.slice(1) || 'text';
      text = buffer.toString('utf8');
    }

    const lines = text.split('\n');
    res.json({
      success: true,
      text,
      charCount: text.length,
      lineCount: lines.length,
      type: parserType,
    });
  } catch (err: any) {
    console.error('File extraction error:', err);
    res.status(500).json({ error: err.message || 'Error extracting file content' });
  }
});

// POST /api/memory/extract - Automatically analyze conversations for enduring user preferences & facts
app.post('/api/memory/extract', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userText, assistantReply } = req.body;
    if (!userText || typeof userText !== 'string' || userText.trim().length < 8) {
      return res.json({ hasMemory: false });
    }

    const ai = getGenAIClient();
    const prompt =
      'You are a strict, privacy-first memory extraction engine for an AI assistant. Analyze the user message to detect if the user EXPLICITLY shared an enduring personal fact, background, explicit skill, or preference about themselves.\n\n' +
      `User message: "${userText}"\n` +
      (assistantReply ? `Assistant response: "${assistantReply}"\n` : '') +
      '\nSTRICT RULES:\n' +
      '1. Save ONLY information that is EXPLICITLY stated by the user or unmistakably established. Never infer, assume, extrapolate, or guess.\n' +
      '2. NEVER infer personal nicknames, preferred names, tone personas, or relationship roles unless the user explicitly said "call me [name]" or "my name is [name]". For example, never save "the user wants to be called Zuxrash" or "the user is a student" unless stated word-for-word.\n' +
      '3. Ignore transient search questions, temporary coding debugging, one-off tasks, and fleeting conversation pleasantries.\n' +
      '4. If no explicit, enduring personal fact was stated by the user, return hasMemory: false.\n' +
      '5. If an explicit fact was provided, state it objectively and factually in one clear sentence (e.g., "User works as a software engineer in Tashkent.").';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasMemory: { type: Type.BOOLEAN, description: 'True if a permanent user fact/preference was shared' },
            content: { type: Type.STRING, description: 'Concise 1-sentence statement of the fact' },
            category: {
              type: Type.STRING,
              description: 'Category for the memory',
            },
            importance: { type: Type.NUMBER, description: 'Importance from 1 to 5' },
          },
          required: ['hasMemory'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"hasMemory":false}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error during memory extraction:', err?.message || err);
    return res.json({ hasMemory: false });
  }
});

// POST /api/voice/tts - Official Gemini Text-To-Speech with gemini-3.8-flash-tts
app.post('/api/voice/tts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text, voiceName = 'Zephyr' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text parameter is required for voice generation.' });
    }

    const ai = getGenAIClient();
    const cleanText = text
      .replace(/[*#`_~\[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, 'link')
      .slice(0, 3000)
      .trim();

    const allowedVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
    const chosenVoice = allowedVoices.includes(voiceName) ? voiceName : 'Zephyr';

    let base64Audio: string | undefined;
    let mimeType = 'audio/wav';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: cleanText }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });
      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';
    } catch (ttsErr: any) {
      console.warn('TTS using fallback gemini-3.8-flash-lite-tts:', ttsErr?.message);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: cleanText }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });
      base64Audio = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      mimeType = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';
    }

    if (!base64Audio) {
      return res.status(500).json({ error: 'Failed to generate speech audio.' });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType,
      voiceName: chosenVoice,
    });
  } catch (err: any) {
    console.error('Error generating TTS:', err);
    res.status(500).json({ error: formatErrorMessage(err) });
  }
});

// POST /api/voice/preview - Quick sample for voice selection in settings
app.post('/api/voice/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { voiceName = 'Zephyr' } = req.body;
    const allowedVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
    const chosenVoice = allowedVoices.includes(voiceName) ? voiceName : 'Zephyr';

    const ai = getGenAIClient();
    const previewText = `Hello! I am Zuxrash, speaking with the ${chosenVoice} voice.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{ role: 'user', parts: [{ text: previewText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: chosenVoice } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'Failed to generate voice preview.' });
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      voiceName: chosenVoice,
    });
  } catch (err: any) {
    res.status(500).json({ error: formatErrorMessage(err) });
  }
});

// Set up WebSocket bridge for real-time Gemini Live API (gemini-3.8-live)
function setupLiveWebSocketServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: any = null;
    let isAuthenticated = false;
    let activeChatId = '';

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'init') {
          const authUser = await verifyToken(msg.token);
          if (!authUser) {
            clientWs.send(JSON.stringify({ type: 'error', error: 'Authentication failed. Please sign in again.' }));
            return clientWs.close(4001, 'Unauthorized');
          }

          isAuthenticated = true;
          activeChatId = msg.chatId || '';

          const ai = getGenAIClient();
          const allowedVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];
          const voiceName = allowedVoices.includes(msg.voiceName) ? msg.voiceName : 'Zephyr';

          const now = new Date();
          const currentYear = now.getUTCFullYear();
          const currentDateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          });
          const currentTimeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          });

          let systemPrompt =
            'You are Zuxrash, an intelligent, futuristic, warm voice companion. ' +
            'You are speaking in a natural real-time voice conversation. ' +
            'Keep your responses spoken, natural, concise, and conversational (usually 1-3 sentences). ' +
            'Avoid reciting large codeblocks, markdown tables, or raw URLs out loud unless asked. ' +
            `Current runtime: ${currentDateString}, ${currentTimeString} UTC. Current calendar year: ${currentYear}.`;

          if (msg.systemInstruction) {
            systemPrompt += `\nAdditional user guidelines: ${msg.systemInstruction}`;
          }

          if (Array.isArray(msg.memories) && msg.memories.length > 0) {
            const memoryContext = msg.memories.map((m: any) => `- ${m.content}`).join('\n');
            systemPrompt += `\nUser's permanent memory preferences:\n${memoryContext}`;
          }

          if (Array.isArray(msg.recentMessages) && msg.recentMessages.length > 0) {
            const historyText = msg.recentMessages
              .filter((m: any) => m && m.content)
              .slice(-8)
              .map((m: any) => `${m.role === 'user' ? 'User' : 'Zuxrash'}: ${m.content}`)
              .join('\n');
            if (historyText) {
              systemPrompt += `\n\nRecent context from this active conversation:\n${historyText}\n(Continue conversation seamlessly from here without repeating previous greetings)`;
            }
          }

          const liveConfig: any = {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
            },
            systemInstruction: systemPrompt,
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          };

          if (msg.webSearch) {
            liveConfig.tools = [{ googleSearch: {} }];
          }

          try {
            liveSession = await ai.live.connect({
              model: 'gemini-3.8-live',
              config: liveConfig,
              callbacks: {
                onmessage: (liveMsg) => {
                  if (clientWs.readyState !== WebSocket.OPEN) return;

                  // 24kHz raw PCM Audio chunk
                  const audioPart = liveMsg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                  if (audioPart) {
                    clientWs.send(JSON.stringify({
                      type: 'audio',
                      data: audioPart,
                      mimeType: 'audio/pcm;rate=24000',
                    }));
                  }

                  // Output transcription (Zuxrash spoken text)
                  const outputText = liveMsg.serverContent?.outputTranscription?.text;
                  if (outputText) {
                    clientWs.send(JSON.stringify({
                      type: 'output_transcription',
                      text: outputText,
                    }));
                  }

                  // Input transcription (User spoken text)
                  const inputText = liveMsg.serverContent?.inputTranscription?.text;
                  if (inputText) {
                    clientWs.send(JSON.stringify({
                      type: 'input_transcription',
                      text: inputText,
                    }));
                  }

                  // Interrupted
                  if (liveMsg.serverContent?.interrupted) {
                    clientWs.send(JSON.stringify({ type: 'interrupted' }));
                  }

                  // Turn complete
                  if (liveMsg.serverContent?.turnComplete) {
                    clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                  }
                },
                onclose: (closeEvt) => {
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'session_closed', reason: closeEvt?.reason }));
                  }
                },
                onerror: (err) => {
                  console.error('Gemini Live session error:', err);
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: 'error',
                      error: formatErrorMessage(err) || 'Voice session encountered an error.',
                    }));
                  }
                },
              },
            });

            clientWs.send(JSON.stringify({
              type: 'ready',
              chatId: activeChatId,
              voiceName,
            }));
          } catch (sessionErr: any) {
            console.error('Failed to establish Live session:', sessionErr);
            clientWs.send(JSON.stringify({
              type: 'error',
              error: formatErrorMessage(sessionErr) || 'Could not connect to Gemini Live service.',
            }));
            clientWs.close(4002, 'Live connect failed');
          }
          return;
        }

        if (!isAuthenticated || !liveSession) {
          return;
        }

        if (msg.type === 'interrupt') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'text' && msg.text) {
          if (typeof liveSession.sendClientContent === 'function') {
            liveSession.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true,
            });
          } else {
            liveSession.sendRealtimeInput({
              text: msg.text,
            });
          }
        }
      } catch (err: any) {
        console.error('WebSocket message handling error:', err);
      }
    });

    clientWs.on('close', () => {
      if (liveSession) {
        try {
          liveSession.close().catch(() => {});
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });

    clientWs.on('error', (err) => {
      console.warn('Client WebSocket error:', err.message);
      if (liveSession) {
        try {
          liveSession.close().catch(() => {});
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });
  });
}

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  setupLiveWebSocketServer(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Zuxrash] Server listening on port ${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
