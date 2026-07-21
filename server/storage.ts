import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { 
  MinistryEvent, 
  Task, 
  Asset, 
  AuditLog, 
  Volunteer, 
  MilestoneTemplate, 
  MilestoneKey, 
  MinistryLane,
  AssetColumn,
  Debrief,
  EventDoc,
  LaneDetail,
  RecentActivity,
  Expense,
  InventoryItem,
  AssetReservation,
  CollabTable,
  AttachedDoc
} from '../src/types';
import { subtractWeeks } from './lib/dates';

export interface DatabaseShape {
  events: MinistryEvent[];
  assets: Asset[];
  volunteers: Volunteer[];
  auditLogs: AuditLog[];
  scratchpad: string;
  collabTable: CollabTable;
  attachedDocs: AttachedDoc[];
  inventory: InventoryItem[];
  reservations: AssetReservation[];
  expenses: Expense[];
  activities: RecentActivity[];
  debriefs: Debrief[];
  lanes: LaneDetail[];
  driveFolderId: string;
  driveFolderName: string;
  googleOAuth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
  };
  driveWatchChannels?: Record<string, string>;
}

// --- Initialize Firebase Admin ---
export let firebaseAdminApp: App | null = null;

const saKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
let saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let saPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

if (saKeyStr) {
  try {
    const saKey = JSON.parse(saKeyStr);
    firebaseAdminApp = initializeApp({
      credential: cert(saKey)
    });
    console.log('Firebase Admin initialized with GOOGLE_SERVICE_ACCOUNT_KEY');
  } catch (e) {
    console.error('Failed to initialize Firebase Admin with GOOGLE_SERVICE_ACCOUNT_KEY:', e);
  }
} else if (saEmail && saPrivateKey) {
  try {
    firebaseAdminApp = initializeApp({
      credential: cert({
        projectId: saEmail.split('@')[1].split('.')[0] || 'mock-project',
        clientEmail: saEmail,
        privateKey: saPrivateKey.replace(/\\n/g, '\n'),
      })
    });
    console.log('Firebase Admin initialized with EMAIL & PRIVATE_KEY');
  } catch (e) {
    console.error('Failed to initialize Firebase Admin with EMAIL & PRIVATE_KEY:', e);
  }
} else {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      firebaseAdminApp = initializeApp({
        projectId: firebaseConfig.projectId
      });
      console.log('Firebase Admin initialized with projectId from firebase-applet-config.json');
    } else {
      console.warn('firebase-applet-config.json not found');
    }
  } catch (e) {
    console.warn('Firebase Admin not initialized. API routes may fail if they require authentication.', e);
  }
}

// --- Persistent Disk / File Storage Path Resolution ---
const getDbFilePath = (): string => {
  const diskPath = process.env.PERSISTENT_DISK_PATH;
  const localPath = path.join(process.cwd(), 'db_storage.json');
  
  if (diskPath) {
    try {
      if (!fs.existsSync(diskPath)) {
        fs.mkdirSync(diskPath, { recursive: true });
        console.log(`Created persistent disk storage directory at: ${diskPath}`);
      }
      
      const resolvedPath = path.join(diskPath, 'db_storage.json');
      
      if (!fs.existsSync(resolvedPath)) {
        if (fs.existsSync(localPath)) {
          fs.copyFileSync(localPath, resolvedPath);
          console.log(`Seeded persistent disk database from local database template: ${resolvedPath}`);
        } else {
          console.log(`Persistent disk database path initialized empty at: ${resolvedPath}`);
        }
      }
      
      return resolvedPath;
    } catch (e) {
      console.error(`Failed to initialize PERSISTENT_DISK_PATH (${diskPath}):`, e);
    }
  }
  
  return localPath;
};

export const DB_FILE = getDbFilePath();

