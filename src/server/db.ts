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
    id: 'ad-popunder-main',
    title: 'Popunder Ad',
    type: 'popunder',
    code: '<script src="https://rightyrely.com/0a/44/b9/0a44b90796d94943a2537dad9f2592d0.js"></script>',
    location: 'download_page',
    isEnabled: true,
    clicks: 0,
    impressions: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-socialbar-main',
    title: 'Social Bar Ad',
    type: 'socialbar',
    code: '<script src="https://rightyrely.com/96/b3/8d/96b38d2a9c3702f149bd60e4800e311b.js"></script>',
    location: 'download_page',
    isEnabled: true,
    clicks: 0,
    impressions: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-smartlink-main',
    title: 'Smart Link Monetized CTA',
    type: 'smartlink',
    code: 'https://rightyrely.com/cu96f0bz3h?key=09cf79c98298c393e20ad910f6953bf7',
    location: 'download_button',
    isEnabled: true,
    clicks: 0,
    impressions: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-banner-468x60',
    title: 'Download Page Banner (468x60)',
    type: 'banner',
    code: `<script type="text/javascript">
  atOptions = {
    'key' : '7e7c02ee62652ec8bf5c47225c4cddec',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://rightyrely.com/7e7c02ee62652ec8bf5c47225c4cddec/invoke.js"></script>`,
    location: 'download_page_top',
    isEnabled: true,
    clicks: 0,
    impressions: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ad-native-main',
    title: 'Download Page Native Banner',
    type: 'native',
    code: `<script async="async" data-cfasync="false" src="https://rightyrely.com/dbaf6128171b01f81aaa66b44edd673e/invoke.js"></script>
<div id="container-dbaf6128171b01f81aaa66b44edd673e"></div>`,
    location: 'download_page_middle',
    isEnabled: true,
    clicks: 0,
    impressions: 0,
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
  defaultDownloadTimer: 10,
  adFrequency: 100,
  currencySymbol: '$',
  analyticsCode: '',
  maintenanceMode: false,
  headerNotice: '⚡ Welcome to FileVault! High-speed, secure file hosting with direct resume downloads.',
  theme: 'dark',
  whatsappNumber: '+918811896374',
  telegramChannelUrl: 'https://t.me/+cOVh2XrT7nBlYTE1',
  supportEmail: 'support@filevault.com',
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
