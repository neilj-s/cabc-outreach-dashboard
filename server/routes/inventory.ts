import express from 'express';
import { getDb, saveDb, logActivity } from '../storage';
import { InventoryItem, AssetReservation } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.inventory || []);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, category, totalStock, notes } = req.body;

  if (!name || !category || !totalStock) {
    return res.status(400).json({ error: 'Missing required parameters: name, category, totalStock' });
  }

  const newItem = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    category: category.trim(),
    totalStock: parseInt(totalStock) || 1,
    notes: notes ? notes.trim() : ''
  };

  if (!db.inventory) db.inventory = [];
  db.inventory.push(newItem);
  
  logActivity(
    db, 
    'event_updated', 
    'New Inventory Registered', 
    `Registered physical asset "${newItem.name}" into shared catalog under "${newItem.category}".`
  );

  saveDb(db);
  res.status(201).json(newItem);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, category, totalStock, notes } = req.body;

  if (!db.inventory) db.inventory = [];
  const index = db.inventory.findIndex((item: InventoryItem) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  const currentItem = db.inventory[index];
  const oldStock = currentItem.totalStock;
  const newStock = totalStock !== undefined ? (parseInt(totalStock) || 0) : currentItem.totalStock;

  db.inventory[index] = {
    ...currentItem,
    name: name ? name.trim() : currentItem.name,
    category: category ? category.trim() : currentItem.category,
    totalStock: newStock,
    notes: notes !== undefined ? notes.trim() : currentItem.notes
  };

  logActivity(
    db,
    'event_updated',
    'Inventory Updated',
    `Updated physical asset "${db.inventory[index].name}" (Stock: ${oldStock} ➔ ${newStock}).`
  );

  saveDb(db);
  res.json({ success: true, item: db.inventory[index] });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!db.inventory) db.inventory = [];
  const index = db.inventory.findIndex((item: InventoryItem) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  const removedItem = db.inventory[index];
  db.inventory.splice(index, 1);

  // Clean up reservations for this asset
  if (db.reservations) {
    db.reservations = db.reservations.filter((r: AssetReservation) => r.assetId !== id);
  }

  logActivity(
    db,
    'event_updated',
    'Inventory Deleted',
    `Removed physical asset "${removedItem.name}" from catalog.`
  );

  saveDb(db);
  res.json({ success: true, message: 'Inventory item deleted successfully' });
});

export default router;