// --- Milestone Templates for Reverse-Timeline ---
export const MILESTONE_TEMPLATES: MilestoneTemplate[] = [
  {
    key: '12_weeks_out',
    title: 'Vision & Scope (12 Weeks Out)',
    weeksOut: 12,
    defaultTasks: [
      { title: 'Define Vision & Objectives', description: 'Determine spiritual objectives, theme, and target audience alignment.', lane: 'Strategy' },
      { title: 'Draft Initial Budget', description: 'Estimate expenses, secure sponsor slots, and outline baseline cashflow needs.', lane: 'Finance' },
      { title: 'Brainstorm Promotional Assets', description: 'Outline flyer concepts, social media schedule, and banner branding.', lane: 'Multimedia' },
      { title: 'Review Permits & Booking Needs', description: 'Identify venue availability, park bookings, and municipal permissions required.', lane: 'Logistics' }
    ]
  },
  {
    key: '10_weeks_out',
    title: 'Planning (10 Weeks Out)',
    weeksOut: 10,
    defaultTasks: [
      { title: 'Secure Event Vendors', description: 'Book food trucks, sound rentals, and inflatable structures.', lane: 'Logistics' },
      { title: 'Establish Sponsor Agreements', description: 'Secure sponsorships and match commitments to critical line items.', lane: 'Finance' },
      { title: 'Social Media Teaser Launch', description: 'Publish initial teaser, launch signups, and email mailing lists.', lane: 'Multimedia' },
      { title: 'Draft Volunteer Recruitment Needs', description: 'Outline exact role counts, setup times, and workload constraints.', lane: 'Strategy' }
    ]
  },
  {
    key: '8_weeks_out',
    title: 'Build (8 Weeks Out)',
    weeksOut: 8,
    defaultTasks: [
      { title: 'Produce Creative Print Media', description: 'Print custom banners, distribute neighborhood flyers, and order decals.', lane: 'Multimedia' },
      { title: 'Acquire Day-Of Assets', description: 'Order walkie-talkies, name tags, and emergency safety vests.', lane: 'Logistics' },
      { title: 'Recruit Core Volunteers', description: 'Begin registrations, promoting roles, and building rosters.', lane: 'Strategy' },
      { title: 'Pre-pay Venue Deposits', description: 'Pay equipment rental and venue layout deposits; log invoices.', lane: 'Finance' }
    ]
  },
  {
    key: '4_weeks_out',
    title: 'Confirmation (4 Weeks Out)',
    weeksOut: 4,
    defaultTasks: [
      { title: 'Walkthrough Venue Site Layout', description: 'Inspect spatial setups, power outlets, and security egress routes.', lane: 'Logistics' },
      { title: 'Verify Volunteer Assignments', description: 'Check that all registered volunteers have their roles assigned.', lane: 'Strategy' },
      { title: 'Collect Final Vendor Payments', description: 'Disburse residual balance payments to booked vendors.', lane: 'Finance' },
      { title: 'Publish Final Promos & Schedule', description: 'Launch main promotional flyers and post event visual timeline.', lane: 'Multimedia' }
    ]
  },
  {
    key: '2_weeks_out',
    title: 'Final Push (2 Weeks Out)',
    weeksOut: 2,
    defaultTasks: [
      { title: 'EOD Asset Audit Drill', description: 'Verify walkie-talkie charging stations, pack signage, check first aid vests.', lane: 'Logistics' },
      { title: 'Final Volunteer Briefing Session', description: 'Conduct online orientation, review task limits, and verify lane coordinators.', lane: 'Strategy' },
      { title: 'Purchase Final Consumable Supplies', description: 'Source snacks, bottled water, candy, and first aid replenishment.', lane: 'Finance' },
      { title: 'Verify Visual Slide Proofs', description: 'Review screen presentations, schedule sheets, and backup radios.', lane: 'Multimedia' }
    ]
  }
];

export const DEFAULT_DOCS: EventDoc[] = [
  { name: "Event Proposal / Brief", done: false, required: true },
  { name: "Budget Sheet", done: false, required: true },
  { name: "Volunteer Guidelines", done: false, required: true },
  { name: "Event Run Sheet", done: false, required: true },
  { name: "Vendor / Partner Contacts", done: false, required: true },
  { name: "Post-Event Debrief Form", done: false, required: true },
  { name: "Media Guidelines", done: false, required: true }
];

