import React, { useState } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Sparkles,
} from 'lucide-react';
import { Memory } from '../types/chat';

interface MemoryManagerProps {
  memories: Memory[];
  onAddMemory: (content: string, category: Memory['category'], importance: number) => Promise<void>;
  onUpdateMemory: (id: string, updates: Partial<Memory>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<Memory['category']>('general');
  const [newImportance, setNewImportance] = useState(3);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<Memory['category']>('general');

  const categories = [
    { id: 'all', label: 'All Memories' },
    { id: 'preference', label: 'Preferences' },
    { id: 'tech_stack', label: 'Tech Stack' },
    { id: 'project', label: 'Projects' },
    { id: 'personal', label: 'Personal' },
    { id: 'general', label: 'General' },
  ];

  const filteredMemories = memories.filter((m) => {
    const matchesSearch =
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleStartAdd = () => {
    setNewContent('');
    setNewCategory('general');
    setNewImportance(3);
    setIsAdding(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    await onAddMemory(newContent.trim(), newCategory, newImportance);
    setIsAdding(false);
    setNewContent('');
  };

  const handleStartEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await onUpdateMemory(id, { content: editContent.trim(), category: editCategory });
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1433] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Brain className="w-5 h-5 text-pink-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Long-Term Memory Hub</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Nari AI automatically remembers meaningful facts and preferences across all conversations.
          </p>
        </div>

        <button
          onClick={handleStartAdd}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-pink-600/15 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Guide Banner */}
      <div className="p-4 rounded-xl bg-[#100a1f] border border-[#23173d] flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-slate-200">Natural Language Memory Commands</div>
          <p className="text-slate-400 leading-relaxed">
            During any conversation, say <span className="text-pink-300 font-mono">"remember this: [fact]"</span> to store a permanent preference, or <span className="text-pink-300 font-mono">"forget this: [topic]"</span> to remove it.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 p-1 bg-[#0b0716] rounded-xl border border-[#1e1333]">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#1b1032] text-pink-300 shadow-sm border border-purple-800/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#140c24]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#0c0817] border border-[#201538] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
          />
        </div>
      </div>

      {/* Add Memory Modal/Form */}
      {isAdding && (
        <form
          onSubmit={handleSaveAdd}
          className="bg-[#0c0817] rounded-2xl p-5 border border-pink-500/40 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Create New Memory Record</h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white p-1"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <textarea
            rows={2}
            required
            placeholder="e.g. User prefers concise TypeScript solutions with tailwind styling and no unnecessary commentary."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full p-3 bg-[#080511] border border-[#22153a] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/60 resize-none leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-[#120a22] border border-[#24173d] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
              >
                <option value="preference">Preference</option>
                <option value="tech_stack">Tech Stack</option>
                <option value="project">Project</option>
                <option value="personal">Personal</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-[#140c24] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 cursor-pointer"
              >
                Save Memory
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Memory Cards Grid */}
      {filteredMemories.length === 0 ? (
        <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#160e28] border border-purple-800/30 flex items-center justify-center text-pink-400">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No memories saved yet</h3>
          <p className="text-xs text-slate-400 max-w-md">
            As you converse with Nari AI, permanent preferences and context are automatically detected and preserved here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredMemories.map((mem) => {
            const isEditing = editingId === mem.id;

            return (
              <div
                key={mem.id}
                className="bg-[#0c0817] hover:bg-[#120b22] rounded-xl p-4 flex flex-col justify-between space-y-3 group border border-[#1f1533] hover:border-pink-500/40 transition-all duration-200"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 bg-[#080511] border border-pink-500/60 rounded-lg text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as any)}
                        className="bg-[#120a22] border border-[#24173d] rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value="preference">Preference</option>
                        <option value="tech_stack">Tech Stack</option>
                        <option value="project">Project</option>
                        <option value="personal">Personal</option>
                        <option value="general">General</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSaveEdit(mem.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                          aria-label="Save memory"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:text-slate-300 cursor-pointer"
                          aria-label="Cancel editing"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono text-pink-400 font-medium uppercase tracking-wide">
                        {mem.category.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans mt-1">
                      {mem.content}
                    </p>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#1b122f] text-[11px] text-slate-500">
                    <span className="italic">{mem.source === 'user_command' ? 'Direct command' : 'Conversation learned'}</span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(mem)}
                        className="p-1 text-slate-400 hover:text-pink-300 transition-colors cursor-pointer"
                        title="Edit memory"
                        aria-label="Edit memory"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete memory"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
