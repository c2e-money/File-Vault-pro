import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  Lock,
  Share2,
  QrCode,
  Flag,
  Star,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Copy,
  ExternalLink,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { FileItem, User, Comment, Advertisement } from '../types.js';
import { getFileIcon, formatBytes } from './FileCard.js';
import { api } from '../services/api.js';
import { AdDisplay } from './AdDisplay.js';
import { registerBackgroundAds } from '../lib/adScriptManager.js';

interface DownloadModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  ads: Advertisement[];
  relatedFiles: FileItem[];
  onSelectRelated: (file: FileItem) => void;
  onOpenReport: (file: FileItem) => void;
  onOpenQRCode: (file: FileItem) => void;
  defaultTimerSeconds?: number;
  onDownloadSuccess?: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  file,
  isOpen,
  onClose,
  currentUser,
  ads,
  relatedFiles,
  onSelectRelated,
  onOpenReport,
  onOpenQRCode,
  defaultTimerSeconds = 5,
  onDownloadSuccess,
}) => {
  if (!isOpen || !file) return null;

  // Password state
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!file.isPasswordProtected);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Download timer & scanner animation state
  const [timer, setTimer] = useState(defaultTimerSeconds);
  const [scanningStep, setScanningStep] = useState(0); // 0: countdown, 1: scanning, 2: ready
  const [downloadReady, setDownloadReady] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/+cOVh2XrT7nBlYTE1');

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.telegramChannelUrl) setTelegramUrl(s.telegramChannelUrl);
    }).catch(() => {});
  }, []);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (file) {
      setIsUnlocked(!file.isPasswordProtected);
      setPasswordInput('');
      setPasswordError(null);
      setTimer(defaultTimerSeconds);
      setScanningStep(0);
      setDownloadReady(false);

      // Load comments
      api.getComments(file.id).then(setComments).catch(() => {});
    }
  }, [file?.id]);

  // Load Popunder and Social Bar advertisement scripts automatically on download page load
  useEffect(() => {
    if (isOpen && file && ads && ads.length > 0) {
      registerBackgroundAds(ads);
    }
  }, [isOpen, file?.id, ads]);

  // Handle Password Verification
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    try {
      const valid = await api.verifyPassword(file.id, passwordInput);
      if (valid) {
        setIsUnlocked(true);
      } else {
        setPasswordError('Incorrect file password');
      }
    } catch {
      setPasswordError('Password validation failed');
    }
  };

  // Timer Countdown Logic
  useEffect(() => {
    if (!isUnlocked) return;

    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setDownloadReady(true);
    }
  }, [isUnlocked, timer]);

  // Comment Submission
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const posted = await api.postComment(file.id, newComment, newRating);
      setComments([posted, ...comments]);
      setNewComment('');
      setSubmittingComment(false);
    } catch {
      setSubmittingComment(false);
    }
  };

  const handleCopyLink = () => {
    const downloadUrl = `${window.location.origin}/#file-${file.id}`;
    navigator.clipboard.writeText(downloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    const url = api.getDownloadUrl(file.id, isUnlocked ? passwordInput : undefined);

    if (file.filePath && (file.filePath.startsWith('http://') || file.filePath.startsWith('https://'))) {
      const link = document.createElement('a');
      link.href = file.filePath;
      link.target = '_blank';
      link.download = file.originalName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = file.originalName || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = file.originalName || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    await api.incrementDownloadCount(file.id, file.filename);

    if (onDownloadSuccess) {
      onDownloadSuccess();
    }
  };

  const downloadUrl = api.getDownloadUrl(file.id, isUnlocked ? passwordInput : undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl my-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white line-clamp-1">{file.originalName}</h2>
              <p className="text-xs text-zinc-400">Category: <span className="text-indigo-400 font-semibold">{file.category}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800 hover:bg-zinc-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Top Advert Banner */}
          <AdDisplay ads={ads} location="download_page_top" type="native" />

          {/* Main Download Card */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center gap-6">
              
              {/* File Icon & Badges */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shadow-xl">
                  {getFileIcon(file.mimeType, file.originalName)}
                </div>
                <span className="text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
                  {formatBytes(file.fileSize)}
                </span>
              </div>

              {/* Stats & Description */}
              <div className="flex-1 space-y-3 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Virus Scanned
                  </span>
                  <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold rounded-lg">
                    {file.downloadsCount} Downloads
                  </span>
                  <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-lg flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {file.ratingAvg || 5.0} ({file.ratingCount || 1})
                  </span>
                </div>

                {file.description && (
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
                    {file.description}
                  </p>
                )}

                <div className="text-[11px] text-zinc-400 flex flex-wrap gap-4 justify-center md:justify-start">
                  <span>Uploaded by: <strong className="text-zinc-200">{file.uploaderName}</strong></span>
                  <span>Date: <strong className="text-zinc-200">{new Date(file.createdAt).toLocaleDateString()}</strong></span>
                </div>
              </div>
            </div>

            {/* Password Lock Section */}
            {!isUnlocked && (
              <div className="mt-6 pt-6 border-t border-zinc-800 text-center space-y-3 bg-amber-950/20 border-amber-500/30 p-4 rounded-xl">
                <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-bold">
                  <Lock className="w-5 h-5" /> Password Protected File
                </div>
                <p className="text-xs text-zinc-300">Enter the access password provided by the file owner to unlock download.</p>
                
                <form onSubmit={handleVerifyPassword} className="flex gap-2 max-w-md mx-auto">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition"
                  >
                    Unlock
                  </button>
                </form>
                {passwordError && <p className="text-xs text-rose-400 font-semibold">{passwordError}</p>}
              </div>
            )}

            {/* Timer & Security Scanning Box */}
            {isUnlocked && (
              <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
                
                {!downloadReady ? (
                  <div className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-center space-y-3">
                    <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin" />
                      <span className="absolute text-xl font-black text-indigo-400">{timer}</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-200">
                      Generating secure download link...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary Download Button */}
                    <button
                      type="button"
                      onClick={handleDownloadClick}
                      className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/30 active:scale-[0.99] transition cursor-pointer"
                    >
                      <Download className="w-6 h-6 animate-bounce" />
                      Download File ({formatBytes(file.fileSize)})
                    </button>

                    {/* Secondary Actions Row */}
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleDownloadClick}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl flex items-center gap-1.5 transition border border-zinc-700/60 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Direct Link
                      </button>

                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl flex items-center gap-1.5 transition border border-zinc-700/60"
                      >
                        <Copy className="w-3.5 h-3.5" /> {copiedLink ? 'Copied Link!' : 'Copy Link'}
                      </button>

                      <button
                        onClick={() => onOpenQRCode(file)}
                        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-indigo-400 font-semibold rounded-xl flex items-center gap-1.5 transition border border-zinc-700/60"
                      >
                        <QrCode className="w-3.5 h-3.5" /> Mobile QR
                      </button>

                      <button
                        onClick={() => onOpenReport(file)}
                        className="px-3 py-2 bg-zinc-800 hover:bg-rose-950/60 text-rose-400 font-semibold rounded-xl flex items-center gap-1.5 transition border border-zinc-700/60"
                      >
                        <Flag className="w-3.5 h-3.5" /> Report File
                      </button>
                    </div>

                    {/* Join Premium Telegram Channel Card */}
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/90 via-blue-950/90 to-indigo-950/90 border border-sky-400/40 hover:border-sky-400 transition-all shadow-lg shadow-sky-950/50 group active:scale-[0.98] cursor-pointer text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.38-.49 1.03-.75 4.03-1.75 6.72-2.91 8.08-3.48 3.85-1.6 4.65-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.22z"/>
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-black text-white group-hover:text-sky-300 transition-colors">
                                Join Premium Telegram
                              </h4>
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-amber-400 text-zinc-950">
                                VIP
                              </span>
                            </div>
                            <p className="text-[10px] text-sky-200/80">
                              Get exclusive files & direct VIP downloads!
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-sky-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    </a>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Middle Sponsor Native Ad */}
          <AdDisplay ads={ads} location="download_page_middle" type="native" />

          {/* Comments & Reviews Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Community Reviews & Comments ({comments.length})
            </h3>

            {/* Comment Box */}
            <form onSubmit={handlePostComment} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-semibold">Your Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-125 transition"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={currentUser ? 'Write a review or report feedback...' : 'Please login to post a comment...'}
                disabled={!currentUser}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!currentUser || submittingComment || !newComment.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl disabled:opacity-50 transition"
                >
                  Post Review
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-200">{c.userName}</span>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span className="text-[11px] font-bold">{c.rating || 5}</span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300">{c.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Related Files Carousel/Grid */}
          {relatedFiles.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <h3 className="text-sm font-bold text-white">Related Files in {file.category}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedFiles.map((rf) => (
                  <div
                    key={rf.id}
                    onClick={() => onSelectRelated(rf)}
                    className="p-3 bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 rounded-xl cursor-pointer transition flex items-center gap-3"
                  >
                    <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                      {getFileIcon(rf.mimeType, rf.originalName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-zinc-100 truncate">{rf.originalName}</h4>
                      <p className="text-[11px] text-zinc-400">{formatBytes(rf.fileSize)} • {rf.downloadsCount} dl</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
