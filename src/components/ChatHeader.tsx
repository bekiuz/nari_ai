import React, { useState } from 'react';
import {
  Menu,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { Conversation } from '../types/chat';
import { NariLogo } from './NariLogo';

interface ChatHeaderProps {
  chat: Conversation | null;
  onToggleMobileMenu: () => void;
  onRenameChat: (newTitle: string) => void;
  onClearMessages: () => void;
  onNewChat: () => void;
  currentModel: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  chat,
  onToggleMobileMenu,
  onRenameChat,
  onClearMessages,
  onNewChat,
  currentModel,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(chat?.title || 'New Chat');

  React.useEffect(() => {
    setTitleValue(chat?.title || 'New Chat');
    setIsEditingTitle(false);
  }, [chat?.id, chat?.title]);

  const handleSaveTitle = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (titleValue.trim() && chat) {
      onRenameChat(titleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleExportMarkdown = () => {
    if (!chat) return;
    let md = `# ${chat.title}\n*Exported from Nari AI - ${new Date().toLocaleString()}*\n\n---\n\n`;
    chat.messages.forEach((m) => {
      const author = m.role === 'user' ? 'User' : 'Nari AI';
      const time = new Date(m.timestamp).toLocaleTimeString();
      md += `### ${author} (${time})\n\n${m.content}\n\n`;
      if (m.attachments && m.attachments.length > 0) {
        md += `*Attachments: ${m.attachments.map((a) => a.name).join(', ')}*\n\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modelDisplay =
    currentModel === 'gemini-3.1-pro-preview'
      ? 'Gemini 3.1 Pro'
      : currentModel === 'gemini-3.1-flash-lite'
      ? 'Gemini 3.1 Flash Lite'
      : 'Gemini 3.8 Flash';

  return (
    <header className="h-14 md:h-16 px-3.5 md:px-6 flex items-center justify-between border-b border-[#1f1533] bg-[#07050e]/90 backdrop-blur-xl shrink-0 z-30">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 cursor-pointer"
          title="Open Menu"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Brand Mark */}
        <div className="lg:hidden shrink-0">
          <NariLogo size={24} />
        </div>

        {/* Title & Edit */}
        {isEditingTitle ? (
          <form onSubmit={handleSaveTitle} className="flex items-center gap-1.5 min-w-0">
            <input
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              autoFocus
              className="bg-[#18102b] border border-pink-500/60 rounded-lg px-2.5 py-1 text-xs md:text-sm font-medium text-white focus:outline-none w-48 sm:w-64"
            />
            <button
              type="submit"
              className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              title="Save Title"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingTitle(false)}
              className="p-1 text-slate-400 hover:text-slate-300 cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 group min-w-0">
            <h1
              onClick={() => {
                if (chat) {
                  setTitleValue(chat.title);
                  setIsEditingTitle(true);
                }
              }}
              className="text-xs sm:text-sm md:text-base font-semibold text-slate-100 truncate cursor-pointer hover:text-pink-300 transition-colors"
              title={chat ? 'Click to rename' : undefined}
            >
              {chat?.title || 'New Chat'}
            </h1>
            {chat && (
              <button
                onClick={() => {
                  setTitleValue(chat.title);
                  setIsEditingTitle(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-white transition-opacity cursor-pointer shrink-0"
                title="Rename conversation"
                aria-label="Rename conversation"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Model Indicator & Action Icons */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Model Indicator - Clean unboxed text, no pill container */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-300">{modelDisplay}</span>
        </div>

        <div className="hidden sm:block w-[1px] h-4 bg-[#23173a]" />

        {/* Export chat */}
        <button
          onClick={handleExportMarkdown}
          disabled={!chat || chat.messages.length === 0}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Export Markdown"
          aria-label="Export conversation as Markdown"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Clear messages */}
        <button
          onClick={() => {
            if (window.confirm('Clear all messages in this conversation?')) {
              onClearMessages();
            }
          }}
          disabled={!chat || chat.messages.length === 0}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title="Clear messages"
          aria-label="Clear messages in conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* New Chat quick button */}
        <button
          onClick={onNewChat}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#140d24] hover:bg-[#1d1334] border border-[#2d1b4a] text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
          title="New conversation"
        >
          <Plus className="w-3.5 h-3.5 text-pink-400" />
          <span>New Chat</span>
        </button>
      </div>
    </header>
  );
};
