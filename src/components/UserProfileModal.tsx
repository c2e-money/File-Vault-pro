import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Shield,
  HardDrive,
  LogOut,
  Database,
  Share2,
  Copy,
  Check,
  Search,
  ExternalLink,
  QrCode,
  Lock,
  Sparkles,
  Folder,
} from 'lucide-react';
import { User, FileItem } from '../types.js';
import { auth } from '../lib/firebase.js';
import { api } from '../services/api.js';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  uploadedCount?: number;
  files?: FileItem[];
  quotaBytes?: number; // Defaults to 5 GB (5 * 1024 * 1024 * 1024)
  onLogout: () => void;
  onSelectFile?: (file: FileItem) => void;
  onOpenQRCode?: (file: FileItem) => void;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  quotaBytes = 5 * 1024 * 1024 * 1024, // 5 GB default quota
  onLogout,
  onSelectFile,
  onOpenQRCode,
}) => {
  const [userFiles, setUserFiles] = useState<FileItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'files'>('overview');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeUid = auth.currentUser?.uid || user?.id || '';
  const displayEmail = auth.currentUser?.email || user?.email || 'No email associated';

  useEffect(() => {
    if (!isOpen || !activeUid) {
      setUserFiles([]);
      return;
    }

    const unsub = api.subscribeUserFiles(activeUid, (realtimeUserFiles) => {
      setUserFiles(realtimeUserFiles);
    });

    return () => unsub();
  }, [isOpen, activeUid]);

  if (!isOpen || !user) return null;

  const fileCount = userFiles.length;
  const usedBytes = userFiles.reduce((acc, f) => acc + (Number(f.fileSize) || 0), 0);

  const usageRatio = Math.min(1, usedBytes / quotaBytes);
  const percentageVal = usageRatio * 100;
  const percentageFormatted =
    usedBytes > 0 && percentageVal < 0.1 ? '<0.1' : percentageVal.toFixed(1);

  const filteredUserFiles = userFiles.filter((f) =>
    f.originalName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCopyLink = (f: FileItem) => {
    const url = `${window.location.origin}/download/${f.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      {/* Mobile Drawer Sheet */}
      <div className="bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 space-y-4 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Swipe Handle for Mobile */}
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">User Panel</h2>
              <p className="text-[10px] text-zinc-400">Account details & cloud files</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Tab Navigation (Overview vs My Files) */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'files'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>My Files ({fileCount})</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
          
          {activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* User Card */}
              <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={user.username}
                    className="w-12 h-12 rounded-2xl object-cover border border-zinc-700/80 shadow-md"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-white truncate">{user.username}</h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 truncate" title={displayEmail}>
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{displayEmail}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" /> Account Role
                  </span>
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold rounded-lg uppercase text-[10px]">
                    {user.role}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-medium flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Uploaded Files
                  </span>
                  <span className="font-bold text-white bg-zinc-950 border border-zinc-800 px-2.5 py-0.5 rounded-lg">
                    {fileCount} {fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>

                {/* Storage Meter */}
                <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-purple-400" /> Storage Used
                    </span>
                    <span className="text-[11px] font-bold text-zinc-300">
                      {formatBytes(usedBytes)} <span className="text-zinc-500">/ {formatBytes(quotaBytes)}</span>
                    </span>
                  </div>

                  <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-3 p-0.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{
                        width: usedBytes > 0 ? `${Math.max(percentageVal, 3)}%` : '0%',
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-zinc-500">
                    <span>Cloud Quota</span>
                    <span className="font-bold text-indigo-400">{percentageFormatted}% used</span>
                  </div>
                </div>
              </div>

              {/* Quick File Summary Banner */}
              <div className="bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/20 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Fast Sharing Link
                  </span>
                  <p className="text-xs text-zinc-300">Manage or share your uploaded files anytime.</p>
                </div>
                <button
                  onClick={() => setActiveTab('files')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
                >
                  View Files
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search Inside User Files */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter my files..."
                  className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {filteredUserFiles.length === 0 ? (
                <div className="p-8 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl text-center space-y-2">
                  <Folder className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-400">No matching uploaded files found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUserFiles.map((f) => (
                    <div
                      key={f.id}
                      className="p-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl space-y-2 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate">{f.originalName}</h4>
                          <p className="text-[10px] text-zinc-400 flex items-center gap-2">
                            <span>{formatBytes(f.fileSize)}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">{f.downloadsCount || 0} downloads</span>
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopyLink(f)}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                            title="Copy Download Link"
                          >
                            {copiedId === f.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          {onOpenQRCode && (
                            <button
                              onClick={() => {
                                onOpenQRCode(f);
                                onClose();
                              }}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                              title="QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
                          )}

                          {onSelectFile && (
                            <button
                              onClick={() => {
                                onSelectFile(f);
                                onClose();
                              }}
                              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
                              title="Open Download Page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80 shrink-0">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>

      </div>
    </div>
  );
};


