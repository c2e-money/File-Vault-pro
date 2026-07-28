import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import stream from 'stream';
import dotenv from 'dotenv';
import path from 'path';

// .env फाइल से वेरिएबल्स लोड करने के लिए
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSON डेटा पार्स करने के लिए
app.use(express.json());

// ---------------------------------------------------------
// 1. MULTER SETUP (Memory Storage for Render)
// ---------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1000 }, // 1GB limit
});

// ---------------------------------------------------------
// 2. GOOGLE DRIVE UPLOAD ROUTE
// ---------------------------------------------------------
app.post('/api/files/upload', upload.array('files'), async (req: any, res: any) => {
  try {
    // Check for Environment Variables
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      console.error("Missing Google Drive Environment Variables.");
      return res.status(500).json({ error: "Google Drive environment variables are missing." });
    }

    // Google Drive Auth Setup
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });
    
    const files = req.files as Express.Multer.File[];
    const driveResponses = [];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    for (const file of files) {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);

      // Google Drive पर Upload
      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
        fields: "id, name, webContentLink, webViewLink",
      });

      const fileId = response.data.id;

      // फाइल को पब्लिक बनाना
      if (fileId) {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      }

      driveResponses.push({
        id: fileId,
        originalName: file.originalname,
        filename: fileId, 
        fileSize: file.size,
        mimeType: file.mimetype,
        downloadUrl: response.data.webContentLink || response.data.webViewLink,
      });
    }

    return res.status(201).json({
      message: "Files uploaded to Google Drive successfully!",
      files: driveResponses,
    });

  } catch (error: any) {
    console.error("Google Drive Upload Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error during file upload",
    });
  }
});


// ---------------------------------------------------------
// 3. PRODUCTION BUILD SETUP (Vite + Express)
// ---------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ---------------------------------------------------------
// 4. START SERVER
// ---------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT} 🚀`);
});
