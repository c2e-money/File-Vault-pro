import { google } from 'googleapis';
import stream from 'stream';
import path from 'path';

// Aapke Service Account ki JSON file ka path
const KEYFILEPATH = path.join(process.cwd(), 'google-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadToGoogleDrive(fileObject: Express.Multer.File, folderId: string) {
  try {
    // Multer memory buffer ko stream mein convert karna
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    const media = {
      mimeType: fileObject.mimetype,
      body: bufferStream,
    };

    // Google Drive par upload karna
    const response = await drive.files.create({
      requestBody: {
        name: fileObject.originalname,
        parents: [folderId], // Yahan Folder ID aayega
      },
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id;

    // File ko public banana taaki koi bhi download kar sake
    if (fileId) {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    }

    return response.data; // Isme fileId aur direct download link hoga
  } catch (error) {
    console.error('Google Drive Upload Error:', error);
    throw error;
  }
}

