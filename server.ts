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

const JWT_SECRET = process.env.JWT_SECRET || 'filevault-super-secret-key-2026';
const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static route to serve uploaded files directly
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer Disk Storage for Server Storage
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

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

// Anti-Bypass & Rate-Limiter Store
interface LoginAttemptRecord {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

const loginAttemptsStore = new Map<string, LoginAttemptRecord>();
const DUMMY_BCRYPT_HASH = '$2a$10$e7xX4W4j6.k1J8uM3f.3O.S245u8v7p9g7.9u0z/c0g2b3a4c5d6e';

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
      if (user && user.role === decoded.role) {
        req.user = user;
      }
    }
    next();
  });
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
      error: `Too many failed login attempts. Try again in ${Math.ceil(limitStatus.remainingSeconds / 60)} minute(s).`,
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
    db.logActivity('System', 'FAILED_USER_LOGIN', clientIp, `Failed login for: ${cleanEmail}`);
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
  const userRateKey = `admin_login_usr:${cleanEmail}`;

  const userLimit = checkRateLimit(userRateKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (userLimit.isLocked) {
    return res.status(429).json({
      error: `Security Lockout: Too many failed attempts. Try again in ${Math.ceil(userLimit.remainingSeconds / 60)} minute(s).`,
    });
  }

  const database = db.getDb();
  const user = database.users.find(
    u => (u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanEmail) && u.role === 'admin'
  );

  const passwordHash = user ? database.passwords[user.id] : DUMMY_BCRYPT_HASH;
  const isValid = bcrypt.compareSync(password, passwordHash || DUMMY_BCRYPT_HASH);

  if (!user || user.status === 'banned' || !isValid) {
    const userFailInfo = recordFailedAttempt(userRateKey, 5);
    db.logActivity('SECURITY_SYSTEM', 'ADMIN_LOGIN_FAILURE', clientIp, `Failed admin login for: ${cleanEmail}`);
    return res.status(401).json({
      error: 'Invalid administrator credentials',
      remainingAttempts: userFailInfo.remainingAttempts,
    });
  }

  clearLoginAttempts(userRateKey);
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  db.logActivity(user.username, 'ADMIN_LOGIN', clientIp, `Admin authenticated`, user.id);

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
// 2. FILES API ROUTES (Server Storage)
// ==========================================

app.get('/api/files', (req: AuthRequest, res) => {
  const { search, category, sort, page = '1', limit = '12', scope } = req.query;

  const database = db.getDb();
  let files = [...database.files];
  const now = new Date();

  if (req.user && req.user.role === 'admin' && scope === 'admin') {
    // Admin viewing all files
  } else if (req.user) {
    files = files.filter(f => f.uploaderId === req.user!.id);
  } else {
    files = [];
  }

  files = files.filter(f => {
    if (f.isDraft) return false;
    if (f.scheduledAt && new Date(f.scheduledAt) > now) return false;
    return true;
  });

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    files = files.filter(
      f =>
        f.originalName.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  if (category && typeof category === 'string' && category !== 'all') {
    files = files.filter(f => f.category.toLowerCase() === category.toLowerCase() || f.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (sort === 'downloads') {
    files.sort((a, b) => b.downloadsCount - a.downloadsCount);
  } else if (sort === 'size') {
    files.sort((a, b) => b.fileSize - a.fileSize);
  } else {
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

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

app.get('/api/files/:id', (req: AuthRequest, res) => {
  const database = db.getDb();
  const file = database.files.find(f => f.id === req.params.id);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  file.viewsCount = (file.viewsCount || 0) + 1;
  db.save();

  const fileObj = { ...file };
  delete (fileObj as any).password;

  res.json({ file: fileObj });
});

// Upload File (Server Storage Direct)
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
        const fileDownloadUrl = `${req.protocol}://${req.get('host')}/api/files/download-by-name/${file.filename}`;

        const newFile: FileItem = {
          id: fileId,
          originalName: file.originalname,
          filename: file.filename,
          filePath: fileDownloadUrl,
          fileSize: file.size,
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
          storageType: 'local',
          ratingAvg: 5.0,
          ratingCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        database.files.unshift(newFile);
        createdFiles.push(newFile);
      }

      db.updateCategoryCounts();
      db.save();

      db.logActivity(
        uploader.username,
        'FILE_UPLOAD',
        req.ip || '127.0.0.1',
        `Uploaded ${createdFiles.length} file(s) to server storage`,
        uploader.id
      );

      return res.status(201).json({
        message: 'Files uploaded successfully to server storage',
        files: createdFiles,
      });
    } catch (handlerErr: any) {
      console.error('Upload handler error:', handlerErr);
      return res.status(500).json({ error: handlerErr.message || 'Internal server error during upload' });
    }
  });
});

// Stream/Download file from server disk by filename with Unique IP Check per File
app.get('/api/files/download-by-name/:filename', (req: AuthRequest, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).setHeader('Content-Type', 'text/plain').send('File missing from server storage');
  }

  const database = db.getDb();
  const file = database.files.find(f => f.filename === safeFilename || f.filePath?.includes(safeFilename));
  
  if (file) {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    
    // Check if this IP has already downloaded this specific file before
    const alreadyDownloaded = database.downloads.some(
      dl => dl.fileId === file.id && dl.ipAddress === clientIp
    );

    if (!alreadyDownloaded) {
      file.downloadsCount = (file.downloadsCount || 0) + 1;
      database.downloads.unshift({
        id: `dl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fileId: file.id,
        fileName: file.originalName,
        userId: req.user?.id,
        userName: req.user?.username || 'Anonymous',
        ipAddress: String(clientIp),
        userAgent: req.headers['user-agent'] || 'Unknown',
        downloadedAt: new Date().toISOString(),
        durationSeconds: 1,
      });
      db.save();
    }
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
});

// Vite Development Server Integration
async function startServer() {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
                 
