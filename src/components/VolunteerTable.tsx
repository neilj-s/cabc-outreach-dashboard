import React, { useState, useReducer } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { parseLocalDate } from '../lib/dates';
import { useFocusTrap } from '../lib/useFocusTrap';
import { useNotification } from '../context/NotificationContext';
import { 
  Users, 
  UserPlus, 
  Trash2,
  Bookmark,
  Mail,
  Send,
  Sparkles,
  Inbox,
  X,
  MapPin,
  Calendar,
  CheckCircle2,
  StickyNote,
  Phone,
  Grid,
  List,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  Plus,
  Info,
  Filter,
  Search,
  ArrowRight,
  Copy
} from 'lucide-react';
import { Volunteer, EmailCommunication, MinistryEvent } from '../types';
import ConfirmDialog from './ConfirmDialog';

// Deterministic role color mapper for high contrast design pills/badges
const getRoleBadgeColors = (role: string) => {
  const normalized = role.toLowerCase().trim();
  
  if (normalized.includes('lead') || normalized.includes('manager') || normalized.includes('director') || normalized.includes('head')) {
    return 'bg-purple-50 text-purple-700 border-purple-200';
  }
  if (normalized.includes('host') || normalized.includes('greeter') || normalized.includes('welcome') || normalized.includes('reception')) {
    return 'bg-amber-50 text-amber-850 border-amber-200';
  }
  if (normalized.includes('pastor') || normalized.includes('prayer') || normalized.includes('advisor') || normalized.includes('elder')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
  if (normalized.includes('music') || normalized.includes('vocals') || normalized.includes('singer') || normalized.includes('band') || normalized.includes('worship')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (normalized.includes('tech') || normalized.includes('av') || normalized.includes('sound') || normalized.includes('multimedia') || normalized.includes('operator')) {
    return 'bg-sky-50 text-sky-700 border-sky-200';
  }
  if (normalized.includes('chef') || normalized.includes('grill') || normalized.includes('kitchen') || normalized.includes('cook') || normalized.includes('food')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (normalized.includes('candy') || normalized.includes('game') || normalized.includes('kid') || normalized.includes('child') || normalized.includes('youth')) {
    return 'bg-teal-50 text-teal-700 border-teal-200';
  }
  if (normalized.includes('helper') || normalized.includes('general') || normalized.includes('assistant')) {
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  // Fallback map list
  const colors = [
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-amber-50 text-amber-800 border-amber-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-rose-50 text-rose-700 border-rose-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-teal-50 text-teal-700 border-teal-200',
    'bg-sky-50 text-sky-700 border-sky-200'
  ];
  
  let hash = 0;
  for (let i = 0; i < role.length; i++) {
    hash = role.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Deterministic initials builder for avatar cards
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Deterministic colors for contact avatars
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-[#faf5ec] text-[#856637] border-[#efe0c2]',
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-rose-50 text-rose-700 border-rose-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-teal-50 text-teal-700 border-teal-200',
    'bg-sky-50 text-sky-700 border-sky-200'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

type AddVolForm = {
  name: string;
  email: string;
  phone: string;
  skills: string;
  ministry: string;
  notes: string;
  assignToActiveEvent: boolean;
};

const initialAddVolForm: AddVolForm = {
  name: '',
  email: '',
  phone: '',
  skills: '',
  ministry: '',
  notes: '',
  assignToActiveEvent: true,
};

type AddVolAction =
  | { type: 'setField'; field: keyof AddVolForm; value: string | boolean }
  | { type: 'reset' };

function addVolFormReducer(state: AddVolForm, action: AddVolAction): AddVolForm {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'reset':
      return initialAddVolForm;
    default:
      return state;
  }
}

type EditProfileForm = {
  name: string;
  email: string;
  phone: string;
  skills: string;
  ministry: string;
};

const emptyEditProfile: EditProfileForm = {
  name: '', email: '', phone: '', skills: '', ministry: '',
};

type EditProfileAction =
  | { type: 'setField'; field: keyof EditProfileForm; value: string }
  | { type: 'load'; values: EditProfileForm };

function editProfileReducer(state: EditProfileForm, action: EditProfileAction): EditProfileForm {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'load':
      return action.values;
    default:
      return state;
  }
}

type DetailForm = {
  role: string;          // placement (event-scoped)
  station: string;       // placement (event-scoped)
  notes: string;         // placement notes (event-scoped)
  privateNotes: string;  // volunteer-scoped
  lastContacted: string; // volunteer-scoped
  contactNotes: string;  // volunteer-scoped
};

const emptyDetailForm: DetailForm = {
  role: '', station: '', notes: '', privateNotes: '', lastContacted: '', contactNotes: '',
};

type DetailAction =
  | { type: 'setField'; field: keyof DetailForm; value: string }
  | { type: 'load'; values: DetailForm }
  | { type: 'clearPlacement' };

function detailFormReducer(state: DetailForm, action: DetailAction): DetailForm {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'load':
      return action.values;
    case 'clearPlacement':
      return { ...state, role: '', station: '', notes: '' };
    default:
      return state;
  }
}

type BulkActionMode = 'none' | 'role' | 'station' | 'remove';

type BulkForm = {
  action: BulkActionMode;
  role: string;
  station: string;
};

const initialBulkForm: BulkForm = { action: 'none', role: '', station: '' };

type BulkFormAction =
  | { type: 'setAction'; action: BulkActionMode }
  | { type: 'setField'; field: 'role' | 'station'; value: string }
  | { type: 'reset' };

function bulkFormReducer(state: BulkForm, action: BulkFormAction): BulkForm {
  switch (action.type) {
    case 'setAction':
      return { ...state, action: action.action };
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'reset':
      return initialBulkForm;
    default:
      return state;
  }
}

interface VolunteerTableProps {
  volunteers: Volunteer[];
  events: MinistryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onUpdateVolunteer: (id: string, updatedData: Partial<Volunteer>) => Promise<void>;
  onCreateVolunteer: (volunteerData: Omit<Volunteer, 'id'>) => Promise<void>;
  onRemoveVolunteer: (id: string) => Promise<void>;
  loading?: boolean;
}

function VolunteerTable({
  volunteers,
  events,
  selectedEventId,
  onSelectEvent,
  onUpdateVolunteer,
  onCreateVolunteer,
  onRemoveVolunteer,
  loading = false
}: VolunteerTableProps) {
  const { showNotification } = useNotification();
  // View mode state: roster mapping vs compact directory
  const [viewMode, setViewMode] = useState<'roster' | 'directory'>('roster');

  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [pickerSearchTerm, setPickerSearchTerm] = useState('');
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);
  const [pickerSubmitting, setPickerSubmitting] = useState(false);

  // Detailed Comments & Notes modal state
  const [notesModalVolId, setNotesModalVolId] = useState<string | null>(null);

  const notesModalRef = useFocusTrap(!!notesModalVolId, () => setNotesModalVolId(null));

  // Reusable Confirmation Dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirmAction = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        resolve: (val) => {
          setConfirmState(null);
          resolve(val);
        }
      });
    });
  };

  // New volunteer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, dispatchAddForm] = useReducer(addVolFormReducer, initialAddVolForm);
  const [submitting, setSubmitting] = useState(false);

  // Expanded Roster Row State
  const [expandedRosterVolId, setExpandedRosterVolId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');

  // Contact Outreach Tracker state
  const [rowLastContacted, setRowLastContacted] = useState('');
  const [rowContactNotes, setRowContactNotes] = useState('');

  const [modalGeneralNotes, setModalGeneralNotes] = useState('');
  const [modalEventNotes, setModalEventNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Bulk Selection & Editing state
  const [selectedVolIds, setSelectedVolIds] = useState<string[]>([]);
  const [bulkForm, dispatchBulkForm] = useReducer(bulkFormReducer, initialBulkForm);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [showMinistryDropdown, setShowMinistryDropdown] = useState(false);

  // --- REDESIGNED HIGH-DENSITY DIRECTORY STATE & HELPERS ---
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedVolId, setSelectedVolId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | 'station' | 'contactStatus' | 'lastContacted' | 'engagement'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Profile Inline Editor State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editProfile, dispatchEditProfile] = useReducer(editProfileReducer, emptyEditProfile);

  // Placement Editor State (within Detail Panel)
  const [isEditingPlacement, setIsEditingPlacement] = useState<boolean>(false);

  // Private Notes (within Detail Panel)
  const [isEditingPrivateNotes, setIsEditingPrivateNotes] = useState<boolean>(false);

  // Detail panel form state (placement + private notes + outreach)
  const [detailForm, dispatchDetailForm] = useReducer(detailFormReducer, emptyDetailForm);

  const activeEventId = selectedEventId || (events[0]?.id || '');

  const unassignedToEventVolunteers = React.useMemo(() => {
    if (!activeEventId) return [];
    return volunteers.filter(v => !v.eventAssignments || !(activeEventId in v.eventAssignments));
  }, [volunteers, activeEventId]);

  const filteredPickerVolunteers = React.useMemo(() => {
    const query = pickerSearchTerm.toLowerCase().trim();
    if (!query) return unassignedToEventVolunteers;
    return unassignedToEventVolunteers.filter(v => v.name.toLowerCase().includes(query));
  }, [unassignedToEventVolunteers, pickerSearchTerm]);

  const handleAddSelectedVolunteers = async () => {
    if (pickerSelectedIds.length === 0 || !activeEventId) return;
    setPickerSubmitting(true);
    try {
      let count = 0;
      for (const volId of pickerSelectedIds) {
        const vol = volunteers.find(v => v.id === volId);
        if (!vol) continue;
        const currentAssignments = vol.eventAssignments || {};
        const updatedAssignments = {
          ...currentAssignments,
          [activeEventId]: {
            role: 'General Helper',
            station: 'General Area',
            notes: '',
            contactStatus: 'Not Contacted' as const
          }
        };
        await onUpdateVolunteer(volId, { eventAssignments: updatedAssignments });
        count++;
      }
      showNotification(`Successfully added ${count} volunteer(s) to this event.`, 'success');
      setShowAddExistingModal(false);
      setPickerSelectedIds([]);
      setPickerSearchTerm('');
    } catch (err) {
      console.error(err);
      showNotification("Error adding volunteers to event.", "error");
    } finally {
      setPickerSubmitting(false);
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const letterCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    volunteers.forEach(v => {
      const firstLetter = v.name.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstLetter)) {
        counts[firstLetter] = (counts[firstLetter] || 0) + 1;
      }
    });
    return counts;
  }, [volunteers]);
  const activeEvent = events.find(e => e.id === activeEventId);

  // Compile unique roles for active event scope
  const allUniqueRoles = Array.from(new Set(
    volunteers
      .map(v => v.eventAssignments?.[activeEventId]?.role)
      .filter((r): r is string => !!r && r.trim() !== '')
  )).sort((a, b) => a.localeCompare(b));

  const hasUnassigned = volunteers.some(v => !v.eventAssignments?.[activeEventId]?.role);

  // Derive distinct skills across all volunteers
  const allUniqueSkills = React.useMemo(() => {
    const skillsSet = new Set<string>();
    volunteers.forEach(v => {
      if (v.skills) {
        v.skills.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) {
            const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            skillsSet.add(formatted);
          }
        });
      }
    });
    return Array.from(skillsSet).sort((a, b) => a.localeCompare(b));
  }, [volunteers]);

  // Distinct ministries, grouped case-insensitively. Display the most common
  // original casing (ties broken alphabetically) so acronyms like "AWANA" survive.
  const allUniqueMinistries = React.useMemo(() => {
    const casingCounts = new Map<string, Map<string, number>>();
    volunteers.forEach(v => {
      if (!v.ministry) return;
      v.ministry.split(',').forEach(m => {
        const token = m.trim();
        if (!token) return;
        const key = token.toLowerCase();
        if (!casingCounts.has(key)) casingCounts.set(key, new Map());
        const inner = casingCounts.get(key)!;
        inner.set(token, (inner.get(token) || 0) + 1);
      });
    });
    const result: string[] = [];
    casingCounts.forEach(inner => {
      let best = '';
      let bestCount = -1;
      inner.forEach((count, casing) => {
        if (count > bestCount || (count === bestCount && casing.localeCompare(best) < 0)) {
          best = casing;
          bestCount = count;
        }
      });
      result.push(best);
    });
    return result.sort((a, b) => a.localeCompare(b));
  }, [volunteers]);

  const baseVolunteers = React.useMemo(() => {
    if (viewMode === 'roster') {
      if (!activeEventId) return [];
      return volunteers.filter(vol => vol.eventAssignments && (activeEventId in vol.eventAssignments));
    }
    return volunteers;
  }, [volunteers, viewMode, activeEventId]);

  // Apply search & multi-select role & skill filters
  const filteredVolunteers = React.useMemo(() => {
    return baseVolunteers.filter(vol => {
      // 1. Search filter match
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch = !query || 
        vol.name.toLowerCase().includes(query) ||
        vol.email.toLowerCase().includes(query) ||
        (vol.phone && vol.phone.toLowerCase().includes(query)) ||
        (vol.skills && vol.skills.toLowerCase().includes(query)) ||
        (vol.notes && vol.notes.toLowerCase().includes(query)) ||
        (vol.eventAssignments?.[activeEventId]?.station && vol.eventAssignments[activeEventId].station.toLowerCase().includes(query)) ||
        (vol.eventAssignments?.[activeEventId]?.role && vol.eventAssignments[activeEventId].role.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 2. Role filter match
      if (selectedRoles.length > 0) {
        const role = vol.eventAssignments?.[activeEventId]?.role;
        const mappedRole = (!role || role.trim() === '') ? 'Unassigned' : role;
        if (!selectedRoles.includes(mappedRole)) return false;
      }

      // 3. Skill filter match
      if (selectedSkills.length > 0) {
        if (!vol.skills) return false;
        const volSkillsList = vol.skills.split(',').map(s => {
          const trimmed = s.trim();
          return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        });
        const hasMatchingSkill = selectedSkills.some(skill => volSkillsList.includes(skill));
        if (!hasMatchingSkill) return false;
      }

      // 4. Ministry filter match (case-insensitive)
      if (selectedMinistries.length > 0) {
        if (!vol.ministry) return false;
        const volMinistries = vol.ministry.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        const selectedLower = selectedMinistries.map(m => m.toLowerCase());
        const hasMatchingMinistry = selectedLower.some(m => volMinistries.includes(m));
        if (!hasMatchingMinistry) return false;
      }

      return true;
    });
  }, [baseVolunteers, searchTerm, selectedRoles, selectedSkills, selectedMinistries, activeEventId]);

  // Filter list by letter if selected
  const directoryVolunteers = React.useMemo(() => {
    let list = filteredVolunteers;
    if (selectedLetter) {
      list = list.filter(v => v.name.trim().charAt(0).toUpperCase() === selectedLetter);
    }
    return list;
  }, [filteredVolunteers, selectedLetter]);

  // Apply sorting to directory list
  const sortedDirectoryVolunteers = React.useMemo(() => {
    const list = [...directoryVolunteers];
    
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'email') {
        valA = a.email.toLowerCase();
        valB = b.email.toLowerCase();
      } else if (sortField === 'role') {
        valA = (a.eventAssignments?.[activeEventId]?.role || '').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.role || '').toLowerCase();
      } else if (sortField === 'station') {
        valA = (a.eventAssignments?.[activeEventId]?.station || '').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.station || '').toLowerCase();
      } else if (sortField === 'contactStatus') {
        valA = (a.eventAssignments?.[activeEventId]?.contactStatus || 'Not Contacted').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.contactStatus || 'Not Contacted').toLowerCase();
      } else if (sortField === 'lastContacted') {
        valA = a.lastContacted || '';
        valB = b.lastContacted || '';
      } else if (sortField === 'engagement') {
        valA = Object.keys(a.eventAssignments || {}).length;
        valB = Object.keys(b.eventAssignments || {}).length;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [directoryVolunteers, sortField, sortDirection, activeEventId]);

  // Apply sorting to roster list
  const sortedRosterVolunteers = React.useMemo(() => {
    const list = [...filteredVolunteers];
    
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'email') {
        valA = a.email.toLowerCase();
        valB = b.email.toLowerCase();
      } else if (sortField === 'role') {
        valA = (a.eventAssignments?.[activeEventId]?.role || '').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.role || '').toLowerCase();
      } else if (sortField === 'station') {
        valA = (a.eventAssignments?.[activeEventId]?.station || '').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.station || '').toLowerCase();
      } else if (sortField === 'contactStatus') {
        valA = (a.eventAssignments?.[activeEventId]?.contactStatus || 'Not Contacted').toLowerCase();
        valB = (b.eventAssignments?.[activeEventId]?.contactStatus || 'Not Contacted').toLowerCase();
      } else if (sortField === 'lastContacted') {
        valA = a.lastContacted || '';
        valB = b.lastContacted || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [filteredVolunteers, sortField, sortDirection, activeEventId]);

  // Handle selected volunteer initialization
  const activeDirectoryVolId = selectedVolId;
  const selectedVol = volunteers.find(v => v.id === activeDirectoryVolId);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!selectedVol) return false;
    const assignment = selectedVol.eventAssignments?.[activeEventId];
    
    const profileChanged = 
      editProfile.name.trim() !== (selectedVol.name || '').trim() ||
      editProfile.email.trim() !== (selectedVol.email || '').trim() ||
      editProfile.phone.trim() !== (selectedVol.phone || '').trim() ||
      editProfile.skills.trim() !== (selectedVol.skills || '').trim() ||
      editProfile.ministry.trim() !== (selectedVol.ministry || '').trim();
      
    const privateNotesChanged =
      detailForm.privateNotes.trim() !== (selectedVol.notes || '').trim();
      
    const outreachChanged =
      detailForm.lastContacted !== (selectedVol.lastContacted || '') ||
      detailForm.contactNotes.trim() !== (selectedVol.contactNotes || '').trim();
      
    const placementChanged =
      detailForm.role.trim() !== (assignment?.role || '').trim() ||
      detailForm.station.trim() !== (assignment?.station || '').trim() ||
      detailForm.notes.trim() !== (assignment?.notes || '').trim();
      
    return profileChanged || privateNotesChanged || outreachChanged || placementChanged;
  }, [
    selectedVol,
    activeEventId,
    editProfile,
    detailForm
  ]);

  const handleSaveChanges = async () => {
    if (!selectedVol) return;
    try {
      const updatePayload: Partial<Volunteer> = {
        name: editProfile.name.trim(),
        email: editProfile.email.trim(),
        phone: editProfile.phone.trim(),
        skills: editProfile.skills.trim(),
        ministry: editProfile.ministry.trim(),
        notes: detailForm.privateNotes.trim(),
        lastContacted: detailForm.lastContacted,
        contactNotes: detailForm.contactNotes.trim()
      };

      if (activeEventId) {
        const currentAssignments = selectedVol.eventAssignments || {};
        const existingEntry = currentAssignments[activeEventId];
        const existingStatus = existingEntry?.contactStatus || 'Not Contacted';

        // Save placement info if we are editing placement or already have one
        if (isEditingPlacement || currentAssignments[activeEventId]) {
          updatePayload.eventAssignments = {
            ...currentAssignments,
            [activeEventId]: {
              role: detailForm.role.trim() || 'General Helper',
              station: detailForm.station.trim() || 'General Area',
              notes: detailForm.notes.trim(),
              contactStatus: existingStatus
            }
          };
        }
      }

      await onUpdateVolunteer(selectedVol.id, updatePayload);
      
      setIsEditingProfile(false);
      setIsEditingPlacement(false);
      setIsEditingPrivateNotes(false);
      
      showNotification("Volunteer changes saved successfully.", "success");
    } catch (err) {
      console.error('Failed to save volunteer changes:', err);
      showNotification("Could not save volunteer changes.", "error");
    }
  };

  const handleUpdateContactStatus = async (volId: string, status: string) => {
    const vol = volunteers.find(v => v.id === volId);
    if (!vol || !activeEventId) return;
    try {
      const currentAssignments = vol.eventAssignments || {};
      const currentAssignmentForEvent = currentAssignments[activeEventId] || {
        role: '',
        station: '',
        notes: ''
      };
      const updatedAssignments = {
        ...currentAssignments,
        [activeEventId]: {
          ...currentAssignmentForEvent,
          contactStatus: status as any
        }
      };

      let declinedEventIds = vol.declinedEventIds || [];
      if (status === 'Declined') {
        declinedEventIds = Array.from(new Set([...declinedEventIds, activeEventId]));
      } else {
        declinedEventIds = declinedEventIds.filter(id => id !== activeEventId);
      }

      await onUpdateVolunteer(vol.id, { 
        eventAssignments: updatedAssignments,
        declinedEventIds
      });
    } catch (err) {
      console.error('Failed to update contact status:', err);
    }
  };

  const handleClearPlacementDirect = async () => {
    if (!selectedVol || !activeEventId) return;
    try {
      const currentAssignments = { ...(selectedVol.eventAssignments || {}) };
      delete currentAssignments[activeEventId];
      await onUpdateVolunteer(selectedVol.id, { eventAssignments: currentAssignments });
      dispatchDetailForm({ type: 'clearPlacement' });
      setIsEditingPlacement(false);
    } catch (err) {
      console.error('Failed to clear placement:', err);
    }
  };

  // Sync edit state when active volunteer changes
  React.useEffect(() => {
    if (selectedVol) {
      dispatchEditProfile({
        type: 'load',
        values: {
          name: selectedVol.name || '',
          email: selectedVol.email || '',
          phone: selectedVol.phone || '',
          skills: selectedVol.skills || '',
          ministry: selectedVol.ministry || '',
        }
      });
      
      const assignment = selectedVol.eventAssignments?.[activeEventId];
      dispatchDetailForm({ type: 'load', values: {
        role: assignment?.role || '',
        station: assignment?.station || '',
        notes: assignment?.notes || '',
        privateNotes: selectedVol.notes || '',
        lastContacted: selectedVol.lastContacted || '',
        contactNotes: selectedVol.contactNotes || '',
      }});
    } else {
      dispatchEditProfile({
        type: 'load',
        values: {
          name: '',
          email: '',
          phone: '',
          skills: '',
          ministry: '',
        }
      });
      dispatchDetailForm({ type: 'load', values: emptyDetailForm });
    }
    setIsEditingProfile(false);
    setIsEditingPlacement(false);
    setIsEditingPrivateNotes(false);
  }, [activeDirectoryVolId, activeEventId]);

  // Sync row-level edit state when expandedRosterVolId changes
  React.useEffect(() => {
    if (expandedRosterVolId) {
      const vol = volunteers.find(v => v.id === expandedRosterVolId);
      if (vol) {
        setRowLastContacted(vol.lastContacted || '');
        setRowContactNotes(vol.contactNotes || '');

        const assignment = vol.eventAssignments?.[activeEventId];
        if (assignment) {
          setNewRoleName(assignment.role);
          setNewStationName(assignment.station);
          setNewEventNotes(assignment.notes || '');
        } else {
          setNewRoleName('');
          setNewStationName('');
          setNewEventNotes('');
        }
      }
    }
  }, [expandedRosterVolId, volunteers, activeEventId]);

  const handleSaveRowOutreach = async (volId: string) => {
    try {
      await onUpdateVolunteer(volId, {
        lastContacted: rowLastContacted,
        contactNotes: rowContactNotes.trim()
      });
      showNotification("Outreach contact record saved successfully.", "success");
    } catch (err) {
      console.error('Failed to save row outreach:', err);
      showNotification("Could not save contact record.", "error");
    }
  };

  const renderSortHeader = (field: 'name' | 'email' | 'role' | 'station' | 'contactStatus' | 'lastContacted' | 'engagement', label: string) => {
    const isSorted = sortField === field;
    return (
      <button
        onClick={() => {
          if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
          } else {
            setSortField(field);
            setSortDirection('asc');
          }
        }}
        className="flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer font-bold focus:outline-none"
      >
        <span>{label}</span>
        <span className="text-[10px] text-[#856637] font-mono">
          {isSorted ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
        </span>
      </button>
    );
  };

  const handleCopyAllEmails = async () => {
    // Respect the currently shown list (search + role + skill filters).
    const withEmail = filteredVolunteers.filter(
      v => v.email && v.email.trim() !== ''
    );
    const skipped = filteredVolunteers.length - withEmail.length;
    const uniqueEmails = Array.from(
      new Set(withEmail.map(v => v.email.trim()))
    );

    if (uniqueEmails.length === 0) {
      showNotification('No email addresses to copy for the current list.', 'error');
      return;
    }

    const text = uniqueEmails.join(', ');

    // Try the async clipboard API, fall back to a temporary textarea
    // (covers browsers where navigator.clipboard is blocked, e.g. non-HTTPS).
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    if (copied) {
      const plural = uniqueEmails.length === 1 ? 'email' : 'emails';
      const suffix = skipped > 0 ? ` · ${skipped} had no email` : '';
      showNotification(
        `${uniqueEmails.length} ${plural} copied to clipboard${suffix}`,
        'success'
      );
    } else {
      showNotification(
        'Could not access the clipboard. Please copy manually.',
        'error'
      );
    }
  };

  const handleCreateVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name) return;
    setSubmitting(true);
    try {
      const initialAssignments = (addForm.assignToActiveEvent && activeEventId) ? {
        [activeEventId]: {
          role: 'General Helper',
          station: 'General Area',
          notes: '',
          contactStatus: 'Not Contacted' as const
        }
      } : {};
      await onCreateVolunteer({
        name: addForm.name,
        email: addForm.email,
        phone: addForm.phone,
        roles: [],
        skills: addForm.skills.trim(),
        ministry: addForm.ministry.trim(),
        notes: addForm.notes.trim(),
        emails: [],
        eventAssignments: initialAssignments
      });
      dispatchAddForm({ type: 'reset' });
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignRoleStation = async (volId: string) => {
    if (!activeEventId) return;
    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return;

    const currentAssignments = vol.eventAssignments || {};
    const existingEntry = currentAssignments[activeEventId];
    const existingStatus = existingEntry?.contactStatus || 'Not Contacted';

    const updatedAssignments = {
      ...currentAssignments,
      [activeEventId]: {
        role: newRoleName.trim() || 'General Helper',
        station: newStationName.trim() || 'General Area',
        notes: newEventNotes.trim(),
        contactStatus: existingStatus
      }
    };

    await onUpdateVolunteer(volId, { eventAssignments: updatedAssignments });
  };

  const handleClearAssignment = async (volId: string) => {
    if (!activeEventId) return;
    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return;

    const currentAssignments = { ...(vol.eventAssignments || {}) };
    delete currentAssignments[activeEventId];

    const declinedEventIds = Array.from(
      new Set([...(vol.declinedEventIds || []), activeEventId])
    );

    await onUpdateVolunteer(volId, { eventAssignments: currentAssignments, declinedEventIds });
    setNewRoleName('');
    setNewStationName('');
    setNewEventNotes('');
  };

  const handleBulkAssignField = async (field: 'role' | 'station', value: string) => {
    if (selectedVolIds.length === 0 || !activeEventId) return;
    if (!value.trim()) {
      showNotification(`Please specify a ${field === 'role' ? 'Role' : 'Station'} to assign.`, "error");
      return;
    }

    setBulkProcessing(true);
    try {
      for (const volId of selectedVolIds) {
        const vol = volunteers.find(v => v.id === volId);
        if (!vol) continue;

        const currentAssignments = vol.eventAssignments || {};
        const assignment = currentAssignments[activeEventId];
        const existingStatus = assignment?.contactStatus || 'Not Contacted';

        const updatedAssignments = {
          ...currentAssignments,
          [activeEventId]: {
            role: field === 'role' ? value.trim() : (assignment?.role || 'General Helper'),
            station: field === 'station' ? value.trim() : (assignment?.station || 'General Area'),
            notes: assignment?.notes || '',
            contactStatus: existingStatus
          }
        };

        await onUpdateVolunteer(volId, { eventAssignments: updatedAssignments });
      }

      showNotification(`Successfully updated ${field} for selected volunteers.`, "success");
      setSelectedVolIds([]);
      dispatchBulkForm({ type: 'reset' });
    } catch (err) {
      console.error(err);
      showNotification(`Could not bulk update ${field}.`, "error");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkRemoveFromEvent = async () => {
    if (selectedVolIds.length === 0 || !activeEventId) return;
    setBulkProcessing(true);
    try {
      for (const volId of selectedVolIds) {
        const vol = volunteers.find(v => v.id === volId);
        if (!vol) continue;

        const currentAssignments = { ...vol.eventAssignments };
        delete currentAssignments[activeEventId];

        await onUpdateVolunteer(volId, { eventAssignments: currentAssignments });
      }

      showNotification(`Removed ${selectedVolIds.length} volunteer${selectedVolIds.length === 1 ? '' : 's'} from ${activeEvent?.name || 'event'}.`, "success");
      setSelectedVolIds([]);
      dispatchBulkForm({ type: 'reset' });
    } catch (err) {
      console.error(err);
      showNotification("Could not bulk remove volunteers.", "error");
    } finally {
      setBulkProcessing(false);
    }
  };



  const handleOpenNotesModal = (vol: Volunteer) => {
    setNotesModalVolId(vol.id);
    setModalGeneralNotes(vol.notes || '');
    setModalEventNotes(vol.eventAssignments?.[activeEventId]?.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!notesModalVolId) return;
    setSavingNotes(true);
    try {
      const vol = volunteers.find(v => v.id === notesModalVolId);
      if (vol) {
        const updatedData: Partial<Volunteer> = {
          notes: modalGeneralNotes.trim()
        };

        if (activeEventId) {
          const currentAssignments = vol.eventAssignments || {};
          const assignment = currentAssignments[activeEventId];
          
          if (assignment) {
            const existingStatus = (vol.eventAssignments?.[activeEventId]?.contactStatus) || 'Not Contacted';
            updatedData.eventAssignments = {
              ...currentAssignments,
              [activeEventId]: {
                role: assignment.role || 'General Helper',
                station: assignment.station || 'General Area',
                notes: modalEventNotes.trim(),
                contactStatus: existingStatus
              }
            };
          }
        }

        await onUpdateVolunteer(notesModalVolId, updatedData);
        setNotesModalVolId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end pb-4 border-b border-[#e2dcd0] gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#856637] font-sans">Module III • Volunteer Registry</span>
          <h2 className="text-2xl font-serif font-black tracking-tight text-[#1e293b] mt-1">Volunteer Database</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Streamlined centralized registry mapping volunteers to event-specific assignments. Track roles, stations, and email communications history.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <UserPlus size={14} /> New volunteer
        </button>
      </div>

      {/* View Switcher Sub-Tabs */}
      <div className="flex border-b border-[#efe0c2]/60 gap-6">
        <button
          onClick={() => setViewMode('roster')}
          className={`pb-3 text-xs uppercase font-bold tracking-wider relative cursor-pointer transition flex items-center gap-1.5 ${
            viewMode === 'roster'
              ? 'text-[#856637]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <List size={14} />
          <span>Event Roster</span>
          {viewMode === 'roster' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#856637]" />
          )}
        </button>
        <button
          onClick={() => setViewMode('directory')}
          className={`pb-3 text-xs uppercase font-bold tracking-wider relative cursor-pointer transition flex items-center gap-1.5 ${
            viewMode === 'directory'
              ? 'text-[#856637]'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Grid size={14} />
          <span>Full Directory</span>
          {viewMode === 'directory' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#856637]" />
          )}
        </button>
      </div>

      {/* Interactive Active Event Selector Context */}
      {events.length > 0 && (
        <div className="bg-[#faf8f4] border border-[#e2dcd0] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#856637] block">Active Event Scope</span>
            <p className="text-xs text-slate-500 leading-normal">
              Select an upcoming event context to map, view, and organize volunteer roles and stations dynamically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={activeEventId}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="text-xs font-serif font-bold border border-[#e2dcd0] bg-white rounded-lg px-3 py-2 text-slate-850 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#c2aa80] shadow-sm shrink-0 min-w-[200px]"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} • {parseLocalDate(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Register Volunteer Form */}
      {showAddForm && (
        <form onSubmit={handleCreateVolunteer} className="bg-[#fcfaf7] p-6 rounded-xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 max-w-2xl animate-fadeIn space-y-4">
          <h3 className="font-serif font-bold text-base text-[#1e293b] border-b border-[#efe0c2] pb-2">New volunteer</h3>
          
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Full Name</label>
            <input
              type="text"
              placeholder="Sarah Jenkins"
              value={addForm.name}
              onChange={e => dispatchAddForm({ type: 'setField', field: 'name', value: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Email Address <span className="normal-case font-medium text-slate-400">(optional)</span></label>
              <input
                type="email"
                placeholder="sarah.j@example.com"
                value={addForm.email}
                onChange={e => dispatchAddForm({ type: 'setField', field: 'email', value: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 555-0192"
                value={addForm.phone}
                onChange={e => dispatchAddForm({ type: 'setField', field: 'phone', value: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Ministry &amp; Small Group</label>
            <input
              type="text"
              placeholder="e.g. Worship, Children's, Hospitality, Outreach"
              value={addForm.ministry}
              onChange={e => dispatchAddForm({ type: 'setField', field: 'ministry', value: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Skills &amp; Interests</label>
            <input
              type="text"
              placeholder="e.g. Greeting, Hospitality, Cooking, AV Board, First Aid"
              value={addForm.skills}
              onChange={e => dispatchAddForm({ type: 'setField', field: 'skills', value: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Private Operational Notes</label>
            <textarea
              placeholder="Any additional notes on availability, past experience, or role placement restrictions..."
              rows={2}
              value={addForm.notes}
              onChange={e => dispatchAddForm({ type: 'setField', field: 'notes', value: e.target.value })}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
            />
          </div>

          {activeEventId && activeEvent && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#efe0c2] bg-[#faf8f4] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addForm.assignToActiveEvent}
                onChange={e => dispatchAddForm({ type: 'setField', field: 'assignToActiveEvent', value: e.target.checked })}
                className="mt-0.5 accent-[#856637] cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-snug">
                <span className="font-semibold text-[#1e293b]">Assign to {activeEvent.name} now</span>
                <br />
                Uncheck to add to the directory only &mdash; you can place them on an event later from the roster picker.
              </span>
            </label>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-[#e2dcd0] hover:bg-[#faf8f4] text-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              {submitting ? 'Adding...' : 'Add volunteer'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Utility Bar */}
      <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-3">
          {/* Right: Assigned Role & Skills multi-select filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Filter Roles:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2dcd0] rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#faf8f4] transition cursor-pointer select-none min-w-[160px] shadow-sm"
                >
                  <span className="truncate">
                    {selectedRoles.length === 0 
                      ? 'All Assigned Roles' 
                      : `${selectedRoles.length} Role${selectedRoles.length > 1 ? 's' : ''} Active`}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {showRoleDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowRoleDropdown(false)} 
                    />
                    <div className="absolute right-0 mt-1 w-64 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-lg z-20 p-3 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#efe0c2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Roles</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRoles([])}
                            className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allOpts = [...allUniqueRoles];
                              if (hasUnassigned) allOpts.push('Unassigned');
                              setSelectedRoles(allOpts);
                            }}
                            className="text-[9px] font-bold text-[#856637] hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {hasUnassigned && (
                          <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faf8f4] cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={selectedRoles.includes('Unassigned')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRoles([...selectedRoles, 'Unassigned']);
                                } else {
                                  setSelectedRoles(selectedRoles.filter(r => r !== 'Unassigned'));
                                }
                              }}
                              className="accent-[#856637] cursor-pointer"
                            />
                            <span className="italic text-slate-500">Unassigned Volunteers</span>
                          </label>
                        )}
                        {allUniqueRoles.map(role => (
                          <label key={role} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faf8f4] cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={selectedRoles.includes(role)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRoles([...selectedRoles, role]);
                                } else {
                                  setSelectedRoles(selectedRoles.filter(r => r !== role));
                                }
                              }}
                              className="accent-[#856637] cursor-pointer"
                            />
                            <span className="truncate">{role}</span>
                          </label>
                        ))}
                        {allUniqueRoles.length === 0 && !hasUnassigned && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">No roles assigned in active event.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Filter Skills:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2dcd0] rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#faf8f4] transition cursor-pointer select-none min-w-[160px] shadow-sm"
                >
                  <span className="truncate">
                    {selectedSkills.length === 0 
                      ? 'All Skills' 
                      : `${selectedSkills.length} Skill${selectedSkills.length > 1 ? 's' : ''} Active`}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {showSkillDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowSkillDropdown(false)} 
                    />
                    <div className="absolute right-0 mt-1 w-64 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-lg z-20 p-3 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#efe0c2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Volunteer Skills</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSkills([])}
                            className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSkills([...allUniqueSkills])}
                            className="text-[9px] font-bold text-[#856637] hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {allUniqueSkills.map(skill => (
                          <label key={skill} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faf8f4] cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={selectedSkills.includes(skill)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSkills([...selectedSkills, skill]);
                                } else {
                                  setSelectedSkills(selectedSkills.filter(s => s !== skill));
                                }
                              }}
                              className="accent-[#856637] cursor-pointer"
                            />
                            <span className="truncate">{skill}</span>
                          </label>
                        ))}
                        {allUniqueSkills.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">No skills registered.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Filter Ministry:</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMinistryDropdown(!showMinistryDropdown)}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2dcd0] rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#faf8f4] transition cursor-pointer select-none min-w-[160px] shadow-sm"
                >
                  <span className="truncate">
                    {selectedMinistries.length === 0
                      ? 'All Ministries'
                      : `${selectedMinistries.length} Ministr${selectedMinistries.length > 1 ? 'ies' : 'y'} Active`}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {showMinistryDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMinistryDropdown(false)}
                    />
                    <div className="absolute right-0 mt-1 w-64 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-lg z-20 p-3 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#efe0c2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Volunteer Ministries</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMinistries([])}
                            className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedMinistries([...allUniqueMinistries])}
                            className="text-[9px] font-bold text-[#856637] hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {allUniqueMinistries.map(ministry => (
                          <label key={ministry} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faf8f4] cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={selectedMinistries.includes(ministry)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMinistries([...selectedMinistries, ministry]);
                                } else {
                                  setSelectedMinistries(selectedMinistries.filter(m => m !== ministry));
                                }
                              }}
                              className="accent-[#856637] cursor-pointer"
                            />
                            <span className="truncate">{ministry}</span>
                          </label>
                        ))}
                        {allUniqueMinistries.length === 0 && (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">No ministries registered.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Clear Filters Button */}
            {(searchTerm || selectedRoles.length > 0 || selectedSkills.length > 0 || selectedMinistries.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRoles([]);
                  setSelectedSkills([]);
                  setSelectedMinistries([]);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Info label about active filters */}
        {(searchTerm || selectedRoles.length > 0 || selectedSkills.length > 0 || selectedMinistries.length > 0) && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1 bg-[#faf8f4] border border-[#efe0c2]/50 px-3 py-1.5 rounded-lg animate-fadeIn">
            <span className="font-semibold text-[#856637]">Active Filters:</span>
            {searchTerm && <span>Search for <strong className="text-slate-700">"{searchTerm}"</strong></span>}
            {searchTerm && (selectedRoles.length > 0 || selectedSkills.length > 0 || selectedMinistries.length > 0) && <span className="mx-1">•</span>}
            {selectedRoles.length > 0 && (
              <span className="truncate max-w-[200px]" title={selectedRoles.join(', ')}>
                Roles: <strong className="text-slate-700">{selectedRoles.join(', ')}</strong>
              </span>
            )}
            {selectedRoles.length > 0 && selectedSkills.length > 0 && <span className="mx-1">•</span>}
            {selectedSkills.length > 0 && (
              <span className="truncate max-w-[200px]" title={selectedSkills.join(', ')}>
                Skills: <strong className="text-slate-700">{selectedSkills.join(', ')}</strong>
              </span>
            )}
            {(selectedRoles.length > 0 || selectedSkills.length > 0) && selectedMinistries.length > 0 && <span className="mx-1">•</span>}
            {selectedMinistries.length > 0 && (
              <span className="truncate max-w-[200px]" title={selectedMinistries.join(', ')}>
                Ministries: <strong className="text-slate-700">{selectedMinistries.join(', ')}</strong>
              </span>
            )}
            <span className="ml-auto text-slate-400 font-mono text-[10px] shrink-0">
              Showing {filteredVolunteers.length} of {volunteers.length} volunteers
            </span>
          </div>
        )}
      </div>

      {/* Main Roster Table / Directory View Toggle Container */}
      {volunteers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl text-center shadow-sm">
          <Users size={40} className="text-[#c2aa80] mb-3" />
          <h3 className="font-serif font-black text-[#1e293b] text-base">No volunteers yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-normal">
            Start building your ministry team by registering your first volunteer to assign roles and track communications.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer inline-flex"
          >
            <UserPlus size={14} /> Add Volunteer
          </button>
        </div>
      ) : viewMode === 'roster' ? (
        !activeEventId ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl text-center shadow-sm">
            <Calendar size={40} className="text-[#c2aa80] mb-3" />
            <h3 className="font-serif font-black text-[#1e293b] text-base">No Event Selected</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-normal">
              Select an event to see its roster.
            </p>
          </div>
        ) : (
          <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-[#faf8f4] border-b border-[#e2dcd0] flex justify-between items-center flex-wrap gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-serif font-bold uppercase tracking-wider text-[#1e293b] flex items-center gap-1.5">
                <Users size={16} className="text-[#856637]" /> Active Roster Management
              </span>
              <p className="text-[10px] text-[#856637] font-medium font-serif leading-none">
                {baseVolunteers.length} volunteer{baseVolunteers.length === 1 ? '' : 's'} on this event: <span className="font-bold text-slate-700">{activeEvent?.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddExistingModal(true)}
                className="px-3 py-1.5 bg-[#856637] hover:bg-[#6c522c] text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Add from directory
              </button>

              <div className="relative hidden md:block">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search global registry..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-[#e2dcd0] bg-white focus:outline-none focus:ring-1 focus:ring-[#856637] text-slate-800 placeholder-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500 font-serif">
                {filteredVolunteers.length === baseVolunteers.length 
                  ? `${baseVolunteers.length} rostered volunteers` 
                  : `Showing ${filteredVolunteers.length} of ${baseVolunteers.length} rostered`
                }
              </span>
              <button
                type="button"
                onClick={handleCopyAllEmails}
                title="Copy all shown volunteer emails, comma-separated, for pasting into Gmail"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#856637] text-[#fdfaf4] text-xs font-bold rounded-lg border border-[#6f5430] shadow-sm hover:bg-[#6f5430] transition cursor-pointer"
              >
                <Copy size={13} />
                <span>Copy All Emails</span>
              </button>
            </div>
          </div>

        {/* Bulk action bar */}
        {selectedVolIds.length > 0 && (
          <div className="bg-amber-50/60 border-b border-[#efe0c2] p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#856637] text-[#faf8f4] rounded-xl shadow-xs">
                <Users size={16} />
              </div>
              <div>
                <p className="text-xs font-serif font-black text-slate-800 flex items-center gap-2">
                  <span>Bulk Roster Actions</span>
                  <span className="px-2.5 py-0.5 bg-[#856637] text-white text-[9px] font-bold rounded-full font-mono">{selectedVolIds.length} Selected</span>
                </p>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  {bulkForm.action === 'none' && `Select an action to perform on these volunteers for ${activeEvent?.name || 'the event'}.`}
                  {bulkForm.action === 'role' && "Assign a specific role to all selected volunteers."}
                  {bulkForm.action === 'station' && "Assign a specific station/location to all selected volunteers."}
                  {bulkForm.action === 'remove' && "Remove selected volunteers from the roster of this event."}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
              {bulkForm.action === 'none' && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => dispatchBulkForm({ type: 'setAction', action: 'role' })}
                    className="px-3 py-1.5 bg-white hover:bg-[#faf8f4] text-slate-700 border border-[#e2dcd0] text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <span>Set role</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchBulkForm({ type: 'setAction', action: 'station' })}
                    className="px-3 py-1.5 bg-white hover:bg-[#faf8f4] text-slate-700 border border-[#e2dcd0] text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <span>Set station</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchBulkForm({ type: 'setAction', action: 'remove' })}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <span>Remove from event</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVolIds([]);
                      dispatchBulkForm({ type: 'reset' });
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {bulkForm.action === 'role' && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <input
                    type="text"
                    list="bulk-role-options"
                    placeholder="Type or select role..."
                    value={bulkForm.role}
                    onChange={e => dispatchBulkForm({ type: 'setField', field: 'role', value: e.target.value })}
                    className="text-xs p-2 rounded-lg border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold placeholder:text-slate-400 w-full sm:w-48 shadow-xs"
                    autoFocus
                  />
                  <datalist id="bulk-role-options">
                    {allUniqueRoles.map(role => (
                      <option key={role} value={role} />
                    ))}
                  </datalist>
                  
                  <button
                    type="button"
                    onClick={() => {
                      dispatchBulkForm({ type: 'reset' });
                    }}
                    className="px-3 py-1.5 border border-[#efe0c2] bg-white hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAssignField('role', bulkForm.role)}
                    disabled={bulkProcessing || !bulkForm.role.trim()}
                    className="px-4 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] disabled:bg-slate-400 text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                  >
                    {bulkProcessing ? 'Applying...' : `Apply to ${selectedVolIds.length}`}
                  </button>
                </div>
              )}

              {bulkForm.action === 'station' && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <input
                    type="text"
                    placeholder="Enter station name..."
                    value={bulkForm.station}
                    onChange={e => dispatchBulkForm({ type: 'setField', field: 'station', value: e.target.value })}
                    className="text-xs p-2 rounded-lg border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold placeholder:text-slate-400 w-full sm:w-48 shadow-xs"
                    autoFocus
                  />
                  
                  <button
                    type="button"
                    onClick={() => {
                      dispatchBulkForm({ type: 'reset' });
                    }}
                    className="px-3 py-1.5 border border-[#efe0c2] bg-white hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAssignField('station', bulkForm.station)}
                    disabled={bulkProcessing || !bulkForm.station.trim()}
                    className="px-4 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] disabled:bg-slate-400 text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                  >
                    {bulkProcessing ? 'Applying...' : `Apply to ${selectedVolIds.length}`}
                  </button>
                </div>
              )}

              {bulkForm.action === 'remove' && (
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                  <span className="text-xs font-medium text-rose-700">
                    Remove these {selectedVolIds.length} from {activeEvent?.name || 'event'}? They stay in the directory.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => dispatchBulkForm({ type: 'reset' })}
                      className="px-3 py-1.5 border border-[#efe0c2] bg-white hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkRemoveFromEvent}
                      disabled={bulkProcessing}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                    >
                      {bulkProcessing ? 'Removing...' : 'Remove from event'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e2dcd0] text-[10px] font-bold uppercase text-slate-450 tracking-wider bg-[#faf8f4]/50">
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    className="accent-[#856637] rounded cursor-pointer w-4 h-4"
                    checked={filteredVolunteers.length > 0 && filteredVolunteers.every(v => selectedVolIds.includes(v.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVolIds(Array.from(new Set([...selectedVolIds, ...filteredVolunteers.map(v => v.id)])));
                      } else {
                        const filteredIds = filteredVolunteers.map(v => v.id);
                        setSelectedVolIds(selectedVolIds.filter(id => !filteredIds.includes(id)));
                      }
                    }}
                  />
                </th>
                <th className="p-4">{renderSortHeader('name', 'Volunteer Identity')}</th>
                <th className="p-4">{renderSortHeader('role', `Assigned Role (${activeEvent?.name || 'Selected Event'})`)}</th>
                <th className="p-4">{renderSortHeader('station', `Assigned Station (${activeEvent?.name || 'Selected Event'})`)}</th>
                <th className="p-4 text-center">Notes</th>
                <th className="p-4">{renderSortHeader('lastContacted', 'Last Contacted')}</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4 w-12 text-center">
                      <div className="w-4 h-4 bg-[#efe9dc]/70 rounded mx-auto"></div>
                    </td>
                    <td className="p-4 space-y-2">
                      <div className="h-3.5 bg-[#efe9dc]/70 rounded w-2/3"></div>
                      <div className="h-2.5 bg-[#efe9dc]/50 rounded w-1/2"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-6 bg-[#efe9dc]/60 rounded-full w-24"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-6 bg-[#efe9dc]/60 rounded-full w-20"></div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="h-3.5 bg-[#efe9dc]/40 rounded w-8 mx-auto"></div>
                    </td>
                    <td className="p-4 space-y-1.5">
                      <div className="h-3 bg-[#efe9dc]/60 rounded w-16"></div>
                      <div className="h-2 bg-[#efe9dc]/40 rounded w-24"></div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <div className="w-7 h-7 bg-[#efe9dc]/50 rounded-lg"></div>
                        <div className="w-7 h-7 bg-[#efe9dc]/50 rounded-lg"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : volunteers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-sans italic">
                    No volunteers registered in this ministry yet.
                  </td>
                </tr>
              ) : sortedRosterVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-sans italic">
                    No registered volunteers match the current search query or role filter.
                  </td>
                </tr>
              ) : (
                sortedRosterVolunteers.map(vol => {
                  const totalEmails = vol.emails?.length || 0;
                  const lastEmail = totalEmails > 0 ? vol.emails![totalEmails - 1] : null;

                  // Get active event assignment
                  const assignment = vol.eventAssignments?.[activeEventId];
                  const hasAssignment = !!assignment;
                  const assignedEventsCount = vol.eventAssignments ? Object.keys(vol.eventAssignments).length : 0;

                  return (
                    <React.Fragment key={vol.id}>
                      <tr className="hover:bg-[#faf8f4]/40 transition-all">
                        <td className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            className="accent-[#856637] rounded cursor-pointer w-4 h-4"
                            checked={selectedVolIds.includes(vol.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVolIds([...selectedVolIds, vol.id]);
                              } else {
                                setSelectedVolIds(selectedVolIds.filter(id => id !== vol.id));
                              }
                            }}
                          />
                        </td>
                        {/* Identity & Skills */}
                        <td className="p-4 max-w-sm relative group cursor-default">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-sm font-bold text-[#1e293b]">{vol.name}</p>
                            {assignedEventsCount > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#efe5d3] text-[#5c4424] border border-[#d6c7ae]/30 shadow-xs shrink-0">
                                Assigned to {assignedEventsCount} event{assignedEventsCount !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/50 shadow-xs shrink-0">
                                Unassigned
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-450 font-mono mt-0.5">{vol.email} • {vol.phone || 'No phone'}</p>
                          {vol.skills && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-[#faf5ec] text-[#856637] border border-[#efe0c2] shadow-xs">
                                <Sparkles size={8} /> {vol.skills}
                              </span>
                            </div>
                          )}

                          {/* Hover Quick-View Tooltip */}
                          <div className="absolute z-50 left-4 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 bg-slate-800 text-white rounded-xl shadow-xl p-3 text-xs flex flex-col gap-1.5 border border-slate-700">
                            <div className="font-serif font-bold text-base text-[#f5ebd6] border-b border-slate-700 pb-1 mb-0.5">
                              {vol.name}
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Mail size={12} className="text-slate-500 shrink-0" />
                              <span className="truncate">{vol.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Phone size={12} className="text-slate-500 shrink-0" />
                              <span>{vol.phone || 'No phone provided'}</span>
                            </div>
                            {vol.skills && (
                              <div className="flex items-start gap-2 text-slate-300 mt-1 pt-1.5 border-t border-slate-700">
                                <Sparkles size={12} className="text-slate-500 mt-0.5 shrink-0" />
                                <span className="line-clamp-2 leading-tight">{vol.skills}</span>
                              </div>
                            )}
                            <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-slate-800" />
                          </div>
                        </td>

                        {/* Assigned Role */}
                        <td className="p-4">
                          {hasAssignment && assignment.role ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs font-serif ${getRoleBadgeColors(assignment.role)}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85" />
                              {assignment.role}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Assigned Station */}
                        <td className="p-4">
                          {hasAssignment && assignment.station ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-[#faf8f4] text-slate-700 border border-[#e2dcd0] shadow-xs font-serif">
                              <MapPin size={10} className="text-[#856637]" />
                              {assignment.station}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Comments & Notes Modal Trigger */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center relative group">
                            <button
                              onClick={() => handleOpenNotesModal(vol)}
                              className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer relative flex items-center justify-center ${
                                (vol.notes?.trim() || assignment?.notes?.trim())
                                  ? 'bg-amber-50/75 border-[#efe0c2] text-[#856637] hover:bg-amber-50 hover:border-[#c2aa80] hover:shadow-xs'
                                  : 'bg-white border-slate-200 hover:bg-[#faf8f4] hover:border-slate-300 text-slate-400 hover:text-slate-600'
                              }`}
                              title="View & Edit Comments/Notes"
                            >
                              <StickyNote size={15} />
                              
                              {/* Indicator badge if notes exist */}
                              {(vol.notes?.trim() || assignment?.notes?.trim()) && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-600 rounded-full border border-white animate-pulse" />
                              )}
                            </button>
                            
                            {/* Hover tooltip with notes summary */}
                            {(vol.notes?.trim() || assignment?.notes?.trim()) && (
                              <div className="absolute z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-lg pointer-events-none leading-relaxed text-left">
                                {vol.notes?.trim() && (
                                  <div className={`${assignment?.notes?.trim() ? 'mb-1.5 border-b border-slate-700 pb-1.5' : ''}`}>
                                    <p className="font-bold text-[#f5ebd6]">Private Notes:</p>
                                    <p className="line-clamp-2 text-slate-300">{vol.notes}</p>
                                  </div>
                                )}
                                {assignment?.notes?.trim() && (
                                  <div>
                                    <p className="font-bold text-[#f5ebd6]">Event Comments:</p>
                                    <p className="line-clamp-2 text-slate-300">{assignment.notes}</p>
                                  </div>
                                )}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Contact Outreach Summary */}
                        <td className="p-4">
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-slate-700 flex items-center gap-1 text-[10px]">
                              <Mail size={11} className="text-slate-400" />
                              Last Contacted
                            </p>
                            {vol.lastContacted ? (
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-mono text-slate-600 font-semibold">
                                  {vol.lastContacted}
                                </p>
                                {vol.contactNotes && (
                                  <p className="text-[9px] text-slate-500 italic truncate max-w-[150px]" title={vol.contactNotes}>
                                    "{vol.contactNotes}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[9px] text-slate-400 italic">Never contacted</p>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            {vol.email && (
                              <a
                                href={`mailto:${vol.email}?subject=${encodeURIComponent('Ministry Outreach + Volunteer Recruitment')}`}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-white hover:bg-[#faf8f4] text-slate-700 border-[#e2dcd0] shadow-sm cursor-pointer flex items-center gap-1 shrink-0"
                                title={`Compose email to ${vol.name} using your local mail client`}
                              >
                                <Send size={12} className="text-slate-500" />
                                <span>Email</span>
                              </a>
                            )}

                            <button
                              onClick={() => {
                                setExpandedRosterVolId(expandedRosterVolId === vol.id ? null : vol.id);
                              }}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition shadow-sm cursor-pointer flex items-center gap-1.5 ${
                                expandedRosterVolId === vol.id
                                  ? 'bg-amber-50 text-[#856637] border-[#efe0c2]'
                                  : 'bg-white hover:bg-[#faf8f4] text-slate-700 border-[#e2dcd0]'
                              }`}
                              title="Manage placement and outreach logger"
                            >
                              <span>Manage</span>
                              <ChevronDown
                                size={12}
                                className={`transition-transform duration-200 ${
                                  expandedRosterVolId === vol.id ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Unified Expanded Management Sub-panel */}
                      {expandedRosterVolId === vol.id && (
                        <tr className="bg-[#faf8f4]/90 border-y border-[#efe0c2]/65 shadow-inner animate-fadeIn">
                          <td colSpan={7} className="p-6">
                            <div className="space-y-6 max-w-4xl mx-auto text-left">
                              {/* Header */}
                              <div className="flex items-center justify-between border-b border-[#efe0c2] pb-3">
                                <h4 className="text-sm text-[#1e293b] font-bold font-serif flex items-center gap-1.5">
                                  <Users size={16} className="text-[#856637]" />
                                  <span>Manage Volunteer: {vol.name}</span>
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRosterVolId(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
                                  title="Close Panel"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Section: Event Placement Assignment */}
                                <div className="space-y-4 bg-white p-4 rounded-xl border border-[#efe0c2]/60 shadow-xs flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs text-[#1e293b] font-bold">
                                      <Bookmark size={14} className="text-[#856637]" />
                                      <span>Event Placement Assignment: "{activeEvent?.name}"</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-normal mt-1">
                                      Map this volunteer to a unique Assigned Role and Station location for this specific event.
                                    </p>

                                    {/* Active assignments summary */}
                                    <div className="mt-3">
                                      {hasAssignment ? (
                                        <div className="bg-[#faf8f4] p-3 rounded-lg border border-[#e2dcd0] flex items-center justify-between gap-3 shadow-xs">
                                          <div className="flex flex-wrap items-center gap-4">
                                            <div className="space-y-0.5">
                                              <p className="text-[9px] font-bold uppercase text-slate-450">Active Role</p>
                                              <p className="text-xs font-serif font-black text-slate-800">{assignment.role || 'General Helper'}</p>
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[9px] font-bold uppercase text-slate-450">Active Station</p>
                                              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                                <MapPin size={10} className="text-[#856637]" />
                                                {assignment.station || 'General Area'}
                                              </p>
                                            </div>
                                            {assignment.notes && (
                                              <div className="space-y-0.5 min-w-[120px] max-w-xs">
                                                <p className="text-[9px] font-bold uppercase text-slate-450">Operational Comments</p>
                                                <p className="text-xs italic text-[#856637] font-serif break-words">"{assignment.notes}"</p>
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleClearAssignment(vol.id)}
                                            className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded border border-rose-200 cursor-pointer transition shrink-0"
                                          >
                                            Clear Placement
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-[10px] italic text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-dashed border-slate-200">
                                          Currently unassigned for this event.
                                        </p>
                                      )}
                                    </div>

                                    {/* Role mapping creator */}
                                    <div className="space-y-3 pt-3 mt-3 border-t border-slate-100">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Role Assignment</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Front Gate Greeter"
                                            value={newRoleName}
                                            onChange={e => setNewRoleName(e.target.value)}
                                            className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Station / Location Assignment</label>
                                          <input
                                            type="text"
                                            placeholder="e.g. Main Lobby Desk, Gate 2"
                                            value={newStationName}
                                            onChange={e => setNewStationName(e.target.value)}
                                            className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Temporary Operational Comments / Notes</label>
                                        <textarea
                                          placeholder="e.g. Arriving early, needs high chair, leaves by 3 PM..."
                                          rows={2}
                                          value={newEventNotes}
                                          onChange={e => setNewEventNotes(e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-4">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignRoleStation(vol.id)}
                                      className="px-4 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1"
                                    >
                                      <Check size={12} />
                                      <span>Save Placement</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Right Section: Outreach Contact Record */}
                                <div className="space-y-4 bg-white p-4 rounded-xl border border-[#efe0c2]/60 shadow-xs flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center gap-1.5 text-xs text-[#1e293b] font-bold">
                                      <Mail size={14} className="text-[#856637]" />
                                      <span>Outreach Contact Record for {vol.name}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-normal mt-1">
                                      Log communication history and details of contact made with this volunteer.
                                    </p>

                                    <div className="space-y-3 mt-3">
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                                          Last Contacted Date
                                        </label>
                                        <input
                                          type="date"
                                          value={rowLastContacted}
                                          onChange={e => setRowLastContacted(e.target.value)}
                                          className="text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold text-slate-800"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                                          Contact Notes
                                        </label>
                                        <textarea
                                          value={rowContactNotes}
                                          rows={4}
                                          onChange={e => setRowContactNotes(e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                          placeholder="Summary of communications, emails sent, phone call response, or scheduling alignment..."
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-4">
                                    {vol.email && (
                                      <a
                                        href={`mailto:${vol.email}?subject=${encodeURIComponent('Ministry Outreach + Volunteer Recruitment')}`}
                                        className="py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-[#e2dcd0] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                        title="Open local email composer"
                                      >
                                        <Send size={12} className="text-slate-500" />
                                        <span>Open Composer</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRowOutreach(vol.id)}
                                      className="py-1.5 px-4 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                      <Check size={12} />
                                      <span>Save Outreach</span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Footer action row: Remove and Close */}
                              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#efe0c2] gap-3">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const confirm = await confirmAction(
                                      "Remove from Event Roster",
                                      `Are you sure you want to remove ${vol.name} from the roster for this event? This will not delete them from the volunteer directory.`
                                    );
                                    if (confirm) {
                                      await handleClearAssignment(vol.id);
                                      showNotification(`Removed ${vol.name} from event roster`, 'success');
                                      setExpandedRosterVolId(null);
                                    }
                                  }}
                                  className="text-xs font-semibold py-2 px-4 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 transition shadow-sm cursor-pointer flex items-center gap-1.5 w-full sm:w-auto justify-center"
                                  title="Remove from Event Roster"
                                >
                                  <X size={14} aria-hidden="true" />
                                  <span>Remove from event roster</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setExpandedRosterVolId(null)}
                                  className="py-2 px-5 bg-white hover:bg-slate-50 text-slate-600 border border-[#e2dcd0] text-xs font-bold rounded-lg transition cursor-pointer w-full sm:w-auto text-center"
                                >
                                  Close Management Panel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        )
      ) : (
        /* Redesigned High-Density Master-Detail Volunteer Directory View */
        <div className="space-y-5 animate-fadeIn">
          {/* Alphabetical quick filter jumps */}
          <div className="bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                <Filter size={11} /> Alphabetical Quick Filter (A-Z)
              </span>
              {selectedLetter && (
                <button 
                  onClick={() => setSelectedLetter(null)}
                  className="text-[10px] font-bold text-[#856637] hover:underline cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              <button
                onClick={() => setSelectedLetter(null)}
                className={`px-2.5 py-1 text-[10px] font-bold tracking-tight rounded-md border transition-all cursor-pointer ${
                  selectedLetter === null
                    ? 'bg-[#856637] text-white border-transparent'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                All ({volunteers.length})
              </button>
              
              {alphabet.map(letter => {
                const count = letterCounts[letter] || 0;
                const hasCount = count > 0;
                return (
                  <button
                    key={letter}
                    disabled={!hasCount}
                    onClick={() => setSelectedLetter(letter)}
                    className={`relative px-2 py-1 text-[10px] font-bold rounded-md border transition-all flex items-center gap-0.5 ${
                      selectedLetter === letter
                        ? 'bg-[#856637] text-white border-transparent z-10 shadow-xs'
                        : hasCount
                          ? 'bg-white hover:bg-[#faf6ee] border-slate-200 text-slate-800 cursor-pointer'
                          : 'bg-slate-50/50 border-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                    title={`${count} volunteer${count === 1 ? '' : 's'} start with ${letter}`}
                  >
                    <span>{letter}</span>
                    {hasCount && (
                      <span className={`text-[8px] font-semibold px-1 rounded-full ${
                        selectedLetter === letter ? 'bg-[#9d7d4f] text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

                    <div className="bg-white border border-[#e2dcd0] rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 overflow-hidden">
            <div className="p-4 bg-[#faf8f4] border-b border-[#e2dcd0] flex justify-between items-center flex-wrap gap-3">
              <div>
                <h3 className="font-serif font-black text-[#1e293b] text-base leading-snug flex items-center gap-2">
                  <Users size={18} className="text-[#856637]" /> Volunteer Registry Directory
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Global roster of every volunteer &mdash; skills and lifetime engagement across all events. Click "Manage" to configure a specific event placement.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden md:block">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search global registry..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48 text-xs pl-8 pr-7 py-1.5 rounded-lg border border-[#e2dcd0] bg-white focus:outline-none focus:ring-1 focus:ring-[#856637] text-slate-800 placeholder-slate-400"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#faf5ec] text-[#856637] border border-[#efe0c2] px-2.5 py-1 rounded-lg shadow-xs">
                  {sortedDirectoryVolunteers.length} Active Profiles
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf8f4]/50 border-b border-[#e2dcd0] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[180px]">
                      {renderSortHeader('name', 'Volunteer')}
                    </th>
                    <th className="py-2.5 px-3 min-w-[200px]">Ministry / Skills / Small Group</th>
                    <th className="py-2.5 px-3 min-w-[120px]">
                      {renderSortHeader('engagement', 'Engagement')}
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px]">
                      {renderSortHeader('lastContacted', 'Last Contacted')}
                    </th>
                    <th className="py-2.5 px-3 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dcd0] text-xs text-slate-750 bg-white">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3 px-3 w-12 text-center">
                          <div className="w-5 h-4 bg-[#efe9dc]/70 rounded mx-auto"></div>
                        </td>
                        <td className="py-3 px-3 space-y-2">
                          <div className="h-3.5 bg-[#efe9dc]/70 rounded w-2/3"></div>
                          <div className="h-2.5 bg-[#efe9dc]/50 rounded w-1/2"></div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-6 bg-[#efe9dc]/60 rounded-full w-24"></div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-6 bg-[#efe9dc]/60 rounded-full w-20"></div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-6 bg-[#efe9dc]/50 rounded-full w-24"></div>
                        </td>
                        <td className="py-3 px-3 space-y-1.5">
                          <div className="h-3 bg-[#efe9dc]/60 rounded w-16"></div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <div className="w-7 h-7 bg-[#efe9dc]/50 rounded-lg"></div>
                            <div className="w-7 h-7 bg-[#efe9dc]/50 rounded-lg"></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : sortedDirectoryVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-450 italic text-xs">
                        No volunteers match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedDirectoryVolunteers.map((vol, index) => {
                      const isExpanded = selectedVolId === vol.id;
                      const assignment = vol.eventAssignments?.[activeEventId];
                      const status = assignment?.contactStatus || 'Not Contacted';
                      const hasSkills = vol.skills && vol.skills.trim() !== '';
                      const hasNotes = vol.notes && vol.notes.trim() !== '';
                      const assignedEventsCount = vol.eventAssignments ? Object.keys(vol.eventAssignments).length : 0;

                      return (
                        <React.Fragment key={vol.id}>
                          {/* Main Row */}
                          <tr className={`hover:bg-[#faf6ee]/40 transition text-xs ${isExpanded ? 'bg-[#faf6ee]/20 border-l-2 border-l-[#856637]' : ''}`}>
                            {/* Index */}
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">
                              {index + 1}
                            </td>

                            {/* Volunteer Identity */}
                            <td className="py-2.5 px-3 relative group cursor-default">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-serif font-black text-[10px] shrink-0 shadow-xs ${getAvatarColor(vol.name)}`}>
                                  {getInitials(vol.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-serif font-bold text-[#1e293b] leading-snug flex flex-wrap items-center gap-1.5">
                                    <span className="truncate max-w-[120px]" title={vol.name}>{vol.name}</span>
                                    {hasSkills && (
                                      <span title={`Skills: ${vol.skills}`}>
                                        <Sparkles size={10} className="text-[#856637]" />
                                      </span>
                                    )}
                                    {hasNotes && (
                                      <span title={`Notes: ${vol.notes}`}>
                                        <StickyNote size={10} className="text-slate-400" />
                                      </span>
                                    )}
                                    {assignedEventsCount > 0 ? (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-[#efe5d3] text-[#5c4424] border border-[#d6c7ae]/30 shadow-xs shrink-0" title={`Assigned to ${assignedEventsCount} events`}>
                                        {assignedEventsCount} event{assignedEventsCount !== 1 ? 's' : ''}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/50 shadow-xs shrink-0">
                                        Unassigned
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-450 truncate flex items-center gap-1.5">
                                    <span className="truncate">{vol.email}</span>
                                    {vol.phone && (
                                      <>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-mono text-slate-400">{vol.phone}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Hover Quick-View Tooltip */}
                              <div className="absolute z-50 left-6 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-64 bg-slate-800 text-white rounded-xl shadow-xl p-3 text-xs flex flex-col gap-1.5 border border-slate-700">
                                <div className="font-serif font-bold text-base text-[#f5ebd6] border-b border-slate-700 pb-1 mb-0.5">
                                  {vol.name}
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                  <Mail size={12} className="text-slate-500 shrink-0" />
                                  <span className="truncate">{vol.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                  <Phone size={12} className="text-slate-500 shrink-0" />
                                  <span>{vol.phone || 'No phone provided'}</span>
                                </div>
                                {vol.skills && (
                                  <div className="flex items-start gap-2 text-slate-300 mt-1 pt-1.5 border-t border-slate-700">
                                    <Sparkles size={12} className="text-slate-500 mt-0.5 shrink-0" />
                                    <span className="line-clamp-2 leading-tight">{vol.skills}</span>
                                  </div>
                                )}
                                <div className="absolute top-full left-4 -mt-[1px] border-4 border-transparent border-t-slate-800" />
                              </div>
                            </td>

                            {/* Skills / Interests */}
                            <td className="py-2.5 px-3">
                              {vol.ministry && vol.ministry.trim() !== '' && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {vol.ministry.split(',').map(m => m.trim()).filter(Boolean).map((grp, gIdx) => (
                                    <span
                                      key={gIdx}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f3ead6] text-[#856637] border border-[#e6d3a8]"
                                    >
                                      {grp}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {vol.skills && vol.skills.trim() !== '' ? (
                                <div className="flex flex-wrap gap-1 max-w-[240px]">
                                  {vol.skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#eef3f8] text-[#3f5b7a] border border-[#d4e2f0]"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-medium">No skills listed</span>
                              )}
                            </td>

                            {/* Engagement — lifetime events served */}
                            <td className="py-2.5 px-3">
                              {assignedEventsCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5c4424]">
                                  <span className="font-mono font-bold">{assignedEventsCount}</span>
                                  <span className="text-slate-500">event{assignedEventsCount === 1 ? '' : 's'}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">—</span>
                              )}
                            </td>

                            {/* Contact Outreach Last Date & Notes */}
                            <td className="py-2.5 px-3">
                              {vol.lastContacted ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 font-bold text-[10px] font-mono text-slate-750">
                                    <Mail size={11} className="text-slate-400 shrink-0" />
                                    <span>{vol.lastContacted}</span>
                                  </div>
                                  {vol.contactNotes && (
                                    <p className="text-[9px] text-slate-400 italic truncate max-w-[120px]" title={vol.contactNotes}>
                                      "{vol.contactNotes}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Never contacted</span>
                              )}
                            </td>

                            {/* Actions column */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {vol.email && (
                                  <a
                                    href={`mailto:${vol.email}?subject=${encodeURIComponent('Ministry Outreach + Volunteer Recruitment')}`}
                                    className="px-2 py-1 text-[10px] font-bold rounded border bg-white hover:bg-[#faf6ee]/30 border-slate-200 text-slate-700 cursor-pointer flex items-center gap-0.5 shrink-0"
                                    title={`Compose email to ${vol.name} using your local mail client`}
                                  >
                                    <Send size={11} className="text-slate-500" />
                                    <span>Email</span>
                                  </a>
                                )}
                                <button
                                  onClick={() => setSelectedVolId(selectedVolId === vol.id ? null : vol.id)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded border transition-all cursor-pointer flex items-center gap-0.5 ${
                                    isExpanded
                                      ? 'bg-[#faf6ee] text-[#856637] border-[#efe0c2] shadow-xs'
                                      : 'bg-white hover:bg-[#faf6ee]/30 border-slate-200 text-slate-700'
                                  }`}
                                  title="Manage Assignments & Communication Outreach"
                                >
                                  <span>{isExpanded ? 'Collapse' : 'Manage'}</span>
                                  <ChevronRight size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                <button
                                  onClick={async () => {
                                    await onRemoveVolunteer(vol.id);
                                    if (selectedVolId === vol.id) {
                                      setSelectedVolId(null);
                                    }
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition border border-transparent cursor-pointer"
                                  title="Remove Volunteer"
                                  aria-label="Remove Volunteer"
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Workspace Sub-Row */}
                          {isExpanded && (
                            <tr className="bg-[#faf8f4]/30">
                              <td colSpan={6} className="p-6 border-l-2 border-l-[#856637] bg-slate-50/10">
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.15 }}
                                  className="max-w-2xl mx-auto bg-white border border-[#e2dcd0] rounded-2xl shadow-sm overflow-hidden"
                                >
                                  <div className="p-6 space-y-6">
                                    {/* 1. Header Row */}
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-[#faf5ec] text-[#856637] font-bold border border-[#efe0c2] flex items-center justify-center font-serif text-base shrink-0">
                                          {getInitials(vol.name)}
                                        </div>
                                        <div className="min-w-0">
                                          <h3 className="text-base font-bold text-slate-800 font-serif leading-tight">
                                            {vol.name}
                                          </h3>
                                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            {assignedEventsCount > 0 ? `Assigned to ${assignedEventsCount} event${assignedEventsCount === 1 ? '' : 's'}` : 'Unassigned'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        <select
                                          value={status}
                                          onChange={(e) => handleUpdateContactStatus(vol.id, e.target.value)}
                                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none shadow-xs transition ${
                                            status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70' :
                                            status === 'Declined' ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70' :
                                            status === 'Awaiting Reply' ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70' :
                                            status === 'Contacted' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/70' :
                                            'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100/70'
                                          }`}
                                        >
                                          <option value="Not Contacted">⚪ Not Contacted</option>
                                          <option value="Contacted">🔵 Contacted</option>
                                          <option value="Awaiting Reply">🟡 Awaiting Reply</option>
                                          <option value="Confirmed">🟢 Confirmed</option>
                                          <option value="Declined">🔴 Declined</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* 2. Action Row */}
                                    <div className={`grid gap-3 ${vol.phone ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                      <a
                                        href={`mailto:${vol.email}`}
                                        className="py-2 px-4 bg-white hover:bg-slate-50 text-slate-705 text-xs font-bold rounded-xl border border-[#e2dcd0] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                      >
                                        <Mail size={13} className="text-[#856637]" />
                                        <span>Email</span>
                                      </a>
                                      {vol.phone && (
                                        <a
                                          href={`tel:${vol.phone}`}
                                          className="py-2 px-4 bg-white hover:bg-slate-50 text-slate-705 text-xs font-bold rounded-xl border border-[#e2dcd0] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                        >
                                          <Phone size={13} className="text-[#856637]" />
                                          <span>Call</span>
                                        </a>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                                        className={`py-2 px-4 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                          isEditingProfile
                                            ? 'bg-[#faf6ee] text-[#856637] border-[#efe0c2]'
                                            : 'bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] border-transparent'
                                        }`}
                                      >
                                        <Edit2 size={13} />
                                        <span>{isEditingProfile ? 'Cancel Edit' : 'Edit'}</span>
                                      </button>
                                    </div>

                                    {/* 3. Contact Details Block & Profile Inline Edit Form */}
                                    {isEditingProfile ? (
                                      <div className="space-y-4 border-t border-slate-100 pt-5 animate-fadeIn">
                                        <div>
                                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Full Name</label>
                                          <input
                                            type="text"
                                            value={editProfile.name}
                                            onChange={e => dispatchEditProfile({ type: 'setField', field: 'name', value: e.target.value })}
                                            className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                          />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email</label>
                                            <input
                                              type="email"
                                              value={editProfile.email}
                                              onChange={e => dispatchEditProfile({ type: 'setField', field: 'email', value: e.target.value })}
                                              className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Phone Number</label>
                                            <input
                                              type="text"
                                              value={editProfile.phone}
                                              onChange={e => dispatchEditProfile({ type: 'setField', field: 'phone', value: e.target.value })}
                                              className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-3 border-t border-slate-100 pt-5 text-xs">
                                        <div className="flex justify-between items-center">
                                          <span className="text-slate-400 font-medium">Email Address</span>
                                          <a href={`mailto:${vol.email}`} className="text-[#856637] font-semibold hover:underline font-mono">
                                            {vol.email}
                                          </a>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-slate-400 font-medium">Phone Number</span>
                                          {vol.phone ? (
                                            <span className="text-slate-705 font-mono font-bold">{vol.phone}</span>
                                          ) : (
                                            <span className="text-slate-400 italic">No phone listed</span>
                                          )}
                                        </div>

                                        {/* Keep Private Operational Notes functionality here */}
                                        <div className="pt-2 border-t border-slate-50">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="text-slate-400 font-medium">Private Notes</span>
                                            <button
                                              type="button"
                                              onClick={() => setIsEditingPrivateNotes(!isEditingPrivateNotes)}
                                              className="text-[10px] text-[#856637] font-semibold hover:underline bg-transparent border-0 cursor-pointer"
                                            >
                                              {isEditingPrivateNotes ? 'Cancel' : 'Edit'}
                                            </button>
                                          </div>
                                          {isEditingPrivateNotes ? (
                                            <div className="space-y-2 animate-fadeIn">
                                              <textarea
                                                value={detailForm.privateNotes}
                                                rows={2}
                                                onChange={e => dispatchDetailForm({ type: 'setField', field: 'privateNotes', value: e.target.value })}
                                                className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                                placeholder="Internal availability, private flags..."
                                              />
                                            </div>
                                          ) : (
                                            <p className="text-xs text-slate-600 italic">
                                              {vol.notes?.trim() ? `"${vol.notes}"` : 'No private notes logged.'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* 4. Roles */}
                                    <div className="space-y-1.5 border-t border-slate-100 pt-5">
                                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Roles</span>
                                      {(() => {
                                        const volunteerRoles = vol.roles && vol.roles.length > 0
                                          ? vol.roles
                                          : Array.from(new Set(
                                              (Object.values(vol.eventAssignments || {}) as any[])
                                                .map(assignment => assignment.role)
                                                .filter((r): r is string => !!r && r.trim() !== '')
                                            ));

                                        return volunteerRoles.length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5">
                                            {volunteerRoles.map((role, rIdx) => (
                                              <span
                                                key={rIdx}
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${getRoleBadgeColors(role)}`}
                                              >
                                                {role}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-slate-400 italic">No registered roles</p>
                                        );
                                      })()}
                                    </div>

                                    {/* 4b. Ministry */}
                                    <div className="space-y-1.5 border-t border-slate-100 pt-5">
                                      {isEditingProfile ? (
                                        <div className="space-y-2">
                                          <label className="block text-[10px] font-bold uppercase text-slate-400">Ministry &amp; Small Group</label>
                                          <input
                                            type="text"
                                            value={editProfile.ministry}
                                            onChange={e => dispatchEditProfile({ type: 'setField', field: 'ministry', value: e.target.value })}
                                            className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            placeholder="e.g. Worship, Children's, Hospitality, Outreach"
                                          />
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Ministry &amp; Small Group</span>
                                          {vol.ministry && vol.ministry.split(',').map(m => m.trim()).filter(Boolean).length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {vol.ministry.split(',').map(m => m.trim()).filter(Boolean).map((grp, gIdx) => (
                                                <span
                                                  key={gIdx}
                                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#efe0c2] bg-amber-50/40 text-[#856637] shadow-xs"
                                                >
                                                  {grp}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-slate-400 italic">No ministry assigned</p>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {/* 5. Skills */}
                                    <div className="space-y-1.5 border-t border-slate-100 pt-5">
                                      {isEditingProfile ? (
                                        <div className="space-y-2">
                                          <label className="block text-[10px] font-bold uppercase text-slate-400">Skills Tagging (comma-separated)</label>
                                          <input
                                            type="text"
                                            value={editProfile.skills}
                                            onChange={e => dispatchEditProfile({ type: 'setField', field: 'skills', value: e.target.value })}
                                            className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            placeholder="e.g. Cooking, AV Stage, Welcoming"
                                          />
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Skills</span>
                                          {vol.skills && vol.skills.split(',').map(s => s.trim()).filter(s => s !== '').length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {vol.skills.split(',').map(s => s.trim()).filter(s => s !== '').map((skill, sIdx) => (
                                                <span
                                                  key={sIdx}
                                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-[#d4e2f0] text-[#3f5b7a] bg-[#eef3f8] shadow-xs"
                                                >
                                                  {skill}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-slate-400 italic">No custom skills listed</p>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {/* 6. Current-event assignment block (tinted) */}
                                    <div className="bg-amber-50/20 border border-[#efe0c2]/50 rounded-2xl p-4 space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase text-[#856637]">
                                          {vol.eventAssignments?.[activeEventId] ? `This Event · ${activeEvent?.name || 'Selected Event'}` : 'Current Event'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setIsEditingPlacement(!isEditingPlacement)}
                                          className="text-[10px] font-bold text-[#856637] hover:underline cursor-pointer bg-transparent border-0"
                                        >
                                          {isEditingPlacement ? 'Cancel' : (vol.eventAssignments?.[activeEventId] ? 'Edit Placement' : 'Assign Role')}
                                        </button>
                                      </div>

                                      {isEditingPlacement ? (
                                        <div className="space-y-3 pt-1 animate-fadeIn">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Assigned Role</label>
                                              <input
                                                type="text"
                                                value={detailForm.role}
                                                onChange={e => dispatchDetailForm({ type: 'setField', field: 'role', value: e.target.value })}
                                                placeholder="e.g. Lead Host, Greeter"
                                                className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Station / Spot</label>
                                              <input
                                                type="text"
                                                value={detailForm.station}
                                                onChange={e => dispatchDetailForm({ type: 'setField', field: 'station', value: e.target.value })}
                                                placeholder="e.g. Main Lobby Stage"
                                                className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">Placement Notes & Comments</label>
                                            <textarea
                                              value={detailForm.notes}
                                              rows={2}
                                              onChange={e => dispatchDetailForm({ type: 'setField', field: 'notes', value: e.target.value })}
                                              placeholder="Specific timing details or accommodations..."
                                              className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none"
                                            />
                                          </div>
                                          <div className="flex justify-between items-center pt-2 border-t border-[#efe0c2]/40">
                                            {vol.eventAssignments?.[activeEventId] ? (
                                              <button
                                                type="button"
                                                onClick={handleClearPlacementDirect}
                                                className="px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg transition cursor-pointer"
                                              >
                                                Clear Assignment
                                              </button>
                                            ) : <div />}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-xs">
                                          {vol.eventAssignments?.[activeEventId] ? (
                                            <div className="space-y-2">
                                              <div className="flex flex-wrap gap-4 items-center">
                                                <div className="space-y-0.5">
                                                  <p className="text-[9px] font-bold uppercase text-slate-400">Assigned Role</p>
                                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${getRoleBadgeColors(vol.eventAssignments[activeEventId].role)}`}>
                                                    {vol.eventAssignments[activeEventId].role}
                                                  </span>
                                                </div>
                                                <div className="space-y-0.5">
                                                  <p className="text-[9px] font-bold uppercase text-slate-400">Station</p>
                                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-705 border border-[#e2dcd0] shadow-xs">
                                                    <MapPin size={10} className="text-[#856637]" />
                                                    {vol.eventAssignments[activeEventId].station || 'General Area'}
                                                  </span>
                                                </div>
                                              </div>
                                              {vol.eventAssignments[activeEventId].notes && (
                                                <div className="bg-white/60 border border-[#efe0c2]/40 p-2 rounded-xl">
                                                  <p className="text-[9px] font-bold uppercase text-slate-400 font-medium">Placement Notes</p>
                                                  <p className="text-[11px] text-slate-650 italic mt-0.5 font-serif font-medium">"{vol.eventAssignments[activeEventId].notes}"</p>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="border border-dashed border-[#e2dcd0] rounded-xl p-3 text-center bg-white/50">
                                              <p className="text-[10px] text-slate-400 italic font-medium">Not assigned to this event.</p>
                                              <button
                                                type="button"
                                                onClick={() => setIsEditingPlacement(true)}
                                                className="mt-1 text-[9px] font-bold text-[#856637] hover:underline cursor-pointer bg-transparent border-0 font-medium"
                                              >
                                                Assign role &amp; station map →
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* 7. Contact Tracking Footer */}
                                    <div className="border-t border-slate-100 pt-5 space-y-4">
                                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                                        <Mail size={12} className="text-slate-400" /> Contact Outreach History
                                      </h4>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                                            Last Contacted Date
                                          </label>
                                          <input
                                            type="date"
                                            value={detailForm.lastContacted}
                                            onChange={e => dispatchDetailForm({ type: 'setField', field: 'lastContacted', value: e.target.value })}
                                            className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium text-slate-800"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                                            Contact Outreach Notes
                                          </label>
                                          <textarea
                                            value={detailForm.contactNotes}
                                            rows={3}
                                            onChange={e => dispatchDetailForm({ type: 'setField', field: 'contactNotes', value: e.target.value })}
                                            className="w-full text-xs p-2 rounded-xl border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            placeholder="Write summary of email conversations, direct contact details, or notes..."
                                          />
                                        </div>
                                      </div>

                                      {/* Unified Save Changes Button */}
                                      {hasUnsavedChanges && (
                                        <div className="pt-4 border-t border-amber-200/50 flex justify-end animate-fadeIn">
                                          <button
                                            type="button"
                                            onClick={handleSaveChanges}
                                            className="py-2.5 px-6 bg-[#856637] hover:bg-[#6c522c] text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-md flex items-center gap-1.5 uppercase tracking-wider"
                                          >
                                            <Check size={14} />
                                            <span>Save Changes</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Comments & Notes Modal Window */}
      {notesModalVolId && (
        (() => {
          const vol = volunteers.find(v => v.id === notesModalVolId);
          if (!vol) return null;
          const assignment = vol.eventAssignments?.[activeEventId];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
              <div 
                className="fixed inset-0" 
                onClick={() => setNotesModalVolId(null)} 
              />
              <div 
                ref={notesModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="notes-modal-title"
                className="bg-white rounded-2xl border border-[#efe0c2] w-full max-w-lg shadow-2xl overflow-hidden relative z-10 animate-scaleIn"
              >
                
                {/* Header */}
                <div className="bg-[#faf8f4] border-b border-[#e2dcd0] px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[#856637]">
                      <StickyNote size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 id="notes-modal-title" className="font-serif font-black text-[#1e293b] text-base">Operational Comments &amp; Notes</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Volunteer profile: <span className="font-bold text-slate-700">{vol.name}</span></p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotesModalVolId(null)}
                    aria-label="Close notes modal"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-slate-700 transition cursor-pointer"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {/* Field 1: Private Operational Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">
                      Private Operational Notes (General Profile)
                    </label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Persistent internal notes about skills, experience, scheduling constraints, or administrative flags.
                    </p>
                    <textarea
                      value={modalGeneralNotes}
                      onChange={e => setModalGeneralNotes(e.target.value)}
                      placeholder="e.g. Needs first-aid kit nearby, prefers morning shifts, highly experienced..."
                      rows={3}
                      className="w-full text-xs p-3 rounded-xl border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium leading-relaxed"
                    />
                  </div>

                  {/* Field 2: Event Placement Comments */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450">
                        Event Comments ({activeEvent?.name || 'Selected Event'})
                      </label>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#856637] bg-amber-50 px-1.5 py-0.5 border border-amber-200 rounded">
                        {assignment ? `${assignment.role || 'General Helper'} • ${assignment.station || 'General Area'}` : 'Unassigned'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Specific operational updates, temporary requirements, or notes relevant only to this event.
                    </p>
                    <textarea
                      value={modalEventNotes}
                      onChange={e => setModalEventNotes(e.target.value)}
                      placeholder={assignment ? "e.g. Arriving 30 mins late, coordinates washing bay 1..." : "Assign a role/station first to save event-specific comments, or type here to auto-initialize mapping."}
                      rows={3}
                      className="w-full text-xs p-3 rounded-xl border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium leading-relaxed"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-[#faf8f4] border-t border-[#e2dcd0] px-6 py-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNotesModalVolId(null)}
                    className="px-4 py-2 border border-[#e2dcd0] hover:bg-white text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    {savingNotes ? 'Saving...' : 'Save Comments'}
                  </button>
                </div>

              </div>
            </div>
          );
        })()
      )}

      {/* Add Existing Volunteers to Event Modal */}
      {showAddExistingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowAddExistingModal(false)} 
          />
          <div 
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl border border-[#efe0c2] w-full max-w-lg shadow-2xl overflow-hidden relative z-10 animate-scaleIn flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="bg-[#faf8f4] border-b border-[#e2dcd0] px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[#856637]">
                  <UserPlus size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-serif font-black text-[#1e293b] text-base">Add Volunteers to Event</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Select volunteers to add to <span className="font-bold text-slate-700">{activeEvent?.name}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowAddExistingModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-[#e2dcd0] bg-[#faf8f4]/50 shrink-0">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search size={14} className="text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="Search by volunteer name..."
                  value={pickerSearchTerm}
                  onChange={(e) => setPickerSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2 rounded-lg border border-[#e2dcd0] bg-white focus:outline-none focus:ring-1 focus:ring-[#856637] text-slate-800 placeholder-slate-400"
                />
                {pickerSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setPickerSearchTerm('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Volunteers List */}
            <div className="p-6 overflow-y-auto space-y-2 flex-1 min-h-0">
              {filteredPickerVolunteers.length === 0 ? (
                <p className="text-xs text-slate-450 italic text-center py-8">
                  {pickerSearchTerm ? "No matching volunteers found." : "All registered volunteers are already rostered on this event."}
                </p>
              ) : (
                filteredPickerVolunteers.map(vol => {
                  const isChecked = pickerSelectedIds.includes(vol.id);
                  return (
                    <label 
                      key={vol.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:bg-[#faf8f4]/50 ${
                        isChecked ? 'border-[#856637] bg-[#faf8f4]/30' : 'border-[#e2dcd0] bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPickerSelectedIds([...pickerSelectedIds, vol.id]);
                          } else {
                            setPickerSelectedIds(pickerSelectedIds.filter(id => id !== vol.id));
                          }
                        }}
                        className="accent-[#856637] rounded cursor-pointer w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{vol.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{vol.email}</p>
                        {vol.skills && (
                          <p className="text-[9px] text-[#856637] font-mono mt-0.5 truncate">Skills: {vol.skills}</p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#faf8f4] border-t border-[#e2dcd0] px-6 py-4 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono font-bold text-slate-500">
                {pickerSelectedIds.length} Selected
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddExistingModal(false)}
                  className="px-4 py-2 border border-[#e2dcd0] hover:bg-white text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedVolunteers}
                  disabled={pickerSelectedIds.length === 0 || pickerSubmitting}
                  className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pickerSubmitting ? 'Adding...' : 'Add Selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmState?.isOpen || false}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={() => confirmState?.resolve(true)}
        onCancel={() => confirmState?.resolve(false)}
      />

    </div>
  );
}

export default React.memo(VolunteerTable);
