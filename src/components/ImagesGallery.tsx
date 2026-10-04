import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Upload,
  ZoomIn,
  Trash2,
  Send,
  X,
} from 'lucide-react';
import { UploadedMediaItem } from '../types/chat';

interface ImagesGalleryProps {
  images: UploadedMediaItem[];
  onUploadImage: (file: File) => Promise<void>;
  onDeleteImage: (id: string) => void;
  onSendToChat: (image: UploadedMediaItem) => void;
}

export const ImagesGallery: React.FC<ImagesGalleryProps> = ({
  images,
  onUploadImage,
  onDeleteImage,
  onSendToChat,
}) => {
  const [activeZoomImage, setActiveZoomImage] = useState<UploadedMediaItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const imageItems = images.filter((item) => item.type === 'image');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      await onUploadImage(file);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f1433] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-pink-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">Multimodal Image Gallery</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual archive of screenshots, diagrams, and photos processed by Gemini 3.8 Flash.
          </p>
        </div>

        {/* Upload Trigger */}
        <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 text-white text-xs font-semibold cursor-pointer transition-all shadow-md shadow-pink-600/15 shrink-0 self-start sm:self-auto">
          <Upload className="w-4 h-4" />
          <span>{isUploading ? 'Uploading...' : 'Upload Image'}</span>
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Grid */}
      {imageItems.length === 0 ? (
        <div className="bg-[#0c0817] border border-[#1f1533] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#160e28] border border-purple-800/30 flex items-center justify-center text-pink-400">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No images in gallery yet</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Upload UI mockups, charts, or photography to have Gemini 3.8 Flash analyze visual structures and patterns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {imageItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#0c0817] hover:bg-[#120b22] rounded-xl overflow-hidden flex flex-col group border border-[#1f1533] hover:border-pink-500/40 transition-all duration-200"
            >
              {/* Image Preview Box */}
              <div
                onClick={() => setActiveZoomImage(item)}
                className="relative aspect-video sm:aspect-square bg-[#07050e] overflow-hidden cursor-pointer"
              >
                <img
                  src={item.dataUrl}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="p-2 rounded-full bg-[#1b1030]/80 text-pink-300 border border-purple-600/40">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Meta & Actions */}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white truncate max-w-[170px]" title={item.name}>
                    {item.name}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#1b122f]">
                  <button
                    onClick={() => onDeleteImage(item.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Delete image"
                    aria-label="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onSendToChat(item)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#180f2d] hover:bg-[#241344] border border-[#2b1848] text-pink-300 text-xs font-medium cursor-pointer transition-all"
                  >
                    <Send className="w-3 h-3" />
                    <span>Analyze in Chat</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {activeZoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            {/* Close Button */}
            <button
              onClick={() => setActiveZoomImage(null)}
              className="absolute -top-12 right-0 p-2 text-slate-300 hover:text-white bg-[#1a1130] rounded-full border border-purple-800/40 cursor-pointer"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={activeZoomImage.dataUrl}
              alt={activeZoomImage.name}
              className="max-h-[75vh] w-auto rounded-xl border border-pink-500/30 object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <span className="text-xs text-slate-400 font-mono mt-3">
              {activeZoomImage.name} · {new Date(activeZoomImage.timestamp).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
