import express from 'express';
import { getDb, saveDb, logActivity, generateTasksForEvent, DEFAULT_DOCS, MILESTONE_TEMPLATES, broadcast, requireAuth } from '../storage';
import { MinistryEvent, Task, AssetReservation, Volunteer } from '../../src/types';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.events);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, date, description } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: 'Name and Event Date are required.' });
  }

  const newEvent: MinistryEvent = {
    id: `evt_${Date.now()}`,
    name,
    date,
    description: description || '',
    tasks: generateTasksForEvent(name, date),
    docs: JSON.parse(JSON.stringify(DEFAULT_DOCS))
  };

  db.events.push(newEvent);
  logActivity(
    db,
    'event_created',
    'New Event Scheduled',
    `"${name}" has been scheduled for ${date}.`,
    { eventId: newEvent.id, eventName: name }
  );
  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.status(201).json(newEvent);
});

router.post('/:id/clone', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { newDate, carryVolunteerIds = [], copyEquipment = false } = req.body;
  
  if (!newDate) {
    return res.status(400).json({ error: 'newDate is required.' });
  }

  const sourceEvent = db.events.find((e: MinistryEvent) => e.id === id);
  if (!sourceEvent) {
    return res.status(404).json({ error: 'Source event not found.' });
  }

  const newYear = newDate.split('-')[0];
  const newId = `evt_${Date.now()}`;
  
  // Deep clone tasks and reset completions/assignments
  const newTasks = (sourceEvent.tasks || []).map((t: Task, index: number) => ({
    ...t,
    id: `tsk_${Date.now()}_${index}`,
    completed: false,
    assignedVolunteerId: undefined
  }));

  // Clone docs (just a basic deep copy of array)
  const newDocs = JSON.parse(JSON.stringify(sourceEvent.docs || []));

  const newEvent = {
    ...sourceEvent,
    id: newId,
    date: newDate,
    name: `${sourceEvent.name} (${newYear})`,
    tasks: newTasks,
    docs: newDocs,
    driveFolderId: undefined
  };
  
  // Carry volunteers: for each volunteer whose id is in carryVolunteerIds and who has an eventAssignments entry for the source event id,
  // set that volunteer's eventAssignments[newId] to a deep copy of their eventAssignments[sourceId] (same role/station/notes).
  // Don't touch volunteers not in the list.
  if (Array.isArray(carryVolunteerIds) && carryVolunteerIds.length > 0 && db.volunteers) {
    db.volunteers.forEach((v: Volunteer) => {
      if (carryVolunteerIds.includes(v.id) && v.eventAssignments && v.eventAssignments[id]) {
        v.eventAssignments[newId] = JSON.parse(JSON.stringify(v.eventAssignments[id]));
      }
    });
  }

  // Carry equipment: if copyEquipment is true, for every reservation in db.reservations whose eventId equals the source event id,
  // create a new reservation copied from it with a new id, eventId set to the new event id, any date field set to newDate, and status reset to 'Pending'.
  // If copyEquipment is false, clone no reservations.
  if (copyEquipment && db.reservations) {
    const sourceReservations = db.reservations.filter((r: AssetReservation) => r.eventId === id);
    sourceReservations.forEach((r: AssetReservation, index: number) => {
      db.reservations.push({
        ...r,
        id: `res_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        eventId: newId,
        eventName: newEvent.name,
        eventDate: newDate,
        status: 'Pending'
      });
    });
  }

  db.events.push(newEvent);
  logActivity(
    db,
    'event_created',
    'Event Cloned',
    `"${sourceEvent.name}" was cloned to ${newDate}.`,
    { eventId: newEvent.id, eventName: newEvent.name }
  );

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  if (Array.isArray(carryVolunteerIds) && carryVolunteerIds.length > 0) {
    broadcast({
      type: 'VOLUNTEERS_CHANGE',
      payload: { volunteers: db.volunteers }
    });
  }
  res.status(201).json(newEvent);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.events = db.events.filter((evt: MinistryEvent) => evt.id !== id);
  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json({ success: true, message: 'Event deleted successfully.' });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, date, description, driveFolderId } = req.body;

  const event = db.events.find((evt: MinistryEvent) => evt.id === id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const oldName = event.name;
  const oldDate = event.date;
  if (name !== undefined) event.name = name;
  if (date !== undefined) event.date = date;
  if (description !== undefined) event.description = description;
  if (driveFolderId !== undefined) event.driveFolderId = driveFolderId;

  const updateDetails: string[] = [];
  if (name !== undefined && name !== oldName) updateDetails.push(`renamed to "${name}"`);
  if (date !== undefined && date !== oldDate) updateDetails.push(`rescheduled to ${date}`);
  if (description !== undefined) updateDetails.push(`description updated`);

  if (updateDetails.length > 0) {
    logActivity(
      db,
      'event_updated',
      'Event Details Updated',
      `"${oldName}" has been updated: ${updateDetails.join(', ')}.`,
      { eventId: event.id, eventName: event.name }
    );
  }

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json(event);
});

router.put('/:id/budget', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { budgetCap } = req.body;

  if (budgetCap === undefined || isNaN(parseFloat(budgetCap))) {
    return res.status(400).json({ error: 'Valid budgetCap is required.' });
  }

  const eventIndex = db.events.findIndex((e: MinistryEvent) => e.id === id);
  if (eventIndex === -1) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const oldCap = db.events[eventIndex].budgetCap || 500;
  const newCap = parseFloat(budgetCap);
  db.events[eventIndex].budgetCap = newCap;

  logActivity(
    db,
    'event_updated',
    'Budget Cap Adjusted',
    `Adjusted approved budget cap for "${db.events[eventIndex].name}" from $${oldCap.toFixed(2)} to $${newCap.toFixed(2)}.`,
    { eventId: id, eventName: db.events[eventIndex].name }
  );

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json({ success: true, event: db.events[eventIndex] });
});

router.patch('/:eventId/tasks/bulk-due-dates', (req, res) => {
  console.log('HIT bulk-due-dates endpoint!', { eventId: req.params.eventId, body: req.body });
  const db = getDb();
  const { eventId } = req.params;
  const updates = Array.isArray(req.body) ? req.body : req.body?.updates;

  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates must be an array of { taskId, dueDate } objects.' });
  }

  const event = db.events.find((evt: MinistryEvent) => evt.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!Array.isArray(event.tasks)) {
    event.tasks = [];
  }

  let updatedCount = 0;
  updates.forEach((item: any) => {
    if (item && typeof item === 'object') {
      const { taskId, dueDate } = item;
      const task = event.tasks.find((t: Task) => t.id === taskId);
      if (task && dueDate !== undefined) {
        task.dueDate = dueDate;
        updatedCount++;
      }
    }
  });

  if (updatedCount > 0) {
    logActivity(
      db,
      'event_updated',
      'Timeline Rescaled',
      `Rescaled ${updatedCount} task due dates for event "${event.name}".`,
      { eventId: event.id, eventName: event.name }
    );
  }

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json({ success: true, event });
});

router.patch('/:eventId/tasks/:taskId', (req, res) => {
  console.log('HIT individual task patch endpoint!', { eventId: req.params.eventId, taskId: req.params.taskId, body: req.body });
  const db = getDb();
  const { eventId, taskId } = req.params;
  const { completed, lane, assignedTo, title, description, dueDate, priority } = req.body;

  const event = db.events.find((evt: MinistryEvent) => evt.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!Array.isArray(event.tasks)) {
    event.tasks = [];
  }

  const task = event.tasks.find((t: Task) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const wasCompleted = task.completed;
  if (completed !== undefined) task.completed = completed;
  if (lane !== undefined) task.lane = lane;
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (priority !== undefined) task.priority = priority;

  if (completed === true && !wasCompleted) {
    logActivity(
      db,
      'task_completed',
      'Task Completed',
      `"${task.title}" has been completed for "${event.name}"${assignedTo ? ` by ${assignedTo}` : ''}.`,
      { eventId: event.id, eventName: event.name, taskId: task.id, taskTitle: task.title }
    );
  }

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json(event);
});

router.delete('/:eventId/tasks/:taskId', (req, res) => {
  const db = getDb();
  const { eventId, taskId } = req.params;

  const event = db.events.find((evt: MinistryEvent) => evt.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!Array.isArray(event.tasks)) {
    event.tasks = [];
  }

  const taskIndex = event.tasks.findIndex((t: Task) => t.id === taskId);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const task = event.tasks[taskIndex];
  event.tasks.splice(taskIndex, 1);

  logActivity(
    db,
    'event_updated',
    'Task Deleted',
    `"${task.title}" has been deleted from "${event.name}".`,
    { eventId: event.id, eventName: event.name, taskId: task.id, taskTitle: task.title }
  );

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json(event);
});

router.post('/:eventId/tasks', (req, res) => {
  const db = getDb();
  const { eventId } = req.params;
  const { title, description, milestoneKey, lane, dueDate, assignedTo, priority } = req.body;

  const event = db.events.find((evt: MinistryEvent) => evt.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!Array.isArray(event.tasks)) {
    event.tasks = [];
  }

  const template = MILESTONE_TEMPLATES.find(m => m.key === milestoneKey);
  const milestoneTitle = template ? template.title : 'Custom Milestones';

  const newTask: Task = {
    id: `task_${Date.now()}`,
    title,
    description: description || '',
    milestoneKey: milestoneKey || '2_weeks_out',
    milestoneTitle,
    lane: lane || 'Strategy',
    completed: false,
    dueDate: dueDate || event.date,
    assignedTo: assignedTo || undefined,
    priority: priority || 'Medium'
  };

  event.tasks.push(newTask);
  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.status(201).json(event);
});

router.patch('/:eventId/docs', (req, res) => {
  const db = getDb();
  const { eventId } = req.params;
  const { docs } = req.body;

  const event = db.events.find((evt: MinistryEvent) => evt.id === eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (docs !== undefined) {
    event.docs = docs;
  }

  saveDb(db);
  broadcast({
    type: 'EVENTS_CHANGE',
    payload: { events: db.events }
  });
  res.json(event);
});

export default router;
