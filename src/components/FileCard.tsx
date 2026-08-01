import React from 'react';
import { auth } from '../lib/firebase';
import {
  FileText,
  FileArchive,
  Music,
  Video,
  Image,
  Code,
  Gamepad2,
  Lock,
  Download,
  Share2,
  Star,
  Eye,
  Edit2,
  Trash2,
  Sparkles,
  Calendar,
  Clock,
} from 'lucide-react';
import { FileItem, User } from '../types.js';

interface FileCardProps {
  file: FileItem;
  currentUser: User | null;
  onSelect: (file: FileItem) => void;
  onEdit?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.includes('zip') || mimeType.includes('compressed')) {
    return <FileArchive className="w-8 h-8 text-amber-400" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext) || mimeType.includes('pdf') || mimeType.includes('document')) {
    return <FileText className="w-8 h-8 text-blue-400" />;
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext) || mimeType.includes('audio')) {
    return <Music className="w-8 h-8 text-rose-400" />;
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext) || mimeType.includes('video')) {
    return <Video className="w-8 h-8 text-indigo-400" />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext) || mimeType.includes('image')) {
    return <Image className="w-8 h-8 text-emerald-400" />;
  }
  if (['apk', 'exe', 'iso', 'dmg', 'rom'].includes(ext) || mimeType.includes('android')) {
    return <Gamepad2 className="w-8 h-8 text-purple-400" />;
  }
  return <Code className="w-8 h-8 text-teal-400" />;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  currentUser,
  onSelect,
  onEdit,
  onDelete,
  onShare,
}) => {
  const fileOwnerUid = file.ownerUid || file.uploaderId;
  const currentUid = auth.currentUser?.uid || currentUser?.id;
  const isOwner = Boolean(currentUid && fileOwnerUid && currentUid === fileOwnerUid);
  const canModify = isOwner || currentUser?.role === 'admin';

  const isScheduled = file.scheduledAt && new Date(file.scheduledAt) > new Date();

  return (
    <div
      onClick={() => onSelect(file)}
      className="group relative bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-indigo-500/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl hover:shadow-indigo-500/5 flex flex-col justify-between space-y-3 active:scale-[0.99]"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-inner">
            {getFileIcon(file.mimeType, file.originalName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-md uppercase tracking-wider">
                {file.category}
              </span>
              {file.isPasswordProtected && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors truncate mt-1">
              {file.originalName}
            </h3>
          </div>
        </div>

        {/* File Size */}
        <div className="text-right shrink-0">
          <span className="text-xs font-extrabold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-1 rounded-lg">
            {formatBytes(file.fileSize)}
          </span>
        </div>
      </div>

      {/* Description if any */}
      {file.description && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/50">
          {file.description}
        </p>
      )}

      {/* Footer Actions Row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/70" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/30 px-2 py-0.5 rounded-md">
            <Download className="w-3 h-3" /> {file.downloadsCount || 0}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onShare && (
            <button
              onClick={() => onShare(file)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition border border-zinc-700/60 active:scale-95 flex items-center gap-1 text-xs font-semibold px-2.5"
              title="Share File Link"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <button
            onClick={() => onSelect(file)}
            className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition"
          >
            <Download className="w-3.5 h-3.5" /> Get File
          </button>

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="p-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 rounded-xl transition border border-rose-800/50 hover:border-rose-600 active:scale-95 shrink-0"
              title="Delete File"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
