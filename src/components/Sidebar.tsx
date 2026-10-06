import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Pin,
  PinOff,
  Check,
  X,
  Search,
  Settings as SettingsIcon,
  Brain,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { Conversation, UserProfile } from '../types/chat';
import { NariLogo } from './NariLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  activeView: 'chats' | 'files' | 'images' | 'memories' | 'settings';
  onChangeView: (view: 'chats' | 'files' | 'images' | 'memories' | 'settings') => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onTogglePin,
  activeView,
  onChangeView,
  isOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredConversations = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedConversations = filteredConversations.filter((c) => c.pinned);
  const otherConversations = filteredConversations.filter((c) => !c.pinned);

  const startRename = (chat: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const navItems = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'images', label: 'Images', icon: ImageIcon },
    { id: 'memories', label: 'Memory', icon: Brain },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`zuxrash-sidebar fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#07050e]/95 border-r border-[#221638]/70 backdrop-blur-2xl transition-all duration-300 ease-in-out lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[72px]' : 'w-72 lg:w-[280px]'}`}
      >
        {/* Brand Header with Zuxrash Icon & Wordmark */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1f1533]">
          <div
            onClick={() => {
              onChangeView('chats');
              if (window.innerWidth < 1024) onCloseMobile();
            }}
            className="flex items-center gap-2.5 cursor-pointer group focus-visible:outline-none"
            role="button"
            tabIndex={0}
          >
            <NariLogo
              size={isCollapsed ? 34 : 36}
              withGlow
              withWordmark={!isCollapsed}
              subtitle="Intelligence"
            />
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Refined New Chat Action Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onChangeView('chats');
              if (window.innerWidth < 1024) onCloseMobile();
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl font-medium text-xs tracking-wide transition-all duration-200 cursor-pointer border ${
              isCollapsed
                ? 'bg-[#150e24] hover:bg-[#1e1434] border-purple-900/40 text-pink-300'
                : 'bg-gradient-to-r from-purple-700 via-pink-600 to-rose-600 hover:from-purple-600 hover:via-pink-500 hover:to-rose-500 text-white border-pink-400/25 shadow-md shadow-pink-600/15 hover:shadow-pink-500/25 active:scale-[0.99]'
            }`}
            title="Start New Chat"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 pb-2">
          <nav className="flex flex-col gap-0.5 p-1 bg-[#0b0816] rounded-xl border border-[#1e1434]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeView(item.id);
                    if (window.innerWidth < 1024 && item.id !== 'chats') onCloseMobile();
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-950/80 via-pink-950/40 to-transparent text-white border-l-2 border-pink-500 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  title={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-pink-400' : 'text-slate-400'
                    }`}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Expanded View Content: Chats List */}
        {activeView === 'chats' && !isCollapsed && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Filter */}
            <div className="px-3 py-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-[#0b0816] border border-[#221638] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              {/* Pinned Section */}
              {pinnedConversations.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                    <Pin className="w-3 h-3 text-pink-400" />
                    <span>Pinned</span>
                  </div>
                  {pinnedConversations.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      isEditing={editingChatId === chat.id}
                      editTitle={editTitle}
                      onSelect={() => {
                        onSelectChat(chat.id);
                        if (window.innerWidth < 1024) onCloseMobile();
                      }}
                      onStartRename={(e) => startRename(chat, e)}
                      onSaveRename={(e) => handleSaveRename(chat.id, e)}
                      onCancelRename={() => setEditingChatId(null)}
                      onChangeTitle={setEditTitle}
                      onTogglePin={(e) => {
                        e.stopPropagation();
                        onTogglePin(chat.id);
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Recent Conversations */}
              <div className="space-y-1">
                {pinnedConversations.length > 0 && (
                  <div className="px-2 text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                    Recent
                  </div>
                )}

                {otherConversations.length === 0 && pinnedConversations.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-slate-500 leading-relaxed">
                    {searchQuery
                      ? 'No matching chats found.'
                      : 'No conversations yet.\nStart a new chat to begin.'}
                  </div>
                ) : (
                  otherConversations.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      isEditing={editingChatId === chat.id}
                      editTitle={editTitle}
                      onSelect={() => {
                        onSelectChat(chat.id);
                        if (window.innerWidth < 1024) onCloseMobile();
                      }}
                      onStartRename={(e) => startRename(chat, e)}
                      onSaveRename={(e) => handleSaveRename(chat.id, e)}
                      onCancelRename={() => setEditingChatId(null)}
                      onChangeTitle={setEditTitle}
                      onTogglePin={(e) => {
                        e.stopPropagation();
                        onTogglePin(chat.id);
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed Chat Icons */}
        {isCollapsed && (
          <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-1.5">
            {conversations.slice(0, 10).map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  onSelectChat(chat.id);
                  onChangeView('chats');
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  chat.id === activeChatId
                    ? 'bg-purple-900/40 border border-pink-500/50 text-pink-300'
                    : 'bg-[#100a1c] hover:bg-purple-950/40 text-slate-400 hover:text-white border border-transparent'
                }`}
                title={chat.title}
                aria-label={chat.title}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}

        {/* Bottom User Profile Section */}
        <div className="p-3 border-t border-[#1f1533] bg-[#07050e]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-purple-800/40 shrink-0 bg-[#160e28] flex items-center justify-center text-pink-300">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {currentUser?.email || 'Cloud Account'}
                  </div>
                </div>
              )}
            </div>

            {/* Logout button */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to log out of Zuxrash?')) {
                  onLogout();
                }
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
              title="Log out of Zuxrash"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

interface ChatItemProps {
  chat: Conversation;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onSaveRename: (e?: React.FormEvent) => void;
  onCancelRename: () => void;
  onChangeTitle: (val: string) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onChangeTitle,
  onTogglePin,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
        isActive
          ? 'bg-[#18102b] border border-pink-500/35 text-white shadow-sm'
          : 'text-slate-300 hover:text-white hover:bg-[#120c22] border border-transparent'
      }`}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <MessageSquare
          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
            isActive ? 'text-pink-400' : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />

        {isEditing ? (
          <form
            onSubmit={onSaveRename}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 w-full"
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onChangeTitle(e.target.value)}
              autoFocus
              className="w-full bg-[#1e1336] border border-pink-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
            <button
              type="submit"
              className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              title="Save"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              className="p-1 text-slate-400 hover:text-slate-300 cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <span className="truncate">{chat.title}</span>
        )}
      </div>

      {/* Hover action buttons */}
      {!isEditing && (
        <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={onTogglePin}
            className="p-1 text-slate-400 hover:text-pink-300 transition-colors cursor-pointer"
            title={chat.pinned ? 'Unpin' : 'Pin to top'}
            aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}
          >
            {chat.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onStartRename}
            className="p-1 text-slate-400 hover:text-pink-300 transition-colors cursor-pointer"
            title="Rename chat"
            aria-label="Rename chat"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Delete chat"
            aria-label="Delete chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
