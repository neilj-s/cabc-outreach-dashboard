import express from 'express';
import { getDb, saveDb, logActivity, broadcast } from '../storage';
import { MinistryEvent, Expense } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.expenses || []);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { eventId, description, category, cost, purchaser, date, receiptName, receiptData, paidBy, reimbursed } = req.body;

  if (!eventId || !description || !category || cost === undefined || !purchaser || !date) {
    return res.status(400).json({ error: 'Missing required fields for logging an expense.' });
  }

  const event = db.events.find((e: MinistryEvent) => e.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const newExpense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    eventId,
    description: description.trim(),
    category,
    cost: parseFloat(cost) || 0,
    purchaser: purchaser.trim(),
    date,
    receiptName: receiptName ? receiptName.trim() : undefined,
    receiptData: receiptData || undefined,
    paidBy: paidBy ? paidBy.trim() : undefined,
    reimbursed: reimbursed !== undefined ? !!reimbursed : false
  };

  if (!db.expenses) db.expenses = [];
  db.expenses.push(newExpense);

  logActivity(
    db,
    'event_updated',
    'Expense Logged',
    `Logged $${newExpense.cost.toFixed(2)} under ${category} for "${event.name}" by ${purchaser}.`,
    { eventId, eventName: event.name }
  );

  saveDb(db);
  broadcast({
    type: 'EXPENSES_CHANGE',
    payload: { expenses: db.expenses }
  });
  res.status(201).json(newExpense);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { description, category, cost, purchaser, date, receiptName, receiptData, paidBy, reimbursed } = req.body;

  if (!db.expenses) db.expenses = [];
  const index = db.expenses.findIndex((exp: Expense) => exp.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  const currentExpense = db.expenses[index];
  const event = db.events.find((e: MinistryEvent) => e.id === currentExpense.eventId);
  const eventName = event ? event.name : 'Unknown Event';

  const oldCost = currentExpense.cost;
  const newCost = cost !== undefined ? parseFloat(cost) || 0 : oldCost;

  db.expenses[index] = {
    ...currentExpense,
    description: description ? description.trim() : currentExpense.description,
    category: category || currentExpense.category,
    cost: newCost,
    purchaser: purchaser ? purchaser.trim() : currentExpense.purchaser,
    date: date || currentExpense.date,
    receiptName: receiptName !== undefined ? receiptName : currentExpense.receiptName,
    receiptData: receiptData !== undefined ? receiptData : currentExpense.receiptData,
    paidBy: paidBy !== undefined ? (paidBy ? paidBy.trim() : undefined) : currentExpense.paidBy,
    reimbursed: reimbursed !== undefined ? !!reimbursed : currentExpense.reimbursed
  };

  logActivity(
    db,
    'event_updated',
    'Expense Updated',
    `Updated expense "${db.expenses[index].description}" for "${eventName}" (Cost: $${oldCost.toFixed(2)} ➔ $${newCost.toFixed(2)}).`,
    { eventId: currentExpense.eventId, eventName }
  );

  saveDb(db);
  broadcast({
    type: 'EXPENSES_CHANGE',
    payload: { expenses: db.expenses }
  });
  res.json({ success: true, expense: db.expenses[index] });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  if (!db.expenses) db.expenses = [];
  const index = db.expenses.findIndex((exp: Expense) => exp.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  const removedExpense = db.expenses[index];
  const event = db.events.find((e: MinistryEvent) => e.id === removedExpense.eventId);
  const eventName = event ? event.name : 'Unknown Event';

  db.expenses.splice(index, 1);

  logActivity(
    db,
    'event_updated',
    'Expense Deleted',
    `Removed expense of $${removedExpense.cost.toFixed(2)} ("${removedExpense.description}") from "${eventName}".`,
    { eventId: removedExpense.eventId, eventName }
  );

  saveDb(db);
  broadcast({
    type: 'EXPENSES_CHANGE',
    payload: { expenses: db.expenses }
  });
  res.json({ success: true, message: 'Expense deleted successfully.' });
});

export default router;