// --- Initial Seed Data ---
export const SEED_DATA = {
  events: [
    {
      id: 'evt_0',
      name: 'Youth Summer Kickoff',
      date: '2026-06-15',
      description: 'Outdoor summer kickoff for youth group with live band and photo booth.',
      tasks: [] as Task[],
      docs: JSON.parse(JSON.stringify(DEFAULT_DOCS)) as EventDoc[],
      budgetCap: 400
    },
    {
      id: 'evt_1',
      name: 'Free Car Wash & BBQ',
      date: '2026-08-15',
      description: 'Community-wide free car wash and barbecue outreach hosted on the main campus parking lot.',
      tasks: [] as Task[],
      docs: JSON.parse(JSON.stringify(DEFAULT_DOCS)) as EventDoc[],
      budgetCap: 500
    },
    {
      id: 'evt_2',
      name: 'Hallelujah Night',
      date: '2026-10-31',
      description: 'Annual autumn neighborhood outreach event filled with family games, candy distribution, and custom displays.',
      tasks: [] as Task[],
      docs: JSON.parse(JSON.stringify(DEFAULT_DOCS)) as EventDoc[],
      budgetCap: 1200
    },
    {
      id: 'evt_3',
      name: 'Winter Event',
      date: '2027-01-17',
      description: 'Gathering of families for fellowship, warming food stations, and volunteer appreciation highlights.',
      tasks: [] as Task[],
      docs: JSON.parse(JSON.stringify(DEFAULT_DOCS)) as EventDoc[],
      budgetCap: 300
    }
  ],
  assets: [
    {
      id: 'ast_1',
      name: 'Promotional Banners & Outdoor Signs',
      category: 'Logistics',
      isHighValue: false,
      status: 'In Storage' as AssetColumn,
      notes: 'Stored in Closet B. Includes metal lawn spikes.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ast_2',
      name: 'Volunteer Badge Name Tags (Set of 100)',
      category: 'Strategy',
      isHighValue: false,
      status: 'Packed for Event' as AssetColumn,
      notes: 'Lanyards and dry-erase markers included.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ast_3',
      name: 'Emergency First Aid Vests & Kits',
      category: 'Logistics',
      isHighValue: false,
      status: 'Deployed' as AssetColumn,
      notes: 'Handed to volunteer Leads on site.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ast_4',
      name: 'Pro Motorola Walkie-Talkies (Set of 6)',
      category: 'Multimedia',
      isHighValue: true,
      status: 'Deployed' as AssetColumn,
      notes: 'High value. Must be returned to charging docks.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'ast_5',
      name: 'Sony Alpha DSLR Camera & Lenses',
      category: 'Multimedia',
      isHighValue: true,
      status: 'Packed for Event' as AssetColumn,
      notes: 'Stored in protective hard shell case.',
      updatedAt: new Date().toISOString()
    }
  ],
  volunteers: [
    {
      id: 'vol_1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+15550101',
      roles: ['Outreach / Greeter'],
      skills: 'Outreach & welcoming guests, social media prep',
      notes: 'Loves community events.',
      emails: [
        {
          id: 'email_1',
          dateTime: '2026-07-01 10:00',
          subject: 'Ministry Outreach + Volunteer Recruitment',
          sender: 'Jane Smith',
          status: 'Sent'
        }
      ],
      customFields: {} as Record<string, string>
    },
    {
      id: 'vol_2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '+15550102',
      roles: ["Men's Clothing"],
      skills: 'Event coordination, youth leading',
      notes: 'Active in local leadership.',
      emails: [
        {
          id: 'email_2',
          dateTime: '2026-07-05 14:30',
          subject: 'Ministry Outreach + Volunteer Recruitment',
          sender: 'Jane Smith',
          status: 'Sent'
        }
      ],
      customFields: {} as Record<string, string>
    },
    {
      id: 'vol_3',
      name: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      phone: '+15550103',
      roles: ['Prayer & Info Booth'],
      skills: 'Prayer booth, leadership, spiritual devotions',
      notes: 'Senior team adviser.',
      emails: [
        {
          id: 'email_3',
          dateTime: '2026-06-13 09:00',
          subject: 'Ministry Outreach + Volunteer Recruitment',
          sender: 'Jane Smith',
          status: 'Sent'
        }
      ],
      customFields: {} as Record<string, string>
    },
    {
      id: 'vol_4',
      name: 'Alice Williams',
      email: 'alice.williams@example.com',
      phone: '+15550104',
      roles: ['Music / AV'],
      skills: 'AV Booth setup, live sound mixing, music coordination',
      notes: 'AV ministry team lead.',
      emails: [
        {
          id: 'email_4',
          dateTime: '2026-06-20 10:30',
          subject: 'Volunteer Handbook + Welcome!',
          sender: 'Jane Smith',
          status: 'Delivered'
        }
      ],
      customFields: {} as Record<string, string>
    },
    {
      id: 'vol_5',
      name: 'Charlie Brown',
      email: 'charlie.brown@example.com',
      phone: '+15550105',
      roles: ['Food Prep', 'Food Manager'],
      skills: 'Food safety, kitchen management, catering logistics',
      notes: 'Very helpful with community BBQ projects.',
      emails: [
        {
          id: 'email_5',
          dateTime: '2026-06-25 11:15',
          subject: 'Volunteer Breakfast Confirmation',
          sender: 'John Doe',
          status: 'Opened'
        }
      ],
      customFields: {} as Record<string, string>
    }
  ],
  auditLogs: [] as AuditLog[],
  scratchpad: '### Action Items & Deliverables\n\n1. Ensure local police clearance is filed for all volunteers working the Kids + Toys zone.\n2. Confirm propane tank count (need at least 4 filled tanks for the BBQ stations).\n3. Keep track of all high-value assets (e.g. Sony DSLR and Pro Motorola Walkie-Talkies).\n\n#### Quick Notes:\n- Jane suggested we add a "Check-in Gate Host" role for Alice.\n- Need to check if the municipal barbecue permit is filed for Free Car Wash event.',
  collabTable: {
    headers: ['Time', 'Session / Item', 'Lane', 'Lead Officer', 'Required Prep / Notes'],
    rows: [
      ['08:00 AM', 'Site Setup & Banner Deployment', 'Logistics', 'Operations', 'Check water supply & power lines'],
      ['09:00 AM', 'Volunteer Briefing & Prayer', 'Strategy', 'Jane Smith', 'Distribute first aid vests and radios'],
      ['10:00 AM', 'BBQ Grill On & Outreach Signups', 'Finance', 'Jane Smith', 'Ensure food vouchers are stamped'],
      ['11:30 AM', 'Live Music & Multimedia Slideshow', 'Multimedia', 'Tech Crew', 'Sony DSLR ready, test main sound deck'],
      ['02:00 PM', 'Site Tear-down & Audit Drill', 'Logistics', 'Operations', 'Scan all high value assets back to Closet B']
    ]
  },
  attachedDocs: [
    {
      id: 'doc_1',
      name: 'Event Scope Document.docx',
      type: 'docx',
      source: 'upload',
      url: '#',
      attachedBy: 'John Doe',
      date: '2026-07-01'
    },
    {
      id: 'doc_2',
      name: 'Parking Lot Layout Blueprint.pdf',
      type: 'pdf',
      source: 'upload',
      url: '#',
      attachedBy: 'Operations',
      date: '2026-07-03'
    }
  ],
  inventory: [
    { id: 'inv_1', name: 'Heavy Duty Foldable Tables (6ft)', category: 'Furniture', totalStock: 15, notes: 'Stored in Closet B. Fold legs carefully.' },
    { id: 'inv_2', name: 'Pop-Up Canopy Tents (10x10)', category: 'Outdoor', totalStock: 6, notes: 'Includes weight bags and ground stakes.' },
    { id: 'inv_3', name: 'Yamaha Stage Sound System', category: 'Audio/Visual', totalStock: 2, notes: '2 active speakers, 6-channel mixer, 2 wireless mics.' },
    { id: 'inv_4', name: 'Giant Cooler Chests (120qt)', category: 'Catering', totalStock: 5, notes: 'Clean with bleach spray after use.' },
    { id: 'inv_5', name: 'Corrugated Plastic Lawn Signs', category: 'Logistics', totalStock: 20, notes: 'White blanks, dry-erase compatible. Includes metal stakes.' },
    { id: 'inv_6', name: 'High-Visibility Safety Vests', category: 'Logistics', totalStock: 30, notes: 'Neon yellow with reflective bands. Medium & Large sizes.' },
    { id: 'inv_7', name: 'Sony Alpha DSLR Camera & Lenses', category: 'Audio/Visual', totalStock: 3, isHighValue: true, notes: 'High value camera equipment. Store in hard shell case.' },
    { id: 'inv_8', name: 'Pro Motorola Walkie-Talkies (Set of 6)', category: 'Audio/Visual', totalStock: 4, isHighValue: true, notes: 'Must be returned to charging docks after event.' }
  ],
  reservations: [
    {
      id: 'res_0',
      assetId: 'inv_7',
      eventId: 'evt_0',
      eventName: 'Youth Summer Kickoff',
      eventDate: '2026-06-15',
      quantity: 1,
      reservedBy: 'Bea P.',
      status: 'Packed'
    },
    {
      id: 'res_1',
      assetId: 'inv_1',
      eventId: 'evt_1',
      eventName: 'Free Car Wash & BBQ',
      eventDate: '2026-08-15',
      quantity: 8,
      reservedBy: 'Operations'
    },
    {
      id: 'res_2',
      assetId: 'inv_2',
      eventId: 'evt_1',
      eventName: 'Free Car Wash & BBQ',
      eventDate: '2026-08-15',
      quantity: 3,
      reservedBy: 'Operations'
    },
    {
      id: 'res_3',
      assetId: 'inv_3',
      eventId: 'evt_1',
      eventName: 'Free Car Wash & BBQ',
      eventDate: '2026-08-15',
      quantity: 1,
      reservedBy: 'Tech Crew'
    },
    {
      id: 'res_4',
      assetId: 'inv_4',
      eventId: 'evt_1',
      eventName: 'Free Car Wash & BBQ',
      eventDate: '2026-08-15',
      quantity: 2,
      reservedBy: 'Joy P.'
    },
    {
      id: 'res_5',
      assetId: 'inv_1',
      eventId: 'evt_2',
      eventName: 'Hallelujah Night',
      eventDate: '2026-10-31',
      quantity: 12,
      reservedBy: 'Joy P.'
    },
    {
      id: 'res_6',
      assetId: 'inv_2',
      eventId: 'evt_2',
      eventName: 'Hallelujah Night',
      eventDate: '2026-10-31',
      quantity: 4,
      reservedBy: 'Joy P.'
    },
    {
      id: 'res_7',
      assetId: 'inv_3',
      eventId: 'evt_2',
      eventName: 'Hallelujah Night',
      eventDate: '2026-10-31',
      quantity: 1,
      reservedBy: 'Tech Crew'
    }
  ],
  expenses: [
    {
      id: 'exp_1',
      eventId: 'evt_1',
      description: 'Burgers & hot dogs from bulk store',
      category: 'Food',
      cost: 185.50,
      purchaser: 'Bea P.',
      date: '2026-08-01',
      receiptName: 'bulk_grocery_receipt.png',
      receiptData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23efe0c2"/><text x="10" y="50" font-family="sans-serif" font-size="10" fill="%23856637">Bulk Foods</text></svg>'
    },
    {
      id: 'exp_2',
      eventId: 'evt_1',
      description: 'Sponges, car soap, and microfiber towels',
      category: 'Supplies',
      cost: 45.20,
      purchaser: 'Operations',
      date: '2026-08-05',
      receiptName: 'hardware_receipt.png',
      receiptData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23e2dcd0"/><text x="15" y="50" font-family="sans-serif" font-size="10" fill="%23334155">Car Soap Co</text></svg>'
    },
    {
      id: 'exp_3',
      eventId: 'evt_1',
      description: 'Lawn flyers and street sign prints',
      category: 'Marketing',
      cost: 65.00,
      purchaser: 'Joy P.',
      date: '2026-08-03',
      receiptName: 'print_shop_invoice.pdf',
      receiptData: ''
    },
    {
      id: 'exp_4',
      eventId: 'evt_2',
      description: 'Prizes for game booths and decorative lights',
      category: 'Supplies',
      cost: 240.00,
      purchaser: 'Joy P.',
      date: '2026-10-15',
      receiptName: 'wholesale_toys_receipt.jpg',
      receiptData: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23faf8f4"/><text x="10" y="50" font-family="sans-serif" font-size="10" fill="%23666">Wholesale Toys</text></svg>'
    },
    {
      id: 'exp_5',
      eventId: 'evt_2',
      description: 'Bulk candy packs for distribution',
      category: 'Food',
      cost: 350.00,
      purchaser: 'Bea P.',
      date: '2026-10-20',
      receiptName: 'sweet_distributor_invoice.pdf',
      receiptData: ''
    }
  ],
  activities: [
    {
      id: 'act_1',
      type: 'task_completed',
      timestamp: '2026-07-08T09:30:00.000Z',
      title: 'Task Completed',
      description: 'Review Permits & Booking Needs has been completed for Free Car Wash & BBQ.',
      metadata: { eventId: 'evt_1', eventName: 'Free Car Wash & BBQ', taskId: 'task_1', taskTitle: 'Review Permits & Booking Needs' }
    },
    {
      id: 'act_2',
      type: 'volunteer_registered',
      timestamp: '2026-07-07T15:45:00.000Z',
      title: 'New Volunteer Registered',
      description: 'Charlie Brown has joined the Food Prep & Food Manager teams.',
      metadata: { volunteerId: 'vol_5', volunteerName: 'Charlie Brown' }
    },
    {
      id: 'act_3',
      type: 'task_completed',
      timestamp: '2026-07-07T11:20:00.000Z',
      title: 'Task Completed',
      description: 'Secure Event Vendors has been completed for Community BBQ Outing by John Doe.',
      metadata: { eventId: 'evt_1', eventName: 'Community BBQ Outing', taskId: 'task_2', taskTitle: 'Secure Event Vendors' }
    },
    {
      id: 'act_4',
      type: 'volunteer_registered',
      timestamp: '2026-07-06T10:00:00.000Z',
      title: 'New Volunteer Registered',
      description: 'Alice Williams has registered as a Music / AV helper.',
      metadata: { volunteerId: 'vol_4', volunteerName: 'Alice Williams' }
    }
  ] as RecentActivity[],
  debriefs: [
    {
      id: 'deb_1',
      name: 'Free Car Wash & BBQ',
      date: '2026-07-05',
      attendance: '120',
      volunteers: '15',
      budgetGiven: '1500',
      budgetActual: '1500',
      wentWell: 'Parking lot floor plan. Very organized event.',
      change: "Longer donation window, stricter donation list (clear do's and don'ts). Start the event later. Reach out to ministries earlier and set expectations. Promotional signs day-of with the address at each intersection leading to the church. Free Market banner + barrier sign with open/close times. CO merch, volunteer name tags, first-aid vests, more tents, walkie-talkies for leads, guest counter. Assign everyone's role honestly based on capacity.",
      filedBy: 'Jane Smith'
    }
  ] as Debrief[]
};

