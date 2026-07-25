import React, { useState, useEffect, useMemo } from 'react';
import {
  HardDriveUpload,
  Search,
  Upload,
  Sparkles,
  TrendingUp,
  Star,
  Clock,
  ShieldCheck,
  FolderOpen,
  Filter,
  ArrowUpDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  CheckCircle,
  Shield,
  LogIn,
} from 'lucide-react';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { FileCard } from './components/FileCard.js';
import { AdDisplay } from './components/AdDisplay.js';
import { FileUploadModal } from './components/FileUploadModal.js';
import { DownloadModal } from './components/DownloadModal.js';
import { QRCodeModal } from './components/QRCodeModal.js';
import { ReportModal } from './components/ReportModal.js';
import { AuthModal } from './components/AuthModal.js';
import { UserProfileModal } from './components/UserProfileModal.js';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal.js';
import { DownloadPage } from './components/DownloadPage.js';
import { AdminPanel } from './components/AdminPanel/AdminPanel.js';
import { AdminLoginPage } from './components/AdminPanel/AdminLoginPage.js';
import { FileItem, User, Category, Advertisement } from './types.js';
import { api } from './services/api.js';
import { auth } from './lib/firebase.js';

function getInitialRouteState() {
  if (typeof window === 'undefined') {
    return { isAdmin: false, downloadFileId: null };
  }
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;

  const isAdmin = pathname.startsWith('/admin') || hash === '#admin';

  let downloadFileId: string | null = null;
  const urlParams = new URLSearchParams(search);

  if (urlParams.get('download')) {
    downloadFileId = urlParams.get('download');
  } else if (urlParams.get('file')) {
    downloadFileId = urlParams.get('file');
  } else if (pathname.startsWith('/download/')) {
    downloadFileId = pathname.replace('/download/', '').split('/')[0] || null;
  } else if (pathname.startsWith('/file/')) {
    downloadFileId = pathname.replace('/file/', '').split('/')[0] || null;
  } else if (hash.startsWith('#download-')) {
    downloadFileId = hash.replace('#download-', '') || null;
  } else if (hash.startsWith('#file-')) {
    downloadFileId = hash.replace('#file-', '') || null;
  }

  return { isAdmin, downloadFileId };
}

