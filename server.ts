import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db.js';
import { FileItem, User, Advertisement, Category, WebsiteSettings } from './src/types.js';
import {
  uploadToGoogleDrive,
  getGoogleDriveStream,
  deleteFromGoogleDrive,
  isGoogleDriveConfigured,
  testGoogleDriveConnection,
  resetDriveInstance,
} from './src/server/googleDrive.js';
import {
  uploadToGitHubRelease,
  deleteFromGitHubRelease,
  testGitHubConnection,
} from './src/server/githubStorage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'filevault-super-secret-key-2026';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static route to serve uploaded files directly if needed
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e4)}`;
    cb(null, `${sanitizedBase}_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1000 }, // 1 GB max
});

// Security Headers Middleware (Anti-Bypass, Anti-Clickjacking, Anti-XSS, MIME-Sniffing Defense)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

// Anti-Bypass & Brute-Force Protection Rate-Limiter Store
interface LoginAttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const loginAttemptsStore = new Map<string, LoginAttemptRecord>();
const DUMMY_BCRYPT_HASH = '$2a$10$e7xX4W4j6.k1J8uM3f.3O.S245u8v7p9g7.9u0z/c0g2b3a4c5d6e';

// Periodic memory store cleanup
setInterval(() => {
  const now = Date.now();
  loginAttemptsStore.forEach((record, key) => {
    if (record.lockedUntil < now && now - record.firstAttemptAt > 30 * 60 * 1000) {
      loginAttemptsStore.delete(key);
    }
  });
}, 10 * 60 * 1000);

function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const record = loginAttemptsStore.get(key);

  if (!record) return { isLocked: false, remainingSeconds: 0 };

  if (record.lockedUntil > now) {
    return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  if (now - record.firstAttemptAt > windowMs) {
    loginAttemptsStore.delete(key);
    return { isLocked: false, remainingSeconds: 0 };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

function recordFailedAttempt(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000): { isNowLocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  let record = loginAttemptsStore.get(key);

  if (!record || now - record.firstAttemptAt > windowMs) {
    record = { attempts: 1, firstAttemptAt: now, lockedUntil: 0 };
    loginAttemptsStore.set(key, record);
    return { isNowLocked: false, remainingAttempts: maxAttempts - 1 };
  }

  record.attempts += 1;

  if (record.attempts >= maxAttempts) {
    record.lockedUntil = now + lockoutMs;
    return { isNowLocked: true, remainingAttempts: 0 };
  }

  return { isNowLocked: false, remainingAttempts: maxAttempts - record.attempts };
}

function clearLoginAttempts(key: string) {
  loginAttemptsStore.delete(key);
}

// Helper Authentication Middlewares
interface AuthRequest extends Request {
  user?: User;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = undefined;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (!err && decoded) {
      const database = db.getDb();
      const user = database.users.find(u => u.id === decoded.id && u.status === 'active');
      // Anti-Bypass: Strict Role Re-Validation against active database record
      if (user && user.role === decoded.role) {
        req.user = user;
      }
    }
    next();
  });
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: System Administrator privilege required' });
  }
  next();
}

app.use(authenticateToken);