// Auto-fill seed tasks for the initial events
export function generateTasksForEvent(eventName: string, dateStr: string): Task[] {
  const tasks: Task[] = [];
  let taskIdCounter = 1;
  
  for (const milestone of MILESTONE_TEMPLATES) {
    const dueDate = subtractWeeks(dateStr, milestone.weeksOut);
    for (const defTask of milestone.defaultTasks) {
      tasks.push({
        id: `task_${Date.now()}_${taskIdCounter++}`,
        title: defTask.title,
        description: defTask.description,
        milestoneKey: milestone.key,
        milestoneTitle: milestone.title,
        lane: defTask.lane,
        completed: false,
        dueDate: dueDate
      });
    }
  }
  return tasks;
}

SEED_DATA.events[0].tasks = generateTasksForEvent(SEED_DATA.events[0].name, SEED_DATA.events[0].date);
SEED_DATA.events[1].tasks = generateTasksForEvent(SEED_DATA.events[1].name, SEED_DATA.events[1].date);
SEED_DATA.events[2].tasks = generateTasksForEvent(SEED_DATA.events[2].name, SEED_DATA.events[2].date);

// --- Database Helper Functions ---
// Build a canonical-casing map for ministry values: group by lowercase,
// pick the most common original casing (ties broken alphabetically).
export function buildMinistryCanonicalMap(volunteers: Volunteer[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const v of volunteers) {
    if (!v.ministry) continue;
    for (const raw of v.ministry.split(',')) {
      const token = raw.trim();
      if (!token) continue;
      const key = token.toLowerCase();
      if (!counts.has(key)) counts.set(key, new Map());
      const inner = counts.get(key)!;
      inner.set(token, (inner.get(token) || 0) + 1);
    }
  }
  const canonical = new Map<string, string>();
  for (const [key, inner] of counts) {
    let best = '';
    let bestCount = -1;
    for (const [casing, count] of inner) {
      if (count > bestCount || (count === bestCount && casing.localeCompare(best) < 0)) {
        best = casing;
        bestCount = count;
      }
    }
    canonical.set(key, best);
  }
  return canonical;
}

