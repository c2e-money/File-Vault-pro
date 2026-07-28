import { google } from 'googleapis';
import stream from 'stream';

// GitHub/Render ke liye safe tareeka (Env Variables)
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadToGoogleDrive(fileObject: any, folderId: string) {
  try {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    const media = {
      mimeType: fileObject.mimetype,
      body: bufferStream,
    };

    const response = await drive.files.create({
      requestBody: {
        name: fileObject.originalname,
        parents: [folderId], 
      },
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id;

    if (fileId) {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    }

    return response.data;
  } catch (error) {
    console.error('Google Drive Upload Error:', error);
    throw error;
  }
}
