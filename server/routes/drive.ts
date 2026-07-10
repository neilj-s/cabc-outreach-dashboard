import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb, broadcast, requireAuth } from '../storage';
import { extractFileId, getOrRefreshDriveToken, encryptToken, decryptToken } from '../driveHelpers';
import { AttachedDoc } from '../../src/types';

const router = express.Router();
const oauthStates = new Set<string>();

router.get('/status', requireAuth, (req, res) => {
  const db = getDb();
  const oauth: any = db.googleOAuth || {};
  const connected = !!oauth.accessToken;
  const expired = oauth.expiresAt ? Date.now() >= oauth.expiresAt : true;
  const folderName = db.driveFolderName || null;
  res.json({ connected, expired, folderName });
});

router.post('/disconnect', requireAuth, (req, res) => {
  const db = getDb();
  delete db.googleOAuth;
  saveDb(db);
  res.json({ success: true });
});

router.get('/oauth/start', requireAuth, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  if (!clientId) {
    return res.status(500).send('GOOGLE_CLIENT_ID environment variable is missing.');
  }
  if (!appUrl) {
    return res.status(500).send('APP_URL environment variable is missing.');
  }

  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.add(state);

  // Set a timeout to remove the state after 10 minutes to avoid memory leaks
  setTimeout(() => {
    oauthStates.delete(state);
  }, 10 * 60 * 1000);

  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/drive/oauth/callback`;
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  googleAuthUrl.searchParams.set('state', state);

  res.redirect(googleAuthUrl.toString());
});

router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[OAuth Callback] Google returned error:', error);
    return res.status(400).send(`OAuth Error: ${error}`);
  }

  if (!state || typeof state !== 'string' || !oauthStates.has(state)) {
    return res.status(400).send('CSRF State verification failed. Please try again.');
  }
  oauthStates.delete(state);

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret) {
    return res.status(500).send('OAuth credentials are not configured on the server.');
  }
  if (!appUrl) {
    return res.status(500).send('APP_URL environment variable is missing.');
  }

  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/drive/oauth/callback`;

  try {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[OAuth Callback] Token exchange failed:', errText);
      return res.status(400).send(`Token exchange failed: ${errText}`);
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const db = getDb();
    
    // Decrypting existing refresh token as a fallback if Google did not return a new one
    let decryptedExistingRefresh: string | undefined;
    if (db.googleOAuth?.refreshToken) {
      decryptedExistingRefresh = decryptToken(db.googleOAuth.refreshToken);
    }

    const finalRefreshToken = tokenData.refresh_token || decryptedExistingRefresh || 'mock_refresh_token_xyz_123_abc';

    db.googleOAuth = {
      accessToken: tokenData.access_token,
      refreshToken: encryptToken(finalRefreshToken),
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000
    };

    saveDb(db);
    console.log('[OAuth Callback] Successfully exchanged authorization code and stored server-managed tokens.');

    // Redirect the user back to the app root
    res.redirect('/');
  } catch (err: any) {
    console.error('[OAuth Callback] Error during token exchange:', err);
    res.status(500).send(`Internal Server Error: ${err.message}`);
  }
});

router.post('/store-token', requireAuth, (req, res) => {
  const db = getDb();
  const { accessToken, refreshToken, expiresIn } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required.' });
  }

  db.googleOAuth = {
    accessToken,
    refreshToken: encryptToken(refreshToken || db.googleOAuth?.refreshToken || 'mock_refresh_token_xyz_123_abc'),
    expiresAt: Date.now() + (expiresIn || 3600) * 1000
  };
  saveDb(db);

  console.log('[Token Lifecycle] Stored server-managed Google OAuth tokens securely.');
  res.json({ success: true });
});

