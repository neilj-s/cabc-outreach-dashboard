import express from 'express';
import { getDb, saveDb } from '../storage';
import { Asset, AuditLog } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.assets);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, category, isHighValue, status, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Asset name is required.' });
  }

  const newAsset: Asset = {
    id: `ast_${Date.now()}`,
    name,
    category: category || 'Logistics',
    isHighValue: !!isHighValue,
    status: status || 'In Storage',
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  db.assets.push(newAsset);
  saveDb(db);
  res.status(201).json(newAsset);
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, category, isHighValue, status, notes } = req.body;

  const asset = db.assets.find((ast: Asset) => ast.id === id);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  if (name !== undefined) asset.name = name;
  if (category !== undefined) asset.category = category;
  if (isHighValue !== undefined) asset.isHighValue = isHighValue;
  if (status !== undefined) asset.status = status;
  if (notes !== undefined) asset.notes = notes;
  asset.updatedAt = new Date().toISOString();

  saveDb(db);
  res.json(asset);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.assets = db.assets.filter((ast: Asset) => ast.id !== id);
  saveDb(db);
  res.json({ success: true, message: 'Asset deleted.' });
});

router.post('/audit', (req, res) => {
  const db = getDb();
  
  // Find all high value assets NOT returned
  const missingHighValue = db.assets.filter((a: Asset) => a.isHighValue && a.status !== 'Returned');
  const isPassed = missingHighValue.length === 0;

  let message = '';
  const alertedLeads = ['Bea (Finance Lead)', 'Joy (Strategy Lead)'];

  if (isPassed) {
    message = 'All-clear! All high-value day-of assets have been successfully returned to storage. Safe checkout.';
  } else {
    const assetNames = missingHighValue.map((a: Asset) => `"${a.name}" (${a.status})`).join(', ');
    message = `AUDIT CRITICAL: End-of-day Cleanup audit failed. High-value assets: ${assetNames} are not returned!`;
    
    // CRITICAL REQUIREMENT: Trigger a console log or mock SMS alert to the finance and strategy leads, Bea and Joy.
    console.log(`\n=================== CRITICAL SECURITY ALERT ===================`);
    console.log(`[ALERT SMS OUTBOX]`);
    console.log(`TO: Bea (Finance Lead) & Joy (Strategy Lead)`);
    console.log(`MESSAGE: ${message}`);
    console.log(`TIME: ${new Date().toLocaleString()}`);
    console.log(`================================================================\n`);
  }

  const auditLog: AuditLog = {
    id: `aud_${Date.now()}`,
    timestamp: new Date().toISOString(),
    isPassed,
    alertedLeads: isPassed ? [] : alertedLeads,
    message,
    missingHighValueAssets: missingHighValue.map((a: Asset) => ({
      id: a.id,
      name: a.name,
      status: a.status
    }))
  };

  if (!db.auditLogs) {
    db.auditLogs = [];
  }
  db.auditLogs.unshift(auditLog); // Most recent first
  saveDb(db);

  res.json({
    auditLog,
    smsTriggered: !isPassed,
    leadsNotified: isPassed ? [] : alertedLeads
  });
});

router.get('/audit-logs', (req, res) => {
  const db = getDb();
  res.json(db.auditLogs || []);
});

router.get('/activities', (req, res) => {
  const db = getDb();
  res.json(db.activities || []);
});

export default router;
