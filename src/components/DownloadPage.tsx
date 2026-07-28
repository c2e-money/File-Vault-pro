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
import { FileItem, User, Advertisement } from '../types.js';
import { getFileIcon, formatBytes } from './FileCard.js';
import { api } from '../services/api.js';
import { AdDisplay } from './AdDisplay.js';

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

  // Helper to extract clean JS / HTTPS URL from ad code snippets
  const extractScriptUrl = (code?: string): string | null => {
    if (!code) return null;
    const trimmed = code.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
      return trimmed.startsWith('//') ? 'https:' + trimmed : trimmed;
    }
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      let url = match[1];
      if (url.startsWith('//')) url = 'https:' + url;
      return url;
    }
    return null;
  };

  // Load advertisement scripts automatically (Popunder & Social Bar) if enabled
  useEffect(() => {
    const popunderAd = ads.find((a) => a.isEnabled && a.type === 'popunder');
    const socialBarAd = ads.find((a) => a.isEnabled && a.type === 'socialbar');

    let popunderScript: HTMLScriptElement | null = null;
    let socialBarScript: HTMLScriptElement | null = null;

    const popUrl = extractScriptUrl(popunderAd?.code) || 'https://rightyrely.com/0a/44/b9/0a44b90796d94943a2537dad9f2592d0.js';
    if (popUrl) {
      popunderScript = document.createElement('script');
      popunderScript.src = popUrl;
      popunderScript.async = true;
      document.body.appendChild(popunderScript);
      if (popunderAd) api.trackAdEvent(popunderAd.id, 'impression');
    }

    const socialUrl = extractScriptUrl(socialBarAd?.code) || 'https://rightyrely.com/96/b3/8d/96b38d2a9c3702f149bd60e4800e311b.js';
    if (socialUrl) {
      socialBarScript = document.createElement('script');
      socialBarScript.src = socialUrl;
      socialBarScript.async = true;
      document.body.appendChild(socialBarScript);
      if (socialBarAd) api.trackAdEvent(socialBarAd.id, 'impression');
    }

    return () => {
      if (popunderScript && document.body.contains(popunderScript)) {
        document.body.removeChild(popunderScript);
      }
      if (socialBarScript && document.body.contains(socialBarScript)) {
        document.body.removeChild(socialBarScript);
      }
    };
  }, [ads, file.id]);

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

  // Trigger Smart Link helper (Opens Ad in New Tab)
  const triggerSmartLink = () => {
    const targetUrl =
      smartLinkAd && smartLinkAd.isEnabled && smartLinkAd.code?.trim()
        ? smartLinkAd.code.trim()
        : 'https://rightyrely.com/cu96f0bz3h?key=09cf79c98298c393e20ad910f6953bf7';

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://') || targetUrl.startsWith('//')) {
      const fullUrl = targetUrl.startsWith('//') ? 'https:' + targetUrl : targetUrl;
      if (smartLinkAd) api.trackAdEvent(smartLinkAd.id, 'click');
      try {
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Smart link open note:', err);
      }
    }
  };

  // Trigger File Download & Increment Real-time Download Count
  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    // 1. CPM BOOST: Trigger ad synchronously with user click.
    triggerSmartLink();

    const downloadUrl = api.getDownloadUrl(file.id, isUnlocked ? passwordInput : undefined);

    // 2. Increment stats asynchronously in the background.
    api.incrementDownloadCount(file.id).catch(console.error);
    setLiveFile((prev) => ({
      ...prev,
      downloadsCount: (prev.downloadsCount || 0) + 1,
    }));
    
    if (onDownloadSuccess) {
      onDownloadSuccess();
    }

    // 3. FIXED DOWNLOAD LOGIC: Execute file download in current tab.
    // Memory leak/browser crash fix for large files.
    const finalUrl = (file.filePath && (file.filePath.startsWith('http://') || file.filePath.startsWith('https://'))) 
      ? file.filePath 
      : downloadUrl;

    const link = document.createElement('a');
    link.href = finalUrl;
    link.download = file.originalName || 'download';
    // Use _self so it downloads in the current page and doesn't trigger popup blockers twice
    link.target = '_self'; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}/download/${file.id}`;
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased pb-20 sm:pb-8">
      {/* Container aligned to mobile screen dimensions */}
      <div className="max-w-md sm:max-w-xl mx-auto w-full min-h-screen bg-zinc-950 border-x border-zinc-900/80 shadow-2xl flex flex-col justify-between relative">
        
        <div>
          {/* Mobile App Header */}
          <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-3">
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
          </main>
        </div>
      </div>
    </div>
  );
};
                
