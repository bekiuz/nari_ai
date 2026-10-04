import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  FileCode,
  FileJson,
  FileSpreadsheet,
  X,
  Check,
  Copy,
  Sparkles,
  AlertCircle,
  Search,
  Loader2,
} from 'lucide-react';
import { UploadedMediaItem } from '../types/chat';

interface FilesPanelProps {
  files: UploadedMediaItem[];
  onUploadFile: (file: File, onProgress?: (p: number) => void) => Promise<void>;
  onDeleteFile: (id: string, name?: string) => void;
  onSendToChat: (file: UploadedMediaItem) => void;
}

function getFileCategory(name: string, mimeType: string): 'pdf' | 'docx' | 'data' | 'code' | 'text' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
  if (ext === 'docx' || mimeType.includes('wordprocessingml')) return 'docx';
  if (ext === 'csv' || ext === 'tsv' || ext === 'json' || mimeType.includes('csv') || mimeType.includes('json')) return 'data';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css', 'sql', 'yaml', 'yml', 'sh'].includes(ext)) return 'code';
  return 'text';
}

function getFileTypeLabel(name: string, mimeType: string) {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
  const category = getFileCategory(name, mimeType);

  if (category === 'pdf') {
    return <span className="text-[11px] font-mono font-medium text-rose-400">PDF</span>;
  }
  if (category === 'docx') {
    return <span className="text-[11px] font-mono font-medium text-blue-400">DOCX</span>;
  }
  if (category === 'data') {
    return <span className="text-[11px] font-mono font-medium text-emerald-400">{ext}</span>;
  }
  if (category === 'code') {
    return <span className="text-[11px] font-mono font-medium text-purple-400">{ext}</span>;
  }
  return <span className="text-[11px] font-mono font-medium text-pink-400">{ext}</span>;
}

function getFileIcon(name: string, mimeType: string) {
  const category = getFileCategory(name, mimeType);
  if (category === 'pdf') {
    return <FileText className="w-5 h-5 text-rose-400" />;
  }
  if (category === 'docx') {
    return <FileText className="w-5 h-5 text-blue-400" />;
  }
  if (name.endsWith('.json') || mimeType.includes('json')) {
    return <FileJson className="w-5 h-5 text-amber-400" />;
  }
  if (name.endsWith('.csv') || mimeType.includes('csv')) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  }
  if (category === 'code') {
    return <FileCode className="w-5 h-5 text-purple-400" />;
  }
  return <FileText className="w-5 h-5 text-pink-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilesPanel: React.FC<FilesPanelProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onSendToChat,
}) => {
  const [selectedFile, setSelectedFile] = useState<UploadedMediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pdf' | 'docx' | 'data' | 'code' | 'text'>('all');
  const [copiedContent, setCopiedContent] = useState(false);

  const documentFiles = files.filter((f) => f.type === 'file');

  const filteredFiles = documentFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    return getFileCategory(file.name, file.mimeType) === categoryFilter;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      await onUploadFile(file, (p) => setUploadProgress(p));
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleDownload = (file: UploadedMediaItem) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
      return;
    }
    if (file.dataUrl) {
      const a = document.createElement('a');
      a.href = file.dataUrl;
      a.download = file.name;
      a.click();
      return;
    }
    if (file.textPreview) {
      const blob = new Blob([file.textPreview], { type: file.mimeType || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1433] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-pink-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Workspace File Repository</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Store, analyze, and query PDF documents, Word (.docx), CSV datasets, JSON, and source code with Gemini intelligence.
          </p>
        </div>

        {/* Upload Trigger */}
        <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-semibold cursor-pointer transition-all shadow-md shadow-pink-600/15 shrink-0 self-start sm:self-auto">
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt,.csv,.json,.md,.py,.js,.jsx,.ts,.tsx,.html,.css,.sql,.yaml,.yml"
            className="hidden"
          />
        </label>
      </div>

      {/* Upload Progress & Error Bar */}
      {isUploading && (
        <div className="p-3 rounded-xl bg-[#140d25] border border-pink-500/35 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs text-pink-300">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
              <span>Uploading to Firebase Storage & extracting readable text...</span>
            </div>
            <span className="font-mono font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-[#1b1030] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
              style={{ width: `${Math.max(uploadProgress, 10)}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="p-1 hover:text-white"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files by name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0c0817] border border-[#201538] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/60"
          />
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 p-1 bg-[#0b0716] rounded-xl border border-[#1e1333]">
          {(
            [
              { id: 'all', label: 'All Files' },
              { id: 'pdf', label: 'PDFs' },
              { id: 'docx', label: 'Word' },
              { id: 'data', label: 'Data/CSV' },
              { id: 'code', label: 'Code' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-[#1b1032] text-pink-300 shadow-sm border border-purple-800/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#140c24]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#160e28] border border-purple-800/30 flex items-center justify-center text-pink-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">
            {searchQuery ? 'No matching files found' : 'No documents uploaded yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Upload PDF reports, Word documents (.docx), CSV datasets, JSON data, or source code (.py, .ts, .js) to analyze and chat with their real contents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="bg-[#0c0817] hover:bg-[#120b22] rounded-xl p-4 flex flex-col justify-between space-y-3 group border border-[#1f1533] hover:border-pink-500/40 transition-all duration-200"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-[#160e28] border border-purple-800/30 shrink-0">
                  {getFileIcon(file.name, file.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {getFileTypeLabel(file.name, file.mimeType)}
                    <span className="text-[10px] text-slate-500 font-mono">
                      · {formatBytes(file.size)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate" title={file.name}>
                    {file.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {new Date(file.timestamp).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Text preview snippet */}
              {file.textPreview && (
                <div className="px-2.5 py-1.5 rounded-lg bg-[#07050e] border border-[#1a112c] text-[11px] font-mono text-slate-400 line-clamp-2">
                  {file.textPreview.slice(0, 140)}
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1b122f]">
                <button
                  onClick={() => onSendToChat(file)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#180f2d] hover:bg-[#241344] border border-[#2b1848] hover:border-pink-500/50 text-pink-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  title="Attach to active chat for AI analysis"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>Analyze in Chat</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedFile(file)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 transition-colors cursor-pointer"
                    title="Inspect file contents"
                    aria-label="Inspect file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(file)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 transition-colors cursor-pointer"
                    title="Download file"
                    aria-label="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${file.name}?`)) {
                        onDeleteFile(file.id, file.name);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete file"
                    aria-label="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Inspector Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0b0816] max-w-3xl w-full max-h-[85vh] rounded-2xl flex flex-col border border-[#24173d] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#1d1233] bg-[#100a1f]">
              <div className="flex items-center gap-3 min-w-0">
                {getFileIcon(selectedFile.name, selectedFile.mimeType)}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    {getFileTypeLabel(selectedFile.name, selectedFile.mimeType)}
                    <h3 className="text-sm font-semibold text-white truncate">
                      {selectedFile.name}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatBytes(selectedFile.size)} · {new Date(selectedFile.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onSendToChat(selectedFile);
                    setSelectedFile(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold shadow-md shadow-pink-600/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze in Chat</span>
                </button>
                <button
                  onClick={async () => {
                    if (selectedFile.textPreview) {
                      await navigator.clipboard.writeText(selectedFile.textPreview);
                      setCopiedContent(true);
                      setTimeout(() => setCopiedContent(false), 2000);
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/60"
                  title="Copy text"
                  aria-label="Copy file text"
                >
                  {copiedContent ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/60"
                  title="Download"
                  aria-label="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/60"
                  aria-label="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#07050e] text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-pink-500/30">
              {selectedFile.textPreview || 'No readable text content extracted.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
