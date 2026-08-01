import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase.js';
import {
  FileItem,
  User,
  Category,
  Advertisement,
  Comment,
  Report,
  WebsiteSettings,
  ActivityLog,
  AdminStats,
  getShareableDownloadUrl,
} from '../types.js';

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Software & Apps', slug: 'software-apps', description: 'Installers, utilities, and applications', icon: 'Code', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Documents & PDFs', slug: 'documents-pdfs', description: 'PDFs, DOCX, TXT, and spreadsheets', icon: 'FileText', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Images & Graphics', slug: 'images-graphics', description: 'Wallpapers, photos, vectors, and icons', icon: 'Image', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Audio & Music', slug: 'audio-music', description: 'FLAC, MP3, podcasts, and sound tracks', icon: 'Music', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Videos & Movies', slug: 'videos-movies', description: 'MP4, MKV, tutorials, and recordings', icon: 'Video', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Archives & Zips', slug: 'archives-zips', description: 'ZIP, RAR, 7Z, and TAR archives', icon: 'Archive', fileCount: 0, createdAt: new Date().toISOString() },
  { name: 'Mobile APKs', slug: 'mobile-apks', description: 'Android application packages', icon: 'Smartphone', fileCount: 0, createdAt: new Date().toISOString() },
];

const DEFAULT_ADS: Omit<Advertisement, 'id'>[] = [
  {
    title: 'High-Speed Cloud VPS Servers',
    type: 'banner',
    code: '<div class="ad-vps">High-Speed Cloud Servers</div>',
    location: 'home_top',
    isEnabled: true,
    clicks: 12,
    impressions: 450,
    createdAt: new Date().toISOString(),
  },
  {
    title: 'Secure File Encryption Tool',
    type: 'native',
    code: '<div class="ad-encrypt">Zero-Knowledge File Encryption</div>',
    location: 'download_page_top',
    isEnabled: true,
    clicks: 8,
    impressions: 310,
    createdAt: new Date().toISOString(),
  },
];

// Helper to seed initial categories if collection is empty
async function ensureInitialData() {
  try {
    const catSnap = await getDocs(collection(db, 'categories'));
    if (catSnap.empty) {
      for (const cat of DEFAULT_CATEGORIES) {
        await addDoc(collection(db, 'categories'), cat);
      }
    }

    const adSnap = await getDocs(collection(db, 'ads'));
    if (adSnap.empty) {
      for (const ad of DEFAULT_ADS) {
        await addDoc(collection(db, 'ads'), ad);
      }
    }
  } catch (e) {
    console.warn('Initial data seeding check:', e);
  }
}

// Trigger initialization seeding
ensureInitialData();

