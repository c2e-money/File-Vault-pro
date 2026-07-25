import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileCheck,
  Lock,
  Tag,
  FolderOpen,
  Calendar,
  AlertCircle,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Category } from '../types.js';
import { api } from '../services/api.js';
import { formatBytes } from './FileCard.js';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onUploadSuccess: () => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUploadSuccess,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState(categories[0]?.name || 'Software & Apps');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; originalName: string; fileSize: number }[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => {
    if (categories && categories.length > 0 && (!category || !categories.some((c) => c.name === category))) {
      setCategory(categories[0].name);
    }
  }, [categories]);

  if (!isOpen) return null;

  const handleResetModal = () => {
    setSelectedFiles([]);
    setDescription('');
    setTags('');
    setPassword('');
    setIsPasswordProtected(false);
    setUploadedFiles(null);
    setCopiedId(null);
    setError(null);
    setProgress(0);
    currentXhrRef.current = null;
  };

  const handleCancelUpload = () => {
    if (currentXhrRef.current) {
      try {
        currentXhrRef.current.abort();
      } catch (err) {
        console.warn('Upload cancellation:', err);
      }
      currentXhrRef.current = null;
    }
    setUploading(false);
    handleResetModal();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    if (isPasswordProtected && !password.trim()) {
      setError('Please set a password for protected file(s)');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const res = await api.uploadFilesWithProgress(
        selectedFiles,
        (percent) => {
          setProgress(percent);
        },
        {
          category,
          description,
          tags,
          isPasswordProtected,
          password,
          isDraft,
        },
        (xhr) => {
          currentXhrRef.current = xhr;
        }
      );
      setUploading(false);
      currentXhrRef.current = null;
      onUploadSuccess();
      if (res && res.files && res.files.length > 0) {
        setUploadedFiles(res.files);
      } else {
        onClose();
        handleResetModal();
      }
    } catch (err: any) {
      setUploading(false);
      currentXhrRef.current = null;
      if (err?.code === 'storage/canceled' || err?.message?.includes('canceled')) {
        handleResetModal();
      } else {
        setError(err.message || 'Upload failed');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              {uploadedFiles ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Upload className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {uploadedFiles ? 'Upload Successful!' : 'Upload Files'}
              </h2>
              <p className="text-xs text-zinc-400">
                {uploadedFiles ? 'Your file(s) are stored and ready for instant download.' : 'Drag & drop files or choose from disk (up to 1 GB)'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (uploading) {
                handleCancelUpload();
              } else {
                if (uploadedFiles) {
                  handleResetModal();
                }
                onClose();
              }
            }}
            className="p-2 text-zinc-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadedFiles ? (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>File(s) uploaded successfully to server storage and saved in database!</span>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Unique Shareable Download Links</h3>
              {uploadedFiles.map((file) => {
                const shareUrl = `${window.location.origin}/#file-${file.id}`;
                const isCopied = copiedId === file.id;

                return (
                  <div key={file.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span className="truncate max-w-sm">{file.originalName}</span>
                      <span className="text-zinc-500">{formatBytes(file.fileSize)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-xs text-indigo-300 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          setCopiedId(file.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition whitespace-nowrap"
                      >
                        {isCopied ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleResetModal}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition"
              >
                Upload More Files
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetModal();
                  onClose();
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                : 'border-zinc-700/80 bg-zinc-950/60 hover:border-indigo-500/50 hover:bg-zinc-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-indigo-400 mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-200">
              Drop files here or <span className="text-indigo-400 underline">Browse files</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">Supports ZIP, PDF, RAR, APK, MP3, MP4, ISO, EXE, Images</p>
          </div>

          {/* Selected Files Queue */}
          {selectedFiles.length > 0 && (
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
                <span>Selected ({selectedFiles.length}):</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-rose-400 hover:underline"
                >
                  Clear Queue
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex justify-between items-center text-xs text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <span className="truncate max-w-xs text-zinc-200 font-medium">{file.name}</span>
                    <span className="text-zinc-500 text-[11px]">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="software, v2.0, build, full"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Description / Changelog</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a description of the file features, instructions, or version updates..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Protection & Publishing Options */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Access & Protection</h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-zinc-300 font-medium">Password Protect File</span>
              </div>
              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => setIsPasswordProtected(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {isPasswordProtected && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter unlock password"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                Save as Draft (Hidden from public)
              </label>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Schedule Publishing (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300 font-semibold">
                <span>Uploading file data to server storage...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (uploading) {
                  handleCancelUpload();
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              {uploading ? 'Cancel Upload' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Start Upload
                </>
              )}
            </button>
          </div>
        </form>
        )}

      </div>
    </div>
  );
};