// Normalize one ministry field string: trim tokens, drop blanks, snap casing to
// the canonical map, and dedupe within the field (case-insensitive, order kept).
export function normalizeMinistryField(field: string | undefined, canonical: Map<string, string>): string {
  if (!field) return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of field.split(',')) {
    const token = raw.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical.get(key) || token);
  }
  return out.join(', ');
}

export function normalizeDb(db: any): DatabaseShape {
  // Ensure lists are initialized
  if (!db.events) db.events = [];
  if (!db.assets) db.assets = [];
  if (!db.volunteers) db.volunteers = [];
  if (!db.auditLogs) db.auditLogs = [];
  if (!db.debriefs) db.debriefs = [];
  if (!db.activities) db.activities = JSON.parse(JSON.stringify(SEED_DATA.activities || []));
  if (!db.lanes) {
    db.lanes = [
      { id: 'Strategy', name: 'Strategy', leadName: 'Joy' },
      { id: 'Finance', name: 'Finance', leadName: 'Bea' },
      { id: 'Multimedia', name: 'Multimedia', leadName: 'Tech Crew' },
      { id: 'Logistics', name: 'Logistics', leadName: 'Operations' }
    ];
  }

  // Ensure all events have docs
  db.events.forEach((evt: MinistryEvent) => {
    if (!evt.docs) {
      evt.docs = JSON.parse(JSON.stringify(DEFAULT_DOCS));
    }
  });

  if (db.scratchpad === undefined) {
    db.scratchpad = SEED_DATA.scratchpad;
  }
  if (!db.collabTable) {
    db.collabTable = SEED_DATA.collabTable;
  }
  if (!db.attachedDocs) {
    db.attachedDocs = SEED_DATA.attachedDocs;
  }
  if (!db.driveFolderId) {
    db.driveFolderId = 'root';
  }
  if (!db.driveFolderName) {
    db.driveFolderName = 'Community Relations';
  }
  if (!db.inventory) {
    db.inventory = JSON.parse(JSON.stringify(SEED_DATA.inventory));
  }
  if (!db.reservations) {
    db.reservations = JSON.parse(JSON.stringify(SEED_DATA.reservations));
  }
  if (!db.expenses) {
    db.expenses = JSON.parse(JSON.stringify(SEED_DATA.expenses));
  }

  // Ensure all events have budget caps
  db.events.forEach((evt: MinistryEvent) => {
    if (evt.budgetCap === undefined) {
      if (evt.id === 'evt_1') evt.budgetCap = 500;
      else if (evt.id === 'evt_2') evt.budgetCap = 1200;
      else if (evt.id === 'evt_3') evt.budgetCap = 300;
      else evt.budgetCap = 500; // Default budget cap
    }
  });

  // One-time (idempotent) ministry hygiene: fold casing/whitespace dupes across all volunteers.
  const ministryCanonical = buildMinistryCanonicalMap(db.volunteers);
  db.volunteers.forEach((v: Volunteer) => {
    if (v.ministry) v.ministry = normalizeMinistryField(v.ministry, ministryCanonical);
  });

  return db as DatabaseShape;
}