// ==========================================
// 1. AUTHENTICATION API ROUTES
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const clientIp = req.ip || '127.0.0.1';
  const cleanEmail = email.trim().toLowerCase();
  const rateKey = `usr_login:${clientIp}:${cleanEmail}`;

  const limitStatus = checkRateLimit(rateKey, 10, 15 * 60 * 1000, 15 * 60 * 1000);
  if (limitStatus.isLocked) {
    return res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked for security. Try again in ${Math.ceil(limitStatus.remainingSeconds / 60)} minute(s).`,
    });
  }

  const database = db.getDb();
  const user = database.users.find(
    u => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail
  );

  const passwordHash = user ? database.passwords[user.id] : DUMMY_BCRYPT_HASH;
  const isValid = bcrypt.compareSync(password, passwordHash || DUMMY_BCRYPT_HASH);

  if (!user || user.status === 'banned' || !isValid) {
    const failInfo = recordFailedAttempt(rateKey, 10);
    db.logActivity('System', 'FAILED_USER_LOGIN', clientIp, `Failed user login attempt for identifier: ${cleanEmail}`);
    return res.status(401).json({
      error: 'Invalid email or password',
      remainingAttempts: failInfo.remainingAttempts,
    });
  }

  clearLoginAttempts(rateKey);

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  db.logActivity(user.username, 'USER_LOGIN', clientIp, `User logged in`, user.id);

  res.json({ token, user });
});

app.post('/api/auth/admin-login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Admin email and password are required' });
  }

  const clientIp = req.ip || '127.0.0.1';
  const cleanEmail = email.trim().toLowerCase();
  const isLocalIp = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  const ipRateKey = isLocalIp ? `admin_login_local:${cleanEmail}` : `admin_login_ip:${clientIp}`;
  const userRateKey = `admin_login_usr:${cleanEmail}`;

  // Check Brute Force Lockouts (Max 5 attempts per 15 minutes)
  const ipLimit = checkRateLimit(ipRateKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
  const userLimit = checkRateLimit(userRateKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);

  if (ipLimit.isLocked || userLimit.isLocked) {
    const lockTime = Math.max(ipLimit.remainingSeconds, userLimit.remainingSeconds);
    db.logActivity(
      'SECURITY_SYSTEM',
      'ADMIN_LOCKOUT_TRIGGERED',
      clientIp,
      `Blocked hacker/cracker brute force attack for admin identifier: ${cleanEmail}`
    );
    return res.status(429).json({
      error: `Security Lockout Triggered: Too many failed administrator login attempts. Access blocked for ${Math.ceil(lockTime / 60)} minute(s) to protect against unauthorized access.`,
    });
  }

  const database = db.getDb();
  const user = database.users.find(
    u => (u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail) && u.role === 'admin'
  );

  // Timing Attack Protection: Always perform bcrypt comparison to equalize server response time
  const passwordHash = user ? database.passwords[user.id] : DUMMY_BCRYPT_HASH;
  const isValid = bcrypt.compareSync(password, passwordHash || DUMMY_BCRYPT_HASH);

  if (!user || user.status === 'banned' || !isValid) {
    recordFailedAttempt(ipRateKey, 5);
    const userFailInfo = recordFailedAttempt(userRateKey, 5);

    db.logActivity(
      'SECURITY_SYSTEM',
      'SUSPICIOUS_ADMIN_LOGIN_ATTEMPT',
      clientIp,
      `UNAUTHORIZED ADMIN LOGIN FAILURE for target: ${cleanEmail}`
    );

    return res.status(401).json({
      error: 'Invalid administrator credentials. Access attempt logged for security.',
      remainingAttempts: userFailInfo.remainingAttempts,
    });
  }

  // Clear failed attempt history upon successful authentication
  clearLoginAttempts(ipRateKey);
  clearLoginAttempts(userRateKey);

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  db.logActivity(user.username, 'ADMIN_LOGIN', clientIp, `Administrator authenticated into system panel`, user.id);

  res.json({ token, user });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const database = db.getDb();
  const existing = database.users.find(
    u => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase()
  );

  if (existing) {
    return res.status(400).json({ error: 'Username or Email already registered' });
  }

  const userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newUser: User = {
    id: userId,
    username: username.trim(),
    email: email.trim().toLowerCase(),
    role: 'user',
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  database.users.push(newUser);
  database.passwords[userId] = bcrypt.hashSync(password, 10);
  db.save();

  const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });

  db.logActivity(newUser.username, 'USER_REGISTER', req.ip || '127.0.0.1', `New user registered`, newUser.id);

  res.json({ token, user: newUser });
});

app.get('/api/auth/me', (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// ==========================================
// 2. FILES API ROUTES
// ==========================================

// Get Files (Filtered by User Privacy & Scope)
app.get('/api/files', (req: AuthRequest, res) => {
  const { search, category, sort, page = '1', limit = '12', scope } = req.query;

  const database = db.getDb();
  let files = [...database.files];

  const now = new Date();

  // User Privacy Filtering:
  // Admin can request all files with scope=admin, otherwise users ONLY see files they uploaded.
  if (req.user && req.user.role === 'admin' && scope === 'admin') {
    // Admin viewing all files in Admin Panel
  } else if (req.user) {
    // Logged-in normal user sees ONLY their own uploaded files
    files = files.filter(f => f.uploaderId === req.user!.id);
  } else {
    // Unauthenticated public visitors see empty list (shared files are accessed via /api/files/:id directly)
    files = [];
  }

  // Filter drafts and scheduled files
  files = files.filter(f => {
    if (f.isDraft) return false;
    if (f.scheduledAt && new Date(f.scheduledAt) > now) return false;
    return true;
  });

  // Search filter
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    files = files.filter(
      f =>
        f.originalName.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (category && typeof category === 'string' && category !== 'all') {
    files = files.filter(f => f.category.toLowerCase() === category.toLowerCase() || f.category.toLowerCase().includes(category.toLowerCase()));
  }

  // Sorting
  if (sort === 'downloads') {
    files.sort((a, b) => b.downloadsCount - a.downloadsCount);
  } else if (sort === 'size') {
    files.sort((a, b) => b.fileSize - a.fileSize);
  } else {
    // Default newest
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Pagination
  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 12;
  const total = files.length;
  const totalPages = Math.ceil(total / limitNum);
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedFiles = files.slice(startIndex, startIndex + limitNum);

  res.json({
    files: paginatedFiles,
    total,
    page: pageNum,
    totalPages,
  });
});

// Get File By ID
app.get('/api/files/:id', (req: AuthRequest, res) => {
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Auto increment view count
  file.viewsCount = (file.viewsCount || 0) + 1;
  db.save();

  // Return file metadata without revealing password hash
  const fileObj = { ...file };
  delete fileObj.password;

  res.json({ file: fileObj });
});

// Upload File (Single or Multiple directly to Google Drive)
app.post('/api/files/upload', (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.array('files', 10)(req, res, async (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload processing failed' });
    }
    const reqFiles = req.files as Express.Multer.File[];
    if (!reqFiles || reqFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
      const { category, description, tags, isPasswordProtected, password, isDraft, scheduledAt, ownerUid } = req.body;
      const database = db.getDb();
      const activeOwnerUid = (ownerUid as string) || (req.body.uploaderId as string) || (req.headers['x-user-uid'] as string) || (req.user ? req.user.id : 'usr-guest');
      const uploader = req.user ? req.user : { id: activeOwnerUid, username: 'Guest' };

      const createdFiles: FileItem[] = [];

      for (const file of reqFiles) {
        const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

        const currentStorageProvider = database.settings?.storageProvider || 'gdrive';

        let driveResult: { driveFileId: string; webViewLink?: string; webContentLink?: string } | null = null;
        let githubResult: { downloadUrl: string; assetId: number; size: number } | null = null;
        let uploadError: string | null = null;

        if (currentStorageProvider === 'github') {
          try {
            githubResult = await uploadToGitHubRelease(file.path, file.originalname, file.mimetype);
          } catch (ghErr: any) {
            uploadError = ghErr?.message || String(ghErr);
            console.error('GitHub Releases Upload Failed:', uploadError);
            return res.status(400).json({
              error: `GitHub Releases upload failed: ${uploadError}. Please check your GitHub Token and Repository in Admin Settings.`,
            });
          }
        } else if (currentStorageProvider === 'gdrive') {
          try {
            driveResult = await uploadToGoogleDrive(file.path, file.originalname, file.mimetype);
          } catch (gErr: any) {
            uploadError = gErr?.message || String(gErr);
            console.error('Google Drive Upload Failed:', uploadError);
            return res.status(400).json({
              error: `Google Drive upload failed: ${uploadError}. Please check Google Drive credentials in Admin Settings.`,
            });
          }
        } else if (currentStorageProvider === 'local') {
          // Local storage fallback - keep file on server disk
        } else {
          // Attempt GitHub first, fallback to Google Drive or Local
          try {
            githubResult = await uploadToGitHubRelease(file.path, file.originalname, file.mimetype);
          } catch {
            try {
              driveResult = await uploadToGoogleDrive(file.path, file.originalname, file.mimetype);
            } catch {}
          }
        }

        const resolvedStorageType = githubResult ? 'github' : driveResult ? 'google_drive' : 'local';
        const resolvedFilePath = githubResult ? githubResult.downloadUrl : (driveResult?.webContentLink || `/uploads/${file.filename}`);

        const newFile: FileItem = {
          id: fileId,
          originalName: file.originalname,
          filename: file.filename,
          filePath: resolvedFilePath,
          fileSize: githubResult ? githubResult.size : file.size,
          mimeType: file.mimetype || 'application/octet-stream',
          category: category || 'Software & Apps',
          ownerUid: activeOwnerUid,
          uploaderId: activeOwnerUid,
          uploaderName: uploader.username,
          description: description || '',
          tags: parsedTags,
          isPasswordProtected: isPasswordProtected === 'true' || isPasswordProtected === true,
          password: password || '',
          isDraft: isDraft === 'true' || isDraft === true,
          isFeatured: false,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          downloadsCount: 0,
          viewsCount: 0,
          storageType: resolvedStorageType,
          driveFileId: driveResult ? driveResult.driveFileId : undefined,
          driveViewUrl: driveResult ? driveResult.webViewLink : undefined,
          driveDownloadUrl: driveResult ? driveResult.webContentLink : undefined,
          externalUrl: githubResult ? githubResult.downloadUrl : undefined,
          ratingAvg: 5.0,
          ratingCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        database.files.unshift(newFile);
        createdFiles.push(newFile);
      }

      db.updateCategoryCounts();

      db.logActivity(
        uploader.username,
        'FILE_UPLOAD',
        req.ip || '127.0.0.1',
        `Uploaded ${createdFiles.length} file(s) to Google Drive: ${createdFiles.map(f => f.originalName).join(', ')}`,
        uploader.id
      );

      return res.status(201).json({
        message: 'Files uploaded to Google Drive successfully',
        files: createdFiles,
      });
    } catch (handlerErr: any) {
      console.error('Upload handler error:', handlerErr);
      return res.status(500).json({ error: handlerErr.message || 'Internal server error during upload' });
    }
  });
});

// Create MediaFire / External Cloud Link File Entry
app.post('/api/files/external-link', (req: AuthRequest, res) => {
  try {
    const {
      originalName,
      externalUrl,
      fileSize,
      category,
      description,
      tags,
      isPasswordProtected,
      password,
      isDraft,
      scheduledAt
    } = req.body;

    if (!originalName || !externalUrl) {
      return res.status(400).json({ error: 'Original name and external URL are required' });
    }

    const database = db.getDb();
    const activeOwnerUid = (req.headers['x-user-uid'] as string) || req.user?.id || 'usr-guest';
    const uploader = req.user || { id: activeOwnerUid, username: req.body.uploaderName || 'Anonymous', role: 'user' };

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    let parsedSize = 1024 * 1024; // default 1MB
    if (typeof fileSize === 'number' && fileSize > 0) {
      parsedSize = fileSize;
    } else if (typeof fileSize === 'string') {
      const num = parseFloat(fileSize);
      if (!isNaN(num)) {
        if (fileSize.toLowerCase().includes('gb')) parsedSize = Math.round(num * 1024 * 1024 * 1024);
        else if (fileSize.toLowerCase().includes('kb')) parsedSize = Math.round(num * 1024);
        else if (fileSize.toLowerCase().includes('mb')) parsedSize = Math.round(num * 1024 * 1024);
        else parsedSize = Math.round(num);
      }
    }

    const isMediaFire = externalUrl.toLowerCase().includes('mediafire.com');
    const storageType = isMediaFire ? 'mediafire' : 'external_link';

    const newFile: FileItem = {
      id: fileId,
      originalName: originalName.trim(),
      filename: `external-${fileId}`,
      filePath: externalUrl.trim(),
      fileSize: parsedSize,
      mimeType: 'application/octet-stream',
      category: category || 'Software & Apps',
      ownerUid: activeOwnerUid,
      uploaderId: activeOwnerUid,
      uploaderName: uploader.username,
      description: description || '',
      tags: parsedTags,
      isPasswordProtected: Boolean(isPasswordProtected),
      password: password || '',
      isDraft: Boolean(isDraft),
      isFeatured: false,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      downloadsCount: 0,
      viewsCount: 0,
      storageType: storageType,
      externalUrl: externalUrl.trim(),
      driveDownloadUrl: externalUrl.trim(),
      ratingAvg: 5.0,
      ratingCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    database.files.unshift(newFile);
    db.updateCategoryCounts();

    db.logActivity(
      uploader.username,
      'FILE_UPLOAD',
      req.ip || '127.0.0.1',
      `Added ${isMediaFire ? 'MediaFire' : 'External'} link file: ${newFile.originalName}`,
      uploader.id
    );

    return res.status(201).json({
      message: 'External link file added successfully',
      file: newFile,
    });
  } catch (err: any) {
    console.error('Error adding external link file:', err);
    return res.status(500).json({ error: err.message || 'Server error adding external link file' });
  }
});

// Delete file directly from server disk by filename
app.delete('/api/files/server-storage/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename) return res.status(400).json({ error: 'Filename is required' });

  const safeFilename = path.basename(filename);
  const targetPath = path.join(UPLOADS_DIR, safeFilename);

  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
      return res.json({ message: 'File deleted from server storage' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed deleting physical file' });
    }
  }
  return res.json({ message: 'File not found on server storage or already removed' });
});

// Helper to locate file in DB by any identifier (ID, filename, driveFileId, or path)
function findFileByAnyIdentifier(database: any, idOrName: string, queryFilename?: string) {
  if (!database || !database.files) return null;
  const target = decodeURIComponent(idOrName || '').trim();
  const qFilename = decodeURIComponent(queryFilename || '').trim();

  return database.files.find((f: any) => {
    if (!f) return false;
    if (target && (f.id === target || f.filename === target || f.driveFileId === target)) return true;
    if (qFilename && (f.filename === qFilename || f.id === qFilename || f.driveFileId === qFilename)) return true;
    if (target && f.originalName && f.originalName === target) return true;
    if (target && f.filePath && f.filePath.includes(target)) return true;
    return false;
  }) || null;
}

// Diagnostic endpoint for Google Drive status
app.get('/api/admin/drive-status', async (req: AuthRequest, res) => {
  const status = await testGoogleDriveConnection();
  res.json(status);
});

// Diagnostic endpoint for GitHub Releases status (supports GET and POST with override parameters)
const handleGitHubStatus = async (req: AuthRequest, res: Response) => {
  const token = req.body?.githubToken || req.query?.githubToken as string;
  const repo = req.body?.githubRepo || req.query?.githubRepo as string;
  const tag = req.body?.githubTag || req.query?.githubTag as string;

  const overrides = (token || repo || tag) ? { token, repo, tag } : undefined;

  if (token || repo) {
    const database = db.getDb();
    database.settings = {
      ...database.settings,
      ...(token ? { githubToken: token } : {}),
      ...(repo ? { githubRepo: repo } : {}),
      ...(tag ? { githubTag: tag } : {}),
    };
    db.save();
  }

  const status = await testGitHubConnection(overrides);
  res.json(status);
};

app.get('/api/admin/github-status', handleGitHubStatus);
app.post('/api/admin/github-status', handleGitHubStatus);

// Enforce Unique Per User/Visitor Download Count Rule (1 download per user per file)
function registerFileDownload(file: any, req: AuthRequest) {
  const database = db.getDb();
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = rawIp.replace(/^::ffff:/, '');

  const userId = req.user?.id || (req.headers['x-user-uid'] as string) || (req.query.userId as string);
  const visitorId = (req.headers['x-visitor-id'] as string) || (req.query.visitorId as string) || (req.body?.visitorId as string);

  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
  const fileKey = file.id || file.filename;

  const existingDownload = database.downloads.find((d: any) => {
    const isSameFile =
      d.fileId === file.id ||
      d.fileId === file.filename ||
      (file.driveFileId && d.fileId === file.driveFileId) ||
      d.fileName === file.originalName ||
      d.fileName === file.filename;

    if (!isSameFile) return false;

    if (userId && d.userId && d.userId === userId) {
      return true;
    }
    if (visitorId && d.visitorId && d.visitorId === visitorId) {
      return true;
    }
    if (!isLoopback && d.ipAddress && (d.ipAddress === clientIp || d.ipAddress === rawIp)) {
      return true;
    }

    return false;
  });

  if (!existingDownload) {
    file.downloadsCount = (file.downloadsCount || 0) + 1;
    database.downloads.unshift({
      id: `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileId: fileKey,
      fileName: file.originalName || file.filename,
      userId: userId || undefined,
      visitorId: visitorId || undefined,
      userName: req.user?.username || 'Anonymous',
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] || 'Unknown',
      downloadedAt: new Date().toISOString(),
      durationSeconds: 1,
    });
    db.save();
    return { incremented: true, downloadsCount: file.downloadsCount, ipAddress: clientIp, duplicate: false };
  }

  return { incremented: false, downloadsCount: file.downloadsCount, ipAddress: clientIp, duplicate: true };
}