export default function App() {
  const initialRoute = getInitialRouteState();

  // Authentication & View Mode
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdminView, setIsAdminView] = useState(initialRoute.isAdmin);
  const [downloadRouteFileId, setDownloadRouteFileId] = useState<string | null>(initialRoute.downloadFileId);
  const [loadingDownloadFile, setLoadingDownloadFile] = useState<boolean>(Boolean(initialRoute.downloadFileId));
  const [selectedFileForDownload, setSelectedFileForDownload] = useState<FileItem | null>(null);
  const [isDark, setIsDark] = useState(true);

  // Data collections
  const [categories, setCategories] = useState<Category[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [featuredFiles, setFeaturedFiles] = useState<FileItem[]>([]);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [totalDownloadsCount, setTotalDownloadsCount] = useState(0);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'downloads' | 'rating' | 'size'>('newest');
  const [activeTab, setActiveTab] = useState<'all' | 'featured' | 'trending' | 'popular'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingFiles, setLoadingFiles] = useState(true);

  // Modal Controls & Nav State
  const [activeBottomNav, setActiveBottomNav] = useState<'vault' | 'upload' | 'account'>('vault');
  const [vaultScope, setVaultScope] = useState<'mine' | 'all'>('mine');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [pendingUploadAfterAuth, setPendingUploadAfterAuth] = useState(false);
  const [qrModalFile, setQrModalFile] = useState<FileItem | null>(null);
  const [reportModalFile, setReportModalFile] = useState<FileItem | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  const handleOpenUpload = () => {
    if (!currentUser) {
      setPendingUploadAfterAuth(true);
      setAuthModalOpen(true);
    } else {
      setUploadModalOpen(true);
    }
  };

  // Initial Realtime Data Subscriptions (Firebase Auth, Categories, Ads)
  useEffect(() => {
    // Restore admin session if available
    const storedAdmin = localStorage.getItem('filevault_admin_user');
    if (storedAdmin) {
      try {
        const parsed = JSON.parse(storedAdmin);
        if (parsed && parsed.role === 'admin') {
          setCurrentUser(parsed);
        }
      } catch (e) {
        console.warn('Failed parsing stored admin user:', e);
      }
    }

    const unsubUser = api.subscribeCurrentUser((u) => {
      if (u) {
        setCurrentUser(u);
      } else {
        const adminStr = localStorage.getItem('filevault_admin_user');
        if (adminStr) {
          try {
            const adminObj = JSON.parse(adminStr);
            if (adminObj && adminObj.role === 'admin') {
              setCurrentUser(adminObj);
              return;
            }
          } catch (e) {}
        }
        setCurrentUser(null);
      }
    });

    const unsubCats = api.subscribeCategories((c) => {
      setCategories(c);
    });

    const unsubAds = api.subscribePublicAds((a) => {
      setAds(a);
    });

    return () => {
      unsubUser();
      unsubCats();
      unsubAds();
    };
  }, []);

  // Direct file URL, Hash & Search query route handler
  useEffect(() => {
    const handleRoute = () => {
      const routeState = getInitialRouteState();

      if (routeState.isAdmin) {
        setIsAdminView(true);
        setDownloadRouteFileId(null);
        setSelectedFileForDownload(null);
        setLoadingDownloadFile(false);
        return;
      }

      setIsAdminView(false);

      if (routeState.downloadFileId) {
        setDownloadRouteFileId(routeState.downloadFileId);
        setLoadingDownloadFile(true);
        api.getFileById(routeState.downloadFileId)
          .then((f) => {
            setSelectedFileForDownload(f);
            setLoadingDownloadFile(false);
          })
          .catch((err) => {
            console.error("Failed to load file from URL:", err);
            setSelectedFileForDownload(null);
            setLoadingDownloadFile(false);
          });
      } else {
        setDownloadRouteFileId(null);
        setSelectedFileForDownload(null);
        setLoadingDownloadFile(false);
      }
    };

    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  // Auto-inject Popunder and Social Bar advertisement scripts for user dashboard when active
  useEffect(() => {
    if (!isAdminView && ads.length > 0) {
      const popunderAd = ads.find((a) => a.isEnabled && a.type === 'popunder');
      const socialBarAd = ads.find((a) => a.isEnabled && a.type === 'socialbar');

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

      const popUrl = extractScriptUrl(popunderAd?.code);
      const socialUrl = extractScriptUrl(socialBarAd?.code);

      let popunderScript: HTMLScriptElement | null = null;
      let socialBarScript: HTMLScriptElement | null = null;

      if (popUrl) {
        popunderScript = document.createElement('script');
        popunderScript.src = popUrl;
        popunderScript.async = true;
        document.body.appendChild(popunderScript);
      }

      if (socialUrl) {
        socialBarScript = document.createElement('script');
        socialBarScript.src = socialUrl;
        socialBarScript.async = true;
        document.body.appendChild(socialBarScript);
      }

      return () => {
        if (popunderScript && document.body.contains(popunderScript)) {
          document.body.removeChild(popunderScript);
        }
        if (socialBarScript && document.body.contains(socialBarScript)) {
          document.body.removeChild(socialBarScript);
        }
      };
    }
  }, [isAdminView, ads]);

  const loadCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAds = async () => {
    try {
      const data = await api.getPublicAds();
      setAds(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Realtime Files Subscription
  useEffect(() => {
    setLoadingFiles(true);
    let sortParam = sortBy;
    if (activeTab === 'trending') sortParam = 'downloads';
    if (activeTab === 'popular') sortParam = 'rating';

    const unsubFiles = api.subscribeFiles(
      {
        search: searchQuery,
        category: selectedCategory,
        sort: sortParam,
        featured: activeTab === 'featured' ? true : undefined,
      },
      (realtimeFiles) => {
        setFiles(realtimeFiles);
        setTotalPages(1);
        setTotalFilesCount(realtimeFiles.length);

        const dlSum = realtimeFiles.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);
        setTotalDownloadsCount(dlSum);
        setLoadingFiles(false);
      }
    );

    return () => unsubFiles();
  }, [searchQuery, selectedCategory, sortBy, activeTab, currentUser]);

  const fetchFiles = async () => {
    // Handled in real time by subscribeFiles
  };

  const handleLogout = () => {
    api.clearToken();
    setCurrentUser(null);
    setIsAdminView(false);
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  // Filter user's own files vs platform public files
  const myFiles = useMemo(() => {
    if (!currentUser) return [];
    const currentUid = auth.currentUser?.uid || currentUser.id;
    return files.filter((f) => {
      const owner = f.ownerUid || f.uploaderId;
      return owner === currentUid;
    });
  }, [files, currentUser]);

  const displayedFiles = useMemo(() => {
    if (currentUser && vaultScope === 'mine') {
      return myFiles;
    }
    return files;
  }, [files, myFiles, currentUser, vaultScope]);

  // Related files logic for download modal
  const relatedFiles = selectedFileForDownload
    ? files.filter(f => f.category === selectedFileForDownload.category && f.id !== selectedFileForDownload.id).slice(0, 4)
    : [];

  // Separate Admin System View
  if (isAdminView) {
    if (currentUser && currentUser.role === 'admin') {
      return (
        <AdminPanel
          currentUser={currentUser}
          categories={categories}
          ads={ads}
          onBackToSite={() => {
            setIsAdminView(false);
            window.history.pushState({}, '', '/');
          }}
          onAdminLogout={() => {
            localStorage.removeItem('filevault_admin_token');
            localStorage.removeItem('filevault_admin_user');
            setCurrentUser(null);
            setIsAdminView(true);
          }}
          onRefreshCategories={loadCategories}
          onRefreshAds={loadAds}
          onOpenUpload={handleOpenUpload}
        />
      );
    }

    return (
      <AdminLoginPage
        onAdminAuthenticated={(adminUser) => {
          setCurrentUser(adminUser);
          setIsAdminView(true);
        }}
        onBackToSite={() => {
          setIsAdminView(false);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // Standalone File Download Page View
  if (downloadRouteFileId || loadingDownloadFile) {
    if (loadingDownloadFile && !selectedFileForDownload) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between font-sans antialiased">
          <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
              <div
                onClick={() => {
                  setDownloadRouteFileId(null);
                  setLoadingDownloadFile(false);
                  setSelectedFileForDownload(null);
                  window.history.pushState({}, '', '/');
                }}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <span className="font-black text-sm text-white tracking-wide">FileVault</span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Shared Download
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login / Sign Up</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Loading Secure Download Page...</h3>
              <p className="text-xs text-zinc-400">Connecting to secure file mirror node</p>
            </div>
          </main>

          <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} FileVault. Secure Real-Time File Hosting Platform.</p>
          </footer>

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onAuthSuccess={(user) => {
              setCurrentUser(user);
            }}
          />
        </div>
      );
    }

    if (!selectedFileForDownload) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
          <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
              <div
                onClick={() => {
                  setDownloadRouteFileId(null);
                  setLoadingDownloadFile(false);
                  setSelectedFileForDownload(null);
                  window.history.pushState({}, '', '/');
                }}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <span className="font-black text-sm text-white tracking-wide">FileVault</span>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login / Sign Up</span>
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">File Not Found or Link Expired</h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                The requested file link may have been removed, deleted, or is temporarily unavailable.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDownloadRouteFileId(null);
                  setSelectedFileForDownload(null);
                  setLoadingDownloadFile(false);
                  window.history.pushState({}, '', '/');
                }}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Go to Homepage
              </button>
              <button
                type="button"
                onClick={handleOpenUpload}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                Upload Your File
              </button>
            </div>
          </main>

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onAuthSuccess={(user) => {
              setCurrentUser(user);
            }}
          />
          <FileUploadModal
            isOpen={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            categories={categories}
            onUploadSuccess={fetchFiles}
          />
        </div>
      );
    }

    const currentFileForDownload = files.find((f) => f.id === selectedFileForDownload.id) || selectedFileForDownload;

    return (
      <>
        <DownloadPage
          file={currentFileForDownload}
          onBackToHome={() => {
            setDownloadRouteFileId(null);
            setSelectedFileForDownload(null);
            setLoadingDownloadFile(false);
            window.history.pushState({}, '', '/');
          }}
          currentUser={currentUser}
          ads={ads}
          relatedFiles={relatedFiles}
          onSelectRelated={(f) => {
            setDownloadRouteFileId(f.id);
            setSelectedFileForDownload(f);
            setLoadingDownloadFile(false);
            window.history.pushState({}, '', `/download/${f.id}`);
          }}
          onOpenReport={(f) => setReportModalFile(f)}
          onOpenQRCode={(f) => setQrModalFile(f)}
          onOpenUpload={handleOpenUpload}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenUserProfile={() => setUserProfileModalOpen(true)}
          onDownloadSuccess={fetchFiles}
        />

        {/* Upload File Modal */}
        <FileUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          categories={categories}
          onUploadSuccess={fetchFiles}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            if (pendingUploadAfterAuth) {
              setPendingUploadAfterAuth(false);
              setUploadModalOpen(true);
            }
          }}
        />

        {/* User Profile Modal */}
        <UserProfileModal
          isOpen={userProfileModalOpen}
          onClose={() => setUserProfileModalOpen(false)}
          user={currentUser}
          onLogout={handleLogout}
          onSelectFile={(f) => {
            setDownloadRouteFileId(f.id);
            setSelectedFileForDownload(f);
            setLoadingDownloadFile(false);
            window.history.pushState({}, '', `/download/${f.id}`);
          }}
          onOpenQRCode={(f) => setQrModalFile(f)}
        />

        {/* Mobile QR Code Modal */}
        <QRCodeModal
          file={qrModalFile}
          isOpen={!!qrModalFile}
          onClose={() => setQrModalFile(null)}
        />

        {/* Report Modal */}
        <ReportModal
          file={reportModalFile}
          isOpen={!!reportModalFile}
          onClose={() => setReportModalFile(null)}
        />
      </>
    );
  }

  return (
    <div className={`${isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'} min-h-screen font-sans transition-colors pb-20 sm:pb-8`}>
      {/* Mobile-First App Layout Container */}
      <div className="max-w-md sm:max-w-xl mx-auto min-h-screen bg-zinc-950 border-x border-zinc-900/80 shadow-2xl flex flex-col justify-between relative">
        
        <div>
          {/* Main Mobile App Navbar */}
          <Navbar
            user={currentUser}
            onOpenUpload={() => {
              setActiveBottomNav('upload');
              handleOpenUpload();
            }}
            onOpenAuth={() => {
              setActiveBottomNav('account');
              if (currentUser) {
                setUserProfileModalOpen(true);
              } else {
                setAuthModalOpen(true);
              }
            }}
            onLogout={handleLogout}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            isDark={isDark}
            toggleTheme={toggleTheme}
            onGoHome={() => {
              setActiveBottomNav('vault');
              setSelectedCategory('all');
              setSearchQuery('');
              setActiveTab('all');
            }}
          />

          <main className="px-4 py-4 space-y-5">
            
            {/* User Dashboard Header Advertisement */}
            <AdDisplay ads={ads} location="header_top" type="banner" />

            {/* Fast Upload Hero Banner */}
            <div className="bg-gradient-to-br from-indigo-950/90 via-zinc-900 to-purple-950/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl text-center space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Fast File Storage
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                  100% Free & Unlimited
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-white tracking-tight">Upload & Share Any File</h2>
                <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                  Instant direct downloads for APKs, PDFs, archives, software, and media files.
                </p>
              </div>

              <button
                onClick={() => {
                  setActiveBottomNav('upload');
                  handleOpenUpload();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Tap to Upload File
              </button>
            </div>

            {/* Category Filter Chips Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-400" /> Categories
                </h3>
                {selectedCategory !== 'all' && (
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="text-[10px] text-indigo-400 hover:underline font-bold"
                  >
                    Show All
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition border ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                  }`}
                >
                  All
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition border ${
                      selectedCategory === cat.name
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Middle Native Ad */}
            <AdDisplay ads={ads} location="download_page_middle" type="native" />

            {/* File Vault Section */}
            <div className="space-y-3">
              {/* Vault Scope Toggle Headers */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setVaultScope('mine')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                      vaultScope === 'mine'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
                    <span>My Vault</span>
                    {currentUser && (
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                        vaultScope === 'mine' ? 'bg-indigo-700 text-white' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {myFiles.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setVaultScope('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                      vaultScope === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-300" />
                    <span>All Public Files</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold ${
                      vaultScope === 'all' ? 'bg-indigo-700 text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {files.length}
                    </span>
                  </button>
                </div>

                <span className="text-[10px] text-zinc-500 font-bold hidden sm:inline">
                  {vaultScope === 'mine' ? 'Isolated Private Storage' : 'Shared Cloud Files'}
                </span>
              </div>

              {/* Account State & File Listing */}
              {vaultScope === 'mine' && !currentUser ? (
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto text-zinc-400">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">Private Account File Isolation</h4>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Log in to view and manage your uploaded files privately.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveBottomNav('account');
                        setAuthModalOpen(true);
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                    >
                      Log In / Register
                    </button>
                    <button
                      onClick={() => setVaultScope('all')}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Browse Public
                    </button>
                  </div>
                </div>
              ) : loadingFiles ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-400">Loading files...</p>
                </div>
              ) : displayedFiles.length === 0 ? (
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 text-center space-y-3">
                  <HardDriveUpload className="w-9 h-9 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-300">
                      {vaultScope === 'mine' ? 'No Files in Your Private Vault' : 'No Public Files Found'}
                    </h4>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      {vaultScope === 'mine'
                        ? 'Upload your first file above to start sharing instant download links!'
                        : 'No public files match the selected filter. Be the first to upload one!'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveBottomNav('upload');
                      handleOpenUpload();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    Upload File Now
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      currentUser={currentUser}
                      onSelect={(f) => {
                        setDownloadRouteFileId(f.id);
                        setSelectedFileForDownload(f);
                        setLoadingDownloadFile(false);
                        window.history.pushState({}, '', `/download/${f.id}`);
                      }}
                      onShare={(f) => {
                        navigator.clipboard.writeText(`${window.location.origin}/download/${f.id}`);
                        alert(`Share link copied to clipboard!`);
                      }}
                      onDelete={(f) => {
                        setFileToDelete(f);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>

        {/* Sticky Bottom Advertisement Bar for Dashboard */}
        <div className="px-4 pb-2">
          <AdDisplay ads={ads} type="sticky" className="w-full text-center" />
        </div>

        {/* Mobile App Footer */}
        <Footer
          totalFiles={totalFilesCount}
          totalDownloads={totalDownloadsCount}
        />

        {/* Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 max-w-md sm:max-w-xl mx-auto px-6 py-2 flex items-center justify-between text-zinc-400">
          <button
            onClick={() => {
              setActiveBottomNav('vault');
              setSelectedCategory('all');
              setSearchQuery('');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition px-3 py-1 rounded-xl ${
              activeBottomNav === 'vault' ? 'text-indigo-400 bg-indigo-500/15' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            <span>Vault</span>
          </button>

          <button
            onClick={() => {
              setActiveBottomNav('upload');
              handleOpenUpload();
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold text-white bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/40 -mt-5 active:scale-95 transition border ${
              uploadModalOpen ? 'ring-2 ring-indigo-400 border-indigo-300' : 'border-indigo-500/50'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span className="sr-only">Upload</span>
          </button>

          <button
            onClick={() => {
              setActiveBottomNav('account');
              if (currentUser) {
                setUserProfileModalOpen(true);
              } else {
                setAuthModalOpen(true);
              }
            }}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition px-3 py-1 rounded-xl ${
              activeBottomNav === 'account' || authModalOpen || userProfileModalOpen ? 'text-indigo-400 bg-indigo-500/15' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {currentUser ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            <span>{currentUser ? 'Account' : 'Login'}</span>
          </button>
        </nav>

      </div>

      {/* Upload File Modal */}
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        categories={categories}
        onUploadSuccess={fetchFiles}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          if (pendingUploadAfterAuth) {
            setPendingUploadAfterAuth(false);
            setUploadModalOpen(true);
          }
        }}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={userProfileModalOpen}
        onClose={() => {
          setUserProfileModalOpen(false);
          setActiveBottomNav('vault');
        }}
        user={currentUser}
        onLogout={handleLogout}
        onSelectFile={(f) => {
          setDownloadRouteFileId(f.id);
          setSelectedFileForDownload(f);
          setLoadingDownloadFile(false);
          window.history.pushState({}, '', `/download/${f.id}`);
        }}
        onOpenQRCode={(f) => setQrModalFile(f)}
      />

      {/* Mobile QR Code Modal */}
      <QRCodeModal
        file={qrModalFile}
        isOpen={!!qrModalFile}
        onClose={() => setQrModalFile(null)}
      />

      {/* Report Modal */}
      <ReportModal
        file={reportModalFile}
        isOpen={!!reportModalFile}
        onClose={() => setReportModalFile(null)}
      />

      {/* Custom Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!fileToDelete}
        file={fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={async (f) => {
          await api.deleteFile(f.id);
          await fetchFiles();
        }}
      />

    </div>
  );
}
