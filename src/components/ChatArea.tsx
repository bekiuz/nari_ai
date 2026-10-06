import React, { useRef, useEffect, useState } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  FileCode,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  Code2,
  Eye,
  Terminal,
  Globe,
  X,
  Database,
  Square,
} from 'lucide-react';
import { Conversation, Message, Attachment, GroundingSource, GeminiVoiceName } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { NariLogo } from './NariLogo';
import { ttsService, TTSStatus } from '../services/ttsService';

interface ChatAreaProps {
  chat: Conversation | null;
  onSendMessage: (text: string, attachments: Attachment[], webSearch?: boolean) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  onRegenerateMessage?: (messageId: string, overrideWebSearch?: boolean) => void;
  onToggleMobileMenu: () => void;
  onRenameChat: (newTitle: string) => void;
  onClearMessages: () => void;
  onNewChat: () => void;
  currentModel: string;
  initialAttachments?: Attachment[];
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  onOpenVoiceMode?: () => void;
  isVoiceSessionActive?: boolean;
  onStopVoiceMode?: () => void;
  authToken?: string | null;
  voiceName?: GeminiVoiceName;
  voiceSpeed?: number;
  outputVolume?: number;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  onSendMessage,
  isLoading,
  onStopGeneration,
  onRegenerateMessage,
  onToggleMobileMenu,
  onRenameChat,
  onClearMessages,
  onNewChat,
  currentModel,
  initialAttachments,
  webSearchEnabled = false,
  onToggleWebSearch,
  onOpenVoiceMode,
  isVoiceSessionActive = false,
  onStopVoiceMode,
  authToken = null,
  voiceName = 'Zephyr',
  voiceSpeed = 1.0,
  outputVolume = 1.0,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<TTSStatus>({ messageId: null, state: 'idle' });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Attachment | null>(null);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Subscribe to TTS changes
  useEffect(() => {
    return ttsService.subscribeStatus((status) => {
      setTtsStatus(status);
    });
  }, []);

  // Auto-scroll on new message or stream updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages, isLoading]);

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleSpeak = (id: string, text: string) => {
    ttsService.speakMessage({
      messageId: id,
      text,
      voiceName,
      token: authToken,
      rate: voiceSpeed,
      volume: outputVolume,
    });
  };

  const handleStopSpeaking = () => {
    ttsService.stop();
  };

  const handleQuickPrompt = (promptText: string) => {
    onSendMessage(promptText, [], webSearchEnabled);
  };

  const getFileIcon = (name: string, mimeType: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (ext === 'csv' || mimeType?.includes('csv') || ext === 'tsv') {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (ext === 'docx' || mimeType?.includes('wordprocessingml')) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    return <FileCode className="w-4 h-4 text-pink-400" />;
  };

  const extractUniqueSources = (msg: Message): GroundingSource[] => {
    const list: GroundingSource[] = [];
    const seen = new Set<string>();

    if (msg.groundingMetadata?.groundingChunks) {
      msg.groundingMetadata.groundingChunks.forEach((c) => {
        const uri = c.web?.uri;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          list.push({
            title: c.web?.title || uri,
            url: uri,
          });
        }
      });
    }

    if (msg.groundingMetadata?.sources) {
      msg.groundingMetadata.sources.forEach((s) => {
        if (s.url && !seen.has(s.url)) {
          seen.add(s.url);
          list.push(s);
        }
      });
    }

    return list;
  };

  const messages = chat?.messages || [];
  const isEmptyChat = messages.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#06040b] relative overflow-hidden">
      {/* Subtle atmospheric backdrop lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[140px]" />
        <div className="absolute bottom-1/4 -left-20 w-[450px] h-[450px] rounded-full bg-pink-900/10 blur-[150px]" />
      </div>

      {/* Top Header */}
      <ChatHeader
        chat={chat}
        onToggleMobileMenu={onToggleMobileMenu}
        onRenameChat={onRenameChat}
        onClearMessages={onClearMessages}
        onNewChat={onNewChat}
        currentModel={currentModel}
      />

