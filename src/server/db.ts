import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  FileItem,
  Category,
  DownloadLog,
  Advertisement,
  Comment,
  Rating,
  Report,
  Notification,
  WebsiteSettings,
  ActivityLog,
} from '../types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  files: FileItem[];
  categories: Category[];
  downloads: DownloadLog[];
  advertisements: Advertisement[];
  comments: Comment[];
  ratings: Rating[];
  reports: Report[];
  notifications: Notification[];
  settings: WebsiteSettings;
  activityLogs: ActivityLog[];
}

const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Software & Apps', slug: 'software', description: 'Applications, tools, and utilities', icon: 'Code', fileCount: 0, createdAt: new Date().toISOString() },
  { id: 'cat-2', name: 'Documents & PDF', slug: 'documents', description: 'E-books, reports, templates, and manuals', icon: 'FileText', fileCount: 0, createdAt: new Date().toISOString() },
  { id: 'cat-3', name: 'Media & Audio', slug: 'media', description: 'Music, podcasts, video clips, and sound effects', icon: 'Music', fileCount: 0, createdAt: new Date().toISOString() },
  { id: 'cat-4', name: 'Archives & ZIP', slug: 'archives', description: 'Compressed folders, ISOs, and packages', icon: 'Archive', fileCount: 0, createdAt: new Date().toISOString() },
  { id: 'cat-5', name: 'Games & ROMs', slug: 'games', description: 'Game installers, mods, patches, and ROMs', icon: 'Gamepad2', fileCount: 0, createdAt: new Date().toISOString() },
  { id: 'cat-6', name: 'Graphics & Design', slug: 'graphics', description: 'UI Kits, vectors, photos, and 3D assets', icon: 'Image', fileCount: 0, createdAt: new Date().toISOString() },
];

const defaultAds: Advertisement[] = [
  {
    id: 'ad-banner-top',
    title: 'Top Header Leaderboard Banner',
    type: 'banner',
    code: '<div class="p-3.5 bg-gradient-to-r from-indigo-950 via-zinc-900 to-purple-950 border border-indigo-500/30 rounded-xl text-center text-xs font-medium text-indigo-200 flex items-center justify-between shadow-lg"><div><strong class="text-white font-bold">Cloud Host Pro:</strong> Get ultra-fast SSD NVMe cloud servers with direct download speed.</div><a href="https://rightyrely.com/d7/5e/20/d75e2089a96bcea84d2e4ca5ffbbc3fd.js" target="_blank" rel="noopener noreferrer" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg transition font-bold">Visit Offer</a></div>',
    location: 'header_top',
    isEnabled: true,
    clicks: 142,
    impressions: 3890,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-download-native',
    title: 'Download Page Native Sponsor',
    type: 'native',
    code: '<div class="p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl flex items-center gap-4 text-left shadow-lg"><div><div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">VPN</div></div><div class="flex-1"><h4 class="font-bold text-zinc-100 text-xs">UltraVPN High Speed Node</h4><p class="text-[11px] text-zinc-400">Encrypted 10Gbps dedicated download proxy.</p></div><a href="https://rightyrely.com/d7/5e/20/d75e2089a96bcea84d2e4ca5ffbbc3fd.js" target="_blank" rel="noopener noreferrer" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap">Learn More</a></div>',
    location: 'download_page_middle',
    isEnabled: true,
    clicks: 89,
    impressions: 2150,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-sticky-bottom',
    title: 'Bottom Sticky Bar Ad',
    type: 'sticky',
    code: '<div class="flex items-center justify-between w-full max-w-4xl mx-auto px-4 py-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-full shadow-2xl text-xs text-zinc-300"><div class="flex items-center gap-2">⚡ <span class="font-bold text-amber-400">High-Speed Mirror:</span> Unlimited Fast Storage Cloud Storage</div><a href="https://rightyrely.com/d7/5e/20/d75e2089a96bcea84d2e4ca5ffbbc3fd.js" target="_blank" rel="noopener noreferrer" class="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1 rounded-full transition">Learn More</a></div>',
    location: 'global_sticky_bottom',
    isEnabled: true,
    clicks: 64,
    impressions: 1820,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-popunder-main',
    title: 'Main Download Popunder Ad',
    type: 'popunder',
    code: 'https://rightyrely.com/d7/5e/20/d75e2089a96bcea84d2e4ca5ffbbc3fd.js',
    location: 'download_page',
    isEnabled: true,
    clicks: 105,
    impressions: 4200,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-smartlink-direct',
    title: 'High Speed Smart Link Direct',
    type: 'smartlink',
    code: 'https://rightyrely.com/smartlink',
    location: 'download_button',
    isEnabled: true,
    clicks: 180,
    impressions: 2900,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-iframe-banner',
    title: 'Download Page Iframe Banner',
    type: 'banner',
    code: '<iframe src="https://rightyrely.com/d7/5e/20/d75e2089a96bcea84d2e4ca5ffbbc3fd.js" width="100%" height="90" style="border:0;border-radius:12px;overflow:hidden;" title="Advertisement Banner"></iframe>',
    location: 'download_page_banner',
    isEnabled: true,
    clicks: 95,
    impressions: 3100,
    createdAt: new Date().toISOString(),
  },
];

