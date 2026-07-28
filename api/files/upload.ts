import { IncomingForm } from "formidable";
import fs from "fs";
import { google } from "googleapis";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uploadDir = "/tmp/uploads";

  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if directory already exists
    }
  }

  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    multiples: true,
    maxFileSize: 1024 * 1024 * 1000, // 1GB
  });

  try {
    const parseForm = () => {
      return new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      });
    };

    const { files }: any = await parseForm();

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return res.status(500).json({ error: "Google Drive environment variables are missing." });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    const rawFiles = files.file || files.files;
    const uploadedFiles = Array.isArray(rawFiles) ? rawFiles : [rawFiles];
    const driveResponses = [];

    for (const file of uploadedFiles) {
      if (!file) continue;

      const filePath = file.filepath || file.path;
      const fileName = file.originalFilename || file.name || "uploaded_file";
      const mimeType = file.mimetype || "application/octet-stream";

      if (!filePath || !fs.existsSync(filePath)) {
        continue;
      }

      const fileMetadata = {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath),
      };

      // 1. Upload to Drive (Added webContentLink)
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id, name, webViewLink, webContentLink",
      });

      const fileId = response.data.id;

      // 2. Make file public so users can download it
      if (fileId) {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
      }

      // Tumhare frontend (api.js) ko filename aur downloadUrl chahiye
      driveResponses.push({
        id: fileId,
        originalName: fileName,
        filename: fileId, // Taki frontend file id save kare
        fileSize: file.size || 0,
        mimeType: mimeType,
        downloadUrl: response.data.webContentLink || response.data.webViewLink,
      });

      // Clean up local temp file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // ignore cleanup error
      }
    }

    return res.status(201).json({
      message: "Files uploaded to Google Drive successfully",
      files: driveResponses, // Frontend api.js isko seedha read kar lega
    });

  } catch (error: any) {
    console.error("Function Invocation Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error during file upload",
    });
  }
}