      {/* Chat Messages Viewport */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {isEmptyChat ? (
          /* Premium Zuxrash Welcome Screen */
          <div className="max-w-3xl mx-auto py-10 md:py-16 flex flex-col items-center text-center space-y-8 animate-fadeIn">
            {/* Minimalist Abstract Zuxrash Brand Mark */}
            <div className="relative group">
              <NariLogo size={72} withGlow />
            </div>

            {/* Title & Editorial Subtitle */}
            <div className="space-y-3 max-w-xl mx-auto">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                  Zuxrash
                </span>
                <span className="text-3xl md:text-4xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
                  AI
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-normal">
                Autonomous intelligence powered by Google Gemini 3.8 Flash. Live Google Search grounding, deep document comprehension, codebase analysis, and persistent memory.
              </p>
            </div>

            {/* Curated Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left pt-3">
              <div
                onClick={() =>
                  handleQuickPrompt(
                    'What are the latest scientific and technological breakthroughs this week? Provide verified facts with sources.'
                  )
                }
                className="group p-4 rounded-2xl bg-[#0d0918]/80 hover:bg-[#150f26] border border-[#211536] hover:border-pink-500/40 transition-all duration-200 cursor-pointer shadow-sm"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-[#180f2d] text-pink-400 border border-purple-800/30 group-hover:scale-105 transition-transform">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-pink-300 transition-colors">
                    Current Web Research
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Query real-time Google Search grounding for breaking technical developments and research.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickPrompt(
                    'Analyze the pros and cons of event-driven vs microkernel architecture in cloud-native applications with code examples.'
                  )
                }
                className="group p-4 rounded-2xl bg-[#0d0918]/80 hover:bg-[#150f26] border border-[#211536] hover:border-pink-500/40 transition-all duration-200 cursor-pointer shadow-sm"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-[#180f2d] text-pink-400 border border-purple-800/30 group-hover:scale-105 transition-transform">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-pink-300 transition-colors">
                    Software Architecture
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Evaluate microservices vs event-driven design patterns with concrete code snippets.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickPrompt(
                    'Provide a step-by-step checklist for optimizing React 19 rendering performance and eliminating component bottlenecks.'
                  )
                }
                className="group p-4 rounded-2xl bg-[#0d0918]/80 hover:bg-[#150f26] border border-[#211536] hover:border-pink-500/40 transition-all duration-200 cursor-pointer shadow-sm"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-[#180f2d] text-pink-400 border border-purple-800/30 group-hover:scale-105 transition-transform">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-pink-300 transition-colors">
                    React & Web Engineering
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Techniques for concurrency, suspense boundaries, memory safety, and DOM optimization.
                </p>
              </div>

              <div
                onClick={() =>
                  handleQuickPrompt(
                    'Write a complete Python script to load a CSV dataset, compute descriptive statistics, and output key insights.'
                  )
                }
                className="group p-4 rounded-2xl bg-[#0d0918]/80 hover:bg-[#150f26] border border-[#211536] hover:border-pink-500/40 transition-all duration-200 cursor-pointer shadow-sm"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 rounded-xl bg-[#180f2d] text-pink-400 border border-purple-800/30 group-hover:scale-105 transition-transform">
                    <Database className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-pink-300 transition-colors">
                    Data & CSV Analysis
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Inspect datasets, summarize distributions, calculate statistics, and identify anomalies.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isLastMessage = index === messages.length - 1;
              const sources = !isUser ? extractUniqueSources(msg) : [];
              const hasActualGrounding =
                !isUser &&
                Boolean(
                  msg.webSearchUsed &&
                    (sources.length > 0 ||
                      (msg.groundingMetadata?.webSearchQueries &&
                        msg.groundingMetadata.webSearchQueries.length > 0) ||
                      (msg.groundingMetadata?.groundingChunks &&
                        msg.groundingMetadata.groundingChunks.length > 0))
                );

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 md:gap-4 ${
                    isUser ? 'justify-end' : 'justify-start'
                  } group`}
                >
                  {/* AI Avatar on left: Minimalist Zuxrash Brand Emblem */}
                  {!isUser && (
                    <div className="shrink-0 mt-1">
                      <NariLogo size={30} />
                    </div>
                  )}

                  {/* Message Container */}
                  <div
                    className={`flex flex-col space-y-2 max-w-[94%] sm:max-w-[85%] ${
                      isUser ? 'items-end' : 'items-start w-full'
                    }`}
                  >
                    {/* Attached media inside message */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div
                        className={`flex flex-wrap gap-2 ${
                          isUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="rounded-xl overflow-hidden border border-[#2b1b46] bg-[#100a1d] shadow-sm cursor-pointer hover:border-pink-500/50 transition-all"
                            onClick={() => {
                              if (att.type === 'image' && att.dataUrl) {
                                setPreviewImage(att.dataUrl);
                              } else {
                                setPreviewDocument(att);
                              }
                            }}
                          >
                            {att.type === 'image' && att.dataUrl ? (
                              <div className="relative max-w-xs max-h-56 overflow-hidden group">
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200">
                                {getFileIcon(att.name, att.mimeType)}
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-white">{att.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {(att.size / 1024).toFixed(1)} KB · Click to inspect
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Web Search Grounded indicator */}
                    {!isUser && hasActualGrounding && (
                      <div className="flex items-center gap-1.5 text-xs text-pink-300 font-mono">
                        <Globe className="w-3.5 h-3.5 text-pink-400" />
                        <span>Google Search Grounded</span>
                      </div>
                    )}

                    {/* Message Body Container */}
                    <div
                      className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-[#18102a] text-slate-100 border border-[#341d52] shadow-sm'
                          : 'bg-[#0c0817]/90 text-slate-200 border border-[#1f1533] w-full shadow-sm'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      ) : (
                        <div>
                          <MarkdownRenderer content={msg.content} />

                          {/* Web Sources section */}
                          {sources.length > 0 && (
                            <div className="mt-4 pt-3.5 border-t border-[#1f1533] space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                                <div className="flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5 text-pink-400" />
                                  <span>Sources ({sources.length})</span>
                                </div>
                                {msg.groundingMetadata?.webSearchQueries && msg.groundingMetadata.webSearchQueries.length > 0 && (
                                  <span className="text-[10px] text-slate-400 font-mono truncate max-w-[240px] hidden sm:inline" title={msg.groundingMetadata.webSearchQueries.join(', ')}>
                                    Query: {msg.groundingMetadata.webSearchQueries[0]}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {sources.map((source, idx) => {
                                  let domain = source.url;
                                  try {
                                    domain = new URL(source.url).hostname.replace(/^www\./, '');
                                  } catch (_) {}

                                  return (
                                    <a
                                      key={idx}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#120b22] hover:bg-[#1a1030] border border-[#23173c] hover:border-pink-500/50 transition-all text-xs group"
                                      title={source.url}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-5 h-5 rounded-md bg-[#1d1235] flex items-center justify-center shrink-0 text-[10px] text-pink-300 font-mono font-bold border border-purple-800/40">
                                          {idx + 1}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-white group-hover:text-pink-300 transition-colors font-medium truncate text-xs">
                                            {source.title || domain}
                                          </span>
                                          <span className="text-[10px] text-slate-400 truncate font-mono">
                                            {domain}
                                          </span>
                                        </div>
                                      </div>
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-300 shrink-0" />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Error Banner */}
                    {msg.status === 'error' && (
                      <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs w-full shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="font-semibold text-rose-300">
                              {msg.error?.includes('Web Search') || msg.error?.includes('search quota')
                                ? 'Web Search Unavailable'
                                : 'Request Failed'}
                            </span>
                            <span className="text-slate-300 leading-relaxed break-words">
                              {msg.error || 'Failed to complete request.'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-900/30">
                          {onRegenerateMessage && (
                            <button
                              type="button"
                              onClick={() => onRegenerateMessage(msg.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-100 text-xs font-medium transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retry</span>
                            </button>
                          )}
                          {onRegenerateMessage &&
                            (msg.error?.includes('Web Search') || msg.error?.includes('search quota')) && (
                              <button
                                type="button"
                                onClick={() => onRegenerateMessage(msg.id, false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/50 text-purple-200 text-xs font-medium transition-colors cursor-pointer"
                                title="Turn off Web Search and ask Gemini using internal knowledge"
                              >
                                <Globe className="w-3.5 h-3.5 text-pink-400" />
                                <span>Turn Web Search OFF & Ask</span>
                              </button>
                            )}
                        </div>
                      </div>
                    )}

                    {/* Message Action Bar (Timestamp, Copy, Read Aloud, Regenerate) */}
                    <div
                      className={`flex items-center gap-2 text-[11px] text-slate-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isUser ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {/* Copy message */}
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 hover:text-slate-300 transition-colors cursor-pointer"
                        title="Copy message"
                        aria-label="Copy message text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Read Aloud button for AI responses with Play/Pause/Stop */}
                      {!isUser && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSpeak(msg.id, msg.content)}
                            className={`p-1 transition-colors cursor-pointer rounded ${
                              ttsStatus.messageId === msg.id && (ttsStatus.state === 'playing' || ttsStatus.state === 'loading')
                                ? 'text-pink-400 bg-pink-500/10'
                                : 'hover:text-slate-300'
                            }`}
                            title={
                              ttsStatus.messageId === msg.id && ttsStatus.state === 'playing'
                                ? 'Pause speech'
                                : ttsStatus.messageId === msg.id && ttsStatus.state === 'paused'
                                ? 'Resume speech'
                                : 'Read aloud with Gemini TTS'
                            }
                            aria-label="Read message aloud"
                          >
                            {ttsStatus.messageId === msg.id && ttsStatus.state === 'loading' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                            ) : ttsStatus.messageId === msg.id && ttsStatus.state === 'playing' ? (
                              <Pause className="w-3.5 h-3.5 text-pink-400" />
                            ) : ttsStatus.messageId === msg.id && ttsStatus.state === 'paused' ? (
                              <Play className="w-3.5 h-3.5 text-pink-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Stop button when this message is playing or paused */}
                          {ttsStatus.messageId === msg.id && (ttsStatus.state === 'playing' || ttsStatus.state === 'paused') && (
                            <button
                              onClick={handleStopSpeaking}
                              className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer rounded"
                              title="Stop speech"
                              aria-label="Stop speech"
                            >
                              <Square className="w-3 h-3 fill-current" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Regenerate for last AI message */}
                      {!isUser && isLastMessage && onRegenerateMessage && !isLoading && (
                        <button
                          onClick={() => onRegenerateMessage(msg.id)}
                          className="p-1 hover:text-pink-300 transition-colors cursor-pointer"
                          title="Regenerate response"
                          aria-label="Regenerate AI response"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* User Monogram on right */}
                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-[#22133b] border border-purple-800/40 flex items-center justify-center text-slate-300 text-xs font-semibold shrink-0 mt-1">
                      U
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pulsing Loading / Formulating Animation */}
            {isLoading && (
              <div className="flex gap-3 md:gap-4 justify-start">
                <div className="shrink-0 mt-1">
                  <NariLogo size={30} withGlow />
                </div>
                <div className="bg-[#0c0817] rounded-2xl rounded-tl-xs px-4 py-3 border border-[#1f1533] flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {webSearchEnabled ? (
                    <div className="flex items-center gap-1.5 text-xs text-pink-300 font-mono">
                      <Globe className="w-3.5 h-3.5 animate-spin text-pink-400" />
                      <span>Searching Google & retrieving verified sources...</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono">
                      Zuxrash AI is formulating response...
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Glass Input Composer */}
      <ChatInput
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        onStopGeneration={onStopGeneration}
        initialAttachments={initialAttachments}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={onToggleWebSearch}
        onOpenVoiceMode={onOpenVoiceMode}
        isVoiceSessionActive={isVoiceSessionActive}
        onStopVoiceMode={onStopVoiceMode}
      />

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-zoom-out"
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] rounded-xl border border-pink-500/40 object-contain shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Document Inspector Modal */}
      {previewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0b0816] max-w-2xl w-full max-h-[85vh] rounded-2xl flex flex-col border border-[#23173c] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#1e1434] bg-[#100a1f]">
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(previewDocument.name, previewDocument.mimeType)}
                <div className="flex flex-col min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {previewDocument.name}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {(previewDocument.size / 1024).toFixed(1)} KB · {previewDocument.mimeType}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (previewDocument.textPreview) {
                      await navigator.clipboard.writeText(previewDocument.textPreview);
                      setCopiedDoc(true);
                      setTimeout(() => setCopiedDoc(false), 2000);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/60 transition-colors cursor-pointer"
                  title="Copy text"
                  aria-label="Copy extracted document text"
                >
                  {copiedDoc ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setPreviewDocument(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/60 transition-colors cursor-pointer"
                  aria-label="Close document inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#07050e] text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-pink-500/30">
              {previewDocument.textPreview || 'No readable text content extracted for preview.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
