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
    let serverErrorMsg = '';
    // 1. Try Express backend admin login endpoint
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token && data.user) {
          localStorage.setItem('filevault_admin_token', data.token);
          localStorage.setItem('filevault_admin_user', JSON.stringify(data.user));
          return data;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error) {
          serverErrorMsg = errJson.error;
        }
      }
    } catch (e: any) {
      console.warn('Server admin login attempt note:', e);
    }

    // 2. Fallback to Firebase Auth login
    try {
      const res = await this.login(email, password);
      if (res.user.role === 'admin' || res.user.email?.toLowerCase().includes('admin') || res.user.email?.toLowerCase() === 'dipen8717@gmail.com') {
        const adminUser: User = { ...res.user, role: 'admin' };
        localStorage.setItem('filevault_admin_token', res.token);
        localStorage.setItem('filevault_admin_user', JSON.stringify(adminUser));
        return { token: res.token, user: adminUser };
      } else {
        throw new Error('Access denied. Account does not have Administrator privileges.');
      }
    } catch (fbErr: any) {
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

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        unsubscribe();
        if (!fbUser) {
          resolve(null);
          return;
        }
        try {
          const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (userSnap.exists()) {
            resolve(userSnap.data() as User);
          } else {
            const fallbackUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              username: fbUser.email ? fbUser.email.split('@')[0] : 'User',
              role: 'user',
              status: 'active',
              createdAt: new Date().toISOString(),
            };
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
        callback(null);
        return;
      }
      onSnapshot(doc(db, 'users', fbUser.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as User;
          callback({
            ...data,
            id: fbUser.uid,
            email: fbUser.email || data.email || '',
          });
        } else {
          callback({
            id: fbUser.uid,
            email: fbUser.email || '',
            username: fbUser.email ? fbUser.email.split('@')[0] : 'User',
            role: 'user',
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
    return onSnapshot(filesRef, (snapshot) => {
      const userList: FileItem[] = [];
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const ownerUid = data.ownerUid || data.uploaderId || '';
        if (ownerUid === userId) {
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
          storageType: 'gdrive',
          ratingAvg: data.ratingAvg || 5.0,
          ratingCount: data.ratingCount || 1,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        } as FileItem;
      });

      // Filter draft files unless owned or admin
      const currentUid = auth.currentUser?.uid;
      fileList = fileList.filter((f) => {
        if (f.isDraft && f.uploaderId !== currentUid) return false;
        if (params.uploaderId && f.uploaderId !== params.uploaderId) return false;
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
    const docSnap = await getDoc(doc(db, 'files', id));
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
      formData.append('isPasswordProtected', isPasswordProtected.toString()