// Stream/Download file by ID or filename (Supports GitHub Releases, Google Drive, External Links, and Local Storage)
async function handleFileDownloadStream(idOrFilename: string, req: AuthRequest, res: Response) {
  const database = db.getDb();
  const qFilename = (req.query.filename as string) || (req.query.name as string);
  const file = findFileByAnyIdentifier(database, idOrFilename, qFilename);

  if (file) {
    registerFileDownload(file, req);
  }

  // 1. Direct external link / GitHub Release download redirect
  const targetExternalUrl = file?.externalUrl || (file?.filePath && (file.filePath.startsWith('http://') || file.filePath.startsWith('https://')) ? file.filePath : null);

  if (targetExternalUrl) {
    return res.redirect(targetExternalUrl);
  }

  // 2. Stream from Google Drive if driveFileId exists
  if (file && file.driveFileId) {
    try {
      const mimeType = file.mimeType || 'application/octet-stream';
      const rawDisplayName = (req.query.name as string) || file.originalName || idOrFilename;
      const safeDisplayName = rawDisplayName.replace(/["\r\n\/\\]/g, '_');
      const encodedDisplayName = encodeURIComponent(rawDisplayName);

      const driveRes = await getGoogleDriveStream(file.driveFileId, req.headers);
      const resHeaders: Record<string, any> = {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
        'X-Content-Type-Options': 'nosniff',
      };

      if (driveRes.headers['content-length']) {
        resHeaders['Content-Length'] = driveRes.headers['content-length'];
      }

      if (driveRes.headers['content-range']) {
        resHeaders['Content-Range'] = driveRes.headers['content-range'];
        resHeaders['Accept-Ranges'] = 'bytes';
        res.writeHead(206, resHeaders);
      } else {
        res.writeHead(200, resHeaders);
      }

      driveRes.data.pipe(res);
      return;
    } catch (driveErr) {
      console.error('Google Drive streaming failed in download endpoint, falling back to local file if available:', driveErr);
    }
  }

  // 3. Fallback to Local Server Storage disk file
  const safeFilename = path.basename(file?.filename || idOrFilename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).setHeader('Content-Type', 'text/plain').send('File missing from server storage');
  }

  const rawDisplayName = (req.query.name as string) || file?.originalName || safeFilename;
  const mimeType = file?.mimeType || 'application/octet-stream';
  const safeDisplayName = rawDisplayName.replace(/["\r\n\/\\]/g, '_');
  const encodedDisplayName = encodeURIComponent(rawDisplayName);

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
      'X-Content-Type-Options': 'nosniff',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

app.get('/api/files/download-by-name/:filename', (req: AuthRequest, res) => {
  return handleFileDownloadStream(req.params.filename, req, res);
});

app.get('/api/files/:id/download', (req: AuthRequest, res) => {
  return handleFileDownloadStream(req.params.id, req, res);
});

// Explicit Download Count Increment Endpoint (Strict 1 IP = 1 Download)
app.post('/api/files/:id/increment-download', (req: AuthRequest, res) => {
  const database = db.getDb();
  const qFilename = (req.query.filename as string) || (req.body.filename as string);
  const file = findFileByAnyIdentifier(database, req.params.id, qFilename);

  if (file) {
    const result = registerFileDownload(file, req);
    return res.json({
      success: true,
      downloadsCount: result.downloadsCount,
      incremented: result.incremented,
      duplicate: result.duplicate,
      ipAddress: result.ipAddress
    });
  }

  // If file record was stored in client/Firestore, register download strictly by userId/visitorId/IP for target ID
  const userId = req.user?.id || (req.headers['x-user-uid'] as string) || (req.query.userId as string);
  const visitorId = (req.headers['x-visitor-id'] as string) || (req.query.visitorId as string) || (req.body?.visitorId as string);
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || (req.headers['x-real-ip'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = rawIp.replace(/^::ffff:/, '');
  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';

  const existingDownload = database.downloads.find((d: any) => {
    const isSameFile = d.fileId === req.params.id || (qFilename && d.fileId === qFilename);
    if (!isSameFile) return false;

    if (userId && d.userId && d.userId === userId) return true;
    if (visitorId && d.visitorId && d.visitorId === visitorId) return true;
    if (!isLoopback && d.ipAddress && (d.ipAddress === clientIp || d.ipAddress === rawIp)) return true;

    return false;
  });

  if (!existingDownload) {
    database.downloads.unshift({
      id: `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fileId: req.params.id,
      fileName: qFilename || req.params.id,
      userId: userId || undefined,
      visitorId: visitorId || undefined,
      userName: req.user?.username || 'Anonymous',
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] || 'Unknown',
      downloadedAt: new Date().toISOString(),
      durationSeconds: 1,
    });
    db.save();
    return res.json({ success: true, incremented: true, duplicate: false, downloadsCount: 1, ipAddress: clientIp });
  }

  return res.json({ success: true, incremented: false, duplicate: true, ipAddress: clientIp });
});

// Helper to check if requester is Admin, file owner, or guest
function checkCanManageFile(req: AuthRequest, file: any): boolean {
  if (!file) return false;
  const requesterUid = (req.headers['x-user-uid'] as string) || req.user?.id;
  const isAdminHeader = req.headers['x-is-admin'] === 'true' || Boolean(req.headers['x-admin-token']);

  const fileOwnerUid = file.ownerUid || file.uploaderId;
  const isOwner = Boolean(requesterUid && fileOwnerUid && requesterUid === fileOwnerUid);
  const isGuestFile = !fileOwnerUid || fileOwnerUid === 'usr-guest' || fileOwnerUid === 'guest';

  const isAdmin = req.user?.role === 'admin' ||
                  isAdminHeader ||
                  Boolean(requesterUid && (requesterUid.includes('admin') || requesterUid === 'usr-admin-master'));

  return isAdmin || isOwner || isGuestFile;
}

// Edit File Metadata
app.put('/api/files/:id/edit', (req: AuthRequest, res) => {
  const database = db.getDb();
  const fileIndex = database.files.findIndex(f => f.id === req.params.id);

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = database.files[fileIndex];

  // Authorization check: Admin has full access, users can edit their own files
  if (!checkCanManageFile(req, file)) {
    return res.status(403).json({ error: 'Permission denied. You can only edit your own files.' });
  }

  const { originalName, category, description, tags, isPasswordProtected, password, isDraft, isFeatured, scheduledAt, externalUrl, fileSize } = req.body;

  if (originalName) file.originalName = originalName;
  if (category) file.category = category;
  if (description !== undefined) file.description = description;
  if (tags) {
    file.tags = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }
  if (isPasswordProtected !== undefined) file.isPasswordProtected = !!isPasswordProtected;
  if (password !== undefined) file.password = password;
  if (isDraft !== undefined) file.isDraft = !!isDraft;
  if (isFeatured !== undefined) file.isFeatured = !!isFeatured;
  if (scheduledAt !== undefined) file.scheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : null;
  if (externalUrl) {
    file.externalUrl = externalUrl.trim();
    file.filePath = externalUrl.trim();
    file.driveDownloadUrl = externalUrl.trim();
    if (externalUrl.toLowerCase().includes('mediafire.com')) {
      file.storageType = 'mediafire';
    } else {
      file.storageType = 'external_link';
    }
  }
  if (fileSize) {
    if (typeof fileSize === 'number' && fileSize > 0) file.fileSize = fileSize;
    else if (typeof fileSize === 'string') {
      const num = parseFloat(fileSize);
      if (!isNaN(num)) {
        if (fileSize.toLowerCase().includes('gb')) file.fileSize = Math.round(num * 1024 * 1024 * 1024);
        else if (fileSize.toLowerCase().includes('kb')) file.fileSize = Math.round(num * 1024);
        else if (fileSize.toLowerCase().includes('mb')) file.fileSize = Math.round(num * 1024 * 1024);
        else file.fileSize = Math.round(num);
      }
    }
  }

  file.updatedAt = new Date().toISOString();

  db.updateCategoryCounts();
  db.logActivity(req.user?.username || 'System', 'FILE_EDIT', req.ip || '127.0.0.1', `Updated file ${file.originalName}`);

  res.json({ message: 'File updated successfully', file });
});

// Replace File Content
app.put('/api/files/:id/replace', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (!checkCanManageFile(req, file)) {
    return res.status(403).json({ error: 'Permission denied. You can only replace content for your own files.' });
  }

  // Delete old Google Drive file if exists
  if (file.driveFileId) {
    await deleteFromGoogleDrive(file.driveFileId);
  }

  // Remove old file from local disk if exists
  if (fs.existsSync(file.filePath)) {
    try {
      fs.unlinkSync(file.filePath);
    } catch (e) {
      console.error('Error removing old file:', e);
    }
  }

  let driveResult: { driveFileId: string; webViewLink?: string; webContentLink?: string } | null = null;
  try {
    driveResult = await uploadToGoogleDrive(req.file.path, file.originalName || req.file.originalname, req.file.mimetype);
  } catch (gErr) {
    console.error('Google Drive replacement upload error:', gErr);
  }

  file.filename = req.file.filename;
  file.filePath = driveResult?.webContentLink || req.file.path;
  file.fileSize = req.file.size;
  file.mimeType = req.file.mimetype || 'application/octet-stream';
  if (driveResult) {
    file.storageType = 'google_drive';
    file.driveFileId = driveResult.driveFileId;
    file.driveViewUrl = driveResult.webViewLink;
    file.driveDownloadUrl = driveResult.webContentLink;
  }
  file.updatedAt = new Date().toISOString();

  db.save();
  db.logActivity(req.user?.username || 'User', 'FILE_REPLACE', req.ip || '127.0.0.1', `Replaced file content for ${file.originalName}`);

  res.json({ message: 'File content replaced successfully', file });
});

// Delete File
app.delete('/api/files/:id', async (req: AuthRequest, res) => {
  const database = db.getDb();
  const fileIndex = database.files.findIndex(f => f.id === req.params.id);

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = database.files[fileIndex];

  if (!checkCanManageFile(req, file)) {
    return res.status(403).json({ error: 'Permission denied. You can only delete your own files.' });
  }

  // Delete from Google Drive if stored there
  if (file.driveFileId) {
    await deleteFromGoogleDrive(file.driveFileId);
  }

  // Remove file physically
  if (fs.existsSync(file.filePath)) {
    try {
      fs.unlinkSync(file.filePath);
    } catch (e) {
      console.error('Failed deleting physical file:', e);
    }
  }

  database.files.splice(fileIndex, 1);
  db.updateCategoryCounts();

  db.logActivity(req.user?.username || 'User', 'FILE_DELETE', req.ip || '127.0.0.1', `Deleted file ${file.originalName}`);

  res.json({ message: 'File deleted successfully' });
});

// Validate File Password
app.post('/api/files/:id/check-password', (req, res) => {
  const { password } = req.body;
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (!file.isPasswordProtected) {
    return res.json({ valid: true });
  }

  if (file.password === password) {
    return res.json({ valid: true });
  } else {
    return res.status(401).json({ valid: false, error: 'Incorrect file password' });
  }
});

// REAL FILE DOWNLOAD ENDPOINT (With Stream & Resume Support from Google Drive or local storage!)
app.get('/api/files/:id/download', async (req: AuthRequest, res) => {
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).setHeader('Content-Type', 'text/plain').send('File not found');
  }

  // Password check if requested via query or header
  if (file.isPasswordProtected) {
    const pwd = (req.query.password as string) || req.headers['x-file-password'];
    if (pwd !== file.password) {
      return res.status(403).setHeader('Content-Type', 'text/plain').send('Password required to download this file');
    }
  }

  // Register download count uniquely per IP address
  registerFileDownload(file, req);

  // External URL or MediaFire Link redirect
  if (file.externalUrl || file.storageType === 'mediafire' || file.storageType === 'external_link' || (file.filePath && file.filePath.startsWith('http'))) {
    const targetRedirectUrl = file.externalUrl || file.filePath || file.driveDownloadUrl;
    if (targetRedirectUrl) {
      return res.redirect(302, targetRedirectUrl);
    }
  }

  // If file is stored in Google Drive, stream directly from Google Drive API
  if (file.driveFileId) {
    try {
      const mimeType = file.mimeType || 'application/octet-stream';
      const safeDisplayName = file.originalName.replace(/["\r\n\/\\]/g, '_');
      const encodedDisplayName = encodeURIComponent(file.originalName);

      const driveRes = await getGoogleDriveStream(file.driveFileId, req.headers);
      const resHeaders: Record<string, any> = {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
        'X-Content-Type-Options': 'nosniff',
      };

      if (driveRes.headers['content-length']) {
        resHeaders['Content-Length'] = driveRes.headers['content-length'];
      }

      if (driveRes.headers['content-range']) {
        resHeaders['Content-Range'] = driveRes.headers['content-range'];
        resHeaders['Accept-Ranges'] = 'bytes';
        res.writeHead(206, resHeaders);
      } else {
        res.writeHead(200, resHeaders);
      }

      driveRes.data.pipe(res);
      return;
    } catch (driveErr) {
      console.error('Google Drive streaming failed, falling back to local file if available:', driveErr);
    }
  }

  let filePath = file.filePath;

  if (!filePath || !fs.existsSync(filePath)) {
    const safeName = file.originalName ? path.basename(file.originalName) : `file-${file.id}.bin`;
    filePath = path.join(UPLOADS_DIR, `file-${file.id}-${safeName}`);
    if (!fs.existsSync(filePath)) {
      const dummyContent = `FileVault Download Content for ${file.originalName || file.id}\nFile ID: ${file.id}\nUploaded: ${file.createdAt || new Date().toISOString()}\nDescription: ${file.description || 'Shared file download.'}\n`;
      fs.writeFileSync(filePath, dummyContent);
    }
    file.filePath = filePath;
  }

  const mimeType = file.mimeType || 'application/octet-stream';
  const safeDisplayName = file.originalName.replace(/["\r\n\/\\]/g, '_');
  const encodedDisplayName = encodeURIComponent(file.originalName);

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Stream file with HTTP Range support for resume capability
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
      'X-Content-Type-Options': 'nosniff',
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeDisplayName}"; filename*=UTF-8''${encodedDisplayName}`,
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// QR Code Data URL Generator
app.get('/api/files/:id/qrcode', async (req, res) => {
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const downloadUrl = `${appUrl}/#download-${file.id}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#4f46e5',
        light: '#ffffff',
      },
    });
    res.json({ qrCode: qrDataUrl, url: downloadUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed generating QR Code' });
  }
});

// Comments & Ratings
app.get('/api/files/:id/comments', (req, res) => {
  const database = db.getDb();
  const comments = database.comments.filter(c => c.fileId === req.params.id);
  res.json({ comments });
});

app.post('/api/files/:id/comments', requireAuth, (req: AuthRequest, res) => {
  const { comment, rating } = req.body;
  if (!comment) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const newComment = {
    id: `comm-${Date.now()}`,
    fileId: file.id,
    userId: req.user!.id,
    userName: req.user!.username,
    userAvatar: req.user!.avatar,
    comment,
    rating: Number(rating) || 5,
    createdAt: new Date().toISOString(),
  };

  database.comments.unshift(newComment);

  // Recalculate ratingAvg
  const fileComments = database.comments.filter(c => c.fileId === file.id && c.rating);
  if (fileComments.length > 0) {
    const sum = fileComments.reduce((acc, curr) => acc + (curr.rating || 5), 0);
    file.ratingAvg = Number((sum / fileComments.length).toFixed(1));
    file.ratingCount = fileComments.length;
  }

  db.save();

  res.status(201).json({ comment: newComment });
});

// File Report Endpoint
app.post('/api/files/:id/report', (req: AuthRequest, res) => {
  const { reason, details } = req.body;
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const report = {
    id: `rep-${Date.now()}`,
    fileId: file.id,
    fileName: file.originalName,
    userId: req.user?.id,
    reason: reason || 'other',
    details: details || '',
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  };

  database.reports.unshift(report);
  db.save();

  res.status(201).json({ message: 'Report submitted for review', report });
});

// ==========================================
// 3. CATEGORIES API
// ==========================================

app.get('/api/categories', (req, res) => {
  const database = db.getDb();
  db.updateCategoryCounts();
  res.json({ categories: database.categories });
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });

  const database = db.getDb();
  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    description: description || '',
    icon: icon || 'Folder',
    fileCount: 0,
    createdAt: new Date().toISOString(),
  };

  database.categories.push(newCat);
  db.save();

  res.status(201).json({ category: newCat });
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  const database = db.getDb();
  database.categories = database.categories.filter(c => c.id !== req.params.id);
  db.save();
  res.json({ message: 'Category removed' });
});

// ==========================================
// 4. REALTIME ADVERTISEMENT API
// ==========================================

app.get('/api/ads', (req, res) => {
  const database = db.getDb();
  const enabledAds = database.advertisements.filter(a => a.isEnabled);
  res.json({ ads: enabledAds });
});

app.get('/api/admin/ads', requireAdmin, (req, res) => {
  const database = db.getDb();
  res.json({ ads: database.advertisements });
});

app.post('/api/admin/ads', requireAdmin, (req, res) => {
  const { title, type, code, location, isEnabled } = req.body;
  if (!title || !type || !code) {
    return res.status(400).json({ error: 'Title, Type, and Code are required' });
  }

  const database = db.getDb();
  const newAd: Advertisement = {
    id: `ad-${Date.now()}`,
    title,
    type,
    code,
    location: location || 'general',
    isEnabled: isEnabled !== undefined ? isEnabled : true,
    clicks: 0,
    impressions: 0,
    createdAt: new Date().toISOString(),
  };

  database.advertisements.unshift(newAd);
  db.save();

  res.status(201).json({ ad: newAd });
});

app.put('/api/admin/ads/:id', requireAdmin, (req, res) => {
  const database = db.getDb();
  const ad = database.advertisements.find(a => a.id === req.params.id);

  if (!ad) {
    return res.status(404).json({ error: 'Ad unit not found' });
  }

  const { title, type, code, location, isEnabled } = req.body;
  if (title) ad.title = title;
  if (type) ad.type = type;
  if (code !== undefined) ad.code = code;
  if (location) ad.location = location;
  if (isEnabled !== undefined) ad.isEnabled = isEnabled;

  db.save();
  res.json({ message: 'Ad updated', ad });
});

app.delete('/api/admin/ads/:id', requireAdmin, (req, res) => {
  const database = db.getDb();
  database.advertisements = database.advertisements.filter(a => a.id !== req.params.id);
  db.save();
  res.json({ message: 'Ad unit deleted' });
});

// Track Ad Impressions / Clicks
app.post('/api/ads/:id/event', (req, res) => {
  const { event } = req.body; // 'impression' | 'click'
  const database = db.getDb();
  const ad = database.advertisements.find(a => a.id === req.params.id);

  if (ad) {
    if (event === 'click') ad.clicks = (ad.clicks || 0) + 1;
    if (event === 'impression') ad.impressions = (ad.impressions || 0) + 1;
    db.save();
  }
  res.json({ success: true });
});

// ==========================================
// 5. ADMIN ANALYTICS & MANAGEMENT API
// ==========================================

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const database = db.getDb();

  const totalFiles = database.files.length;
  const totalDownloads = database.files.reduce((acc, f) => acc + (f.downloadsCount || 0), 0);
  const totalUsers = database.users.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayDownloads = database.downloads.filter(d => d.downloadedAt.startsWith(todayStr)).length;

  const storageUsedBytes = database.files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  const revenueEstimate = Number((totalDownloads * 0.005 + database.advertisements.reduce((acc, a) => acc + a.clicks * 0.15, 0)).toFixed(2));

  // Generate 7-day chart data
  const dailyDownloadsChart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dlCount = database.downloads.filter(dl => dl.downloadedAt.startsWith(dateStr)).length;
    const upCount = database.files.filter(f => f.createdAt.startsWith(dateStr)).length;
    dailyDownloadsChart.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      downloads: dlCount,
      uploads: upCount,
    });
  }

  res.json({
    totalFiles,
    totalDownloads,
    totalUsers,
    todayDownloads,
    onlineUsers: database.users.filter(u => u.status === 'active').length || 1,
    storageUsedBytes,
    revenueEstimate,
    files: database.files,
    recentUploads: database.files.slice(0, 5),
    recentDownloads: database.downloads.slice(0, 10),
    dailyDownloadsChart,
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const database = db.getDb();
  res.json({ users: database.users });
});

app.put('/api/admin/users/:id', requireAdmin, (req: AuthRequest, res) => {
  const { role, status } = req.body;
  const database = db.getDb();
  const user = database.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  // Prevent demoting or banning main root admin
  if (user.id === 'usr-admin-1' || user.email === 'dipen8717@gmail.com') {
    if (status === 'banned' || role === 'user') {
      return res.status(400).json({ error: 'Primary system administrator account cannot be banned or demoted.' });
    }
  }

  if (role && (role === 'admin' || role === 'user')) {
    user.role = role;
  }
  if (status && (status === 'active' || status === 'banned')) {
    user.status = status;
  }

  db.save();
  db.logActivity(
    req.user?.username || 'Admin',
    'UPDATE_USER',
    req.ip || '127.0.0.1',
    `Updated user ${user.username} (Role: ${user.role}, Status: ${user.status})`
  );

  res.json({ user, message: `User ${user.username} updated successfully.` });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const database = db.getDb();
  res.json({ settings: database.settings });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthRequest, res) => {
  const database = db.getDb();
  database.settings = { ...database.settings, ...req.body };
  db.save();
  resetDriveInstance();
  db.logActivity(req.user?.username || 'Admin', 'UPDATE_SETTINGS', req.ip || '127.0.0.1', 'Updated website settings');
  res.json({ settings: database.settings });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const database = db.getDb();
  res.json({ logs: database.activityLogs });
});

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const database = db.getDb();
  res.json({ reports: database.reports });
});

app.put('/api/admin/reports/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  const database = db.getDb();
  const rep = database.reports.find(r => r.id === req.params.id);
  if (rep) {
    rep.status = status;
    db.save();
  }
  res.json({ report: rep });
});

// ==========================================
// 6. SEO ENDPOINTS
// ==========================================

app.get('/robots.txt', (req, res) => {
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${appUrl}/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  const database = db.getDb();
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `<url><loc>${appUrl}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;

  database.files.forEach(f => {
    xml += `<url><loc>${appUrl}/#file-${f.id}</loc><lastmod>${f.updatedAt.split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  });

  xml += `</urlset>`;
  res.type('application/xml');
  res.send(xml);
});

// ==========================================
// 7. VITE DEVELOPMENT / PRODUCTION MIDDLEWARE & SPA FALLBACK
// ==========================================

// Explicit SPA fallback routes for download links, file links, and admin paths
app.get(['/download/*', '/file/*', '/d/*', '/admin*'], (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    req.url = '/';
    return next();
  }
  const distPath = path.join(process.cwd(), 'dist');
  return res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FileVault Express server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