export const api = {
  // Auth Services
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = userCredential.user;

    const userDocRef = doc(db, 'users', fbUser.uid);
    const userSnap = await getDoc(userDocRef);

    let userData: User;
    if (userSnap.exists()) {
      userData = userSnap.data() as User;
    } else {
      userData = {
        id: fbUser.uid,
        email: fbUser.email || email,
        username: email.split('@')[0],
        role: email.includes('admin') ? 'admin' : 'user',
        status: 'active',
        createdAt: new Date().toISOString(),
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`,
      };
      await setDoc(userDocRef, userData);
    }

    return { token: fbUser.uid, user: userData };
  },

  async adminLogin(email: string, password: string): Promise<{ token: string; user: User }> {
    const cleanEmail = email.trim().toLowerCase();
    let serverErrorMsg = '';

    // 1. Try Express backend admin login endpoint
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.token && data.user) {
          localStorage.setItem('filevault_admin_token', data.token);
          localStorage.setItem('filevault_admin_user', JSON.stringify(data.user));
          localStorage.setItem('filevault_token', data.token);
          localStorage.setItem('filevault_user', JSON.stringify(data.user));
          return data;
        }
      } else if (contentType.includes('application/json')) {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          serverErrorMsg = errJson.error;
        }
      }
    } catch (e: any) {
      console.warn('Server admin login attempt note:', e);
    }

    // 2. Fallback admin credentials check for Vercel & client deployments
    const isStandardAdminEmail =
      cleanEmail === 'dipenshort@gmail.com' ||
      cleanEmail === 'dipenshorts@gmail.com' ||
      cleanEmail === 'dipen8717@gmail.com' ||
      cleanEmail === 'admin' ||
      cleanEmail === 'admin@filevault.com';

    const isStandardAdminPass =
      password === 'Dipen&Biswas9101' ||
      password === 'admin123' ||
      password === 'admin';

    // 3. Try Firebase Auth login
    try {
      const res = await this.login(cleanEmail, password);
      if (
        res.user.role === 'admin' ||
        res.user.email?.toLowerCase().includes('admin') ||
        isStandardAdminEmail
      ) {
        const adminUser: User = { ...res.user, role: 'admin' };
        localStorage.setItem('filevault_admin_token', res.token);
        localStorage.setItem('filevault_admin_user', JSON.stringify(adminUser));
        localStorage.setItem('filevault_token', res.token);
        localStorage.setItem('filevault_user', JSON.stringify(adminUser));
        return { token: res.token, user: adminUser };
      } else {
        throw new Error('Access denied. Account does not have Administrator privileges.');
      }
    } catch (fbErr: any) {
      // If Firebase login throws invalid-credential/user-not-found, but credentials match configured admin credentials:
      if (isStandardAdminEmail && isStandardAdminPass) {
        try {
          const targetEmail = cleanEmail.includes('@') ? cleanEmail : 'dipenshorts@gmail.com';
          const userCred = await createUserWithEmailAndPassword(auth, targetEmail, password);
          const adminUser: User = {
            id: userCred.user.uid,
            username: 'Dipen Biswas',
            email: targetEmail,
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', userCred.user.uid), adminUser);
          localStorage.setItem('filevault_admin_token', userCred.user.uid);
          localStorage.setItem('filevault_admin_user', JSON.stringify(adminUser));
          localStorage.setItem('filevault_token', userCred.user.uid);
          localStorage.setItem('filevault_user', JSON.stringify(adminUser));
          return { token: userCred.user.uid, user: adminUser };
        } catch {
          const adminUser: User = {
            id: 'usr-admin-master',
            username: 'Dipen Biswas',
            email: cleanEmail.includes('@') ? cleanEmail : 'dipenshorts@gmail.com',
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString(),
          };
          const staticToken = 'admin-token-' + Date.now();
          localStorage.setItem('filevault_admin_token', staticToken);
          localStorage.setItem('filevault_admin_user', JSON.stringify(adminUser));
          localStorage.setItem('filevault_token', staticToken);
          localStorage.setItem('filevault_user', JSON.stringify(adminUser));
          return { token: staticToken, user: adminUser };
        }
      }

      throw new Error(serverErrorMsg || fbErr.message || 'Invalid administrator credentials.');
    }
  },

  async register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = userCredential.user;

    const userData: User = {
      id: fbUser.uid,
      email: fbUser.email || email,
      username: username || email.split('@')[0],
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100`,
    };

    await setDoc(doc(db, 'users', fbUser.uid), userData);

    // Log Activity
    await this.logActivity('user_signup', `New user registered: ${username}`, fbUser.uid);

    return { token: fbUser.uid, user: userData };
  },

  async isAdminUser(): Promise<boolean> {
    const adminToken = localStorage.getItem('filevault_admin_token');
    const adminUserStr = localStorage.getItem('filevault_admin_user');
    if (adminToken || adminUserStr) {
      if (adminUserStr) {
        try {
          const parsed = JSON.parse(adminUserStr);
          if (parsed && parsed.role === 'admin') return true;
        } catch {}
      }
      if (adminToken) return true;
    }

    const currentUser = await this.getCurrentUser();
    if (currentUser && currentUser.role === 'admin') return true;

    const email = (auth.currentUser?.email || currentUser?.email || '').trim().toLowerCase();
    const adminEmails = [
      'dipenshorts@gmail.com',
      'dipenshort@gmail.com',
      'dipen8717@gmail.com',
      'admin@filevault.com',
      'admin',
    ];

    if (adminEmails.includes(email) || email.includes('admin')) {
      return true;
    }

    return false;
  },

  async getCurrentUser(): Promise<User | null> {
    const adminUserStr = localStorage.getItem('filevault_admin_user');
    if (adminUserStr) {
      try {
        const parsed = JSON.parse(adminUserStr);
        if (parsed && parsed.role === 'admin') {
          return parsed;
        }
      } catch (e) {}
    }

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        unsubscribe();
        if (!fbUser) {
          resolve(null);
          return;
        }
        try {
          const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
          const cleanEmail = (fbUser.email || '').toLowerCase();
          const isKnownAdmin =
            cleanEmail === 'dipenshorts@gmail.com' ||
            cleanEmail === 'dipenshort@gmail.com' ||
            cleanEmail === 'dipen8717@gmail.com' ||
            cleanEmail === 'admin@filevault.com' ||
            cleanEmail.includes('admin');

          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            if (isKnownAdmin && userData.role !== 'admin') {
              userData.role = 'admin';
              setDoc(doc(db, 'users', fbUser.uid), { role: 'admin' }, { merge: true }).catch(() => {});
            }
            resolve(userData);
          } else {
            const fallbackUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              username: fbUser.email ? fbUser.email.split('@')[0] : 'User',
              role: isKnownAdmin ? 'admin' : 'user',
              status: 'active',
              createdAt: new Date().toISOString(),
            };
            if (isKnownAdmin) {
              setDoc(doc(db, 'users', fbUser.uid), fallbackUser).catch(() => {});
            }
            resolve(fallbackUser);
          }
        } catch {
          resolve(null);
        }
      });
    });
  },

  subscribeCurrentUser(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        const adminUserStr = localStorage.getItem('filevault_admin_user');
        if (adminUserStr) {
          try {
            const parsed = JSON.parse(adminUserStr);
            if (parsed && parsed.role === 'admin') {
              callback(parsed);
              return;
            }
          } catch {}
        }
        callback(null);
        return;
      }
      onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
        const cleanEmail = (fbUser.email || '').toLowerCase();
        const isKnownAdmin =
          cleanEmail === 'dipenshorts@gmail.com' ||
          cleanEmail === 'dipenshort@gmail.com' ||
          cleanEmail === 'dipen8717@gmail.com' ||
          cleanEmail === 'admin@filevault.com' ||
          cleanEmail.includes('admin');

        if (snap.exists()) {
          const data = snap.data() as User;
          callback({
            ...data,
            id: fbUser.uid,
            email: fbUser.email || data.email || '',
            role: isKnownAdmin ? 'admin' : (data.role || 'user'),
          });
        } else {
          callback({
            id: fbUser.uid,
            email: fbUser.email || '',
            username: fbUser.email ? fbUser.email.split('@')[0] : 'User',
            role: isKnownAdmin ? 'admin' : 'user',
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
      });
    });
  },

  subscribeUserFiles(userId: string, callback: (userFiles: FileItem[]) => void) {
    if (!userId) {
      callback([]);
      return () => {};
    }
    const filesRef = collection(db, 'files');

    let storedUser: any = null;
    try {
      const raw = localStorage.getItem('filevault_user') || localStorage.getItem('filevault_admin_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {}

    const firebaseUid = auth.currentUser?.uid;
    const userEmail = storedUser?.email?.toLowerCase();
    const userUsername = storedUser?.username?.toLowerCase();
    const userIdLower = userId.toLowerCase();

    return onSnapshot(filesRef, (snapshot) => {
      const userList: FileItem[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const docOwner = (data.ownerUid || '').toLowerCase();
        const docUploader = (data.uploaderId || '').toLowerCase();
        const docUploaderName = (data.uploaderName || '').toLowerCase();

        const isMatch =
          docOwner === userIdLower ||
          docUploader === userIdLower ||
          (firebaseUid && (docOwner === firebaseUid.toLowerCase() || docUploader === firebaseUid.toLowerCase())) ||
          (storedUser?.id && (docOwner === storedUser.id.toLowerCase() || docUploader === storedUser.id.toLowerCase())) ||
          (userEmail && (docOwner === userEmail || docUploader === userEmail || docUploaderName === userEmail)) ||
          (userUsername && docUploaderName === userUsername);

        if (isMatch) {
          const origName = data.originalName || data.name || 'Untitled File';
          const fileUrl = data.filePath || data.fileUrl || data.downloadUrl || '';
          userList.push({
            id: docSnap.id,
            originalName: origName,
            filename: origName,
            filePath: fileUrl,
            fileSize: Number(data.fileSize || data.size || 0),
            mimeType: data.mimeType || 'application/octet-stream',
            category: data.category || 'General',
            uploaderId: data.uploaderId || data.ownerUid || '',
            ownerUid: data.ownerUid || data.uploaderId || '',
            uploaderName: data.uploaderName || 'Anonymous',
            description: data.description || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            isPasswordProtected: Boolean(data.isPasswordProtected),
            password: data.password || '',
            isDraft: Boolean(data.isDraft),
            isFeatured: Boolean(data.isFeatured),
            scheduledAt: data.scheduledAt || null,
            downloadsCount: data.downloadsCount ?? data.downloads ?? 0,
            viewsCount: data.viewsCount || 0,
            storageType: 'local' as const,
            ratingAvg: data.ratingAvg || 5.0,
            ratingCount: data.ratingCount || 1,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          } as FileItem);
        }
      });

      userList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(userList);
    });
  },

  async logout(): Promise<void> {
    await signOut(auth);
  },

  clearToken() {
    signOut(auth).catch(() => {});
  },

  // File Services
  subscribeFiles(
    params: {
      search?: string;
      category?: string;
      sort?: string;
      featured?: boolean;
      uploaderId?: string;
    },
    callback: (files: FileItem[]) => void
  ) {
    const filesRef = collection(db, 'files');

    return onSnapshot(filesRef, (snapshot) => {
      let fileList: FileItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const origName = data.originalName || data.name || 'Untitled File';
        const fileUrl = data.filePath || data.fileUrl || data.downloadUrl || '';

        const ownerUid = data.ownerUid || data.uploaderId || '';
        return {
          id: docSnap.id,
          originalName: origName,
          filename: origName,
          filePath: fileUrl,
          fileSize: data.fileSize || data.size || 0,
          mimeType: data.mimeType || 'application/octet-stream',
          category: data.category || 'General',
          uploaderId: ownerUid,
          ownerUid: ownerUid,
          uploaderName: data.uploaderName || 'Anonymous',
          description: data.description || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          isPasswordProtected: Boolean(data.isPasswordProtected),
          password: data.password || '',
          isDraft: Boolean(data.isDraft),
          isFeatured: Boolean(data.isFeatured),
          scheduledAt: data.scheduledAt || null,
          downloadsCount: data.downloadsCount ?? data.downloads ?? 0,
          viewsCount: data.viewsCount || 0,
          storageType: 'local' as const,
          ratingAvg: data.ratingAvg || 5.0,
          ratingCount: data.ratingCount || 1,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        } as FileItem;
      });

      // Filter draft files unless owned by logged-in user or admin
      const firebaseUid = auth.currentUser?.uid;
      let storedUser: any = null;
      try {
        const raw = localStorage.getItem('filevault_user') || localStorage.getItem('filevault_admin_user');
        if (raw) storedUser = JSON.parse(raw);
      } catch {}

      const activeUid = firebaseUid || storedUser?.id;
      const isAdmin = storedUser?.role === 'admin' || Boolean(localStorage.getItem('filevault_admin_token'));

      fileList = fileList.filter((f) => {
        if (f.isDraft) {
          const isOwner =
            isAdmin ||
            (activeUid && (f.uploaderId === activeUid || f.ownerUid === activeUid)) ||
            (storedUser?.email && (f.uploaderName?.toLowerCase() === storedUser.email.toLowerCase())) ||
            (storedUser?.username && (f.uploaderName?.toLowerCase() === storedUser.username.toLowerCase()));
          if (!isOwner) return false;
        }
        if (params.uploaderId && f.uploaderId !== params.uploaderId && f.ownerUid !== params.uploaderId) return false;
        if (params.category && params.category !== 'all' && f.category !== params.category) return false;
        if (params.featured && !f.isFeatured) return false;
        if (params.search && params.search.trim()) {
          const q = params.search.toLowerCase();
          const matchTitle = f.originalName.toLowerCase().includes(q);
          const matchDesc = f.description?.toLowerCase().includes(q);
          const matchTag = f.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchTag) return false;
        }
        return true;
      });

      // Sorting
      fileList.sort((a, b) => {
        if (params.sort === 'downloads') return (b.downloadsCount || 0) - (a.downloadsCount || 0);
        if (params.sort === 'rating') return (b.ratingAvg || 0) - (a.ratingAvg || 0);
        if (params.sort === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      callback(fileList);
    });
  },

  async getFiles(params?: {
    search?: string;
    category?: string;
    sort?: string;
    page?: number;
    limit?: number;
    featured?: boolean;
    scope?: string;
    uploaderId?: string;
  }): Promise<{ files: FileItem[]; total: number; page: number; totalPages: number }> {
    const snapshot = await getDocs(collection(db, 'files'));
    let fileList: FileItem[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const origName = data.originalName || data.name || 'Untitled File';
      const fileUrl = data.filePath || data.fileUrl || data.downloadUrl || '';

      const ownerUid = data.ownerUid || data.uploaderId || '';
      return {
        id: docSnap.id,
        originalName: origName,
        filename: origName,
        filePath: fileUrl,
        fileSize: data.fileSize || data.size || 0,
        mimeType: data.mimeType || 'application/octet-stream',
        category: data.category || 'General',
        uploaderId: ownerUid,
        ownerUid: ownerUid,
        uploaderName: data.uploaderName || 'Anonymous',
        description: data.description || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        isPasswordProtected: Boolean(data.isPasswordProtected),
        password: data.password || '',
        isDraft: Boolean(data.isDraft),
        isFeatured: Boolean(data.isFeatured),
        scheduledAt: data.scheduledAt || null,
        downloadsCount: data.downloadsCount ?? data.downloads ?? 0,
        viewsCount: data.viewsCount || 0,
        storageType: 'gdrive',
        ratingAvg: data.ratingAvg || 5.0,
        ratingCount: data.ratingCount || 1,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      } as FileItem;
    });

    const currentUid = auth.currentUser?.uid;
    fileList = fileList.filter((f) => {
      if (f.isDraft && f.uploaderId !== currentUid) return false;
      if (params?.uploaderId && f.uploaderId !== params.uploaderId) return false;
      if (params?.category && params.category !== 'all' && f.category !== params.category) return false;
      if (params?.featured && !f.isFeatured) return false;
      if (params?.search && params.search.trim()) {
        const q = params.search.toLowerCase();
        const matchTitle = f.originalName.toLowerCase().includes(q);
        const matchDesc = f.description?.toLowerCase().includes(q);
        const matchTag = f.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTag) return false;
      }
      return true;
    });

    fileList.sort((a, b) => {
      if (params?.sort === 'downloads') return (b.downloadsCount || 0) - (a.downloadsCount || 0);
      if (params?.sort === 'rating') return (b.ratingAvg || 0) - (a.ratingAvg || 0);
      if (params?.sort === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = fileList.length;
    const pageNum = params?.page || 1;
    const pageSize = params?.limit || 12;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paginated = fileList.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    return {
      files: paginated,
      total,
      page: pageNum,
      totalPages,
    };
  },

  async getFileById(id: string): Promise<FileItem> {
    const targetId = id && id.includes('_') ? id.split('_').pop()! : id;
    let docSnap = await getDoc(doc(db, 'files', targetId));
    if (!docSnap.exists() && targetId !== id) {
      docSnap = await getDoc(doc(db, 'files', id));
    }
    if (!docSnap.exists()) {
      throw new Error('File not found in database');
    }
    const data = docSnap.data();
    const origName = data.originalName || data.name || 'Untitled File';
    const fileUrl = data.filePath || data.fileUrl || data.downloadUrl || '';

    const ownerUid = data.ownerUid || data.uploaderId || '';
    return {
      id: docSnap.id,
      originalName: origName,
      filename: origName,
      filePath: fileUrl,
      fileSize: data.fileSize || data.size || 0,
      mimeType: data.mimeType || 'application/octet-stream',
      category: data.category || 'General',
      uploaderId: ownerUid,
      ownerUid: ownerUid,
      uploaderName: data.uploaderName || 'Anonymous',
      description: data.description || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      isPasswordProtected: Boolean(data.isPasswordProtected),
      password: data.password || '',
      isDraft: Boolean(data.isDraft),
      isFeatured: Boolean(data.isFeatured),
      scheduledAt: data.scheduledAt || null,
      downloadsCount: data.downloadsCount ?? data.downloads ?? 0,
      viewsCount: data.viewsCount || 0,
      storageType: 'gdrive',
      ratingAvg: data.ratingAvg || 5.0,
      ratingCount: data.ratingCount || 1,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    } as FileItem;
  },

  async uploadFilesWithProgress(
    formDataOrFiles: FormData | File[],
    onProgress: (percent: number) => void,
    optionalMetadata?: {
      category?: string;
      description?: string;
      tags?: string;
      isPasswordProtected?: boolean;
      password?: string;
      isDraft?: boolean;
    },
    onXhrCreated?: (xhr: XMLHttpRequest) => void
  ): Promise<{ message: string; files: FileItem[] }> {
    let files: File[] = [];
    let category = optionalMetadata?.category || 'General';
    let description = optionalMetadata?.description || '';
    let tags = optionalMetadata?.tags || '';
    let isPasswordProtected = optionalMetadata?.isPasswordProtected || false;
    let password = optionalMetadata?.password || '';
    let isDraft = optionalMetadata?.isDraft || false;

    let formData: FormData;
    if (formDataOrFiles instanceof FormData) {
      formData = formDataOrFiles;
      const extracted = formData.getAll('files');
      files = extracted.filter((item): item is File => item instanceof File);
      category = (formData.get('category') as string) || category;
      description = (formData.get('description') as string) || description;
      tags = (formData.get('tags') as string) || tags;
      isPasswordProtected = formData.get('isPasswordProtected') === 'true' || isPasswordProtected;
      password = (formData.get('password') as string) || password;
      isDraft = formData.get('isDraft') === 'true' || isDraft;
    } else {
      files = formDataOrFiles;
      formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('category', category);
      formData.append('description', description);
      formData.append('tags', tags);
      formData.append('isPasswordProtected', isPasswordProtected.toString());
      formData.append('password', password);
      formData.append('isDraft', isDraft.toString());
    }

    if (!files || files.length === 0) {
      throw new Error('No files provided for upload');
    }

    const currentUser = await this.getCurrentUser();
    const activeUid = auth.currentUser?.uid || currentUser?.id || 'guest';
    const uploaderName = currentUser?.username || currentUser?.email || auth.currentUser?.email || 'Anonymous';

    formData.append('ownerUid', activeUid);
    formData.append('uploaderId', activeUid);

    const responseJson = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (onXhrCreated) {
        onXhrCreated(xhr);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error(`Server response error (${xhr.status}): ${xhr.responseText ? xhr.responseText.substring(0, 100) : 'Empty response'}`));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText ? xhr.responseText.substring(0, 100) : 'No detail'}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during file upload'));
      };

      xhr.onabort = () => {
        const abortErr: any = new Error('Upload cancelled');
        abortErr.code = 'storage/canceled';
        reject(abortErr);
      };

      xhr.open('POST', '/api/files/upload');
      if (activeUid && activeUid !== 'guest') {
        xhr.setRequestHeader('x-user-uid', activeUid);
      }
      xhr.send(formData);
    });

    const serverFiles = responseJson.files || [];
    const tagsArray = typeof tags === 'string'
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const createdRecords: FileItem[] = [];

    for (const sFile of serverFiles) {
      const fileDocRef = doc(collection(db, 'files'));
      const downloadUrl = `${window.location.origin}/api/files/download-by-name/${sFile.filename}?name=${encodeURIComponent(sFile.originalName)}`;
      const resolvedDirectUrl = sFile.externalUrl || (sFile.filePath && (sFile.filePath.startsWith('http://') || sFile.filePath.startsWith('https://')) ? sFile.filePath : null);

      const fileRecord = {
        originalName: sFile.originalName,
        filename: sFile.filename,
        filePath: resolvedDirectUrl || downloadUrl,
        fileSize: sFile.fileSize,
        mimeType: sFile.mimeType || 'application/octet-stream',
        storagePath: sFile.filename,
        category: category || 'General',
        description: description || '',
        tags: tagsArray,
        isPasswordProtected: Boolean(isPasswordProtected),
        password: password || '',
        isDraft: Boolean(isDraft),
        isFeatured: false,
        scheduledAt: null,
        ownerUid: activeUid,
        uploaderId: activeUid,
        uploaderName,
        downloadsCount: 0,
        viewsCount: 0,
        storageType: (sFile.storageType || 'google_drive') as any,
        driveFileId: sFile.driveFileId || '',
        driveViewUrl: sFile.driveViewUrl || '',
        driveDownloadUrl: sFile.driveDownloadUrl || resolvedDirectUrl || '',
        externalUrl: resolvedDirectUrl || '',
        ratingAvg: 5.0,
        ratingCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(fileDocRef, fileRecord);

      await this.logActivity('file_upload', `Uploaded file to server: ${sFile.originalName}`, activeUid);

      createdRecords.push({
        id: fileDocRef.id,
        ...fileRecord,
      });
    }

    onProgress(100);

    return {
      message: 'Files uploaded successfully to server storage and metadata saved to Firestore!',
      files: createdRecords,
    };
  },

  async addExternalLinkFile(data: {
    originalName: string;
    externalUrl: string;
    fileSize?: string | number;
    category?: string;
    description?: string;
    tags?: string;
    isPasswordProtected?: boolean;
    password?: string;
    isDraft?: boolean;
    scheduledAt?: string;
  }): Promise<{ message: string; file: FileItem }> {
    const currentUser = await this.getCurrentUser();
    const activeUid = auth.currentUser?.uid || currentUser?.id || 'guest';
    const uploaderName = currentUser?.username || currentUser?.email || auth.currentUser?.email || 'Anonymous';

    const isMediaFire = data.externalUrl.toLowerCase().includes('mediafire.com');

    const res = await fetch('/api/files/external-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-uid': activeUid,
      },
      body: JSON.stringify({
        ...data,
        uploaderName,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add external link file');
    }

    const result = await res.json();
    const serverFile: FileItem = result.file;

    try {
      const fileDocRef = doc(db, 'files', serverFile.id);
      await setDoc(fileDocRef, {
        originalName: serverFile.originalName,
        filename: serverFile.filename,
        filePath: serverFile.filePath,
        fileSize: serverFile.fileSize,
        mimeType: 'application/octet-stream',
        category: serverFile.category,
        description: serverFile.description || '',
        tags: serverFile.tags || [],
        isPasswordProtected: serverFile.isPasswordProtected,
        password: serverFile.password || '',
        isDraft: serverFile.isDraft,
        isFeatured: false,
        scheduledAt: serverFile.scheduledAt || null,
        downloadsCount: 0,
        viewsCount: 0,
        storageType: serverFile.storageType,
        externalUrl: serverFile.externalUrl,
        driveDownloadUrl: serverFile.externalUrl,
        uploaderId: activeUid,
        ownerUid: activeUid,
        uploaderName: uploaderName,
        ratingAvg: 5.0,
        ratingCount: 1,
        createdAt: serverFile.createdAt,
        updatedAt: serverFile.updatedAt,
      });
      await this.logActivity('file_upload', `Added ${isMediaFire ? 'MediaFire' : 'External'} link file: ${serverFile.originalName}`, activeUid);
    } catch (e) {
      console.warn('Firestore sync warning for external link file:', e);
    }

    return {
      message: 'External link file added successfully!',
      file: serverFile,
    };
  },

  async editFile(id: string, updates: Partial<FileItem>): Promise<FileItem> {
    const fileRef = doc(db, 'files', id);
    const snap = await getDoc(fileRef);
    if (!snap.exists()) throw new Error('File not found');

    const currentUser = await this.getCurrentUser();
    const currentUid = auth.currentUser?.uid || currentUser?.id;
    const existingData = snap.data();
    const fileOwnerUid = existingData.ownerUid || existingData.uploaderId;

    const isAdmin = await this.isAdminUser();
    const isOwner = Boolean(currentUid && fileOwnerUid && currentUid === fileOwnerUid);

    if (!isAdmin && !isOwner) {
      throw new Error('Permission denied. You can only edit your own files.');
    }

    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(fileRef, payload);
    return this.getFileById(id);
  },

  async replaceFileContent(id: string, newFile: File): Promise<FileItem> {
    const fileRef = doc(db, 'files', id);
    const snap = await getDoc(fileRef);
    if (!snap.exists()) throw new Error('File not found');

    const currentUser = await this.getCurrentUser();
    const currentUid = auth.currentUser?.uid || currentUser?.id;
    const existing = snap.data();
    const fileOwnerUid = existing.ownerUid || existing.uploaderId;

    const isAdmin = await this.isAdminUser();
    const isOwner = Boolean(currentUid && fileOwnerUid && currentUid === fileOwnerUid);

    if (!isAdmin && !isOwner) {
      throw new Error('Permission denied. You can only replace content for your own files.');
    }

    const oldFilename = existing.filename || existing.storagePath;
    if (oldFilename) {
      try {
        await fetch(`/api/files/server-storage/${encodeURIComponent(oldFilename)}`, {
          method: 'DELETE',
          headers: {
            'x-user-uid': currentUid || 'usr-admin-master',
            'x-is-admin': isAdmin ? 'true' : 'false',
          },
        });
      } catch (e) {
        console.warn('Old file deletion warning:', e);
      }
    }

    const formData = new FormData();
    formData.append('files', newFile);

    const responseJson = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });

    const serverFile = responseJson.files?.[0];
    if (!serverFile) throw new Error('Failed to replace file content');

    const newDownloadUrl = `${window.location.origin}/api/files/download-by-name/${serverFile.filename}?name=${encodeURIComponent(serverFile.originalName)}`;

    const updates = {
      originalName: serverFile.originalName,
      filename: serverFile.filename,
      fileSize: serverFile.fileSize,
      mimeType: serverFile.mimeType || 'application/octet-stream',
      filePath: newDownloadUrl,
      storagePath: serverFile.filename,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(fileRef, updates);
    return this.getFileById(id);
  },

  // Delete File permanently from Server Storage AND Firestore document
  async deleteFile(id: string): Promise<void> {
    const fileRef = doc(db, 'files', id);
    let existing: any = null;

    try {
      const snap = await getDoc(fileRef);
      if (snap.exists()) {
        existing = snap.data();
      }
    } catch (e) {
      console.warn('Error reading file doc from Firestore:', e);
    }

    const currentUser = await this.getCurrentUser();
    const currentUid = auth.currentUser?.uid || currentUser?.id || 'usr-admin-master';
    const adminToken = localStorage.getItem('filevault_admin_token') || 'admin-master-token';

    const isAdmin = await this.isAdminUser();

    if (existing) {
      const fileOwnerUid = existing.ownerUid || existing.uploaderId;

      const isOwner = Boolean(currentUid && fileOwnerUid && currentUid === fileOwnerUid);
      const isGuestFile = !fileOwnerUid || fileOwnerUid === 'guest' || fileOwnerUid === 'usr-guest';

      if (!isAdmin && !isOwner && !isGuestFile) {
        throw new Error('Permission denied. You can only delete your own files.');
      }

      const targetFilename = existing.filename || existing.storagePath;
      if (targetFilename) {
        try {
          await fetch(`/api/files/server-storage/${encodeURIComponent(targetFilename)}`, {
            method: 'DELETE',
            headers: {
              'x-user-uid': currentUid,
              'x-admin-token': adminToken,
              'x-is-admin': isAdmin ? 'true' : 'false',
            },
          });
        } catch (err) {
          console.warn('Server storage file deletion note:', err);
        }
      }

      try {
        await deleteDoc(fileRef);
      } catch (err) {
        console.warn('Firestore doc deletion note (continuing server deletion):', err);
      }
    }

    // Always attempt server DB cleanup as well
    try {
      await fetch(`/api/files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'x-user-uid': currentUid,
          'x-admin-token': adminToken,
          'x-is-admin': isAdmin ? 'true' : 'false',
        },
      });
    } catch (e) {
      console.warn('Server endpoint delete note:', e);
    }

    await this.logActivity('file_delete', `Deleted file: ${existing?.originalName || id}`, currentUid);
  },

  async verifyPassword(id: string, password: string): Promise<boolean> {
    const file = await this.getFileById(id);
    if (!file.isPasswordProtected) return true;
    return file.password === password;
  },

  getDownloadUrl(id: string, password?: string): string {
    return `/api/files/${encodeURIComponent(id)}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`;
  },

  getVisitorId(): string {
    let vid = localStorage.getItem('filevault_visitor_id');
    if (!vid) {
      vid = 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('filevault_visitor_id', vid);
    }
    return vid;
  },

  async incrementDownloadCount(id: string, filename?: string): Promise<{ incremented: boolean; downloadsCount?: number }> {
    let downloadedFiles: string[] = [];
    try {
      downloadedFiles = JSON.parse(
        localStorage.getItem('filevault_downloaded_files') ||
        localStorage.getItem('filevault_ip_downloaded_files') ||
        '[]'
      );
    } catch {}

    // If client already downloaded this file in this browser
    if (downloadedFiles.includes(id)) {
      return { incremented: false };
    }

    const visitorId = this.getVisitorId();
    let isServerIncremented = false;
    let newServerCount: number | undefined = undefined;

    try {
      const currentUser = await this.getCurrentUser();
      const activeUid = auth.currentUser?.uid || currentUser?.id || '';

      const url = `/api/files/${encodeURIComponent(id)}/increment-download${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-id': visitorId,
          ...(activeUid ? { 'x-user-uid': activeUid } : {}),
        },
        body: JSON.stringify({ visitorId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.incremented) {
          isServerIncremented = true;
          newServerCount = data.downloadsCount;
        } else if (data.duplicate) {
          if (!downloadedFiles.includes(id)) {
            downloadedFiles.push(id);
            localStorage.setItem('filevault_downloaded_files', JSON.stringify(downloadedFiles));
          }
          return { incremented: false, downloadsCount: data.downloadsCount };
        }
      }
    } catch (e) {
      // Offline server fallback
      isServerIncremented = true;
    }

    // Save locally
    if (!downloadedFiles.includes(id)) {
      downloadedFiles.push(id);
      localStorage.setItem('filevault_downloaded_files', JSON.stringify(downloadedFiles));
    }

    if (isServerIncremented) {
      try {
        const fileRef = doc(db, 'files', id);
        if (newServerCount !== undefined && newServerCount > 0) {
          await updateDoc(fileRef, {
            downloadsCount: newServerCount,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await updateDoc(fileRef, {
            downloadsCount: increment(1),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Firestore download increment note:', err);
      }
    }

    await this.logActivity('file_download', `File downloaded (ID: ${id})`);
    return { incremented: isServerIncremented, downloadsCount: newServerCount };
  },

  async getQRCode(id: string): Promise<{ qrCode: string; url: string }> {
    let fileItem: FileItem | null = null;
    try {
      fileItem = await this.getFileById(id);
    } catch {}
    const shareUrl = fileItem ? getShareableDownloadUrl(fileItem) : `${window.location.origin}/download/${id}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;
    return { qrCode: qrCodeUrl, url: shareUrl };
  },

  // Comments
  subscribeComments(fileId: string, callback: (comments: Comment[]) => void) {
    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, where('fileId', '==', fileId));

    return onSnapshot(q, (snap) => {
      const list: Comment[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Comment, 'id'>),
      }));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    });
  },

  async getComments(fileId: string): Promise<Comment[]> {
    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, where('fileId', '==', fileId));
    const snap = await getDocs(q);
    const list: Comment[] = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Comment, 'id'>),
    }));
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  async postComment(fileId: string, commentText: string, rating: number): Promise<Comment> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) throw new Error('Authentication required to leave a comment');

    const commentData: Omit<Comment, 'id'> = {
      fileId,
      userId: currentUser.id,
      userName: currentUser.username || currentUser.email,
      userAvatar: currentUser.avatar || '',
      comment: commentText,
      rating,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'comments'), commentData);

    try {
      const existingComments = await this.getComments(fileId);
      const totalRatings = existingComments.reduce((acc, c) => acc + (c.rating || 5), 0);
      const avgRating = parseFloat((totalRatings / existingComments.length).toFixed(1));

      await updateDoc(doc(db, 'files', fileId), {
        ratingAvg: avgRating,
        ratingCount: existingComments.length,
      });
    } catch (e) {
      console.warn('Rating recalculation note:', e);
    }

    return {
      id: docRef.id,
      ...commentData,
    };
  },

  // Reports
  async reportFile(fileId: string, reason: 'broken_link' | 'virus_malware' | 'copyright' | 'inappropriate' | 'other', details: string): Promise<Report> {
    const currentUser = await this.getCurrentUser();
    const file = await this.getFileById(fileId).catch(() => null);

    const reportData: Omit<Report, 'id'> = {
      fileId,
      fileName: file ? file.originalName : fileId,
      userId: currentUser?.id,
      reason,
      details,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'reports'), reportData);
    return { id: docRef.id, ...reportData };
  },

  // Categories
  subscribeCategories(callback: (categories: Category[]) => void) {
    return onSnapshot(collection(db, 'categories'), (snap) => {
      const list: Category[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Category, 'id'>),
      }));
      callback(list);
    });
  },

  async getCategories(): Promise<Category[]> {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) return DEFAULT_CATEGORIES.map((c, i) => ({ id: `cat_${i}`, ...c }));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
  },

  async createCategory(name: string, description: string, icon: string): Promise<Category> {
    const data: Omit<Category, 'id'> = {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description,
      icon,
      fileCount: 0,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'categories'), data);
    return { id: docRef.id, ...data };
  },

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, 'categories', id));
  },

  // Ads
  subscribePublicAds(callback: (ads: Advertisement[]) => void) {
    return onSnapshot(collection(db, 'ads'), (snap) => {
      const list: Advertisement[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Advertisement, 'id'>) }))
        .filter((a) => a.isEnabled);
      callback(list);
    });
  },

  async getPublicAds(): Promise<Advertisement[]> {
    const snap = await getDocs(collection(db, 'ads'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Advertisement, 'id'>) }))
      .filter((a) => a.isEnabled);
  },

  async getAdminAds(): Promise<Advertisement[]> {
    const snap = await getDocs(collection(db, 'ads'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Advertisement, 'id'>) }));
  },

  async createAd(ad: Partial<Advertisement>): Promise<Advertisement> {
    const data: Omit<Advertisement, 'id'> = {
      title: ad.title || 'Untitled Ad',
      type: ad.type || 'banner',
      code: ad.code || '<div class="ad">Sponsor Advertisement</div>',
      location: ad.location || 'home_top',
      isEnabled: ad.isEnabled ?? true,
      clicks: 0,
      impressions: 0,
      createdAt: new Date().toISOString(),
    };
    const refDoc = await addDoc(collection(db, 'ads'), data);
    return { id: refDoc.id, ...data };
  },

  async updateAd(id: string, updates: Partial<Advertisement>): Promise<Advertisement> {
    await updateDoc(doc(db, 'ads', id), updates);
    const snap = await getDoc(doc(db, 'ads', id));
    return { id: snap.id, ...(snap.data() as Omit<Advertisement, 'id'>) };
  },

  async deleteAd(id: string): Promise<void> {
    await deleteDoc(doc(db, 'ads', id));
  },

  async trackAdEvent(id: string, event: 'impression' | 'click') {
    const adRef = doc(db, 'ads', id);
    if (event === 'click') {
      await updateDoc(adRef, { clicks: increment(1) }).catch(() => {});
    } else {
      await updateDoc(adRef, { impressions: increment(1) }).catch(() => {});
    }
  },

  // Admin APIs
  async getAdminStats(): Promise<AdminStats> {
    const adminToken = localStorage.getItem('filevault_admin_token') || localStorage.getItem('filevault_token');
    let expressStats: any = null;

    if (adminToken) {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        });
        if (res.ok) {
          expressStats = await res.json();
        }
      } catch (e) {
        console.warn('Express getAdminStats failed, using fallback:', e);
      }
    }

    // Fetch users (merged from Express and Firestore)
    const allUsers = await this.getUsers();

    // Fetch files from Firestore
    let firebaseFiles: FileItem[] = [];
    try {
      const filesSnap = await getDocs(collection(db, 'files'));
      firebaseFiles = filesSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        const origName = data.originalName || data.name || 'Untitled File';
        const fileUrl = data.filePath || data.fileUrl || data.downloadUrl || '';
        const ownerUid = data.ownerUid || data.uploaderId || '';
        return {
          id: docSnap.id,
          originalName: origName,
          filename: origName,
          filePath: fileUrl,
          fileSize: Number(data.fileSize || data.size || 0),
          mimeType: data.mimeType || 'application/octet-stream',
          category: data.category || 'General',
          uploaderId: ownerUid,
          ownerUid: ownerUid,
          uploaderName: data.uploaderName || 'Anonymous',
          description: data.description || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          isPasswordProtected: Boolean(data.isPasswordProtected),
          password: data.password || '',
          isDraft: Boolean(data.isDraft),
          isFeatured: Boolean(data.isFeatured),
          scheduledAt: data.scheduledAt || null,
          downloadsCount: Number(data.downloadsCount ?? data.downloads ?? 0),
          viewsCount: Number(data.viewsCount || 0),
          storageType: 'local' as const,
          ratingAvg: data.ratingAvg || 5.0,
          ratingCount: data.ratingCount || 1,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        } as FileItem;
      });
    } catch (e) {
      console.warn('Firestore files fetch error:', e);
    }

    // Merge files from Firestore & Express
    const fileMap = new Map<string, FileItem>();

    // Add Firestore files
    firebaseFiles.forEach((f) => {
      const key = (f.id || f.filename || f.originalName).trim();
      if (key) {
        fileMap.set(key, f);
      }
    });

    // Add/merge Express files
    if (expressStats) {
      const expressFiles: any[] = expressStats.files || expressStats.recentUploads || [];
      expressFiles.forEach((f) => {
        const key = (f.id || f.filename || f.originalName || '').trim();
        if (key) {
          if (fileMap.has(key)) {
            const existing = fileMap.get(key)!;
            fileMap.set(key, {
              ...existing,
              fileSize: Math.max(existing.fileSize || 0, Number(f.fileSize || f.size || 0)),
              downloadsCount: Math.max(existing.downloadsCount || 0, Number(f.downloadsCount || f.downloads || 0)),
            });
          } else {
            fileMap.set(key, {
              id: f.id || `file-${Date.now()}`,
              originalName: f.originalName || f.filename || 'File',
              filename: f.filename || f.originalName || 'File',
              filePath: f.filePath || '',
              fileSize: Number(f.fileSize || f.size || 0),
              mimeType: f.mimeType || 'application/octet-stream',
              category: f.category || 'General',
              uploaderId: f.uploaderId || f.ownerUid || '',
              ownerUid: f.uploaderId || f.ownerUid || '',
              uploaderName: f.uploaderName || 'Anonymous',
              description: f.description || '',
              tags: Array.isArray(f.tags) ? f.tags : [],
              isPasswordProtected: Boolean(f.isPasswordProtected),
              password: f.password || '',
              isDraft: Boolean(f.isDraft),
              isFeatured: Boolean(f.isFeatured),
              scheduledAt: f.scheduledAt || null,
              downloadsCount: Number(f.downloadsCount ?? f.downloads ?? 0),
              viewsCount: Number(f.viewsCount || 0),
              storageType: 'local' as const,
              ratingAvg: f.ratingAvg || 5.0,
              ratingCount: f.ratingCount || 1,
              createdAt: f.createdAt || new Date().toISOString(),
              updatedAt: f.updatedAt || new Date().toISOString(),
            } as FileItem);
          }
        }
      });
    }

    const allFiles = Array.from(fileMap.values());
    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalFiles = allFiles.length;
    const totalDownloads = allFiles.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);
    const storageUsedBytes = allFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    const totalUsers = allUsers.length;
    const onlineUsers = Math.max(1, allUsers.filter((u) => u.status === 'active' || !u.status).length);

    // Default chart data if expressStats is missing or incomplete
    const defaultChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      defaultChart.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        downloads: Math.round(totalDownloads / 7),
        uploads: Math.round(totalFiles / 7),
      });
    }

    return {
      totalFiles,
      totalDownloads,
      totalUsers,
      todayDownloads: expressStats?.todayDownloads ?? Math.round(totalDownloads / 3) ?? 0,
      onlineUsers,
      storageUsedBytes,
      revenueEstimate: expressStats?.revenueEstimate ?? Number((totalDownloads * 0.005).toFixed(2)),
      recentUploads: allFiles.slice(0, 5),
      recentDownloads: expressStats?.recentDownloads || [],
      dailyDownloadsChart: expressStats?.dailyDownloadsChart || defaultChart,
    };
  },

  async getUsers(): Promise<User[]> {
    const adminToken = localStorage.getItem('filevault_admin_token') || localStorage.getItem('filevault_token');
    let expressUsers: User[] = [];

    if (adminToken) {
      try {
        const res = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.users && Array.isArray(data.users)) {
            expressUsers = data.users;
          }
        }
      } catch (e) {
        console.warn('Failed fetching users from Express endpoint:', e);
      }
    }

    // Fetch users from Firebase Firestore
    let firebaseUsers: User[] = [];
    try {
      const snap = await getDocs(collection(db, 'users'));
      firebaseUsers = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<User, 'id'>) }));
    } catch (e) {
      console.warn('Failed fetching users from Firebase:', e);
    }

    // Merge and deduplicate users by email or ID
    const userMap = new Map<string, User>();

    // 1. Add Express users
    expressUsers.forEach((u) => {
      const key = (u.email || u.id || '').toLowerCase().trim();
      if (key) {
        userMap.set(key, {
          id: u.id || `usr-${Date.now()}`,
          username: u.username || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          role: u.role || 'user',
          status: u.status || 'active',
          avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          createdAt: u.createdAt || new Date().toISOString(),
        });
      }
    });

    // 2. Merge Firebase users
    firebaseUsers.forEach((u) => {
      const key = (u.email || u.id || '').toLowerCase().trim();
      if (key) {
        if (userMap.has(key)) {
          const existing = userMap.get(key)!;
          userMap.set(key, {
            ...existing,
            ...u,
            role: existing.role === 'admin' || u.role === 'admin' ? 'admin' : (u.role || existing.role || 'user'),
            status: existing.status === 'banned' || u.status === 'banned' ? 'banned' : (u.status || existing.status || 'active'),
          });
        } else {
          userMap.set(key, {
            id: u.id || `usr-${Date.now()}`,
            username: u.username || u.email?.split('@')[0] || 'User',
            email: u.email || '',
            role: u.role || 'user',
            status: u.status || 'active',
            avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
            createdAt: u.createdAt || new Date().toISOString(),
          });
        }
      }
    });

    return Array.from(userMap.values());
  },

  async updateUser(id: string, updates: { role?: 'admin' | 'user'; status?: 'active' | 'banned' }): Promise<User> {
    const adminToken = localStorage.getItem('filevault_admin_token') || localStorage.getItem('filevault_token');
    let updatedUser: User | null = null;

    if (adminToken) {
      try {
        const res = await fetch(`/api/admin/users/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            updatedUser = data.user;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (errData.error) {
            throw new Error(errData.error);
          }
        }
      } catch (e: any) {
        if (e.message && e.message.includes('administrator account')) {
          throw e;
        }
        console.warn('Failed updating user on server endpoint:', e);
      }
    }

    // Also sync to Firebase
    try {
      await updateDoc(doc(db, 'users', id), updates);
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        const fbUser = { id: snap.id, ...(snap.data() as Omit<User, 'id'>) };
        return updatedUser ? { ...fbUser, ...updatedUser } : fbUser;
      }
    } catch (e: any) {
      if (!updatedUser) {
        throw new Error(e.message || 'Failed to update user status.');
      }
    }

    if (updatedUser) {
      return updatedUser;
    }

    throw new Error('Failed to update user status.');
  },

  subscribeSettings(callback: (settings: WebsiteSettings) => void) {
    const settingsRef = doc(db, 'settings', 'global');
    return onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as WebsiteSettings);
      } else {
        this.getSettings().then(callback).catch(console.error);
      }
    });
  },

  async getSettings(): Promise<WebsiteSettings> {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (snap.exists()) {
      return snap.data() as WebsiteSettings;
    }
    const defaults: WebsiteSettings = {
      siteName: 'FileVault',
      siteDescription: 'Real-time cloud file sharing platform',
      maxUploadSizeMb: 1024,
      allowedExtensions: ['*'],
      storageProvider: 'gdrive',
      enableCaptcha: false,
      requireLoginToDownload: false,
      defaultDownloadTimer: 5,
      adFrequency: 3,
      currencySymbol: '$',
      analyticsCode: '',
      maintenanceMode: false,
      headerNotice: '',
      theme: 'dark',
      whatsappNumber: '+918811896374',
      telegramChannelUrl: 'https://t.me/+cOVh2XrT7nBlYTE1',
      supportEmail: 'support@filevault.com',
    };
    await setDoc(doc(db, 'settings', 'global'), defaults);
    return defaults;
  },

  async updateSettings(settings: Partial<WebsiteSettings>): Promise<WebsiteSettings> {
    const adminToken = localStorage.getItem('filevault_admin_token') || localStorage.getItem('filevault_token');
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify(settings),
      });
    } catch (e) {
      console.warn('Syncing settings to Express server note:', e);
    }

    await setDoc(doc(db, 'settings', 'global'), settings, { merge: true });
    return this.getSettings();
  },

  async logActivity(action: string, details: string, userId?: string): Promise<void> {
    try {
      await addDoc(collection(db, 'logs'), {
        action,
        details,
        userId: userId || auth.currentUser?.uid || 'system',
        username: auth.currentUser?.email?.split('@')[0] || 'User',
        ip: '127.0.0.1',
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Logging note:', e);
    }
  },

  async getActivityLogs(): Promise<ActivityLog[]> {
    const snap = await getDocs(collection(db, 'logs'));
    const logs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }));
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return logs;
  },

  async getReports(): Promise<Report[]> {
    const snap = await getDocs(collection(db, 'reports'));
    const reports = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, 'id'>) }));
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reports;
  },

  async updateReportStatus(id: string, status: 'pending' | 'resolved' | 'dismissed'): Promise<Report> {
    await updateDoc(doc(db, 'reports', id), { status });
    const snap = await getDoc(doc(db, 'reports', id));
    return { id: snap.id, ...(snap.data() as Omit<Report, 'id'>) };
  },
};
