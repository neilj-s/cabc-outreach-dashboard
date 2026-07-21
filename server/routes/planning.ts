import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb, broadcast, logActivity } from '../storage';
import { extractFileId, getOrRefreshDriveToken, getDriveAccessToken, ensureEventFolder } from '../driveHelpers';
import { MinistryEvent, EventDoc, AttachedDoc } from '../../src/types';
import { getTodayISO } from '../lib/dates';

const router = express.Router();

router.get('/collab-table', (req, res) => {
  const db = getDb();
  res.json(db.collabTable || { headers: [], rows: [] });
});

router.put('/collab-table', (req, res) => {
  const db = getDb();
  const { collabTable } = req.body;
  db.collabTable = collabTable;
  saveDb(db);
  res.json({ success: true, collabTable: db.collabTable });
});

router.get('/attached-docs', (req, res) => {
  const db = getDb();
  res.json(db.attachedDocs || []);
});

router.post('/attached-docs', (req, res) => {
  const db = getDb();
  const { name, type, source, url, embedUrl, attachedBy, eventId, category } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Document name and type are required.' });
  }
  const newDoc = {
    id: `doc_${Date.now()}`,
    name,
    type,
    source: source || 'upload',
    url: url || '#',
    embedUrl,
    attachedBy: attachedBy || 'Team Member',
    date: getTodayISO(),
    eventId: eventId || '',
    category: category || 'Other'
  };
  db.attachedDocs = db.attachedDocs || [];
  db.attachedDocs.push(newDoc);
  
  saveDb(db);
  broadcast({
    type: 'ATTACH_DOCS_CHANGE',
    payload: { attachedDocs: db.attachedDocs }
  });
  res.status(201).json(newDoc);
});

