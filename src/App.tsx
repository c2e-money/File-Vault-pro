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
import { FileUploadModal } from './components/FileUploadModal.js';
import { DownloadModal } from './components/DownloadModal.js';
import { QRCodeModal } from './components/QRCodeModal.js';
import { ReportModal } from './components/ReportModal.js';
import { AuthModal } from './components/AuthModal.js';
import { registerBackgroundAds } from './lib/adScriptManager.js';
import { UserProfileModal } from './components/UserProfileModal.js';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal.js';
import { DownloadPage } from './components/DownloadPage.js';
import { AdminPanel } from './components/AdminPanel/AdminPanel.js';
import { AdminLoginPage } from './components/AdminPanel/AdminLoginPage.js';
import { FileItem, User, Category, Advertisement, WebsiteSettings, getShareableDownloadUrl } from './types.js';
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
    downloadFileId = decodeURIComponent(pathname.replace('/download/', '')).split('/')[0] || null;
  } else if (pathname.startsWith('/file/')) {
    downloadFileId = decodeURIComponent(pathname.replace('/file/', '')).split('/')[0] || null;
  } else if (hash.startsWith('#download-')) {
    downloadFileId = hash.replace('#download-', '') || null;
  } else if (hash.startsWith('#file-')) {
    downloadFileId = hash.replace('#file-', '') || null;
  }

  // Extract real file ID if formatted as slug_fileId
  if (downloadFileId && downloadFileId.includes('_')) {
    const parts = downloadFileId.split('_');
    downloadFileId = parts[parts.length - 1] || downloadFileId;
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
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings | null>(null);
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

    api.getSettings().then(setSiteSettings).catch(console.error);

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

  // Auto-inject Popunder and Social Bar advertisement scripts globally when active
  useEffect(() => {
    if (!isAdminView && ads.length > 0) {
      registerBackgroundAds(ads);
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
    const currentUid = (auth.currentUser?.uid || currentUser.id || '').toLowerCase();
    const userEmail = (currentUser.email || '').toLowerCase();
    const username = (currentUser.username || '').toLowerCase();

    return files.filter((f) => {
      const owner = (f.ownerUid || f.uploaderId || '').toLowerCase();
      const uploaderName = (f.uploaderName || '').toLowerCase();

      return (
        owner === currentUid ||
        owner === (currentUser.id || '').toLowerCase() ||
        (userEmail && owner === userEmail) ||
        (userEmail && uploaderName === userEmail) ||
        (username && uploaderName === username)
      );
    });
  }, [files, currentUser]);

  const displayedFiles = useMemo(() => {
    if (currentUser) {
      return myFiles;
    }
    return [];
  }, [myFiles, currentUser]);

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
          defaultTimerSeconds={siteSettings?.defaultDownloadTimer ?? 5}
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
    <div className={`${isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'} min-h-screen font-sans transition-colors pb-20 sm:pb-8 w-full max-w-full overflow-x-hidden`}>
      {/* Mobile-First App Layout Container */}
      <div className="w-full max-w-md sm:max-w-xl mx-auto min-h-screen bg-zinc-950 border-x border-zinc-900/80 shadow-2xl flex flex-col justify-between relative overflow-x-hidden">
        
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

            {/* WhatsApp Support Banner Card */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2.5 shadow-md max-w-full overflow-hidden">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center shrink-0 text-[#25D366]">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.176-1.338c1.45.79 3.097 1.222 4.836 1.222 5.506 0 9.989-4.478 9.989-9.984s-4.483-9.984-9.989-9.984zm0 18.281c-1.503 0-2.981-.403-4.275-1.168l-.307-.182-3.176.821.849-3.093-.2-.318A8.257 8.257 0 0 1 3.722 11.98c0-4.57 3.719-8.284 8.29-8.284 4.571 0 8.29 3.714 8.29 8.284 0 4.571-3.719 8.281-8.29 8.281zm4.542-6.206c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.792 6.792 0 0 1-1.998-1.233 7.488 7.488 0 0 1-1.383-1.722c-.145-.249-.016-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.768-1.847-.203-.486-.41-.42-.56-.427h-.477c-.166 0-.435.062-.664.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.407 1.016 2.573.125.166 1.756 2.682 4.254 3.761.594.257 1.058.41 1.42.525.597.19 1.141.163 1.571.099.479-.071 1.472-.602 1.68-1.183.208-.581.208-1.079.145-1.183-.063-.104-.228-.166-.477-.291z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    WhatsApp Support
                    <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 whitespace-nowrap">24/7</span>
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-emerald-200/80 truncate">SMS {siteSettings?.whatsappNumber || '+918811896374'} on WhatsApp</p>
                </div>
              </div>
              <a
                href={`https://wa.me/${(siteSettings?.whatsappNumber || '+918811896374').replace(/[^0-9]/g, '')}?text=Hello%20FileVault%20Support`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-xl shadow-md transition shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Chat</span>
              </a>
            </div>

            {/* File Vault Section */}
            <div className="space-y-3">
              {/* Vault Scope Header */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide">My Storage Vault</h3>
                  {currentUser && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                      {myFiles.length} {myFiles.length === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 font-bold">Isolated Private Storage</span>
              </div>

              {/* Account State & File Listing */}
              {!currentUser ? (
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto text-zinc-400">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white">Private Account Vault</h4>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Log in to view and manage your uploaded files privately.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveBottomNav('account');
                      setAuthModalOpen(true);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    Log In / Register
                  </button>
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
                      No Files in Your Private Vault
                    </h4>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Upload your first file above to start sharing instant download links!
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
                        const shareUrl = getShareableDownloadUrl(f);
                        window.history.pushState({}, '', shareUrl);
                      }}
                      onShare={(f) => {
                        const shareUrl = getShareableDownloadUrl(f);
                        navigator.clipboard.writeText(shareUrl);
                        alert(`Share link copied to clipboard!\n${shareUrl}`);
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

      {/* Floating WhatsApp Support Button */}
      <a
        href={`https://wa.me/${(siteSettings?.whatsappNumber || '+918811896374').replace(/[^0-9]/g, '')}?text=Hello%20FileVault%20Support`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 py-2.5 rounded-full shadow-xl shadow-emerald-950/60 font-bold text-xs transition-all transform hover:scale-105 active:scale-95 cursor-pointer border border-emerald-400/40"
        title={`Contact Support on WhatsApp (${siteSettings?.whatsappNumber || '+918811896374'})`}
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.176-1.338c1.45.79 3.097 1.222 4.836 1.222 5.506 0 9.989-4.478 9.989-9.984s-4.483-9.984-9.989-9.984zm0 18.281c-1.503 0-2.981-.403-4.275-1.168l-.307-.182-3.176.821.849-3.093-.2-.318A8.257 8.257 0 0 1 3.722 11.98c0-4.57 3.719-8.284 8.29-8.284 4.571 0 8.29 3.714 8.29 8.284 0 4.571-3.719 8.281-8.29 8.281zm4.542-6.206c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.792 6.792 0 0 1-1.998-1.233 7.488 7.488 0 0 1-1.383-1.722c-.145-.249-.016-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.768-1.847-.203-.486-.41-.42-.56-.427h-.477c-.166 0-.435.062-.664.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.407 1.016 2.573.125.166 1.756 2.682 4.254 3.761.594.257 1.058.41 1.42.525.597.19 1.141.163 1.571.099.479-.071 1.472-.602 1.68-1.183.208-.581.208-1.079.145-1.183-.063-.104-.228-.166-.477-.291z"/>
        </svg>
        <span className="font-extrabold text-xs tracking-wide">Support</span>
      </a>

    </div>
  );
}
