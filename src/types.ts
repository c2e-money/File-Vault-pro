export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'active' | 'banned';
  createdAt: string;
}

export interface FileItem {
  id: string;
  originalName: string;
  filename: string;
  filePath: string;
  fileSize: number; // bytes
  mimeType: string;
  category: string;
  uploaderId: string;
  ownerUid?: string;
  uploaderName: string;
  description?: string;
  tags?: string[];
  isPasswordProtected: boolean;
  password?: string;
  isDraft: boolean;
  isFeatured: boolean;
  scheduledAt?: string | null;
  downloadsCount: number;
  viewsCount: number;
  thumbnailPath?: string;
  storageType: 'local' | 'r2' | 's3' | 'gdrive' | 'dropbox' | 'onedrive' | 'google_drive';
  driveFileId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  fileCount: number;
  createdAt: string;
}

export interface DownloadLog {
  id: string;
  fileId: string;
  fileName: string;
  userId?: string;
  userName?: string;
  ipAddress: string;
  userAgent: string;
  downloadedAt: string;
  durationSeconds?: number;
}

export type AdType =
  | 'banner'
  | 'native'
  | 'sticky'
  | 'popunder'
  | 'smartlink'
  | 'socialbar'
  | 'interstitial'
  | 'popup';

export interface Advertisement {
  id: string;
  title: string;
  type: AdType;
  code: string; // HTML or JS code
  location: string;
  isEnabled: boolean;
  clicks: number;
  impressions: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  fileId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  comment: string;
  rating?: number;
  createdAt: string;
}

export interface Rating {
  id: string;
  fileId: string;
  userId: string;
  score: number;
  createdAt: string;
}

export interface Report {
  id: string;
  fileId: string;
  fileName: string;
  userId?: string;
  reason: 'broken_link' | 'virus_malware' | 'copyright' | 'inappropriate' | 'other';
  details: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  type: 'info' | 'success' | 'warning' | 'report';
  createdAt: string;
}

export interface WebsiteSettings {
  siteName: string;
  siteDescription: string;
  maxUploadSizeMb: number;
  allowedExtensions: string[];
  storageProvider: 'local' | 'r2' | 's3' | 'gdrive' | 'dropbox' | 'onedrive';
  enableCaptcha: boolean;
  requireLoginToDownload: boolean;
  defaultDownloadTimer: number; // in seconds
  adFrequency: number;
  currencySymbol: string;
  analyticsCode: string;
  maintenanceMode: boolean;
  headerNotice: string;
  theme: 'dark' | 'light' | 'system';
  whatsappNumber?: string;
  telegramChannelUrl?: string;
  supportEmail?: string;
  gdriveFolderId?: string;
  gdriveClientId?: string;
  gdriveClientSecret?: string;
  gdriveRefreshToken?: string;
  gdriveClientEmail?: string;
  gdrivePrivateKey?: string;
}

export interface ActivityLog {
  id: string;
  userId?: string;
  username: string;
  action: string;
  ip: string;
  details: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export interface AdminStats {
  totalFiles: number;
  totalDownloads: number;
  totalUsers: number;
  todayDownloads: number;
  onlineUsers: number;
  storageUsedBytes: number;
  revenueEstimate: number;
  recentUploads: FileItem[];
  recentDownloads: DownloadLog[];
  dailyDownloadsChart: { date: string; downloads: number; uploads: number }[];
}

export function getCleanSlug(name?: string): string {
  if (!name) return 'file';
  // Strip file extension first if present
  const baseName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
  const slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'file';
}

export function getShareableDownloadUrl(file: { id: string; originalName?: string; filename?: string }): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const slug = getCleanSlug(file.originalName || file.filename);
  return `${origin}/download/${slug}_${file.id}`;
}
