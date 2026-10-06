import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Sparkles,
  AlertCircle,
  Globe,
  Radio,
  ChevronDown,
  RotateCcw,
  Square,
  MessageSquare,
} from 'lucide-react';
import { NariLogo } from './NariLogo';
import { GeminiVoiceName, Memory, Conversation } from '../types/chat';
import { liveVoiceService, LiveVoiceState } from '../services/liveVoiceService';

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChat: Conversation | null;
  authToken: string | null;
  defaultVoice?: GeminiVoiceName;
  webSearchEnabled?: boolean;
  systemInstruction?: string;
  memories?: Memory[];
  onPersistVoiceTurn: (userText: string, modelText: string) => Promise<void>;
}

const SUPPORTED_VOICES: Array<{ id: GeminiVoiceName; label: string; desc: string }> = [
  { id: 'Zephyr', label: 'Zephyr', desc: 'Balanced, futuristic & intelligent (Default)' },
  { id: 'Puck', label: 'Puck', desc: 'Energetic, engaging & upbeat' },
  { id: 'Charon', label: 'Charon', desc: 'Deep, calm & authoritative' },
  { id: 'Kore', label: 'Kore', desc: 'Smooth, warm & conversational' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Crisp, grounded & articulate' },
];

export const VoiceModeModal: React.FC<VoiceModeModalProps> = ({
  isOpen,
  onClose,
  activeChat,
  authToken,
  defaultVoice = 'Zephyr',
  webSearchEnabled = false,
  systemInstruction,
  memories = [],
  onPersistVoiceTurn,
}) => {
  const [state, setState] = useState<LiveVoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceName>(defaultVoice);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [liveUserText, setLiveUserText] = useState('');
  const [liveModelText, setLiveModelText] = useState('');
  const [recentTurns, setRecentTurns] = useState<Array<{ role: 'user' | 'model'; text: string }>>([]);

  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live transcript
  useEffect(() => {
    transcriptScrollRef.current?.scrollTo({
      top: transcriptScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [liveUserText, liveModelText, recentTurns]);

  // Connect / disconnect on modal open/close
  useEffect(() => {
    if (!isOpen) {
      liveVoiceService.stopSession();
      setState('idle');
      setRecentTurns([]);
      setLiveUserText('');
      setLiveModelText('');
      setErrorMessage(null);
      return;
    }

    if (!authToken || !activeChat) {
      setErrorMessage('Please ensure you are signed in and have an active conversation.');
      return;
    }

    setErrorMessage(null);
    liveVoiceService.setCallbacks({
      onStateChange: (s) => setState(s),
      onVolumeChange: (v) => setVolume(v),
      onError: (err) => setErrorMessage(err),
      onTranscriptUpdate: ({ user, model }) => {
        setLiveUserText(user);
        setLiveModelText(model);
      },
      onTurnComplete: async ({ user, model }) => {
        if (user || model) {
          setRecentTurns((prev) => [
            ...prev.slice(-6),
            ...(user ? [{ role: 'user' as const, text: user }] : []),
            ...(model ? [{ role: 'model' as const, text: model }] : []),
          ]);
          setLiveUserText('');
          setLiveModelText('');

          // Persist turn to active Firestore chat
          try {
            await onPersistVoiceTurn(user, model);
          } catch (persistErr) {
            console.error('Failed to persist voice turn to chat:', persistErr);
          }
        }
      },
    });

    startSession(selectedVoice);

    return () => {
      liveVoiceService.stopSession();
    };
  }, [isOpen, activeChat?.id]);

  const startSession = (voice: GeminiVoiceName) => {
    if (!authToken || !activeChat) return;
    setErrorMessage(null);
    liveVoiceService.startSession({
      token: authToken,
      chatId: activeChat.id,
      voiceName: voice,
      systemInstruction,
      memories,
      recentMessages: activeChat.messages
        .filter((m) => m && m.content)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content })),
      webSearch: webSearchEnabled,
    });
  };

  const handleToggleMute = () => {
    const muted = liveVoiceService.toggleMute();
    setIsMuted(muted);
  };

  const handleInterrupt = () => {
    liveVoiceService.interrupt();
    setLiveModelText('');
  };

  const handleSwitchVoice = (voice: GeminiVoiceName) => {
    setSelectedVoice(voice);
    setShowVoiceMenu(false);
    startSession(voice);
  };

  const handleEndSession = () => {
    liveVoiceService.stopSession();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col zuxrash-shell bg-[#050308]/95 backdrop-blur-2xl text-white overflow-hidden select-none animate-in fade-in duration-200">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px] transition-all duration-700 ${
            state === 'speaking'
              ? 'w-[480px] h-[480px] bg-pink-600/20'
              : state === 'listening'
              ? 'w-[420px] h-[420px] bg-purple-600/18'
              : 'w-[360px] h-[360px] bg-violet-900/15'
          }`}
          style={{
            transform: `translate(-50%, -50%) scale(${1 + volume * 0.4})`,
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-purple-900/20 bg-[#08050e]/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <NariLogo size={28} />
            <span className="font-semibold text-sm tracking-tight text-white">Zuxrash Voice</span>
          </div>
          <div className="h-4 w-px bg-purple-800/40 hidden sm:block" />
          <span className="text-xs text-slate-400 font-mono truncate max-w-[180px] sm:max-w-xs hidden sm:inline">
            {activeChat?.title || 'Active Chat'}
          </span>
        </div>

        {/* Status badges & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Web Search indicator */}
          {webSearchEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/25 text-pink-300 text-[11px] font-mono">
              <Globe className="w-3 h-3 text-pink-400" />
              <span className="hidden sm:inline">Google Search Grounded</span>
              <span className="sm:hidden">Web</span>
            </div>
          )}

          {/* Voice Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowVoiceMenu(!showVoiceMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#140b22] hover:bg-[#1c0f30] border border-purple-800/40 text-xs text-slate-200 transition-colors cursor-pointer"
              title="Change Voice"
            >
              <Volume2 className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-medium">{selectedVoice}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showVoiceMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f091a] border border-[#2b1744] shadow-2xl p-2 z-30">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-2 py-1">
                  Gemini Official Voices
                </div>
                {SUPPORTED_VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSwitchVoice(v.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex flex-col gap-0.5 transition-colors cursor-pointer ${
                      selectedVoice === v.id
                        ? 'bg-purple-900/40 text-pink-300 border border-pink-500/30 font-medium'
                        : 'text-slate-300 hover:bg-[#1a0e2d]'
                    }`}
                  >
                    <span className="font-semibold">{v.label}</span>
                    <span className="text-[10px] text-slate-400">{v.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Return to Chat Button */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors cursor-pointer"
            title="Return to text conversation"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Text Chat</span>
          </button>
        </div>
      </header>

      {/* Main Voice Centerpiece */}
      <main className="flex-1 flex flex-col items-center justify-between p-4 sm:p-8 max-w-4xl mx-auto w-full relative z-10 overflow-hidden">
        {/* State Indicator Badge */}
        <div className="pt-2">
          {state === 'speaking' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
              <span>Zuxrash is speaking</span>
            </div>
          )}

          {state === 'listening' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium">
              <span
                className="w-2 h-2 rounded-full bg-purple-400 transition-all duration-100"
                style={{ transform: `scale(${1 + volume * 2})` }}
              />
              <span>{isMuted ? 'Microphone Muted' : 'Listening for your voice...'}</span>
            </div>
          )}

          {state === 'thinking' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <Radio className="w-3.5 h-3.5 animate-spin" />
              <span>Synthesizing response...</span>
            </div>
          )}

          {state === 'connecting' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700 text-slate-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              <span>Connecting to Gemini Live...</span>
            </div>
          )}

          {state === 'requesting_mic' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-mono">
              <Mic className="w-3.5 h-3.5 animate-bounce" />
              <span>Requesting microphone permissions...</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs max-w-md text-center">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{errorMessage}</span>
              <button
                onClick={() => startSession(selectedVoice)}
                className="p-1 hover:text-white rounded transition-colors"
                title="Retry session"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Glowing Responsive Zuxrash Logo */}
        <div className="relative my-auto flex items-center justify-center py-6">
          {/* Dynamic Audio Waves Ring */}
          <div
            className={`absolute rounded-full transition-all duration-200 pointer-events-none ${
              state === 'speaking'
                ? 'border border-pink-500/40 bg-pink-500/5 animate-pulse'
                : state === 'listening' && !isMuted
                ? 'border border-purple-500/30 bg-purple-500/5'
                : 'border border-purple-900/20'
            }`}
            style={{
              width: 170 + volume * 100,
              height: 170 + volume * 100,
            }}
          />

          <div
            className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
              state === 'speaking'
                ? 'border border-pink-400/20'
                : 'border border-purple-700/15'
            }`}
            style={{
              width: 220 + volume * 140,
              height: 220 + volume * 140,
            }}
          />

          {/* Logo container */}
          <div
            className={`relative rounded-3xl p-5 sm:p-6 transition-all duration-500 ${
              state === 'speaking'
                ? 'shadow-2xl shadow-pink-500/30 ring-2 ring-pink-500/50 scale-105'
                : state === 'listening'
                ? 'shadow-xl shadow-purple-600/20 ring-1 ring-purple-500/40'
                : 'shadow-md ring-1 ring-purple-900/30'
            } bg-[#0c0716]/90 backdrop-blur-xl`}
          >
            <NariLogo size={90} withGlow={state === 'speaking' || state === 'listening'} />
          </div>
        </div>

        {/* Live Conversation Transcript Stream */}
        <div className="w-full max-w-xl mx-auto flex flex-col gap-2 mb-4">
          <div
            ref={transcriptScrollRef}
            className="h-32 sm:h-36 overflow-y-auto px-4 py-3 rounded-2xl bg-[#0c0716]/80 border border-purple-900/30 text-xs space-y-2.5 backdrop-blur-md"
          >
            {recentTurns.length === 0 && !liveUserText && !liveModelText && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center space-y-1">
                <Sparkles className="w-4 h-4 text-purple-400/60" />
                <p>Speak naturally. Zuxrash is listening in real time.</p>
                <p className="text-[10px] text-slate-600">You can interrupt anytime by speaking.</p>
              </div>
            )}

            {recentTurns.map((turn, i) => (
              <div
                key={i}
                className={`flex gap-2 ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-1.5 rounded-xl max-w-[85%] leading-relaxed ${
                    turn.role === 'user'
                      ? 'bg-purple-900/30 text-slate-200 border border-purple-800/30'
                      : 'bg-[#150d26] text-pink-100 border border-[#271542]'
                  }`}
                >
                  <span className="text-[9px] font-mono uppercase tracking-wider block mb-0.5 opacity-60">
                    {turn.role === 'user' ? 'You' : 'Nari'}
                  </span>
                  {turn.text}
                </div>
              </div>
            ))}

            {/* In-progress User Spoken Text */}
            {liveUserText && (
              <div className="flex justify-end">
                <div className="px-3 py-1.5 rounded-xl max-w-[85%] bg-purple-900/40 text-white border border-purple-500/40 animate-pulse">
                  <span className="text-[9px] font-mono uppercase tracking-wider block mb-0.5 text-purple-300">
                    Listening to you...
                  </span>
                  {liveUserText}
                </div>
              </div>
            )}

            {/* In-progress Nari Spoken Text */}
            {liveModelText && (
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-xl max-w-[85%] bg-[#1a0f30] text-pink-200 border border-pink-500/40">
                  <span className="text-[9px] font-mono uppercase tracking-wider block mb-0.5 text-pink-400">
                    Zuxrash speaking...
                  </span>
                  {liveModelText}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Interactive Controls */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2 pb-4">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg ${
              isMuted
                ? 'bg-amber-600 text-white shadow-amber-600/30 hover:bg-amber-500'
                : 'bg-[#1a0f30] hover:bg-[#251545] text-slate-200 border border-purple-800/40 shadow-purple-950/40'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Interrupt Speaking Button (Visible when Zuxrash is speaking) */}
          {state === 'speaking' && (
            <button
              onClick={handleInterrupt}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-purple-950/80 hover:bg-purple-900 border border-purple-600/60 text-purple-200 flex items-center justify-center transition-all cursor-pointer shadow-lg animate-pulse"
              title="Stop Nari from speaking"
              aria-label="Interrupt speech"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          )}

          {/* End Call / Close Voice Session Button */}
          <button
            onClick={handleEndSession}
            className="px-6 sm:px-8 h-13 sm:h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2.5 font-medium text-sm transition-all cursor-pointer shadow-xl shadow-rose-900/40 active:scale-95"
            title="End voice conversation and return to chat"
            aria-label="End conversation"
          >
            <PhoneOff className="w-5 h-5" />
            <span>End Call</span>
          </button>
        </div>
      </main>
    </div>
  );
};
