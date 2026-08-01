import React, { useState, useEffect } from 'react';
import {
  Download,
  ShieldCheck,
  Lock,
  HardDrive,
  UploadCloud,
  LogIn,
  User as UserIcon,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  Flag,
  Share2,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase.js';
import { FileItem, User, Advertisement, getShareableDownloadUrl } from '../types.js';
import { getFileIcon, formatBytes } from './FileCard.js';
import { api } from '../services/api.js';
import { AdDisplay } from './AdDisplay.js';
import { registerBackgroundAds } from '../lib/adScriptManager.js';

interface DownloadPageProps {
  file: FileItem;
  onBackToHome?: () => void;
  currentUser?: User | null;
  ads: Advertisement[];
  relatedFiles?: FileItem[];
  onSelectRelated?: (file: FileItem) => void;
  onOpenReport?: (file: FileItem) => void;
  onOpenQRCode?: (file: FileItem) => void;
  onOpenUpload?: () => void;
  onOpenAuth?: () => void;
  onOpenUserProfile?: () => void;
  defaultTimerSeconds?: number;
  onDownloadSuccess?: () => void;
}

export const DownloadPage: React.FC<DownloadPageProps> = ({
  file,
  onBackToHome,
  currentUser,
  ads,
  onOpenReport,
  onOpenQRCode,
  onOpenUpload,
  onOpenAuth,
  onOpenUserProfile,
  defaultTimerSeconds = 5,
  onDownloadSuccess,
}) => {
  // Real-time file state
  const [liveFile, setLiveFile] = useState<FileItem>(file);

  // Password state
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(!file.isPasswordProtected);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Download timer state
  const [timer, setTimer] = useState(defaultTimerSeconds);
  const [downloadReady, setDownloadReady] = useState(defaultTimerSeconds === 0);

  // Copy link state
  const [copiedLink, setCopiedLink] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/+cOVh2XrT7nBlYTE1');

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.telegramChannelUrl) setTelegramUrl(s.telegramChannelUrl);
      if (typeof s.defaultDownloadTimer === 'number') {
        setTimer(s.defaultDownloadTimer);
        setDownloadReady(s.defaultDownloadTimer === 0);
      }
    }).catch(() => {});
  }, [file.id]);

  // Check login state
  const isLoggedIn = Boolean(currentUser || auth.currentUser);

  // Active Smart Link Ad unit check
  const smartLinkAd = ads.find((a) => a.isEnabled && a.type === 'smartlink');

  // Real-time Firestore document listener for file download count updates
  useEffect(() => {
    setLiveFile(file);
    setIsUnlocked(!file.isPasswordProtected);
    setPasswordInput('');
    setPasswordError(null);
    setTimer(defaultTimerSeconds);
    setDownloadReady(defaultTimerSeconds === 0);

    if (!file.id) return;

    const fileRef = doc(db, 'files', file.id);
    const unsub = onSnapshot(fileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLiveFile((prev) => ({
          ...prev,
          downloadsCount: data.downloadsCount ?? data.downloads ?? prev.downloadsCount ?? 0,
        }));
      }
    });

    return () => unsub();
  }, [file.id, defaultTimerSeconds]);

  const smartLinkOpenedRef = React.useRef(false);

  // Load advertisement scripts automatically (Popunder & Social Bar) if enabled
  useEffect(() => {
    if (ads && ads.length > 0) {
      registerBackgroundAds(ads);
    }
  }, [ads]);

  // Password Verification
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

  // Trigger Smart Link helper (max 1 time per download page session to prevent popup spam)
  const triggerSmartLink = () => {
    if (smartLinkOpenedRef.current) return;
    const targetUrl =
      smartLinkAd && smartLinkAd.isEnabled && smartLinkAd.code?.trim()
        ? smartLinkAd.code.trim()
        : 'https://rightyrely.com/cu96f0bz3h?key=09cf79c98298c393e20ad910f6953bf7';

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('//')) {
      smartLinkOpenedRef.current = true;
      const fullUrl = targetUrl.startsWith('//') ? 'https:' + targetUrl : targetUrl;
      if (smartLinkAd) api.trackAdEvent(smartLinkAd.id, 'click');
      try {
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Smart link open note:', err);
      }
    }
  };

  // Trigger File Download & Increment Real-time Download Count (1 download per IP)
  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    triggerSmartLink();

    const directUrl = file.externalUrl || (file.filePath && (file.filePath.startsWith('http://') || file.filePath.startsWith('https://')) ? file.filePath : null);
    const downloadUrl = directUrl || api.getDownloadUrl(file.id, isUnlocked ? passwordInput : undefined);

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = file.originalName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const res = await api.incrementDownloadCount(file.id, file.filename);
    if (res && res.incremented) {
      setLiveFile((prev) => ({
        ...prev,
        downloadsCount: res.downloadsCount || (prev.downloadsCount || 0) + 1,
      }));
    } else if (res && res.downloadsCount !== undefined) {
      setLiveFile((prev) => ({
        ...prev,
        downloadsCount: res.downloadsCount!,
      }));
    }

    if (onDownloadSuccess) {
      onDownloadSuccess();
    }
  };

  const handleCopyShareLink = () => {
    const url = getShareableDownloadUrl(file);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleTopAuthButtonClick = () => {
    if (!isLoggedIn) {
      if (onOpenAuth) onOpenAuth();
    } else {
      if (onOpenUserProfile) {
        onOpenUserProfile();
      } else if (onOpenAuth) {
        onOpenAuth();
      }
    }
  };

  const handleUploadButtonClick = () => {
    if (!isLoggedIn) {
      if (onOpenAuth) onOpenAuth();
    } else {
      if (onOpenUpload) onOpenUpload();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased pb-20 sm:pb-8 w-full max-w-full overflow-x-hidden">
      {/* Container aligned to mobile screen dimensions */}
      <div className="max-w-md sm:max-w-xl mx-auto w-full min-h-screen bg-zinc-950 border-x border-zinc-900/80 shadow-2xl flex flex-col justify-between relative overflow-x-hidden">
        
        <div>
          {/* Mobile App Header */}
          <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 px-3 sm:px-4 py-2.5 sm:py-3 max-w-full overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onBackToHome}
                className="flex items-center gap-2 p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 transition cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>Vault</span>
              </button>

              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <span className="font-extrabold text-xs text-white tracking-wide">Shared Download</span>
              </div>

              <button
                type="button"
                onClick={handleTopAuthButtonClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95"
              >
                {isLoggedIn ? (
                  <>
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Account</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Login</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Main Mobile Content Body */}
          <main className="px-4 py-5 space-y-5">
            
            {/* Native Top Advertisement Placement */}
            <AdDisplay ads={ads} location="download_page_top" type="native" />

            {/* Banner Ad Placement */}
            <AdDisplay ads={ads} type="banner" className="w-full text-center" />

            {/* File Details Mobile Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-5">
              
              {/* Thumbnail & File Details Header */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-lg shrink-0">
                  {getFileIcon(liveFile.mimeType, liveFile.originalName)}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <h1 className="text-base font-extrabold text-white leading-snug break-words">
                    {liveFile.originalName}
                  </h1>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Virus Free
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold rounded-md">
                      Downloads: <strong className="text-indigo-400">{liveFile.downloadsCount || 0}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* File Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">File Size</span>
                  <p className="font-extrabold text-zinc-200">{formatBytes(liveFile.fileSize)}</p>
                </div>
                <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Upload Date</span>
                  <p className="font-extrabold text-zinc-200">{new Date(liveFile.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Mobile Quick Action Tools (Copy Link, QR Code, Report) */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="flex-1 py-2 px-3 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{copiedLink ? 'Copied Link' : 'Copy Link'}</span>
                </button>

                {onOpenQRCode && (
                  <button
                    type="button"
                    onClick={() => onOpenQRCode(liveFile)}
                    className="p-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-indigo-400 rounded-xl transition active:scale-95"
                    title="Mobile QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                )}

                {onOpenReport && (
                  <button
                    type="button"
                    onClick={() => onOpenReport(liveFile)}
                    className="p-2 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-500 hover:text-rose-400 rounded-xl transition active:scale-95"
                    title="Report File"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Password Protection Lock Gate */}
              {!isUnlocked && (
                <div className="pt-4 border-t border-zinc-800 space-y-3 bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl text-center">
                  <div className="inline-flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <Lock className="w-4 h-4" /> Password Protected File
                  </div>
                  <form onSubmit={handleVerifyPassword} className="space-y-2">
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter file password..."
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Unlock File
                    </button>
                  </form>
                  {passwordError && <p className="text-[11px] text-rose-400 font-semibold">{passwordError}</p>}
                </div>
              )}

              {/* Download Timer & Main Download Button */}
              {isUnlocked && (
                <div className="pt-2 space-y-3">
                  {!downloadReady ? (
                    <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-2xl text-center space-y-2">
                      <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full border-4 border-zinc-800 border-t-indigo-500 animate-spin" />
                        <span className="absolute text-lg font-black text-indigo-400">{timer}</span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-300">
                        Preparing secure link node...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleDownloadClick}
                        className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition cursor-pointer"
                      >
                        <Download className="w-5 h-5 animate-bounce" />
                        Download ({formatBytes(liveFile.fileSize)})
                      </button>

                      {smartLinkAd && (
                        <button
                          type="button"
                          onClick={triggerSmartLink}
                          className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-amber-500/30 active:scale-[0.98] transition cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Fast Direct Mirror (Smart Link)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Join Premium Telegram Channel Card */}
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full p-3.5 rounded-2xl bg-gradient-to-r from-sky-950/90 via-blue-950/90 to-indigo-950/90 border border-sky-400/40 hover:border-sky-400 transition-all shadow-lg shadow-sky-950/50 group active:scale-[0.98] cursor-pointer"
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

                  {/* Mobile Upload CTA */}
                  <button
                    type="button"
                    onClick={handleUploadButtonClick}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border border-indigo-500/40 rounded-2xl flex items-center justify-between text-left active:scale-95 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                        <UploadCloud className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Upload Your File</h4>
                        <p className="text-[10px] text-zinc-400">Share files free with instant download links</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
                  </button>
                </div>
              )}

            </div>

            {/* Middle Adsterra Ad Unit */}
            <AdDisplay ads={ads} location="download_page_middle" type="native" />

          </main>
        </div>

        {/* Mobile Footer */}
        <footer className="border-t border-zinc-800/80 py-4 text-center text-[11px] text-zinc-500">
          <p>© {new Date().getFullYear()} FileVault. Secure Real-Time Hosting.</p>
        </footer>

        {/* Sticky Bottom Adsterra Advertisement Bar */}
        <AdDisplay ads={ads} type="sticky" className="fixed bottom-0 left-0 right-0 z-50 p-2 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800" />

      </div>
    </div>
  );
};