function initializeDatabase(): DatabaseShape {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DATA, null, 2));
      const db = JSON.parse(JSON.stringify(SEED_DATA));
      return normalizeDb(db);
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);
    return normalizeDb(db);
  } catch (error) {
    console.error('Error reading/writing DB_FILE, fallback to memory', error);
    const db = JSON.parse(JSON.stringify(SEED_DATA));
    return normalizeDb(db);
  }
}

let cachedDb: DatabaseShape = initializeDatabase();

export function getDb(): DatabaseShape {
  return cachedDb;
}

let isWriting = false;
let pendingData: DatabaseShape | null = null;

function triggerWrite() {
  if (isWriting || !pendingData) return;
  isWriting = true;
  const dataToWrite = pendingData;
  pendingData = null;
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(dataToWrite, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Error saving DB_FILE atomically', error);
  } finally {
    isWriting = false;
    if (pendingData) {
      setImmediate(triggerWrite);
    }
  }
}

export function saveDb(data: DatabaseShape) {
  cachedDb = data;
  pendingData = data;
  triggerWrite();
}

export function logActivity(
  db: DatabaseShape, 
  type: RecentActivity['type'], 
  title: string, 
  description: string, 
  metadata?: RecentActivity['metadata']
) {
  if (!db.activities) {
    db.activities = [];
  }
  const newActivity: RecentActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    timestamp: new Date().toISOString(),
    title,
    description,
    metadata
  };
  db.activities.unshift(newActivity);
  if (db.activities.length > 40) {
    db.activities = db.activities.slice(0, 40);
  }
}

