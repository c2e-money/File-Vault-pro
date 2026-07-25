import { IncomingForm } from "formidable";
import fs from "fs";
import { google } from "googleapis";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Google Drive Authentication Setup
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY 
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : undefined,
  },
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const uploadDir = "/tmp/uploads";

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new IncomingForm({
    uploadDir,
    keepExtensions: true,
    multiples: true,
    maxFileSize: 1024 * 1024 * 1000, // 1GB
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({
        error: err.message,
      });
    }

    try {
      // Formidable v3/v2 ke mutabiq files array handle karna
      const fileData = files.file || files.files;
      const uploadedFiles = Array.isArray(fileData) ? fileData : [fileData];
      const driveResponses = [];

      for (const file of uploadedFiles) {
        if (!file) continue;

        const filePath = file.filepath || file.path;
        const fileName = file.originalFilename || file.name || "uploaded_file";
        const mimeType = file.mimetype || "application/octet-stream";

        const fileMetadata = {
          name: fileName,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID as string],
        };

        const media = {
          mimeType: mimeType,
          body: fs.createReadStream(filePath),
        };

        // Google Drive par upload call
        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id, name, webViewLink",
        });

        driveResponses.push(response.data);

        // Temp file delete karna
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      return res.status(201).json({
        message: "Files uploaded to Google Drive successfully",
        files: driveResponses,
      });

    } catch (uploadError: any) {
      console.error("Google Drive Upload Error:", uploadError);
      return res.status(500).json({
        error: uploadError.message || "Failed to upload to Google Drive",
      });
    }
  });
}
