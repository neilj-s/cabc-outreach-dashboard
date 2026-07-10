import crypto from 'crypto';
import { getDb, saveDb } from './storage';

// Encryption config for refresh tokens
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'a_very_secure_32_character_key_planning';
const IV_LENGTH = 16;

export function encryptToken(text: string): string {
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (err) {
    console.error('Token encryption failed:', err);
    return text;
  }
}

export function decryptToken(text: string): string {
  try {
    if (!text.includes(':')) return text;
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error('Token decryption failed:', err);
    return text;
  }
}

export function extractFileId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

export async function getOrRefreshDriveToken(): Promise<string> {
  const db = getDb();
  if (!db.googleOAuth?.accessToken) {
    throw new Error('No server-managed Google OAuth session active.');
  }

  const now = Date.now();
  const expiresAt = db.googleOAuth.expiresAt || 0;

  // Treat a missing or zero expiresAt as already expired, and refresh it immediately.
  // Otherwise, only attempt a refresh when the token is actually near expiry (within 2 minutes).
  if (expiresAt === 0 || now >= expiresAt - 120 * 1000) {
    console.log('[Token Lifecycle] Refreshing expired or near-expired server-managed Google Access Token...');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth client credentials are unconfigured on the server. Please reconnect Drive.');
    }

    const encryptedRefresh = db.googleOAuth.refreshToken;
    const decryptedRefresh = encryptedRefresh ? decryptToken(encryptedRefresh) : null;

    if (!decryptedRefresh || decryptedRefresh === 'mock_refresh_token_xyz_123_abc') {
      throw new Error('No valid refresh token stored. Please reconnect Drive.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptedRefresh,
      grant_type: 'refresh_token'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google token refresh failed: ${errText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      throw new Error('Google token refresh returned an invalid response with no access token.');
    }

    db.googleOAuth.accessToken = data.access_token;
    if (data.refresh_token) {
      db.googleOAuth.refreshToken = encryptToken(data.refresh_token);
    }
    
    const expiresIn = typeof data.expires_in === 'number'
      ? data.expires_in
      : parseInt(data.expires_in as any, 10) || 3600;

    db.googleOAuth.expiresAt = Date.now() + expiresIn * 1000;
    saveDb(db);
    console.log('[Token Lifecycle] Server-managed token successfully refreshed via Google Auth API.');
    return db.googleOAuth.accessToken;
  }

  return db.googleOAuth.accessToken;
}

export async function getServiceAccountAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  try {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedClaim = Buffer.from(JSON.stringify(claim)).toString('base64url');
    
    const stringToSign = `${encodedHeader}.${encodedClaim}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(stringToSign);
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    const signature = sign.sign(formattedPrivateKey, 'base64url');
    
    const jwt = `${stringToSign}.${signature}`;
    
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get service account token: ${text}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  } catch (err) {
    throw err;
  }
}

// Helper to get Google Drive access token (Service Account or User OAuth)
export async function getDriveAccessToken(userBearerToken?: string): Promise<string> {
  // 1. Try server-managed OAuth session from DB first
  const db = getDb();
  if (db.googleOAuth?.accessToken) {
    try {
      return await getOrRefreshDriveToken();
    } catch (err) {
      console.warn('Server-managed OAuth retrieval failed, falling back to Service Account / Bearer token:', err);
    }
  }

  const saKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let saPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (saKeyStr) {
    try {
      const saKey = JSON.parse(saKeyStr);
      saEmail = saKey.client_email;
      saPrivateKey = saKey.private_key;
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  if (saEmail && saPrivateKey) {
    try {
      return await getServiceAccountAccessToken(saEmail, saPrivateKey);
    } catch (err) {
      console.error('Service account token generation failed, falling back to user token:', err);
    }
  }

  if (userBearerToken) {
    return userBearerToken.replace('Bearer ', '').trim();
  }

  throw new Error('No Google authentication configured. Please provide a user OAuth token or configure a Service Account.');
}
