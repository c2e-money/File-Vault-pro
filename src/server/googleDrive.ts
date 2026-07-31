import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';

// Fallback Google Drive Credentials & Environment Variables
const ENV_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const ENV_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const ENV_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';

const ENV_CLIENT_EMAIL =
  process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
  'drive-api@numeric-camp-503820-s6.iam.gserviceaccount.com';

const ENV_PRIVATE_KEY_RAW =
  process.env.GOOGLE_DRIVE_PRIVATE_KEY ||
  `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC2+lf9Trq7Hp/8\ndaLqPtQuHkBTblfXOqP8TMzXJqcR6AlSwSdGMvryi5fFAUTfULBIU6G1GwiIDHwZ\nWjtsNSiJDufVd5WGBdYk/WfRvOL52CusK9SB8+xEfUXccIQsAEf6pbkQPolcDUzp\nAXvqwf9U2GE9GR1ZQ6xMkBbJvt4ryOGX5JWPe5zPInfOIwA9+GW7e5Dze5EGBfKm\nRFX066Vn0V0ZZ5YOjCVxDPLm5982BxNIrx7rrM/6cYZlPxkcQv5tsqNqh2MWlP+f\n/GKn7CMViKtoWJQNmpPEbmzDtE5026HHqLs/QD1sz5hboUdnf7MQGRbOrRW2+14l\nk9YvLUFZAgMBAAECggEAS6FpWiW/EBXl+fNjrd/fUtqlKvcKbsdpvaC+8FUlLEUV\nCXQV+DGdQUCKsF7IaWeQHa0Xw2RTn+xNJSuDMUQ9p30WPUkq8BUcgPiO/4XL6Yo8\n7vLE6Rv59gszo5yMPSW2mrcCKeE3ZGmI9yxqXEvobljrxFXLqDhNEO5jxOrUKRMx\nYtkjXi7i3YGMf54KXt3iKJnpwPBK8Yur+d4KrW9Hvj5SKMTZrhMOBvfjOmaHJvKC\nnwxVlBa2k/aIs7wGnxmbnGuK4gHVyhtKbPvvabpRpDFfOpNavrG0ogZbsij1dmBT\nBVfzSZTLSOqs4WB4+B5p/WUOmoSpv0KyDuvVGpZPGwKBgQDkXIwjTrIfeyZ3oXZ6\nZ3Loj6Kdwu4bn4yIB4p6yOqrOzDD0iVYcXAEZFQXv2DIDfTG6mesUfUtuN3ofP3h\nAFU30gFFIjRaou6ArWfkpB73v5A3U4wFo2srlN5e4qweBqU5D08R8fs5dl58W1sq\nl3XtjtoILcd6FyMEmIWww7TThwKBgQDNH6aLESsVn7xXj88xLS9VS4ZeO3GfjRLj\nQ8nRT32pKhRvO3IOVWNFg6XmtuFGsCXTvwdwLVh61iDIPP2VUXfuRYzPlYrYSuO8\nH3FidKSb5Cc6vaVM9JVky6z5s7hXOL+R52GF3esSUhpHseqZnET3657p45KKScU8\n5V3VJKw8HwKBgArPDpsFOI0g6Rs0e0Uj7F5xngLVnSuVi7NMmBNjuyfLr201Xysm\ng2TR0uEk39HYR0O7CJkxb+dwHqDIecPSnjX8LK83BT9dAuj4TDiYRBb57DuSKsiB\niasQas4W8IqjSeK/hMCWsYtwvNwp/tCvRpet8Uf90rlGqxOmnH1XZhG1AoGAPV7y\n3TjNwzJ/j1Mfkn8KYmKuWRM/85SpygVGJLG7zxkf9Ae9IDy77thskpK05Alfx/Kn\nrxBiIJ5gQIi+9iXh1BBLCPCdEgmWCXr+2Y48kce5VQHYqyWibP3jSvJSfQYliunH\na93xrxGRe1Hn9v2iROriKOhFt8pKkOWvJU5LmdECgYAb2ew+/DJKAgQxbjpGLbCL\nGmAmdu7X7PCl/T9sF4dRBd8PNqYTBSqHE82iq2bEvJ6O6pJjwmXUnPyUrpZW/pVh\nvFXArpgen50jCaxUWtkYKUOUZZxD9TMcOGF9vmMhbREa8ivLnBs0BUldWqcMPN5O\nPBHjZEUAnzr5T3N2A2U5VA==\n-----END PRIVATE KEY-----\n`;

