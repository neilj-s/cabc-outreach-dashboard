import express from 'express';
import { getDb, saveDb, logActivity, broadcast, buildMinistryCanonicalMap, normalizeMinistryField } from '../storage';
import { Volunteer } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.volunteers);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, email, phone, roles, skills, ministry, notes, emails, eventAssignments } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  const ministryCanonical = buildMinistryCanonicalMap(db.volunteers);

  const newVolunteer: Volunteer = {
    id: `vol_${Date.now()}`,
    name,
    email,
    phone: phone || '',
    roles: roles || [],
    skills: skills || '',
    ministry: normalizeMinistryField(ministry, ministryCanonical),
    notes: notes || '',
    emails: emails || [],
    eventAssignments: eventAssignments || {}
  };

  db.volunteers.push(newVolunteer);
  logActivity(
    db,
    'volunteer_registered',
    'New Volunteer Registered',
    `${name} has registered with the volunteer team. Roles: ${roles && roles.length > 0 ? roles.join(', ') : 'General helper'}.`,
    { volunteerId: newVolunteer.id, volunteerName: name }
  );
  saveDb(db);
  broadcast({
    type: 'VOLUNTEERS_CHANGE',
    payload: { volunteers: db.volunteers }
  });
  res.status(201).json(newVolunteer);
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, email, phone, roles, skills, ministry, notes, emails, eventAssignments } = req.body;

  const vol = db.volunteers.find((v: Volunteer) => v.id === id);
  if (!vol) {
    return res.status(404).json({ error: 'Volunteer not found' });
  }

  if (name !== undefined) vol.name = name;
  if (email !== undefined) vol.email = email;
  if (phone !== undefined) vol.phone = phone;
  if (roles !== undefined) vol.roles = roles;
  if (skills !== undefined) vol.skills = skills;
  if (ministry !== undefined) {
    const ministryCanonical = buildMinistryCanonicalMap(db.volunteers);
    vol.ministry = normalizeMinistryField(ministry, ministryCanonical);
  }
  if (notes !== undefined) vol.notes = notes;
  if (emails !== undefined) vol.emails = emails;
  if (eventAssignments !== undefined) vol.eventAssignments = eventAssignments;

  saveDb(db);
  broadcast({
    type: 'VOLUNTEERS_CHANGE',
    payload: { volunteers: db.volunteers }
  });
  res.json(vol);
});

router.post('/:id/emails', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { subject, sender, status, dateTime } = req.body;

  const vol = db.volunteers.find((v: Volunteer) => v.id === id);
  if (!vol) {
    return res.status(404).json({ error: 'Volunteer not found' });
  }

  if (!vol.emails) vol.emails = [];
  const newEmail = {
    id: `email_${Date.now()}`,
    dateTime: dateTime || new Date().toISOString().replace('T', ' ').substring(0, 16),
    subject: subject || 'Notification',
    sender: sender || 'System Auto',
    status: status || 'Sent'
  };

  vol.emails.push(newEmail);
  saveDb(db);
  broadcast({
    type: 'VOLUNTEERS_CHANGE',
    payload: { volunteers: db.volunteers }
  });
  res.status(201).json(vol);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.volunteers = db.volunteers.filter((v: Volunteer) => v.id !== id);
  saveDb(db);
  broadcast({
    type: 'VOLUNTEERS_CHANGE',
    payload: { volunteers: db.volunteers }
  });
  res.json({ success: true, message: 'Volunteer removed.' });
});

export default router;