const defaultSettings: WebsiteSettings = {
  siteName: 'FileVault',
  siteDescription: 'High-Speed Secure File Upload, Cloud Storage, & Public File Sharing Platform.',
  maxUploadSizeMb: 500,
  allowedExtensions: ['zip', 'rar', '7z', 'pdf', 'docx', 'xlsx', 'pptx', 'mp3', 'mp4', 'apk', 'exe', 'iso', 'png', 'jpg', 'svg', 'txt', 'csv', 'json'],
  storageProvider: 'local',
  enableCaptcha: false,
  requireLoginToDownload: false,
  defaultDownloadTimer: 5,
  adFrequency: 100,
  currencySymbol: '$',
  analyticsCode: '',
  maintenanceMode: false,
  headerNotice: '⚡ Welcome to FileVault! High-speed, secure file hosting with direct resume downloads.',
  theme: 'dark',
};

function getInitialDb(): DatabaseSchema {
  const adminId = 'usr-admin-1';
  const adminEmail = process.env.ADMIN_EMAIL || 'dipen8717@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Dipen&Biswas9101';
  const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);

  const initialAdmin: User = {
    id: adminId,
    username: 'admin',
    email: adminEmail,
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const sampleUserId = 'usr-regular-1';
  const sampleUserPasswordHash = bcrypt.hashSync('user123', 10);
  const initialUser: User = {
    id: sampleUserId,
    username: 'alex_dev',
    email: 'alex@example.com',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  defaultCategories.forEach(cat => {
    cat.fileCount = 0;
  });

  return {
    users: [initialAdmin, initialUser],
    passwords: {
      [adminId]: adminPasswordHash,
      [sampleUserId]: sampleUserPasswordHash,
    },
    files: [],
    categories: defaultCategories,
    downloads: [],
    advertisements: defaultAds,
    comments: [],
    ratings: [],
    reports: [],
    notifications: [
      {
        id: 'notif-1',
        userId: adminId,
        title: 'System Initialized',
        message: 'FileVault database and file storage initialized successfully.',
        isRead: false,
        type: 'info',
        createdAt: new Date().toISOString(),
      }
    ],
    settings: defaultSettings,
    activityLogs: [],
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        const usersList: User[] = parsed.users || [];
        const passwordsDict = parsed.passwords || {};

        const envAdminEmail = process.env.ADMIN_EMAIL || 'dipen8717@gmail.com';
        const envAdminPassword = process.env.ADMIN_PASSWORD || 'Dipen&Biswas9101';

        // Guarantee admin user uses updated credentials
        let adminUser = usersList.find(u => u.role === 'admin' || u.id === 'usr-admin-1');
        if (!adminUser) {
          adminUser = {
            id: 'usr-admin-1',
            username: 'admin',
            email: envAdminEmail,
            role: 'admin',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            status: 'active',
            createdAt: new Date().toISOString(),
          };
          usersList.unshift(adminUser);
        } else {
          adminUser.email = envAdminEmail;
        }
        passwordsDict[adminUser.id] = bcrypt.hashSync(envAdminPassword, 10);

        const loadedData: DatabaseSchema = {
          users: usersList,
          passwords: passwordsDict,
          files: parsed.files || [],
          categories: parsed.categories?.length ? parsed.categories : defaultCategories,
          downloads: parsed.downloads || [],
          advertisements: parsed.advertisements?.length ? parsed.advertisements : defaultAds,
          comments: parsed.comments || [],
          ratings: parsed.ratings || [],
          reports: parsed.reports || [],
          notifications: parsed.notifications || [],
          settings: { ...defaultSettings, ...(parsed.settings || {}) },
          activityLogs: parsed.activityLogs || [],
        };

        // Persist migrated admin credentials to disk
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(loadedData, null, 2), 'utf-8');
        } catch (_) {}

        return loadedData;
      }
    } catch (err) {
      console.error('Failed to parse database file, re-initializing database:', err);
    }

    const initData = getInitialDb();
    this.save(initData);
    return initData;
  }

  public save(dataToSave?: DatabaseSchema) {
    if (dataToSave) {
      this.data = dataToSave;
    }
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing database to disk:', err);
    }
  }

  public getDb(): DatabaseSchema {
    return this.data;
  }

  public logActivity(username: string, action: string, ip: string, details: string, userId?: string) {
    const log: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      username,
      action,
      ip,
      details,
      createdAt: new Date().toISOString(),
    };
    this.data.activityLogs.unshift(log);
    // limit activity log to last 500 entries
    if (this.data.activityLogs.length > 500) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 500);
    }
    this.save();
  }

  public updateCategoryCounts() {
    this.data.categories.forEach(cat => {
      cat.fileCount = this.data.files.filter(
        f => f.category === cat.name && !f.isDraft
      ).length;
    });
    this.save();
  }
}

export const db = new Database();
                      
