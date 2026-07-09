const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = "app.delete('/api/events/:id', (req, res) => {";
const cloneEndpoint = `
  app.post('/api/events/:id/clone', (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const { newDate } = req.body;
    
    if (!newDate) {
      return res.status(400).json({ error: 'newDate is required.' });
    }

    const sourceEvent = db.events.find((e: any) => e.id === id);
    if (!sourceEvent) {
      return res.status(404).json({ error: 'Source event not found.' });
    }

    const newYear = newDate.split('-')[0];
    const newId = \`evt_\${Date.now()}\`;
    
    // Deep clone tasks and reset completions/assignments
    const newTasks = (sourceEvent.tasks || []).map((t: any, index: number) => ({
      ...t,
      id: \`tsk_\${Date.now()}_\${index}\`,
      completed: false,
      assignedVolunteerId: undefined
    }));

    // Clone docs (just a basic deep copy of array)
    const newDocs = JSON.parse(JSON.stringify(sourceEvent.docs || []));

    const newEvent = {
      ...sourceEvent,
      id: newId,
      date: newDate,
      name: \`\${sourceEvent.name} (\${newYear})\`,
      tasks: newTasks,
      docs: newDocs
    };
    
    // Copy reservations
    if (db.reservations) {
      const sourceReservations = db.reservations.filter((r: any) => r.eventId === id);
      sourceReservations.forEach((r: any, index: number) => {
        db.reservations.push({
          ...r,
          id: \`res_\${Date.now()}_\${index}\`,
          eventId: newId,
          eventName: newEvent.name,
          eventDate: newDate,
          status: 'pending' // reset status if any
        });
      });
    }

    db.events.push(newEvent);
    logActivity(
      db,
      'event_created',
      'Event Cloned',
      \`"\${sourceEvent.name}" was cloned to \${newDate}.\`,
      { eventId: newEvent.id, eventName: newEvent.name }
    );

    saveDb(db);
    res.status(201).json(newEvent);
  });

`;

code = code.replace(targetStr, cloneEndpoint + targetStr);
fs.writeFileSync('server.ts', code);
console.log('patched server');
