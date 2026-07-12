export type MinistryLane = string;

export interface LaneDetail {
  id: string;
  name: string;
  leadName: string;
}

export type MilestoneKey = '12_weeks_out' | '10_weeks_out' | '8_weeks_out' | '4_weeks_out' | '2_weeks_out';

export interface MilestoneTemplate {
  key: MilestoneKey;
  title: string;
  weeksOut: number;
  defaultTasks: {
    title: string;
    description: string;
    lane: MinistryLane;
  }[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  milestoneKey: MilestoneKey;
  milestoneTitle: string;
  lane: MinistryLane;
  completed: boolean;
  assignedTo?: string;
  dueDate: string; // ISO date string (YYYY-MM-DD)
  estimatedHours?: number; // added estimated hourly weight
  priority?: 'High' | 'Medium' | 'Low';
}

export interface EventDoc {
  name: string;
  done: boolean;
  required?: boolean;
  url?: string;
}

export interface MinistryEvent {
  id: string;
  name: string;
  date: string; // ISO date string (YYYY-MM-DD)
  description: string;
  tasks: Task[];
  docs?: EventDoc[];
  budgetCap?: number;
  driveFolderId?: string;
}

export interface Expense {
  id: string;
  eventId: string;
  description: string;
  category: 'Food' | 'Supplies' | 'Marketing' | 'Permits' | 'Other';
  cost: number;
  purchaser: string;
  date: string; // YYYY-MM-DD
  receiptName?: string;
  receiptData?: string; // base64 preview or placeholder
}

export interface Debrief {
  id: string;
  name: string;
  date: string; // ISO date string (YYYY-MM-DD)
  attendance: string;
  volunteers: string;
  budgetGiven: string;
  budgetActual: string;
  wentWell: string;
  change: string;
  filedBy: string;
}

export type AssetColumn = 'In Storage' | 'Packed for Event' | 'Deployed' | 'Returned';

export interface Asset {
  id: string;
  name: string;
  category: string;
  isHighValue: boolean;
  status: AssetColumn;
  notes?: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  isPassed: boolean;
  alertedLeads: string[];
  message: string;
  missingHighValueAssets: {
    id: string;
    name: string;
    status: AssetColumn;
  }[];
}

export interface EmailCommunication {
  id: string;
  dateTime: string;
  subject: string;
  sender: string;
  status: 'Sent' | 'Delivered' | 'Opened' | 'Failed';
}

export interface VolunteerEventAssignment {
  role: string;
  station: string;
  notes?: string;
  contactStatus?: 'Not Contacted' | 'Contacted' | 'Awaiting Reply' | 'Confirmed' | 'Declined';
}

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[]; // List of currently assigned Roles/Stations
  skills?: string; // Foundational skills/interests
  notes?: string;
  hasVulnerableSectorCheck?: boolean;
  emails?: EmailCommunication[]; // Email communication tracker entries
  eventAssignments?: Record<string, VolunteerEventAssignment>; // map of eventId -> assignment
}

export interface AuditHistoryItem {
  id: string;
  timestamp: string;
  checkedBy: string;
  status: 'ok' | 'restricted' | 'warning' | 'error' | 'unchecked' | 'checking';
  details: string;
  sharedWithLink: boolean;
  anyoneCanEdit: boolean;
  triggerType: 'manual' | 'automatic_webhook' | 'oauth_refresh';
}

export interface AttachedDoc {
  id: string;
  name: string;
  type: string;
  source: 'upload' | 'google';
  url?: string;
  embedUrl?: string;
  attachedBy: string;
  date: string;
  eventId?: string;
  category?: string;
  auditStatus?: 'ok' | 'restricted' | 'warning' | 'error' | 'unchecked' | 'checking';
  auditDetails?: string;
  auditCheckedAt?: string;
  auditSharedWithLink?: boolean;
  auditAnyoneCanEdit?: boolean;
  auditHistory?: AuditHistoryItem[];
  watchStatus?: 'active' | 'inactive';
  watchChannelId?: string;
  watchResourceId?: string;
  watchExpiration?: string;
  watchChannelToken?: string;
}

export interface CollabTable {
  headers: string[];
  rows: string[][];
}

export interface RecentActivity {
  id: string;
  type: 'task_completed' | 'volunteer_registered' | 'event_updated' | 'event_created';
  timestamp: string; // ISO string
  title: string;
  description: string;
  metadata?: {
    eventId?: string;
    eventName?: string;
    volunteerId?: string;
    volunteerName?: string;
    taskId?: string;
    taskTitle?: string;
    docName?: string;
    docId?: string;
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  totalStock: number;
  imageUrl?: string;
  notes?: string;
}

export interface AssetReservation {
  id: string;
  assetId: string;
  eventId: string;
  eventName: string;
  eventDate: string; // YYYY-MM-DD
  quantity: number;
  reservedBy: string;
  status?: 'Pending' | 'Packed' | 'Returned';
}




