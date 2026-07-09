import express from 'express';
import { getDb, saveDb, broadcast, requireAuth } from '../storage';
import { extractFileId, getOrRefreshDriveToken, encryptToken } from '../driveHelpers';
import { AttachedDoc } from '../../src/types';

const router = express.Router();

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
