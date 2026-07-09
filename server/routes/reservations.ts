import express from 'express';
import { getDb, saveDb, logActivity } from '../storage';
import { MinistryEvent, InventoryItem, AssetReservation } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.reservations || []);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { assetId, eventId, quantity, reservedBy } = req.body;

  if (!assetId || !eventId || quantity === undefined) {
    return res.status(400).json({ error: 'Missing required parameters: assetId, eventId, quantity' });
  }

  const event = db.events.find((e: MinistryEvent) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const item = db.inventory.find((i: InventoryItem) => i.id === assetId);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found' });
  }

  // Calculate other bookings on the same date
  const targetDate = event.date;
  const sameDateOtherReservations = (db.reservations || []).filter((r: AssetReservation) => 
    r.assetId === assetId && 
    r.eventDate === targetDate && 
    r.eventId !== eventId
  );

  const reservedByOthers = sameDateOtherReservations.reduce((sum: number, r: AssetReservation) => sum + r.quantity, 0);
  const availableStock = item.totalStock - reservedByOthers;

  if (quantity < 0) {
    return res.status(400).json({ error: 'Quantity cannot be negative' });
  }

  if (quantity > availableStock) {
    return res.status(400).json({ 
      error: `Requested quantity (${quantity}) exceeds current available stock (${availableStock}) on ${targetDate} due to other bookings.` 
    });
  }

  if (!db.reservations) db.reservations = [];

  // Find if already exists
  const existingIndex = db.reservations.findIndex((r: AssetReservation) => r.assetId === assetId && r.eventId === eventId);

  let resDoc;
  if (quantity === 0) {
    // Remove reservation if quantity is 0
    if (existingIndex !== -1) {
      resDoc = db.reservations[existingIndex];
      db.reservations.splice(existingIndex, 1);
      logActivity(
        db, 
        'event_updated', 
        'Asset Reservation Removed', 
        `Cancelled reservation of "${item.name}" for "${event.name}".`,
        { eventId, eventName: event.name }
      );
    }
  } else {
    if (existingIndex !== -1) {
      // Update existing
      db.reservations[existingIndex].quantity = quantity;
      db.reservations[existingIndex].reservedBy = reservedBy || 'Operations';
      db.reservations[existingIndex].eventDate = targetDate;
      db.reservations[existingIndex].eventName = event.name;
      resDoc = db.reservations[existingIndex];
      logActivity(
        db, 
        'event_updated', 
        'Asset Reservation Updated', 
        `Adjusted reservation of "${item.name}" for "${event.name}" to ${quantity} units.`,
        { eventId, eventName: event.name }
      );
    } else {
      // Create new
      resDoc = {
        id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        assetId,
        eventId,
        eventName: event.name,
        eventDate: targetDate,
        quantity,
        reservedBy: reservedBy || 'Operations'
      };
      db.reservations.push(resDoc);
      logActivity(
        db, 
        'event_updated', 
        'Asset Reserved', 
        `Reserved ${quantity}x "${item.name}" for "${event.name}".`,
        { eventId, eventName: event.name }
      );
    }
  }

  saveDb(db);
  res.json({ success: true, reservation: resDoc, reservations: db.reservations });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!db.reservations) db.reservations = [];
  const index = db.reservations.findIndex((r: AssetReservation) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  const resDoc = db.reservations[index];
  const item = db.inventory.find((i: InventoryItem) => i.id === resDoc.assetId);
  const itemName = item ? item.name : 'Unknown Asset';

  db.reservations.splice(index, 1);
  
  logActivity(
    db, 
    'event_updated', 
    'Asset Reservation Cancelled', 
    `Cancelled reservation of "${itemName}" for "${resDoc.eventName}".`,
    { eventId: resDoc.eventId, eventName: resDoc.eventName }
  );

  saveDb(db);
  res.json({ success: true, message: 'Reservation cancelled successfully', reservations: db.reservations });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!db.reservations) db.reservations = [];
  const index = db.reservations.findIndex((r: AssetReservation) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  db.reservations[index].status = status;
  saveDb(db);
  res.json({ success: true, reservation: db.reservations[index] });
});

export default router;