// --- Email Allowlist Initialization ---
const allowedEmailsEnv = process.env.ALLOWED_EMAILS || '';
const allowedEmailsSet = new Set<string>();

if (!allowedEmailsEnv.trim()) {
  console.warn('WARNING: ALLOWED_EMAILS environment variable is not configured or empty. Failing closed: all user authentication attempts will be denied.');
} else {
  allowedEmailsEnv.split(',').forEach(email => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed) {
      allowedEmailsSet.add(trimmed);
    }
  });
}

export async function verifyTokenAndEmail(idToken: string): Promise<any> {
  if (!firebaseAdminApp) {
    throw new Error('Firebase Admin not initialized on server');
  }
  const decodedToken = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
  const userEmail = decodedToken.email ? decodedToken.email.toLowerCase() : '';
  if (!decodedToken.email_verified || !userEmail || !allowedEmailsSet.has(userEmail)) {
    throw new Error('Access restricted to authorized ministry accounts');
  }
  return decodedToken;
}

export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === '/api/drive/webhook' || req.path === '/drive/webhook') {
    return next();
  }
  
  let idToken: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    idToken = req.query.token;
  }

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization' });
  }

  try {
    const decodedToken = await verifyTokenAndEmail(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token in requireAuth:', error);
    if (error.message === 'Access restricted to authorized ministry accounts') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
  }
};

type BroadcastFunction = (message: unknown, skipClientId?: string) => void;
let globalBroadcast: BroadcastFunction = () => {};

export function setBroadcastHandler(handler: BroadcastFunction) {
  globalBroadcast = handler;
}

export function broadcast(message: unknown, skipClientId?: string) {
  globalBroadcast(message, skipClientId);
}

