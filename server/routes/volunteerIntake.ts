import express from 'express';
import {
  getDb, saveDb, logActivity, broadcast,
  buildMinistryCanonicalMap, normalizeMinistryField
} from '../storage';
import { Volunteer, MinistryEvent } from '../../src/types';

const router = express.Router();

// Rejected/held submissions surface in the activity feed instead of vanishing.
// Reuses VOLUNTEERS_CHANGE (the same signal the success path uses for live activity).
function logSignupIssue(db: ReturnType<typeof getDb>, message: string) {
  logActivity(db, 'signup_issue', 'Form sign-up needs attention', message);
  saveDb(db);
  broadcast({ type: 'VOLUNTEERS_CHANGE', payload: { volunteers: db.volunteers } });
}

// Public webhook for Google Form submissions. NOT behind Firebase auth,
// so protected by a shared secret instead.
router.post('/', (req, res) => {
  const secret = req.header('x-intake-secret');
  if (!process.env.INTAKE_WEBHOOK_SECRET || secret !== process.env.INTAKE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' }); // silent: no activity log
  }

  const { name, email, phone, skills, ministry, eventId, role, station } = req.body || {};
  const db = getDb();

  // Missing required fields (the Form blocks these, but a raw POST might not).
  if (!name || !email || !eventId) {
    logSignupIssue(db, 'A form submission was missing required fields (name, email, or event) and was not filed.');
    return res.status(400).json({ error: 'name, email, and eventId are required.' });
  }

  // Unknown event — rejects stale or tampered links.
  const event = db.events.find((e: MinistryEvent) => e.id === eventId);
  if (!event) {
    logSignupIssue(db, `A form submission referenced an unknown event code ("${eventId}") and was not filed. Check the registration link.`);
    return res.status(404).json({ error: 'Unknown eventId.' });
  }

  // Dedup by email (case-insensitive).
  const emailKey = String(email).trim().toLowerCase();
  let vol = db.volunteers.find(
    (v: Volunteer) => v.email && v.email.trim().toLowerCase() === emailKey
  );

  // Respect a prior withdrawal: don't silently re-add someone who backed out.
  const previouslyDeclined = !!vol && (
    (vol.declinedEventIds?.includes(eventId)) ||
    vol.eventAssignments?.[eventId]?.contactStatus === 'Declined'
  );
  if (previouslyDeclined) {
    logSignupIssue(db, `${name} re-submitted the sign-up for "${event.name}" after previously withdrawing. Review before re-adding to the roster.`);
    return res.status(200).json({ success: true, status: 'pending_review', volunteerId: vol!.id });
  }

  const ministryCanonical = buildMinistryCanonicalMap(db.volunteers);
  const normalizedMinistry = normalizeMinistryField(ministry, ministryCanonical);

  const isNew = !vol;
  if (!vol) {
    vol = {
      id: `vol_${Date.now()}`,
      name, email,
      phone: phone || '',
      roles: [],
      skills: skills || '',
      ministry: normalizedMinistry,
      notes: '',
      emails: [],
      eventAssignments: {}
    };
    db.volunteers.push(vol);
  } else {
    if (!vol.phone && phone) vol.phone = phone;
    if (!vol.skills && skills) vol.skills = skills;
    if (!vol.ministry && normalizedMinistry) vol.ministry = normalizedMinistry;
  }

  if (!vol.eventAssignments) vol.eventAssignments = {};
  vol.eventAssignments[eventId] = {
    ...(vol.eventAssignments[eventId] || {}),
    role: role || vol.eventAssignments[eventId]?.role || 'General helper',
    station: station || vol.eventAssignments[eventId]?.station || '',
    contactStatus: vol.eventAssignments[eventId]?.contactStatus || 'Confirmed'
  };

  logActivity(
    db,
    'volunteer_registered',
    isNew ? 'New Volunteer Registered' : 'Volunteer Signed Up for Event',
    `${name} registered for "${event.name}" via the sign-up form.`,
    { volunteerId: vol.id, volunteerName: name }
  );

  saveDb(db);
  broadcast({ type: 'VOLUNTEERS_CHANGE', payload: { volunteers: db.volunteers } });
  res.status(isNew ? 201 : 200).json({ success: true, volunteerId: vol.id });
});

export default router;
