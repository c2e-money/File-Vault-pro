import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2, HardDrive } from 'lucide-react';
import { FileItem } from '../types.js';
import { getFileIcon, formatBytes } from './FileCard.js';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  file: FileItem | null;
  onClose: () => void;
  onConfirm: (file: FileItem) => Promise<void> | void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  file,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !file) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirm(file);
      setIsDeleting(false);
      onClose();
    } catch (err: any) {
      console.error('Delete confirmation error:', err);
      setErrorMessage(err?.message || 'Failed to delete file. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden transform transition-all">
        {/* Subtle Top Red Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition disabled:opacity-50"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Content */}
        <div className="flex items-start gap-4 pt-1">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-lg font-extrabold text-white">Delete File?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This action <span className="text-rose-400 font-semibold">cannot be undone</span>. This will permanently delete the file from the vault and server storage.
            </p>
          </div>
        </div>

        {/* Target File Preview Box */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0">
            {getFileIcon(file.mimeType, file.originalName)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-zinc-100 truncate">{file.originalName}</h4>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
              <span className="font-medium text-indigo-400">{formatBytes(file.fileSize)}</span>
              <span>•</span>
              <span className="truncate">{file.category}</span>
            </div>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition disabled:opacity-50 min-w-[120px]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Delete File</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