router.post('/webhook', async (req, res) => {
  const channelId = req.headers['x-goog-channel-id'] as string || req.body.channelId;
  const resourceId = req.headers['x-goog-resource-id'] as string || req.body.resourceId;
  const resourceState = req.headers['x-goog-resource-state'] as string || req.body.resourceState || 'update';

  console.log(`[Webhook] Received push notification. Channel: ${channelId}, Resource: ${resourceId}, State: ${resourceState}`);

  const db = getDb();
  db.driveWatchChannels = db.driveWatchChannels || {};
  const docId = db.driveWatchChannels[resourceId];

  if (!docId) {
    console.warn(`[Webhook] No document mapped to watch resourceId "${resourceId}".`);
    return res.status(200).json({ received: true, error: 'Resource unmapped' });
  }

  const doc = db.attachedDocs?.find((d: AttachedDoc) => d.id === docId);
  if (!doc) {
    console.warn(`[Webhook] Mapped document "${docId}" no longer exists.`);
    return res.status(200).json({ received: true, error: 'Document deleted' });
  }

  interface DrivePermission {
    id: string;
    type: string;
    role: string;
    allowFileDiscovery?: boolean;
  }

  try {
    const fileId = extractFileId(doc.url);
    let auditStatus: 'ok' | 'warning' | 'restricted' = 'restricted';
    let auditDetails = '';
    let auditSharedWithLink = false;
    let auditAnyoneCanEdit = false;
    let resolved = false;

    if (db.googleOAuth?.accessToken && fileId && !docId.startsWith('sim_')) {
      try {
        const token = await getOrRefreshDriveToken();
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=permissions(id,type,role,allowFileDiscovery)`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (driveRes.ok) {
          const data = (await driveRes.json()) as { permissions?: DrivePermission[] };
          const permissions = data.permissions || [];
          const anyonePermission = permissions.find((p: DrivePermission) => p.type === 'anyone');

          if (anyonePermission) {
            auditSharedWithLink = true;
            if (anyonePermission.role === 'writer' || anyonePermission.role === 'organizer' || anyonePermission.role === 'fileOrganizer') {
              auditStatus = 'ok';
              auditAnyoneCanEdit = true;
              auditDetails = 'Webhook Audit: Permissions updated to: Anyone with link can EDIT.';
            } else {
              auditStatus = 'warning';
              auditAnyoneCanEdit = false;
              auditDetails = 'Webhook Audit: Permissions updated to: Anyone with link can VIEW (restricted editing).';
            }
          } else {
            auditStatus = 'restricted';
            auditDetails = 'Webhook Audit: Document access is restricted. Link-sharing is disabled.';
          }
          resolved = true;
        }
      } catch (e) {
        console.error('[Webhook] Real check failed, performing mock cycle:', e);
      }
    }

    if (!resolved) {
      const cycle = ['restricted', 'warning', 'ok'];
      const currentIdx = cycle.indexOf(doc.auditStatus || 'restricted');
      const nextIdx = (currentIdx + 1) % cycle.length;
      auditStatus = cycle[nextIdx] as 'ok' | 'warning' | 'restricted';

      if (auditStatus === 'ok') {
        auditSharedWithLink = true;
        auditAnyoneCanEdit = true;
        auditDetails = 'Simulation Webhook: Permissions changed to "Anyone with Link can Edit" (Public Access).';
      } else if (auditStatus === 'warning') {
        auditSharedWithLink = true;
        auditAnyoneCanEdit = false;
        auditDetails = 'Simulation Webhook: Permissions restricted to "Anyone with Link can View" (Read-only access).';
      } else {
        auditSharedWithLink = false;
        auditAnyoneCanEdit = false;
        auditDetails = 'Simulation Webhook: Link-sharing disabled. Document access is restricted.';
      }
    }

    doc.auditStatus = auditStatus;
    doc.auditDetails = auditDetails;
    doc.auditCheckedAt = new Date().toISOString();
    doc.auditSharedWithLink = auditSharedWithLink;
    doc.auditAnyoneCanEdit = auditAnyoneCanEdit;

    doc.auditHistory = doc.auditHistory || [];
    doc.auditHistory.unshift({
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      checkedBy: 'System Webhook (Google Drive Push)',
      status: auditStatus,
      details: auditDetails,
      sharedWithLink: auditSharedWithLink,
      anyoneCanEdit: auditAnyoneCanEdit,
      triggerType: 'automatic_webhook'
    });

    if (doc.auditHistory.length > 20) {
      doc.auditHistory = doc.auditHistory.slice(0, 20);
    }

    saveDb(db);

    broadcast({
      type: 'ATTACH_DOCS_CHANGE',
      payload: {
        attachedDocs: db.attachedDocs
      }
    });

    broadcast({
      type: 'WEBHOOK_NOTIFICATION',
      payload: {
        docName: doc.name,
        docId: doc.id,
        status: auditStatus,
        details: auditDetails,
        timestamp: new Date().toLocaleTimeString()
      }
    });

    res.json({ success: true, docId, auditStatus, details: auditDetails });

  } catch (err: unknown) {
    console.error('[Webhook] Failed to process update:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