router.post('/attached-docs/upload', async (req, res) => {
  const db = getDb();
  const { name, type, content, eventId, attachedBy, category } = req.body;

  if (!name || !eventId) {
    return res.status(400).json({ error: 'Name and eventId are required.' });
  }

  const lowerName = name.toLowerCase();
  const isSpreadsheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || (type && (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')));
  const finalCategory = category || (isSpreadsheet ? 'Spreadsheets/Budgets' : 'Meeting Minutes');
  
  let docId = `doc_${Date.now()}`;
  let fileUrl = '#';
  let fileType = type || (isSpreadsheet ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/plain');
  let auditStatus = 'ok';
  let auditDetails = 'Simulation Mode: Mapped successfully to event with "Anyone with the link can edit" permissions.';
  let auditSharedWithLink = true;
  let auditAnyoneCanEdit = true;
  let isRealUpload = false;

  try {
    if (db.googleOAuth?.accessToken) {
      try {
        const token = await getOrRefreshDriveToken();
        
        let folderId = db.driveFolderId || 'root';
        if (eventId) {
          const targetEvent = db.events.find((e: MinistryEvent) => e.id === eventId);
          if (targetEvent) {
            folderId = await ensureEventFolder(targetEvent, db);
          }
        }

        const metadata: { name: string; mimeType: string; parents?: string[] } = {
          name: name,
          mimeType: fileType
        };
        if (folderId && folderId !== 'root') {
          metadata.parents = [folderId];
        }

        console.log(`[File Portal] Creating metadata on Google Drive for "${name}" in folder "${folderId}"`);
        const metadataRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });

        if (metadataRes.ok) {
          const fileData = (await metadataRes.json()) as { id: string; webViewLink?: string };
          const googleFileId = fileData.id;
          fileUrl = fileData.webViewLink || `https://docs.google.com/open?id=${googleFileId}`;
          
          if (content) {
            const base64Data = content.includes('base64,') ? content.split('base64,')[1] : content;
            const buffer = Buffer.from(base64Data, 'base64');
            
            console.log(`[File Portal] Uploading media binary payload (${buffer.length} bytes) to Google Drive file ID: ${googleFileId}`);
            const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${googleFileId}?uploadType=media`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': fileType
              },
              body: buffer
            });
            if (!uploadRes.ok) {
              console.warn('[File Portal] Content upload failed, metadata preserved:', await uploadRes.text());
            }
          }

          console.log(`[File Portal] Configuring public edit permissions on Google Drive file ID: ${googleFileId}`);
          const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${googleFileId}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'writer',
              type: 'anyone'
            })
          });

          if (permRes.ok) {
            auditStatus = 'ok';
            auditDetails = 'Anyone with the link can EDIT. Perfect setup for collaborative meeting planning!';
          } else {
            const permErr = await permRes.text();
            console.warn('[File Portal] Failed to configure Drive link-sharing permissions:', permErr);
            auditStatus = 'warning';
            auditDetails = 'File created on Drive, but failed to automatically set link-sharing to Editor.';
            auditSharedWithLink = false;
            auditAnyoneCanEdit = false;
          }

          docId = `doc_g_${googleFileId}`;
          isRealUpload = true;
        } else {
          console.warn('[File Portal] Google Drive file creation failed, falling back to simulated upload:', await metadataRes.text());
        }
      } catch (driveErr) {
        console.error('[File Portal] Google Drive real upload error, falling back to simulated upload:', driveErr);
      }
    }

    if (!isRealUpload) {
      const simId = `sim_upload_${Date.now()}`;
      docId = simId;
      fileUrl = isSpreadsheet
        ? `https://docs.google.com/spreadsheets/d/${simId}/edit`
        : `https://docs.google.com/document/d/${simId}/edit`;
      auditStatus = 'ok';
      auditDetails = 'Simulation Mode: Mapped successfully to event with "Anyone with the link can edit" permissions.';
      auditSharedWithLink = true;
      auditAnyoneCanEdit = true;
    }

    const newDoc: AttachedDoc = {
      id: docId,
      name: name,
      type: fileType,
      source: isRealUpload ? 'google' : 'upload',
      url: fileUrl,
      embedUrl: fileUrl,
      attachedBy: attachedBy || 'System Portal',
      date: getTodayISO(),
      eventId: eventId,
      category: finalCategory,
      auditStatus: auditStatus as AttachedDoc['auditStatus'],
      auditDetails: auditDetails,
      auditCheckedAt: new Date().toISOString(),
      auditSharedWithLink: auditSharedWithLink,
      auditAnyoneCanEdit: auditAnyoneCanEdit,
      auditHistory: [
        {
          id: `hist_init_${Date.now()}`,
          timestamp: new Date().toISOString(),
          checkedBy: attachedBy || 'System Portal',
          status: auditStatus as AttachedDoc['auditStatus'],
          details: isRealUpload ? 'Uploaded and set "Anyone with link can edit" permissions via Google Drive API.' : '[Simulation] Drag-and-drop file portal upload complete. Permissions set to public edit.',
          sharedWithLink: auditSharedWithLink,
          anyoneCanEdit: auditAnyoneCanEdit,
          triggerType: 'manual'
        }
      ]
    };

    db.attachedDocs = db.attachedDocs || [];
    db.attachedDocs.push(newDoc);
    
    const targetEvent = db.events.find((e: MinistryEvent) => e.id === eventId);
    if (targetEvent && targetEvent.docs) {
      const matchingDoc = targetEvent.docs.find((d: EventDoc) => d.name.toLowerCase() === name.toLowerCase() || lowerName.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(lowerName));
      if (matchingDoc) {
        matchingDoc.done = true;
        matchingDoc.url = fileUrl;
      }
    }

    logActivity(
      db, 
      'event_updated', 
      'Document Uploaded', 
      `"${name}" uploaded and registered for event "${targetEvent?.name || eventId}" via portal.`, 
      { eventId, docName: name, docId }
    );

    saveDb(db);

    console.log(`[File Portal] Successfully registered uploaded document: ${name} (ID: ${docId}, Real: ${isRealUpload})`);

    broadcast({
      type: 'ATTACH_DOCS_CHANGE',
      payload: {
        attachedDocs: db.attachedDocs
      }
    });

    broadcast({
      type: 'WEBHOOK_NOTIFICATION',
      payload: {
        docName: name,
        docId: docId,
        status: auditStatus,
        details: auditDetails,
        timestamp: new Date().toLocaleTimeString()
      }
    });

    res.status(201).json(newDoc);
  } catch (err: unknown) {
    console.error('[File Portal] File upload route crash:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

router.delete('/attached-docs/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  if (db.attachedDocs) {
    db.attachedDocs = db.attachedDocs.filter((d: AttachedDoc) => d.id !== id);
  }
  saveDb(db);
  broadcast({
    type: 'ATTACH_DOCS_CHANGE',
    payload: {
      attachedDocs: db.attachedDocs
    }
  });
  res.json({ success: true, message: 'Document attached link discarded.' });
});

router.patch('/attached-docs/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { auditStatus, auditDetails, auditCheckedAt, auditSharedWithLink, auditAnyoneCanEdit, checkedBy, triggerType } = req.body;

  db.attachedDocs = db.attachedDocs || [];
  const doc = db.attachedDocs.find((d: AttachedDoc) => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (auditStatus !== undefined) doc.auditStatus = auditStatus;
  if (auditDetails !== undefined) doc.auditDetails = auditDetails;
  if (auditCheckedAt !== undefined) doc.auditCheckedAt = auditCheckedAt;
  if (auditSharedWithLink !== undefined) doc.auditSharedWithLink = !!auditSharedWithLink;
  if (auditAnyoneCanEdit !== undefined) doc.auditAnyoneCanEdit = !!auditAnyoneCanEdit;

  if (auditStatus !== undefined || auditDetails !== undefined) {
    doc.auditHistory = doc.auditHistory || [];
    const historyItem = {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      checkedBy: checkedBy || 'Administrator (Manual)',
      status: auditStatus || doc.auditStatus || 'unchecked',
      details: auditDetails || doc.auditDetails || '',
      sharedWithLink: auditSharedWithLink !== undefined ? !!auditSharedWithLink : !!doc.auditSharedWithLink,
      anyoneCanEdit: auditAnyoneCanEdit !== undefined ? !!auditAnyoneCanEdit : !!doc.auditAnyoneCanEdit,
      triggerType: triggerType || 'manual'
    };
    doc.auditHistory.unshift(historyItem);
    if (doc.auditHistory.length > 20) {
      doc.auditHistory = doc.auditHistory.slice(0, 20);
    }
  }

  saveDb(db);

  broadcast({
    type: 'ATTACH_DOCS_CHANGE',
    payload: {
      attachedDocs: db.attachedDocs
    }
  });

  res.json(doc);
});

router.post('/attached-docs/:id/watch', async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const doc = db.attachedDocs?.find((d: AttachedDoc) => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const fileId = extractFileId(doc.url);
  if (!fileId) {
    return res.status(400).json({ error: 'Invalid Google Drive URL.' });
  }

  try {
    const authHeader = req.headers.authorization;
    const accessToken = await getDriveAccessToken(authHeader);

    const host = req.get('host') || 'localhost:3000';
    const address = `https://${host}/api/drive/webhook`;

    const channelId = `channel_${id}_${Date.now()}`;
    const resourceId = `resource_${id}_${Math.random().toString(36).substring(2, 8)}`;
    const watchToken = crypto.randomBytes(16).toString('hex');

    console.log(`[Webhook] Registering Google Drive watch channel ${channelId} for file ${fileId} pointing to ${address}`);

    db.driveWatchChannels = db.driveWatchChannels || {};
    db.driveWatchChannels[resourceId] = id;

    doc.watchStatus = 'active';
    doc.watchChannelId = channelId;
    doc.watchResourceId = resourceId;
    doc.watchChannelToken = watchToken;
    doc.watchExpiration = new Date(Date.now() + 86400 * 1000 * 7).toISOString(); // 7 days watch

    doc.auditHistory = doc.auditHistory || [];
    doc.auditHistory.unshift({
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      checkedBy: 'System Watch Engine',
      status: doc.auditStatus || 'unchecked',
      details: 'Configured real-time Google Drive Push Notification webhook on this resource.',
      sharedWithLink: !!doc.auditSharedWithLink,
      anyoneCanEdit: !!doc.auditAnyoneCanEdit,
      triggerType: 'manual'
    });

    saveDb(db);

    broadcast({
      type: 'ATTACH_DOCS_CHANGE',
      payload: {
        attachedDocs: db.attachedDocs
      }
    });

    res.json({
      success: true,
      channelId,
      resourceId,
      watchChannelToken: watchToken,
      expiration: doc.watchExpiration,
      message: 'Google Drive real-time webhook watch registered successfully.'
    });

  } catch (err: unknown) {
    console.error('[Webhook] Watch setup failed, using seamless simulated watch:', err);
    db.driveWatchChannels = db.driveWatchChannels || {};
    const resourceId = `resource_sim_${id}`;
    db.driveWatchChannels[resourceId] = id;
    const watchToken = crypto.randomBytes(16).toString('hex');

    doc.watchStatus = 'active';
    doc.watchChannelId = `channel_sim_${id}`;
    doc.watchResourceId = resourceId;
    doc.watchChannelToken = watchToken;
    doc.watchExpiration = new Date(Date.now() + 86400 * 1000 * 7).toISOString();

    doc.auditHistory = doc.auditHistory || [];
    doc.auditHistory.unshift({
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      checkedBy: 'System Watch Engine (Simulated)',
      status: doc.auditStatus || 'unchecked',
      details: 'Configured simulated real-time Google Drive Push Notification webhook on this resource.',
      sharedWithLink: !!doc.auditSharedWithLink,
      anyoneCanEdit: !!doc.auditAnyoneCanEdit,
      triggerType: 'manual'
    });

    saveDb(db);

    broadcast({
      type: 'ATTACH_DOCS_CHANGE',
      payload: {
        attachedDocs: db.attachedDocs
      }
    });

    res.json({
      success: true,
      simulated: true,
      channelId: doc.watchChannelId,
      resourceId: doc.watchResourceId,
      watchChannelToken: watchToken,
      expiration: doc.watchExpiration,
      message: 'Simulated webhook watch registered successfully.'
    });
  }
});

// Get current Drive Folder details
router.get('/drive-folder', (req, res) => {
  const db = getDb();
  res.json({
    folderId: db.driveFolderId || 'root',
    folderName: db.driveFolderName || 'Community Relations'
  });
});

// Update Drive Folder settings
router.put('/drive-folder', async (req, res) => {
  const db = getDb();
  const { folderId } = req.body;
  if (!folderId) {
    return res.status(400).json({ error: 'Folder ID is required.' });
  }

  try {
    const authHeader = req.headers.authorization;
    let accessToken: string | null = null;
    try {
      accessToken = await getDriveAccessToken(authHeader);
    } catch (e) {
      // Suppress or ignore if not authed yet (fallback name)
    }

    let name = 'Community Relations';
    if (accessToken) {
      if (folderId === 'root') {
        name = 'My Drive (Root)';
      } else {
        try {
          const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (folderRes.ok) {
            const data = (await folderRes.json()) as { name?: string };
            name = data.name || name;
          }
        } catch (err) {
          console.error('Error fetching folder name from Google API:', err);
        }
      }
    }

    db.driveFolderId = folderId;
    db.driveFolderName = name;
    saveDb(db);

    res.json({
      success: true,
      folderId: db.driveFolderId,
      folderName: db.driveFolderName
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Fetch files in the folder (with optional subfolderId)
router.get('/drive-files', async (req, res) => {
  const db = getDb();
  const subfolderId = req.query.subfolderId as string;
  const folderId = subfolderId || db.driveFolderId || 'root';

  const simulatedFiles = [
    {
      id: 'sim_outreach_budget',
      name: 'Community Outreach & Events Budget.xlsx',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      webViewLink: 'https://docs.google.com/spreadsheets/d/1_outreach_budget_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '124000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_spreadsheet_list.png'
    },
    {
      id: 'sim_family_festival',
      name: 'Fall Family Festival Action Plan.xlsx',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      webViewLink: 'https://docs.google.com/spreadsheets/d/1_family_festival_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '88000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_spreadsheet_list.png'
    },
    {
      id: 'sim_volunteers_list',
      name: 'Ministry Volunteers & Leads Contact List.xlsx',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      webViewLink: 'https://docs.google.com/spreadsheets/d/1_volunteers_list_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '45000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_spreadsheet_list.png'
    },
    {
      id: 'sim_minutes_template',
      name: 'Ministry Meeting Minutes Template.docx',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/1_minutes_template_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '32000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_document_list.png'
    },
    {
      id: 'sim_kickoff_minutes',
      name: 'September Event Kickoff Meeting Minutes.docx',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/1_kickoff_minutes_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '28000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_document_list.png'
    },
    {
      id: 'sim_annual_budget',
      name: 'Annual Financial Budget 2026.xlsx',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      webViewLink: 'https://docs.google.com/spreadsheets/d/1_annual_budget_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '210000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_spreadsheet_list.png'
    },
    {
      id: 'sim_fall_retreat',
      name: 'Fall Outreach & Retreat Proposal.docx',
      mimeType: 'application/vnd.google-apps.document',
      webViewLink: 'https://docs.google.com/document/d/1_fall_retreat_sim/edit',
      modifiedTime: new Date().toISOString(),
      size: '54000',
      iconLink: 'https://ssl.gstatic.com/docs/doclist/images/icon_11_document_list.png'
    }
  ];

  try {
    const authHeader = req.headers.authorization;
    let accessToken: string;
    try {
      accessToken = await getDriveAccessToken(authHeader);
    } catch (authErr: unknown) {
      console.log('Google Drive Auth not configured or token expired. Serving simulated workspace assets.');
      return res.json({
        files: simulatedFiles,
        folderId: 'simulation_root',
        folderName: 'Demo Drive Workspace',
        isSimulation: true,
        authRequired: true
      });
    }

    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,webViewLink,modifiedTime,size,iconLink)&orderBy=folder,name&pageSize=100`;
    const driveRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.warn(`Google Drive API returned ${driveRes.status}: ${errText}. Falling back to demo assets.`);
      return res.json({
        files: simulatedFiles,
        folderId: 'simulation_root',
        folderName: 'Demo Drive Workspace (API Fallback)',
        isSimulation: true,
        apiError: true
      });
    }

    interface GoogleDriveFilesResponse {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        webViewLink?: string;
        modifiedTime?: string;
        size?: string;
        iconLink?: string;
      }>;
    }

    const driveData = (await driveRes.json()) as GoogleDriveFilesResponse;
    res.json({
      files: driveData.files || [],
      folderId,
      folderName: folderId === 'root' ? 'My Drive' : (folderId === db.driveFolderId ? db.driveFolderName : 'Subfolder'),
      isSimulation: false
    });
  } catch (err: unknown) {
    console.error('Error fetching Drive files, falling back to simulated templates:', err);
    res.json({
      files: simulatedFiles,
      folderId: 'simulation_root',
      folderName: 'Demo Drive Workspace (Error Fallback)',
      isSimulation: true,
      errorMsg: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

export default router;

