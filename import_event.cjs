const fs = require('fs');

const dbPath = './db_storage.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// 1. Create the new event
const eventId = 'evt_free_market_2026';
const freeMarketEvent = {
  id: eventId,
  name: 'Free Market 2026',
  date: '2026-06-27',
  description: 'Annual free market outreach event giving away clothing, household items, and more to the community.',
  budgetCap: 1800,
  tasks: [
    {
      id: 'task_fm_1',
      title: 'Create volunteer registration form',
      description: 'Setup Google form or equivalent for volunteers to register',
      milestoneKey: '4_weeks_out',
      milestoneTitle: '4 Weeks Out',
      lane: 'Strategy',
      completed: true,
      assignedTo: 'Jane Smith',
      dueDate: '2026-05-30',
      estimatedHours: 2,
      priority: 'Medium'
    },
    {
      id: 'task_fm_2',
      title: 'Create an CR/Event Email',
      description: 'Create communication email for the event',
      milestoneKey: '8_weeks_out',
      milestoneTitle: '8 Weeks Out',
      lane: 'Strategy',
      completed: true,
      assignedTo: 'Jane Smith',
      dueDate: '2026-05-02',
      estimatedHours: 1,
      priority: 'Medium'
    },
    {
      id: 'task_fm_3',
      title: 'Contact venue owner regarding space',
      description: 'Coordinate for space of donated items',
      milestoneKey: '8_weeks_out',
      milestoneTitle: '8 Weeks Out',
      lane: 'Logistics',
      completed: true,
      assignedTo: 'Jane Smith',
      dueDate: '2026-05-02',
      estimatedHours: 1,
      priority: 'High'
    },
    {
      id: 'task_fm_4',
      title: 'Social Media Post',
      description: 'Post about the Free Market event on Instagram/Facebook',
      milestoneKey: '4_weeks_out',
      milestoneTitle: '4 Weeks Out',
      lane: 'Multimedia',
      completed: false,
      assignedTo: 'Jane Smith',
      dueDate: '2026-05-30',
      estimatedHours: 3,
      priority: 'High'
    },
    {
      id: 'task_fm_5',
      title: 'Print Posters + Post up',
      description: 'Print posters and distribute them around the neighbourhood',
      milestoneKey: '2_weeks_out',
      milestoneTitle: '2 Weeks Out',
      lane: 'Multimedia',
      completed: false,
      assignedTo: 'Bob Johnson',
      dueDate: '2026-06-13',
      estimatedHours: 4,
      priority: 'High'
    },
    {
      id: 'task_fm_6',
      title: 'Send coordinator announcement draft',
      description: 'Draft announcement for Sunday Service',
      milestoneKey: '4_weeks_out',
      milestoneTitle: '4 Weeks Out',
      lane: 'Strategy',
      completed: false,
      assignedTo: 'Jane Smith',
      dueDate: '2026-05-30',
      estimatedHours: 1,
      priority: 'Medium'
    }
  ],
  docs: [
    { name: 'Volunteer Handbook', done: false, required: true },
    { name: 'Training Materials', done: false, required: true },
    { name: 'Event Flyer', done: false, required: true }
  ]
};

if (!db.events.some(e => e.id === eventId)) {
  db.events.push(freeMarketEvent);
}

// 2. Read the CSV and process volunteers
const csvData = fs.readFileSync('./event_data.csv', 'utf-8');
const lines = csvData.split('\n').filter(l => l.trim() !== '');
const headers = lines[0].split(',');

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',').map(c => c.trim());
  const role = cols[0];
  const name = cols[1];
  const email = cols[3] || '';
  const notes = cols[7] || '';
  
  if (!name) continue; // skip empty rows

  let volunteer = db.volunteers.find(v => v.name === name);
  if (!volunteer) {
    volunteer = {
      id: 'vol_' + Date.now() + '_' + i,
      name: name,
      email: email,
      phone: '',
      roles: [],
      skills: '',
      notes: '',
      eventAssignments: {}
    };
    db.volunteers.push(volunteer);
  }

  // Ensure they have this role globally
  if (!volunteer.roles.includes(role)) {
    volunteer.roles.push(role);
  }

  // Add event assignment
  if (!volunteer.eventAssignments) volunteer.eventAssignments = {};
  volunteer.eventAssignments[eventId] = {
    role: role,
    station: role,
    notes: notes,
    contactStatus: 'Confirmed'
  };
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Successfully updated DB with Free Market 2026 event and volunteers.');
