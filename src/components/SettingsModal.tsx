import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Cpu,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Trash2,
  Download,
  Brain,
  LogOut,
  User as UserIcon,
  Mic,
  Volume2,
  Play,
  Loader2,
  Radio,
  Globe,
} from 'lucide-react';
import { UserSettings, Conversation, UserProfile, GeminiVoiceName } from '../types/chat';
import { ttsService } from '../services/ttsService';

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onResetSettings: () => void;
  onClearAllChats: () => void;
  conversations: Conversation[];
  currentUser?: UserProfile | null;
  onNavigateToMemories?: () => void;
  onLogout?: () => void;
  authToken?: string | null;
}

const SUPPORTED_VOICES: Array<{ id: GeminiVoiceName; label: string; desc: string }> = [
  { id: 'Zephyr', label: 'Zephyr', desc: 'Balanced, futuristic & intelligent (Recommended for Zuxrash)' },
  { id: 'Puck', label: 'Puck', desc: 'Energetic, upbeat & engaging' },
  { id: 'Charon', label: 'Charon', desc: 'Deep, calm & authoritative' },
  { id: 'Kore', label: 'Kore', desc: 'Smooth, warm & conversational' },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Crisp, grounded & articulate' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClearAllChats,
  conversations,
  currentUser,
  onNavigateToMemories,
  onLogout,
  authToken,
}) => {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);

  const voiceSettings = settings.voiceSettings || {
    voiceChatEnabled: true,
    readAloudEnabled: true,
    voiceName: 'Zephyr',
    voiceSpeed: 1.0,
    outputVolume: 1.0,
    autoPlayResponses: false,
  };

  // Enumerate microphones if supported
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const mics = devices.filter((d) => d.kind === 'audioinput');
        setAvailableMics(mics);
      }).catch(() => {});
    }
  }, []);

  const handleUpdateVoice = (partial: Partial<typeof voiceSettings>) => {
    onUpdateSettings({
      voiceSettings: {
        ...voiceSettings,
        ...partial,
      },
    });
  };

  const handlePreviewVoice = async (vName: GeminiVoiceName) => {
    setPreviewingVoice(vName);
    try {
      await ttsService.previewVoice(vName, authToken);
    } finally {
      setPreviewingVoice(null);
    }
  };
  const handleExportData = () => {
    const exportPayload = {
      app: 'Zuxrash',
      exportedAt: new Date().toISOString(),
      user: currentUser?.email,
      settings,
      conversations,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zuxrash-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="border-b border-[#1f1433] pb-4">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">System & AI Settings</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Configure model intelligence, continuous memory, temperature dynamics, and system instructions for Zuxrash.
        </p>
      </div>

      {/* Account Info */}
      {currentUser && (
        <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#160e28] border border-purple-800/40 flex items-center justify-center text-pink-300 overflow-hidden shadow-sm">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  {currentUser.displayName || 'Authenticated User'}
                </h3>
                <span className="text-[11px] font-mono text-emerald-400">· Cloud Active</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to log out?')) {
                  onLogout();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-medium cursor-pointer transition-colors self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      )}

      {/* Long-Term Memory Section */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-pink-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Continuous Long-Term Memory</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically retain personal facts, tech stack preferences, and project contexts.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.memoryEnabled}
              onChange={(e) => onUpdateSettings({ memoryEnabled: e.target.checked })}
              className="sr-only peer"
              aria-label="Toggle Long-Term Memory"
            />
            <div className="w-11 h-6 bg-[#160e28] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
          </label>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-[#1a112c] text-xs">
          <span className="text-slate-400">
            {settings.memoryEnabled
              ? 'Memories are actively injected into Gemini 3.8 context.'
              : 'Memory injection is paused.'}
          </span>
          {onNavigateToMemories && (
            <button
              onClick={onNavigateToMemories}
              className="text-pink-400 hover:text-pink-300 font-medium cursor-pointer underline underline-offset-4"
            >
              Manage Stored Memories →
            </button>
          )}
        </div>
      </div>

      {/* Google Web Search Grounding Preference */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-pink-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Google Web Search Grounding</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enable live Google Web Search by default for real-time web citations and up-to-date facts.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.webSearchDefault}
              onChange={(e) => onUpdateSettings({ webSearchDefault: e.target.checked })}
              className="sr-only peer"
              aria-label="Toggle Default Web Search"
            />
            <div className="w-11 h-6 bg-[#160e28] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
          </label>
        </div>
        <p className="text-xs text-slate-400">
          {settings.webSearchDefault
            ? 'Web Search is ON by default for new conversations.'
            : 'Web Search is OFF by default (you can toggle it anytime in the composer).'}
        </p>
      </div>

      {/* Model Selection */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Gemini Intelligence Engine</h3>
          </div>
          <span className="text-xs font-mono text-emerald-400">· Cloud Verified</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Gemini 3.8 Flash */}
          <div
            onClick={() => onUpdateSettings({ model: 'gemini-3.8-flash' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              settings.model === 'gemini-3.8-flash'
                ? 'bg-[#180f2d] border-pink-500/60 shadow-sm'
                : 'bg-[#100a1d] border-[#22153a] hover:border-purple-700/50'
            }`}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-white text-sm">Gemini 3.8 Flash</span>
              <span className="text-[11px] font-mono text-pink-400">Flagship</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Flagship multimodal model. Advanced multimodal vision, code review, and logical precision.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Context: 1M</span>
              <span>·</span>
              <span>Vision: 8K</span>
            </div>
          </div>

          {/* Gemini 3.1 Flash Lite */}
          <div
            onClick={() => onUpdateSettings({ model: 'gemini-3.1-flash-lite' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              settings.model === 'gemini-3.1-flash-lite'
                ? 'bg-[#180f2d] border-pink-500/60 shadow-sm'
                : 'bg-[#100a1d] border-[#22153a] hover:border-purple-700/50'
            }`}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-white text-sm">3.1 Flash Lite</span>
              <span className="text-[11px] font-mono text-emerald-400">Fast & Stable</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ultra-low latency engine. Instant responses, high availability, and rapid execution.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Latency: ~200ms</span>
              <span>·</span>
              <span>Always-On</span>
            </div>
          </div>

          {/* Gemini 3.1 Pro */}
          <div
            onClick={() => onUpdateSettings({ model: 'gemini-3.1-pro-preview' })}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              settings.model === 'gemini-3.1-pro-preview'
                ? 'bg-[#180f2d] border-pink-500/60 shadow-sm'
                : 'bg-[#100a1d] border-[#22153a] hover:border-purple-700/50'
            }`}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-white text-sm">Gemini 3.1 Pro</span>
              <span className="text-[11px] font-mono text-purple-400">Deep Reason</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Specialized for intricate algorithms, architectural evaluations, complex STEM derivations, and deep analysis.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Context: 2M</span>
              <span>·</span>
              <span>Deep STEM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Temperature & Creativity Slider */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Temperature & Creativity</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lower values yield deterministic, precise code; higher values encourage imaginative synthesis.
            </p>
          </div>
          <span className="text-sm font-mono font-medium text-pink-400 px-2.5 py-0.5 rounded-lg bg-[#180e2b] border border-pink-500/25">
            {settings.temperature.toFixed(2)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          value={settings.temperature}
          onChange={(e) => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-pink-500 cursor-pointer h-1.5 bg-[#170e28] rounded-lg appearance-none"
          aria-label="Temperature slider"
        />

        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
          <span>0.0 (Strict)</span>
          <span>0.7 (Balanced)</span>
          <span>1.5 (Creative)</span>
        </div>
      </div>

      {/* System Prompt Customization */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">System Persona & Directives</h3>
          </div>
          <button
            onClick={() =>
              onUpdateSettings({
                systemPrompt:
                  'You are Zuxrash, an advanced, highly intelligent futuristic AI assistant. ' +
                  'Provide articulate, accurate, elegant responses. Format code with language specifiers. ' +
                  'Be observant and insightful with images and uploaded files.',
              })
            }
            className="text-xs text-slate-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Default
          </button>
        </div>

        <textarea
          rows={4}
          value={settings.systemPrompt}
          onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
          className="w-full p-3.5 bg-[#080511] border border-[#22153a] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500/50 leading-relaxed font-mono resize-none"
          placeholder="Enter system prompt for Zuxrash..."
          aria-label="System prompt textarea"
        />
        <p className="text-[11px] text-slate-500">
          This instruction steers Zuxrash’s tone, demeanor, reasoning method, and code conventions across all chats.
        </p>
      </div>

      {/* Voice & Audio Intelligence Section */}
      <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Mic className="w-5 h-5 text-pink-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Voice & Speech Intelligence</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official Gemini Live API (gemini-3.8-live) and Gemini Text-To-Speech (gemini-3.8-flash-tts).
              </p>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Live Voice Chat Toggle */}
          <div className="p-3.5 rounded-xl bg-[#100a1d] border border-[#22153a] flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-white block">Real-Time Voice Mode</span>
              <span className="text-[11px] text-slate-400">Low-latency live conversational audio</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={voiceSettings.voiceChatEnabled}
              onClick={() => handleUpdateVoice({ voiceChatEnabled: !voiceSettings.voiceChatEnabled })}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                voiceSettings.voiceChatEnabled ? 'bg-pink-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  voiceSettings.voiceChatEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Read Aloud Toggle */}
          <div className="p-3.5 rounded-xl bg-[#100a1d] border border-[#22153a] flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-white block">Gemini Read Aloud</span>
              <span className="text-[11px] text-slate-400">Natural voice synthesis for AI messages</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={voiceSettings.readAloudEnabled}
              onClick={() => handleUpdateVoice({ readAloudEnabled: !voiceSettings.readAloudEnabled })}
              className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                voiceSettings.readAloudEnabled ? 'bg-pink-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  voiceSettings.readAloudEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Gemini Official Voice Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 block">
            Default Gemini Voice Persona
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {SUPPORTED_VOICES.map((v) => {
              const isSelected = voiceSettings.voiceName === v.id;
              const isPreviewing = previewingVoice === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => handleUpdateVoice({ voiceName: v.id })}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#1b0f33] border-pink-500/60 shadow-sm'
                      : 'bg-[#100a1d] border-[#22153a] hover:border-purple-700/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white text-xs">{v.label}</span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-pink-400 font-bold">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{v.desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewVoice(v.id);
                    }}
                    disabled={isPreviewing}
                    className="self-start flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-pink-300 transition-colors cursor-pointer"
                  >
                    {isPreviewing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                    <span>Preview Voice</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Speed & Volume Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Voice Speed Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Speech Rate</span>
              <span className="font-mono text-pink-400">{voiceSettings.voiceSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={voiceSettings.voiceSpeed}
              onChange={(e) => handleUpdateVoice({ voiceSpeed: parseFloat(e.target.value) })}
              className="w-full accent-pink-500 cursor-pointer h-1.5 bg-[#170e28] rounded-lg appearance-none"
              aria-label="Speech rate slider"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.75x (Relaxed)</span>
              <span>1.0x (Normal)</span>
              <span>1.5x (Brisk)</span>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Playback Volume</span>
              <span className="font-mono text-pink-400">
                {Math.round(voiceSettings.outputVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceSettings.outputVolume}
              onChange={(e) => handleUpdateVoice({ outputVolume: parseFloat(e.target.value) })}
              className="w-full accent-pink-500 cursor-pointer h-1.5 bg-[#170e28] rounded-lg appearance-none"
              aria-label="Volume slider"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Mute</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Microphone Device Selector */}
        {availableMics.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-slate-300 block">
              Audio Input Device (Microphone)
            </label>
            <select
              value={voiceSettings.selectedMicDeviceId || ''}
              onChange={(e) => handleUpdateVoice({ selectedMicDeviceId: e.target.value })}
              className="w-full p-2.5 bg-[#0e081c] border border-[#22153a] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-pink-500/50 cursor-pointer font-mono"
            >
              <option value="">Default System Microphone</option>
              {availableMics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Auto-play Responses */}
        <div className="p-3.5 rounded-xl bg-[#100a1d] border border-[#22153a] flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-white block">Auto-Play Incoming Responses</span>
            <span className="text-[11px] text-slate-400">
              Automatically narrate assistant responses out loud in text chat
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={voiceSettings.autoPlayResponses}
            onClick={() => handleUpdateVoice({ autoPlayResponses: !voiceSettings.autoPlayResponses })}
            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
              voiceSettings.autoPlayResponses ? 'bg-pink-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                voiceSettings.autoPlayResponses ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Security & Cloud Isolation Notice */}
      <div className="p-4 rounded-xl bg-[#100a1f] border border-[#23173d] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-slate-200">Cloud Isolation & Protected Endpoints</div>
          <p className="text-slate-400 leading-relaxed">
            All database collections (chats, messages, memories, files) are strictly segmented by your authenticated user ID. All Gemini API requests are validated via Bearer tokens on the server.
          </p>
        </div>
      </div>

      {/* Danger & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#1f1533]">
        <button
          onClick={handleExportData}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#130b22] hover:bg-[#1a1030] border border-[#25173e] text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-pink-400" />
          Export All Cloud Data (.json)
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onResetSettings}
            className="px-3 py-1.5 rounded-xl bg-[#120a1f] hover:bg-[#190e2b] border border-[#221438] text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Reset Settings
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all cloud conversations in your account? This action cannot be reversed.')) {
                onClearAllChats();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-xs font-medium text-rose-300 hover:text-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Chats
          </button>
        </div>
      </div>
    </div>
  );
};
