import express from 'express';
import { getDb, saveDb } from '../storage';
import { Debrief } from '../../src/types';
import { getTodayISO } from '../lib/dates';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.debriefs || []);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, date, attendance, volunteers, budgetGiven, budgetActual, wentWell, change, filedBy } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Event name is required.' });
  }

  const newDebrief: Debrief = {
    id: `db_${Date.now()}`,
    name,
    date: date || getTodayISO(),
    attendance: attendance || '',
    volunteers: volunteers || '',
    budgetGiven: budgetGiven || '',
    budgetActual: budgetActual || '',
    wentWell: wentWell || '',
    change: change || '',
    filedBy: filedBy || ''
  };

  if (!db.debriefs) db.debriefs = [];
  db.debriefs.push(newDebrief);
  saveDb(db);
  res.status(201).json(newDebrief);
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, date, attendance, volunteers, budgetGiven, budgetActual, wentWell, change, filedBy } = req.body;

  const debrief = db.debriefs?.find((d: Debrief) => d.id === id);
  if (!debrief) {
    return res.status(404).json({ error: 'Debrief not found' });
  }

  if (name !== undefined) debrief.name = name;
  if (date !== undefined) debrief.date = date;
  if (attendance !== undefined) debrief.attendance = attendance;
  if (volunteers !== undefined) debrief.volunteers = volunteers;
  if (budgetGiven !== undefined) debrief.budgetGiven = budgetGiven;
  if (budgetActual !== undefined) debrief.budgetActual = budgetActual;
  if (wentWell !== undefined) debrief.wentWell = wentWell;
  if (change !== undefined) debrief.change = change;
  if (filedBy !== undefined) debrief.filedBy = filedBy;

  saveDb(db);
  res.json(debrief);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  if (db.debriefs) {
    db.debriefs = db.debriefs.filter((d: Debrief) => d.id !== id);
  }
  saveDb(db);
  res.json({ success: true, message: 'Debrief deleted.' });
});

export default router;