const ENV_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1CM0Vq7SXrfaZsTHr4u8ufxqA2RLHT3ER';

function getDriveConfig() {
  const database = db.getDb();
  const settings: any = database?.settings || {};

  const clientId = settings.gdriveClientId || ENV_CLIENT_ID;
  const clientSecret = settings.gdriveClientSecret || ENV_CLIENT_SECRET;
  const refreshToken = settings.gdriveRefreshToken || ENV_REFRESH_TOKEN;
  const clientEmail = settings.gdriveClientEmail || ENV_CLIENT_EMAIL;
  const privateKeyRaw = settings.gdrivePrivateKey || ENV_PRIVATE_KEY_RAW;
  const folderId = settings.gdriveFolderId || ENV_FOLDER_ID;

  return {
    clientId,
    clientSecret,
    refreshToken,
    clientEmail,
    privateKeyRaw,
    folderId,
    isOAuth: Boolean(clientId && clientSecret && refreshToken),
  };
}

function getFormattedPrivateKey(rawKey: string): string {
  if (!rawKey) return '';
  return rawKey.replace(/\\n/g, '\n');
}

export function resetDriveInstance() {
  driveInstance = null;
}

let driveInstance: any = null;

export function getGoogleDriveClient() {
  const cfg = getDriveConfig();

  if (cfg.isOAuth) {
    const oauth2Client = new google.auth.OAuth2(
      cfg.clientId,
      cfg.clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: cfg.refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  const formattedKey = getFormattedPrivateKey(cfg.privateKeyRaw);
  const auth = new google.auth.JWT({
    email: cfg.clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export function isGoogleDriveConfigured(): boolean {
  const cfg = getDriveConfig();
  return Boolean(cfg.isOAuth || (cfg.clientEmail && cfg.privateKeyRaw && cfg.folderId));
}

/**
 * Uploads a local file to Google Drive and cleans up the temporary file from local storage.
 */
export async function uploadToGoogleDrive(
  localFilePath: string,
  originalName: string,
  mimeType: string
): Promise<{ driveFileId: string; webViewLink?: string; webContentLink?: string }> {
  const cfg = getDriveConfig();
  const drive = getGoogleDriveClient();

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file not found for upload: ${localFilePath}`);
  }

  const requestBody: any = {
    name: originalName,
  };

  if (cfg.folderId) {
    requestBody.parents = [cfg.folderId];
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fs.createReadStream(localFilePath),
  };

  try {
    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true,
      supportsTeamDrives: true,
    });

    const driveFileId = response.data.id;
    if (!driveFileId) {
      throw new Error('Google Drive API did not return a valid file ID');
    }

    // Make file publicly accessible via link
    try {
      await drive.permissions.create({
        fileId: driveFileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });
    } catch (permErr) {
      console.warn('Google Drive permission warning:', permErr);
    }

    // Safely remove local temp file after successful Google Drive upload
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (cleanupErr) {
      console.warn('Temp file cleanup note:', cleanupErr);
    }

    return {
      driveFileId,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    console.error('Google Drive Upload Error:', errMsg);

    if (errMsg.includes('storage quota') || errMsg.includes('quota')) {
      throw new Error(
        'Google Drive Upload Error: Service Account has 0 quota in personal My Drive folders. Please configure Google Drive OAuth Refresh Token in Admin Settings or use a Google Workspace Shared Drive folder.'
      );
    }
    throw new Error(`Google Drive storage error: ${errMsg}`);
  }
}

/**
 * Gets readable media stream from Google Drive for a given driveFileId.
 */
export async function getGoogleDriveStream(driveFileId: string, headers?: any) {
  const drive = getGoogleDriveClient();
  const requestHeaders: any = {};
  if (headers && headers.range) {
    requestHeaders.range = headers.range;
  }

  const response = await drive.files.get(
    { fileId: driveFileId, alt: 'media', supportsAllDrives: true, supportsTeamDrives: true },
    { responseType: 'stream', headers: requestHeaders }
  );

  return response;
}

/**
 * Gets file metadata (like size) from Google Drive.
 */
export async function getGoogleDriveFileMetadata(driveFileId: string) {
  const drive = getGoogleDriveClient();
  const response = await drive.files.get({
    fileId: driveFileId,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink',
    supportsAllDrives: true,
    supportsTeamDrives: true,
  });
  return response.data;
}

/**
 * Deletes file from Google Drive.
 */
export async function deleteFromGoogleDrive(driveFileId: string): Promise<boolean> {
  try {
    const drive = getGoogleDriveClient();
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true, supportsTeamDrives: true });
    return true;
  } catch (error) {
    console.warn('Google Drive deletion note:', error);
    return false;
  }
}

/**
 * Diagnostic helper to test connection & access to target folder + live write test
 */
export async function testGoogleDriveConnection() {
  try {
    const cfg = getDriveConfig();
    const drive = getGoogleDriveClient();

    if (!cfg.folderId) {
      return { configured: false, status: 'NO_FOLDER_ID', message: 'No Google Drive Folder ID provided.' };
    }

    const folder = await drive.files.get({
      fileId: cfg.folderId,
      fields: 'id, name, permissions, driveId',
      supportsAllDrives: true,
      supportsTeamDrives: true,
    });

    // Run a live 1-byte file upload write test to verify quota and write permission
    let writeTestSuccess = false;
    let writeError = '';
    const testTempPath = path.join(process.cwd(), 'uploads', `test_write_${Date.now()}.txt`);

    try {
      fs.writeFileSync(testTempPath, 'x');
      const uploadRes = await drive.files.create({
        requestBody: { name: `_test_quota_check_${Date.now()}.txt`, parents: [cfg.folderId] },
        media: { mimeType: 'text/plain', body: fs.createReadStream(testTempPath) },
        fields: 'id',
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      if (uploadRes.data.id) {
        writeTestSuccess = true;
        // Clean up test file
        await drive.files.delete({ fileId: uploadRes.data.id, supportsAllDrives: true, supportsTeamDrives: true }).catch(() => {});
      }
    } catch (wErr: any) {
      writeError = wErr.message || String(wErr);
    } finally {
      if (fs.existsSync(testTempPath)) {
        fs.unlinkSync(testTempPath);
      }
    }

    if (!writeTestSuccess) {
      if (writeError.includes('storage quota') || writeError.includes('quota')) {
        return {
          configured: true,
          authType: cfg.isOAuth ? 'OAuth2 Refresh Token' : 'Service Account',
          folderId: cfg.folderId,
          folderName: folder.data.name,
          status: 'QUOTA_ERROR',
          error: 'Service Account quota error: Service Accounts have 0 bytes storage quota in personal Google Drive folders.',
          solution: 'To fix: 1. Enter OAuth2 Client ID, Secret, and Refresh Token in Admin Settings, or 2. Use a Google Workspace Shared Drive folder ID.',
        };
      }
      return {
        configured: true,
        authType: cfg.isOAuth ? 'OAuth2 Refresh Token' : 'Service Account',
        folderId: cfg.folderId,
        folderName: folder.data.name,
        status: 'WRITE_FAILED',
        error: writeError,
      };
    }

    return {
      configured: true,
      authType: cfg.isOAuth ? 'OAuth2 Refresh Token' : 'Service Account',
      folderId: cfg.folderId,
      folderName: folder.data.name,
      permissionsCount: folder.data.permissions?.length || 0,
      status: 'CONNECTED',
      message: 'Google Drive is connected and write uploads are working perfectly!',
    };
  } catch (err: any) {
    return {
      configured: true,
      status: 'ERROR',
      error: err.message || String(err),
    };
  }
}

