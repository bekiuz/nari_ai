import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Image as ImageIcon,
  Paperclip,
  X,
  Mic,
  MicOff,
  Square,
  FileText,
  FileCode,
  FileSpreadsheet,
  Globe,
  Loader2,
} from 'lucide-react';
import { Attachment } from '../types/chat';
import { getAuthToken } from '../services/authService';

interface ChatInputProps {
  onSendMessage: (text: string, attachments: Attachment[], webSearch?: boolean) => void;
  isLoading: boolean;
  onStopGeneration?: () => void;
  initialAttachments?: Attachment[];
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  onOpenVoiceMode?: () => void;
  isVoiceSessionActive?: boolean;
  onStopVoiceMode?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  onStopGeneration,
  initialAttachments = [],
  webSearchEnabled = false,
  onToggleWebSearch,
  onOpenVoiceMode,
  isVoiceSessionActive = false,
  onStopVoiceMode,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isListening, setIsListening] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [localWebSearch, setLocalWebSearch] = useState(webSearchEnabled);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync with prop
  useEffect(() => {
    setLocalWebSearch(webSearchEnabled);
  }, [webSearchEnabled]);

  // Synchronize initial attachments if provided
  useEffect(() => {
    if (initialAttachments.length > 0) {
      setAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newOnes = initialAttachments.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newOnes];
      });
    }
  }, [initialAttachments]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [text]);

  // Setup Web Speech Recognition for voice dictation
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleToggleWeb = () => {
    if (onToggleWebSearch) {
      onToggleWebSearch();
    } else {
      setLocalWebSearch((prev) => !prev);
    }
  };

  const isWebSearchActive = onToggleWebSearch ? webSearchEnabled : localWebSearch;

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading || isProcessingFile) return;
    onSendMessage(text.trim(), attachments, isWebSearchActive);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            type: 'image',
            mimeType: file.type || 'image/png',
            size: file.size,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isPdf = ext === 'pdf' || file.type.includes('pdf');
        const isDocx = ext === 'docx' || file.type.includes('wordprocessingml');

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        let textPreview = '';

        if (isDocx || isPdf) {
          try {
            const token = await getAuthToken();
            const base64 = dataUrl.split(',')[1] || dataUrl;
            const res = await fetch('/api/files/extract', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                fileName: file.name,
                mimeType: file.type,
                fileDataBase64: base64,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              textPreview = data.text || '';
            }
          } catch (err) {
            console.warn('Document text extract notice:', err);
          }
        } else {
          textPreview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsText(file);
          });
        }

        setAttachments((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            type: 'file',
            mimeType: file.type || 'text/plain',
            size: file.size,
            dataUrl: isPdf ? dataUrl : undefined,
            textPreview: textPreview || undefined,
          },
        ]);
      } catch (err) {
        console.error('Error processing attachment:', err);
      }
    }

    setIsProcessingFile(false);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  function getAttachmentIcon(name: string, mimeType: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || mimeType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-rose-400" />;
    }
    if (ext === 'csv' || mimeType.includes('csv') || ext === 'tsv') {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    return <FileCode className="w-4 h-4 text-pink-400" />;
  }

  return (
    <div className="p-3 md:p-5 bg-gradient-to-t from-[#06040b] via-[#06040b]/95 to-transparent shrink-0">
      <div className="max-w-4xl mx-auto w-full">
        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-[#130b20] border border-[#2b1945] text-xs text-slate-200 shadow-sm group"
              >
                {att.type === 'image' && att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-7 h-7 rounded-lg object-cover border border-purple-800/50"
                  />
                ) : (
                  getAttachmentIcon(att.name, att.mimeType)
                )}
                <div className="flex flex-col min-w-0 max-w-[140px]">
                  <span className="truncate font-mono text-[11px] text-white">{att.name}</span>
                  <span className="text-[9px] text-slate-400">
                    {(att.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer ml-1"
                  aria-label={`Remove attachment ${att.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Processing file indicator */}
        {isProcessingFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 text-xs text-pink-300 bg-[#160d28] rounded-xl border border-purple-800/40 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
            <span>Extracting readable text & parsing file content...</span>
          </div>
        )}

        {/* Floating Glass Input Panel */}
        <div
          className={`rounded-2xl p-2.5 md:p-3 flex flex-col gap-2 transition-all duration-200 bg-[#0e0a1a]/90 backdrop-blur-xl border ${
            isWebSearchActive
              ? 'border-pink-500/35 shadow-lg shadow-pink-500/10'
              : 'border-[#221639] focus-within:border-purple-600/50 shadow-md'
          }`}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Listening to speech... Speak clearly'
                : isWebSearchActive
                ? 'Ask Nari AI with live Google Web Search enabled...'
                : 'Ask Nari AI anything, or analyze files and images...'
            }
            className="w-full bg-transparent px-2.5 py-1 text-sm md:text-[15px] text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed min-h-[40px] max-h-[180px]"
            aria-label="Message prompt"
          />

          {/* Bottom controls bar */}
          <div className="flex items-center justify-between pt-1 border-t border-[#1c122e]">
            {/* Attachment & Capability Tools */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Web Search Toggle Button */}
              <button
                type="button"
                onClick={handleToggleWeb}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  isWebSearchActive
                    ? 'bg-[#220d33] text-pink-300 border-pink-500/50 shadow-sm'
                    : 'bg-[#120a1f] text-slate-400 border-[#221438] hover:text-slate-200 hover:bg-[#190e2b]'
                }`}
                title={
                  isWebSearchActive
                    ? 'Web Search is ON (Google Grounding)'
                    : 'Turn Web Search ON for live web results'
                }
                aria-pressed={isWebSearchActive}
              >
                <Globe
                  className={`w-3.5 h-3.5 ${
                    isWebSearchActive ? 'text-pink-400 animate-pulse' : 'text-slate-400'
                  }`}
                />
                <span>Web Search</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                    isWebSearchActive
                      ? 'bg-pink-500/25 text-pink-300 border border-pink-500/30'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {isWebSearchActive ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Attach Image */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-2 rounded-xl text-slate-400 hover:text-pink-300 hover:bg-purple-950/40 transition-colors cursor-pointer"
                title="Attach images for vision analysis"
                aria-label="Upload image"
              >
                <ImageIcon className="w-4 h-4 md:w-4.5 md:h-4.5" />
              </button>

              {/* Attach Document/File */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.csv,.json,.md,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.yaml,.yml"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl text-slate-400 hover:text-pink-300 hover:bg-purple-950/40 transition-colors cursor-pointer"
                title="Attach PDF, DOCX, CSV, JSON, code or documents"
                aria-label="Upload document"
              >
                <Paperclip className="w-4 h-4 md:w-4.5 md:h-4.5" />
              </button>

              {/* Real-time Voice Chat Mode button in tool row */}
              {onOpenVoiceMode && (
                <button
                  type="button"
                  onClick={onOpenVoiceMode}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    isVoiceSessionActive
                      ? 'bg-pink-500/25 text-pink-300 border-pink-500/60 shadow-sm animate-pulse'
                      : 'bg-[#120a1f] text-slate-300 border-[#221438] hover:text-pink-300 hover:bg-[#1c0f30] hover:border-purple-600/40'
                  }`}
                  title={isVoiceSessionActive ? 'Gemini Live Voice Active (Click to open)' : 'Start Gemini Live Voice Mode'}
                  aria-label="Start Voice Mode"
                >
                  <Mic className="w-3.5 h-3.5 text-pink-400" />
                  <span className="hidden sm:inline">Voice Mode</span>
                  {isVoiceSessionActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                  )}
                </button>
              )}

              {/* Voice dictation fallback to text input */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isListening
                    ? 'text-rose-400 bg-rose-950/60 border border-rose-600/50 animate-pulse'
                    : 'text-slate-400 hover:text-pink-300 hover:bg-purple-950/40'
                }`}
                title={isListening ? 'Stop recording dictation' : 'Speech-to-text dictation into prompt'}
                aria-label={isListening ? 'Stop speech dictation' : 'Start speech dictation'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 text-rose-400" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Right controls: Voice Mode trigger, Stop Voice, and Send/Stop buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">
                Shift + Enter for newline
              </span>

              {/* Dedicated microphone / voice control button beside send */}
              {isVoiceSessionActive ? (
                <button
                  type="button"
                  onClick={onStopVoiceMode || onOpenVoiceMode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-xs font-semibold shadow-md shadow-rose-900/30 animate-pulse transition-all cursor-pointer"
                  title="Stop real-time voice session"
                  aria-label="Stop Voice Mode"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                  <span>Stop Voice</span>
                </button>
              ) : (
                onOpenVoiceMode && (
                  <button
                    type="button"
                    onClick={onOpenVoiceMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-950/50 to-pink-950/50 hover:from-purple-900/70 hover:to-pink-900/70 text-pink-300 hover:text-white border border-pink-500/40 hover:border-pink-500/70 text-xs font-semibold shadow-sm shadow-pink-500/10 hover:shadow-pink-500/20 transition-all cursor-pointer group"
                    title="Start Real-time Voice Chat (Gemini Live)"
                    aria-label="Start Voice Mode"
                  >
                    <Mic className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Voice Mode</span>
                  </button>
                )
              )}

              {/* Send / Stop button */}
              {isLoading ? (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#221020] hover:bg-[#30142c] text-rose-300 border border-rose-900/40 text-xs font-medium cursor-pointer transition-all"
                  title="Stop generation"
                  aria-label="Stop AI generation"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!text.trim() && attachments.length === 0) || isProcessingFile}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:via-pink-500 hover:to-rose-500 disabled:opacity-30 disabled:pointer-events-none text-white text-xs font-semibold shadow-md shadow-pink-600/15 hover:shadow-pink-500/25 transition-all cursor-pointer"
                  aria-label="Send message"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
