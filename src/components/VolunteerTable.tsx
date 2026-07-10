import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../lib/useFocusTrap';
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
  Edit2,
  Check,
  Plus,
  Info,
  Filter,
  Search,
  ArrowRight
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

interface VolunteerTableProps {
  volunteers: Volunteer[];
  events: MinistryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onUpdateVolunteer: (id: string, updatedData: Partial<Volunteer>) => Promise<void>;
  onCreateVolunteer: (volunteerData: Omit<Volunteer, 'id'>) => Promise<void>;
  onRemoveVolunteer: (id: string) => Promise<void>;
}

function VolunteerTable({
  volunteers,
  events,
  selectedEventId,
  onSelectEvent,
  onUpdateVolunteer,
  onCreateVolunteer,
  onRemoveVolunteer
}: VolunteerTableProps) {
  // View mode state: roster mapping vs compact directory
  const [viewMode, setViewMode] = useState<'roster' | 'directory'>('roster');

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Role & Station mapping state
  const [editingRolesVolId, setEditingRolesVolId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');

  // Email communication tracker state
  const [editingEmailsVolId, setEditingEmailsVolId] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState('Ministry Outreach + Volunteer Recruitment');
  const [customSubject, setCustomSubject] = useState('');
  const [useCustomSubject, setUseCustomSubject] = useState(false);
  const [emailSender, setEmailSender] = useState('Joy P.');
  const [emailStatus, setEmailStatus] = useState<'Sent' | 'Delivered' | 'Opened' | 'Failed'>('Sent');
  const [emailDateTime, setEmailDateTime] = useState('2026-07-07 19:32');

  const [modalGeneralNotes, setModalGeneralNotes] = useState('');
  const [modalEventNotes, setModalEventNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Bulk Selection & Editing state
  const [selectedVolIds, setSelectedVolIds] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState('');
  const [bulkStation, setBulkStation] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  // --- REDESIGNED HIGH-DENSITY DIRECTORY STATE & HELPERS ---
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [selectedVolId, setSelectedVolId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | 'station' | 'contactStatus' | 'emailsCount'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Profile Inline Editor State
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSkills, setEditSkills] = useState('');

  // Placement Editor State (within Detail Panel)
  const [isEditingPlacement, setIsEditingPlacement] = useState<boolean>(false);
  const [detailRole, setDetailRole] = useState('');
  const [detailStation, setDetailStation] = useState('');
  const [detailNotes, setDetailNotes] = useState('');

  // Private Notes (within Detail Panel)
  const [isEditingPrivateNotes, setIsEditingPrivateNotes] = useState<boolean>(false);
  const [detailPrivateNotes, setDetailPrivateNotes] = useState('');

  // Email outbound logging form states (for Detail Panel)
  const [detailEmailSubject, setDetailEmailSubject] = useState('Ministry Outreach + Volunteer Recruitment');
  const [detailCustomSubject, setDetailCustomSubject] = useState('');
  const [detailUseCustomSubject, setDetailUseCustomSubject] = useState(false);
  const [detailEmailSender, setDetailEmailSender] = useState('Joy P.');
  const [detailEmailStatus, setDetailEmailStatus] = useState<'Sent' | 'Delivered' | 'Opened' | 'Failed'>('Sent');
  const [detailEmailDateTime, setDetailEmailDateTime] = useState('2026-07-08 10:00');

  const activeEventId = selectedEventId || (events[0]?.id || '');

  const handleSaveProfile = async () => {
    if (!selectedVol) return;
    try {
      await onUpdateVolunteer(selectedVol.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        skills: editSkills.trim()
      });
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Failed to update volunteer profile:', err);
    }
  };

  const handleSavePlacement = async () => {
    if (!selectedVol || !activeEventId) return;
    try {
      const currentAssignments = selectedVol.eventAssignments || {};
      const updatedAssignments = {
        ...currentAssignments,
        [activeEventId]: {
          role: detailRole.trim() || 'General Helper',
          station: detailStation.trim() || 'General Area',
          notes: detailNotes.trim()
        }
      };
      await onUpdateVolunteer(selectedVol.id, { eventAssignments: updatedAssignments });
      setIsEditingPlacement(false);
    } catch (err) {
      console.error('Failed to update placement:', err);
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
      await onUpdateVolunteer(vol.id, { eventAssignments: updatedAssignments });
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
      setDetailRole('');
      setDetailStation('');
      setDetailNotes('');
      setIsEditingPlacement(false);
    } catch (err) {
      console.error('Failed to clear placement:', err);
    }
  };

  const handleSavePrivateNotes = async () => {
    if (!selectedVol) return;
    try {
      await onUpdateVolunteer(selectedVol.id, { notes: detailPrivateNotes.trim() });
      setIsEditingPrivateNotes(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const handleAddEmailDirect = async () => {
    if (!selectedVol) return;
    const finalSubject = detailUseCustomSubject ? detailCustomSubject : detailEmailSubject;
    if (!finalSubject) return;

    const newEmail: EmailCommunication = {
      id: `email_${Date.now()}`,
      dateTime: detailEmailDateTime || '2026-07-08 10:00',
      subject: finalSubject,
      sender: detailEmailSender,
      status: detailEmailStatus
    };

    const updatedEmails = [...(selectedVol.emails || []), newEmail];
    await onUpdateVolunteer(selectedVol.id, { emails: updatedEmails });
    
    setDetailCustomSubject('');
    setDetailUseCustomSubject(false);
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

  // Apply search & multi-select role filters
  const filteredVolunteers = React.useMemo(() => {
    return volunteers.filter(vol => {
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

      // 2. Role filter match
      if (selectedRoles.length === 0) return matchesSearch;
      
      const role = vol.eventAssignments?.[activeEventId]?.role;
      if (!role || role.trim() === '') {
        return matchesSearch && selectedRoles.includes('Unassigned');
      }
      return matchesSearch && selectedRoles.includes(role);
    });
  }, [volunteers, searchTerm, selectedRoles, activeEventId]);

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
      } else if (sortField === 'emailsCount') {
        valA = a.emails?.length || 0;
        valB = b.emails?.length || 0;
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
      } else if (sortField === 'emailsCount') {
        valA = a.emails?.length || 0;
        valB = b.emails?.length || 0;
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

  // Sync edit state when active volunteer changes
  React.useEffect(() => {
    if (selectedVol) {
      setEditName(selectedVol.name || '');
      setEditEmail(selectedVol.email || '');
      setEditPhone(selectedVol.phone || '');
      setEditSkills(selectedVol.skills || '');
      setDetailPrivateNotes(selectedVol.notes || '');
      
      const assignment = selectedVol.eventAssignments?.[activeEventId];
      setDetailRole(assignment?.role || '');
      setDetailStation(assignment?.station || '');
      setDetailNotes(assignment?.notes || '');
    } else {
      setEditName('');
      setEditEmail('');
      setEditPhone('');
      setEditSkills('');
      setDetailPrivateNotes('');
      setDetailRole('');
      setDetailStation('');
      setDetailNotes('');
    }
    setIsEditingProfile(false);
    setIsEditingPlacement(false);
    setIsEditingPrivateNotes(false);
  }, [activeDirectoryVolId, activeEventId]);

  const renderSortHeader = (field: 'name' | 'email' | 'role' | 'station' | 'contactStatus' | 'emailsCount', label: string) => {
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

  const handleCreateVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);
    try {
      await onCreateVolunteer({
        name,
        email,
        phone,
        roles: [],
        skills: skills.trim(),
        notes: notes.trim(),
        emails: [],
        eventAssignments: {}
      });
      setName('');
      setEmail('');
      setPhone('');
      setSkills('');
      setNotes('');
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
    const updatedAssignments = {
      ...currentAssignments,
      [activeEventId]: {
        role: newRoleName.trim() || 'General Helper',
        station: newStationName.trim() || 'General Area',
        notes: newEventNotes.trim()
      }
    };

    await onUpdateVolunteer(volId, { eventAssignments: updatedAssignments });
    setNewRoleName('');
    setNewStationName('');
    setNewEventNotes('');
    setEditingRolesVolId(null);
  };

  const handleClearAssignment = async (volId: string) => {
    if (!activeEventId) return;
    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return;

    const currentAssignments = { ...(vol.eventAssignments || {}) };
    delete currentAssignments[activeEventId];

    await onUpdateVolunteer(volId, { eventAssignments: currentAssignments });
  };

  const handleBulkAssignRoleStation = async () => {
    if (selectedVolIds.length === 0 || !activeEventId) return;
    if (!bulkRole.trim() && !bulkStation.trim()) {
      alert("Please specify a Role or a Station to assign.");
      return;
    }

    setBulkProcessing(true);
    try {
      for (const volId of selectedVolIds) {
        const vol = volunteers.find(v => v.id === volId);
        if (!vol) continue;

        const currentAssignments = vol.eventAssignments || {};
        const assignment = currentAssignments[activeEventId];

        const updatedAssignments = {
          ...currentAssignments,
          [activeEventId]: {
            role: bulkRole.trim() ? bulkRole.trim() : (assignment?.role || 'General Helper'),
            station: bulkStation.trim() ? bulkStation.trim() : (assignment?.station || 'General Area'),
            notes: assignment?.notes || ''
          }
        };

        await onUpdateVolunteer(volId, { eventAssignments: updatedAssignments });
      }

      setSelectedVolIds([]);
      setBulkRole('');
      setBulkStation('');
    } catch (err) {
      console.error(err);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleAddEmail = async (volId: string) => {
    const finalSubject = useCustomSubject ? customSubject : emailSubject;
    if (!finalSubject) return;

    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return;

    const newEmail: EmailCommunication = {
      id: `email_${Date.now()}`,
      dateTime: emailDateTime || '2026-07-07 19:32',
      subject: finalSubject,
      sender: emailSender,
      status: emailStatus
    };

    const updatedEmails = [...(vol.emails || []), newEmail];
    await onUpdateVolunteer(volId, { emails: updatedEmails });
    
    setCustomSubject('');
    setUseCustomSubject(false);
  };

  const handleRemoveEmail = async (volId: string, emailId: string) => {
    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return;

    const updatedEmails = (vol.emails || []).filter(e => e.id !== emailId);
    await onUpdateVolunteer(volId, { emails: updatedEmails });
  };

  const getStatusBadgeColor = (status: 'Sent' | 'Delivered' | 'Opened' | 'Failed') => {
    switch (status) {
      case 'Sent': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Delivered': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Opened': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Failed': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
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
          
          updatedData.eventAssignments = {
            ...currentAssignments,
            [activeEventId]: {
              role: assignment?.role || 'General Helper',
              station: assignment?.station || 'General Area',
              notes: modalEventNotes.trim()
            }
          };
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
          <UserPlus size={14} /> Register Volunteer
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
          <span>Roster &amp; Event Mapping</span>
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
          <span>Volunteer Directory</span>
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
                  {evt.name} • {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Register Volunteer Form */}
      {showAddForm && (
        <form onSubmit={handleCreateVolunteer} className="bg-[#fcfaf7] p-6 rounded-xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 max-w-2xl animate-fadeIn space-y-4">
          <h3 className="font-serif font-bold text-base text-[#1e293b] border-b border-[#efe0c2] pb-2">Register New Ministry Volunteer</h3>
          
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Full Name</label>
            <input
              type="text"
              placeholder="Sarah Jenkins"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="sarah.j@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 555-0192"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Skills &amp; Interests</label>
            <input
              type="text"
              placeholder="e.g. Greeting, Hospitality, Cooking, AV Board, First Aid"
              value={skills}
              onChange={e => setSkills(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1">Private Operational Notes</label>
            <textarea
              placeholder="Any additional notes on availability, past experience, or role placement restrictions..."
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-medium"
            />
          </div>

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
              {submitting ? 'Registering...' : 'Complete Registration'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Utility Bar */}
      <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-3">
          {/* Right: Assigned Role multi-select filter */}
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Clear Filters Button */}
            {(searchTerm || selectedRoles.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedRoles([]);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Info label about active filters */}
        {(searchTerm || selectedRoles.length > 0) && (
          <div className="text-[11px] text-slate-500 flex items-center gap-1 bg-[#faf8f4] border border-[#efe0c2]/50 px-3 py-1.5 rounded-lg animate-fadeIn">
            <span className="font-semibold text-[#856637]">Active Filters:</span>
            {searchTerm && <span>Search for <strong className="text-slate-700">"{searchTerm}"</strong></span>}
            {searchTerm && selectedRoles.length > 0 && <span className="mx-1">•</span>}
            {selectedRoles.length > 0 && (
              <span className="truncate">
                Roles: <strong className="text-slate-700">{selectedRoles.join(', ')}</strong>
              </span>
            )}
            <span className="ml-auto text-slate-400 font-mono text-[10px] shrink-0">
              Showing {filteredVolunteers.length} of {volunteers.length} volunteers
            </span>
          </div>
        )}
      </div>

      {/* Main Roster Table / Directory View Toggle Container */}
      {viewMode === 'roster' ? (
        <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-[#faf8f4] border-b border-[#e2dcd0] flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-serif font-bold uppercase tracking-wider text-[#1e293b] flex items-center gap-1.5">
            <Users size={16} className="text-[#856637]" /> Active Roster Management
          </span>
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
            <span className="text-xs font-medium text-slate-500 font-serif">
              {filteredVolunteers.length === volunteers.length 
                ? `${volunteers.length} registered volunteers` 
                : `Showing ${filteredVolunteers.length} of ${volunteers.length} volunteers`
              }
            </span>
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
                <p className="text-xs font-serif font-black text-slate-800">
                  Bulk Assignment Action <span className="ml-1 px-2.5 py-0.5 bg-[#856637] text-white text-[9px] font-bold rounded-full font-mono">{selectedVolIds.length} Selected</span>
                </p>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Assign all selected volunteers to a specific role and/or station for the event <span className="font-bold text-slate-700">{activeEvent?.name}</span>.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Bulk Role (e.g. Host)"
                  value={bulkRole}
                  onChange={e => setBulkRole(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold placeholder:text-slate-400 w-full sm:w-44 shadow-xs"
                />
                <input
                  type="text"
                  placeholder="Bulk Station (e.g. Foyer)"
                  value={bulkStation}
                  onChange={e => setBulkStation(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold placeholder:text-slate-400 w-full sm:w-44 shadow-xs"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVolIds([]);
                    setBulkRole('');
                    setBulkStation('');
                  }}
                  className="px-3 py-2 border border-[#efe0c2] bg-white hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAssignRoleStation}
                  disabled={bulkProcessing}
                  className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] disabled:bg-slate-400 text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                >
                  {bulkProcessing ? 'Applying...' : 'Apply Assignment'}
                </button>
              </div>
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
                <th className="p-4">{renderSortHeader('emailsCount', 'Communications')}</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
              {volunteers.length === 0 ? (
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
                          <p className="font-serif text-sm font-bold text-[#1e293b]">{vol.name}</p>
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

                        {/* Email Tracking Summary */}
                        <td className="p-4">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-700 flex items-center gap-1 text-[10px]">
                              <Mail size={11} className="text-slate-400" />
                              {totalEmails} Logged {totalEmails === 1 ? 'Email' : 'Emails'}
                            </p>
                            {lastEmail ? (
                              <div className="space-y-0.5">
                                <p className="text-[9px] text-slate-500 font-medium truncate max-w-[150px]">
                                  Last: <span className="text-slate-700 font-semibold">"{lastEmail.subject}"</span>
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-block text-[8px] font-bold px-1.5 py-0.1 border rounded-full ${getStatusBadgeColor(lastEmail.status)}`}>
                                    {lastEmail.status}
                                  </span>
                                  <span className="text-[8px] text-slate-400 font-mono">{lastEmail.dateTime}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[9px] text-slate-400 italic">No history</p>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              onClick={() => {
                                setEditingEmailsVolId(editingEmailsVolId === vol.id ? null : vol.id);
                                setEditingRolesVolId(null);
                              }}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition shadow-sm cursor-pointer flex items-center gap-1 ${
                                editingEmailsVolId === vol.id 
                                  ? 'bg-amber-50 text-[#856637] border-[#efe0c2]' 
                                  : 'bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] border-transparent'
                              }`}
                              title="Email Communications Tracker"
                            >
                              <Mail size={12} />
                              <span>Emails ({totalEmails})</span>
                            </button>

                            <button
                              onClick={() => {
                                setEditingRolesVolId(editingRolesVolId === vol.id ? null : vol.id);
                                setEditingEmailsVolId(null);
                                // Prepopulate current mapping if exists
                                if (assignment) {
                                  setNewRoleName(assignment.role);
                                  setNewStationName(assignment.station);
                                   setNewEventNotes(assignment.notes || '');
                                } else {
                                  setNewRoleName('');
                                  setNewStationName('');
                                  setNewEventNotes('');
                                }
                              }}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition shadow-sm cursor-pointer flex items-center gap-1 ${
                                editingRolesVolId === vol.id
                                  ? 'bg-amber-50 text-[#856637] border-[#efe0c2]'
                                  : 'bg-white hover:bg-[#faf8f4] text-slate-700 border-[#e2dcd0]'
                              }`}
                            >
                              <Bookmark size={12} />
                              <span>Assign Role &amp; Station</span>
                            </button>

                            <button
                              onClick={async () => {
                                const isConfirmed = await confirmAction(
                                  "Remove Volunteer",
                                  `Remove volunteer "${vol.name}" from ministry registry?`
                                );
                                if (isConfirmed) {
                                  await onRemoveVolunteer(vol.id);
                                }
                              }}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Delete Volunteer"
                              aria-label="Delete Volunteer"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Interactive Email Communication Tracker Sub-panel */}
                      {editingEmailsVolId === vol.id && (
                        <tr className="bg-[#fcfbf9] border-y border-[#efe0c2]/60 shadow-inner">
                          <td colSpan={7} className="p-6">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-[#efe0c2] pb-2">
                                <div className="flex items-center gap-1.5 text-sm text-[#1e293b] font-bold font-serif">
                                  <Mail size={16} className="text-[#856637]" />
                                  Email Communications Tracker for {vol.name}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Logged: {totalEmails} messages
                                </span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-7 space-y-3">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1">
                                    <Inbox size={12} /> Outgoing History &amp; Status Logs
                                  </h4>
                                  
                                  {(!vol.emails || vol.emails.length === 0) ? (
                                    <div className="bg-white border border-dashed border-[#e2dcd0] p-6 rounded-xl text-center text-slate-400 italic text-xs">
                                      No email records logged. Fill out the tracker form to record a communication.
                                    </div>
                                  ) : (
                                    <div className="bg-white rounded-xl border border-[#e2dcd0] overflow-hidden shadow-xs divide-y divide-slate-100">
                                      {vol.emails.map((emailItem) => (
                                        <div key={emailItem.id} className="p-3 hover:bg-slate-50 transition flex items-start justify-between gap-3 text-xs">
                                          <div className="space-y-1 min-w-0">
                                            <p className="font-bold text-slate-800 flex items-center gap-1">
                                              <span className="text-[#856637]">✉</span> {emailItem.subject}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                              Sender: <span className="font-semibold text-slate-700">{emailItem.sender}</span> • Logged on <span className="font-mono text-slate-600">{emailItem.dateTime}</span>
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 border rounded-full ${getStatusBadgeColor(emailItem.status)}`}>
                                              {emailItem.status}
                                            </span>
                                            <button
                                              onClick={() => handleRemoveEmail(vol.id, emailItem.id)}
                                              className="p-1 text-slate-355 hover:text-rose-600 transition cursor-pointer"
                                              title="Delete Log Entry"
                                            >
                                              <X size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-[#efe0c2] space-y-3">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#856637] flex items-center gap-1.5 border-b border-dashed border-[#efe0c2] pb-1.5">
                                    <Send size={12} /> Track Outgoing Email
                                  </h4>

                                  <div className="space-y-2.5">
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[9px] font-bold uppercase text-slate-450">Subject Line</label>
                                        <button 
                                          type="button"
                                          onClick={() => setUseCustomSubject(!useCustomSubject)}
                                          className="text-[9px] font-extrabold text-[#856637] hover:underline"
                                        >
                                          {useCustomSubject ? 'Use Preset List' : 'Write Custom Subject'}
                                        </button>
                                      </div>

                                      {useCustomSubject ? (
                                        <input
                                          type="text"
                                          placeholder="e.g. Action Required: Schedule Conflict Details"
                                          value={customSubject}
                                          onChange={e => setCustomSubject(e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                                        />
                                      ) : (
                                        <select
                                          value={emailSubject}
                                          onChange={e => setEmailSubject(e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold text-slate-800"
                                        >
                                          <option value="Ministry Outreach + Volunteer Recruitment">Ministry Outreach + Volunteer Recruitment</option>
                                          <option value="Sorting Day Reminder -- Day 1">Sorting Day Reminder -- Day 1</option>
                                          <option value="Volunteer Handbook + Welcome!">Volunteer Handbook + Welcome!</option>
                                          <option value="Sorting Day Reminder -- Day 2">Sorting Day Reminder -- Day 2</option>
                                          <option value="Volunteer Breakfast Confirmation">Volunteer Breakfast Confirmation</option>
                                          <option value="Post-event Thank you to all Volunteers">Post-event Thank you to all Volunteers</option>
                                        </select>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Sender</label>
                                        <select
                                          value={emailSender}
                                          onChange={e => setEmailSender(e.target.value)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold text-slate-800"
                                        >
                                          <option value="Joy P.">Joy P.</option>
                                          <option value="Iya G.">Iya G.</option>
                                          <option value="Bea P.">Bea P.</option>
                                          <option value="Neil S.">Neil S.</option>
                                          <option value="System Auto">System Auto</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Tracking Status</label>
                                        <select
                                          value={emailStatus}
                                          onChange={e => setEmailStatus(e.target.value as any)}
                                          className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold text-slate-800"
                                        >
                                          <option value="Sent">Sent</option>
                                          <option value="Delivered">Delivered</option>
                                          <option value="Opened">Opened</option>
                                          <option value="Failed">Failed</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Date &amp; Time Outbound</label>
                                      <input
                                        type="text"
                                        placeholder="YYYY-MM-DD HH:mm (e.g. 2026-07-07 19:32)"
                                        value={emailDateTime}
                                        onChange={e => setEmailDateTime(e.target.value)}
                                        className="w-full text-xs p-2 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-mono font-bold"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleAddEmail(vol.id)}
                                      className="w-full py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm mt-1"
                                    >
                                      <Send size={12} /> Record Outgoing Email
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Interactive Role & Station Mapping Sub-panel */}
                      {editingRolesVolId === vol.id && (
                        <tr className="bg-[#faf8f4]/60 border-y border-dashed border-[#e2dcd0]">
                          <td colSpan={7} className="p-6">
                            <div className="space-y-4 max-w-xl">
                              <div className="flex items-center gap-1.5 text-xs text-[#1e293b] font-bold">
                                <Bookmark size={14} className="text-[#856637]" />
                                Event Placement Assignment: <span className="font-serif italic text-[#856637]">"{activeEvent?.name}"</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-normal">
                                Map this volunteer to a unique Assigned Role and Station location for this specific event. This implements Option B's centralized junction mapping cleanly.
                              </p>

                              {/* Active assignments summary */}
                              {hasAssignment ? (
                                <div className="bg-white p-3 rounded-lg border border-[#e2dcd0] flex items-center justify-between gap-3 shadow-xs">
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
                                      <div className="space-y-0.5 min-w-[150px] max-w-xs">
                                        <p className="text-[9px] font-bold uppercase text-slate-450">Operational Comments</p>
                                        <p className="text-xs italic text-[#856637] font-serif break-words">"{assignment.notes}"</p>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAssignment(vol.id)}
                                    className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded border border-rose-200 cursor-pointer transition shrink-0"
                                  >
                                    Clear Placement
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[10px] italic text-slate-400">Currently unassigned for this event.</p>
                              )}

                              {/* Role mapping creator */}
                              <div className="space-y-3 pt-2 border-t border-[#e2dcd0]/60">
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
                                <div className="flex gap-2 justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRolesVolId(null)}
                                    className="px-3 py-1.5 border border-[#e2dcd0] hover:bg-[#faf8f4] text-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
                                  >
                                    Close
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignRoleStation(vol.id)}
                                    className="px-4 py-1.5 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold rounded-lg transition cursor-pointer shadow-sm"
                                  >
                                    Save Placement
                                  </button>
                                </div>
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
                  High-volume data-dense table view designed for scaling beyond 60 volunteers. Click "Manage" to configure placements and outreach.
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
                    <th className="py-2.5 px-3 min-w-[140px]">
                      {renderSortHeader('role', 'Event Role')}
                    </th>
                    <th className="py-2.5 px-3 min-w-[140px]">
                      {renderSortHeader('station', 'Station')}
                    </th>
                    <th className="py-2.5 px-3 min-w-[150px]">
                      {renderSortHeader('contactStatus', 'Outreach / Contact Status')}
                    </th>
                    <th className="py-2.5 px-3 min-w-[120px]">
                      {renderSortHeader('emailsCount', 'Outreach Logs')}
                    </th>
                    <th className="py-2.5 px-3 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2dcd0] text-xs text-slate-750 bg-white">
                  {sortedDirectoryVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-450 italic text-xs">
                        No volunteers match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedDirectoryVolunteers.map((vol, index) => {
                      const isExpanded = selectedVolId === vol.id;
                      const assignment = vol.eventAssignments?.[activeEventId];
                      const role = assignment?.role || 'Unassigned';
                      const station = assignment?.station || 'None';
                      const status = assignment?.contactStatus || 'Not Contacted';
                      const hasSkills = vol.skills && vol.skills.trim() !== '';
                      const hasNotes = vol.notes && vol.notes.trim() !== '';
                      const emailsCount = vol.emails?.length || 0;

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
                                  <div className="font-serif font-bold text-[#1e293b] leading-snug truncate flex items-center gap-1.5">
                                    <span className="truncate">{vol.name}</span>
                                    {hasSkills && (
                                      <Sparkles size={10} className="text-[#856637]" title={`Skills: ${vol.skills}`} />
                                    )}
                                    {hasNotes && (
                                      <StickyNote size={10} className="text-slate-400" title={`Notes: ${vol.notes}`} />
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

                            {/* Event Role Badge */}
                            <td className="py-2.5 px-3">
                              {role !== 'Unassigned' ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${getRoleBadgeColors(role)}`}>
                                  <span className="w-1 h-1 rounded-full bg-current opacity-80" />
                                  {role}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-medium">Unassigned</span>
                              )}
                            </td>

                            {/* Assigned Station */}
                            <td className="py-2.5 px-3">
                              {station !== 'None' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                                  <MapPin size={9} className="text-[#856637]" />
                                  {station}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">-</span>
                              )}
                            </td>

                            {/* Outreach Status Selector - INLINE TOGGLE */}
                            <td className="py-2.5 px-3">
                              <select
                                value={status}
                                onChange={(e) => handleUpdateContactStatus(vol.id, e.target.value)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none shadow-xs transition ${
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
                            </td>

                            {/* Communication Outreach Logs count & last action */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Mail size={11} className="text-slate-400 shrink-0" />
                                <span className="font-bold text-[10px] font-mono">{emailsCount} logs</span>
                                {emailsCount > 0 && (
                                  <span className="text-[9px] text-slate-400 truncate max-w-[100px]" title={`Last subject: ${vol.emails?.[emailsCount - 1]?.subject}`}>
                                    ({vol.emails?.[emailsCount - 1]?.subject})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions column */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex justify-end items-center gap-1.5">
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
                                    const isConfirmed = await confirmAction(
                                      "Remove Volunteer",
                                      `Remove volunteer "${vol.name}" from ministry registry?`
                                    );
                                    if (isConfirmed) {
                                      await onRemoveVolunteer(vol.id);
                                      if (selectedVolId === vol.id) {
                                        setSelectedVolId(null);
                                      }
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
                            <tr className="bg-[#faf8f4]/50">
                              <td colSpan={7} className="p-4 border-l-2 border-l-[#856637] bg-slate-50/20">
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.15 }}
                                  className="grid grid-cols-1 xl:grid-cols-12 gap-5"
                                >
                                  {/* Left Panel: Profile Info and Event assignment */}
                                  <div className="xl:col-span-6 space-y-4">
                                    {/* Sub-panel 1: Personal profile */}
                                    <div className="bg-white border border-[#e2dcd0] p-4 rounded-xl shadow-xs space-y-3 relative">
                                      <div className="flex justify-between items-center border-b border-[#efe0c2]/60 pb-1.5">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                                          <Users size={12} /> Personal Profile Details
                                        </h4>
                                        <button
                                          onClick={() => setIsEditingProfile(!isEditingProfile)}
                                          className={`px-2 py-1 text-[10px] font-bold rounded border transition flex items-center gap-0.5 cursor-pointer ${
                                            isEditingProfile
                                              ? 'bg-[#faf6ee] text-[#856637] border-[#efe0c2]'
                                              : 'bg-white hover:bg-slate-50 text-slate-705 border-slate-200'
                                          }`}
                                        >
                                          <Edit2 size={10} />
                                          <span>{isEditingProfile ? 'Cancel' : 'Edit Details'}</span>
                                        </button>
                                      </div>

                                      {isEditingProfile ? (
                                        <div className="space-y-2.5 animate-fadeIn">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Full Name</label>
                                              <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Email</label>
                                              <input
                                                type="email"
                                                value={editEmail}
                                                onChange={e => setEditEmail(e.target.value)}
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Phone Number</label>
                                              <input
                                                type="text"
                                                value={editPhone}
                                                onChange={e => setEditPhone(e.target.value)}
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Skills Tagging (comma-separated)</label>
                                              <input
                                                type="text"
                                                value={editSkills}
                                                onChange={e => setEditSkills(e.target.value)}
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                                placeholder="e.g. Cooking, AV Stage, Welcoming"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex gap-2 justify-end pt-1">
                                            <button
                                              onClick={() => setIsEditingProfile(false)}
                                              className="px-2.5 py-1.5 border border-slate-200 text-slate-655 hover:bg-slate-50 text-[10px] font-semibold rounded-md cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={handleSaveProfile}
                                              className="px-3.5 py-1.5 bg-[#1e293b] text-[#faf8f4] text-[10px] font-bold rounded-md cursor-pointer"
                                            >
                                              Save Details
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-0.5">
                                          <div className="space-y-1.5 font-medium">
                                            <p className="text-[9px] font-bold uppercase text-slate-400">Contact Channels</p>
                                            <div className="space-y-1 text-slate-700">
                                              <a href={`mailto:${vol.email}`} className="flex items-center gap-1.5 text-slate-650 hover:text-[#856637] hover:underline transition truncate">
                                                <Mail size={11} className="text-slate-400 shrink-0" />
                                                <span className="truncate font-semibold">{vol.email}</span>
                                              </a>
                                              {vol.phone ? (
                                                <a href={`tel:${vol.phone}`} className="flex items-center gap-1.5 text-slate-650 hover:text-[#856637] hover:underline transition">
                                                  <Phone size={11} className="text-slate-400 shrink-0" />
                                                  <span className="font-mono font-bold text-[11px]">{vol.phone}</span>
                                                </a>
                                              ) : (
                                                <span className="text-[10px] text-slate-400 italic">No phone listed</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="space-y-1.5">
                                            <p className="text-[9px] font-bold uppercase text-slate-400 font-medium">Registered Talents</p>
                                            {vol.skills ? (
                                              <div className="flex flex-wrap gap-1 font-medium">
                                                {vol.skills.split(',').map((skill, sIdx) => (
                                                  <span key={sIdx} className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#faf5ec] text-[#856637] border border-[#efe0c2] shadow-xs">
                                                    <Sparkles size={7} /> {skill.trim()}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-slate-400 italic font-medium">No custom skills listed</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Sub-panel 2: Active event placement */}
                                    <div className="bg-white border border-[#e2dcd0] p-4 rounded-xl shadow-xs space-y-3 relative">
                                      <div className="flex justify-between items-center border-b border-[#efe0c2]/60 pb-1.5">
                                        <div className="space-y-0.5">
                                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450">
                                            Active Event Placement Map
                                          </h4>
                                          <p className="text-[9px] font-semibold text-[#856637] leading-none font-serif">
                                            Event: {activeEvent?.name || 'Selected Event'}
                                          </p>
                                        </div>
                                        <button
                                          onClick={() => setIsEditingPlacement(!isEditingPlacement)}
                                          className="px-2 py-1 text-[10px] font-bold text-[#856637] hover:bg-amber-50/50 border border-[#efe0c2] rounded shadow-xs transition cursor-pointer"
                                        >
                                          {isEditingPlacement ? 'Cancel Assignment' : 'Assign / Edit'}
                                        </button>
                                      </div>

                                      {isEditingPlacement ? (
                                        <div className="space-y-2.5 pt-0.5 animate-fadeIn">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Assigned Role</label>
                                              <input
                                                type="text"
                                                value={detailRole}
                                                onChange={e => setDetailRole(e.target.value)}
                                                placeholder="e.g. Lead Host, Greeter"
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Assigned Station / Spot</label>
                                              <input
                                                type="text"
                                                value={detailStation}
                                                onChange={e => setDetailStation(e.target.value)}
                                                placeholder="e.g. Main Lobby Stage"
                                                className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-[8px] font-bold uppercase text-slate-450 mb-0.5">Placement Notes & Comments</label>
                                            <textarea
                                              value={detailNotes}
                                              rows={1.5}
                                              onChange={e => setDetailNotes(e.target.value)}
                                              placeholder="Specific timing details or accommodations..."
                                              className="w-full text-[11px] p-1.5 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                            />
                                          </div>
                                          <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                                            {vol.eventAssignments?.[activeEventId] ? (
                                              <button
                                                onClick={handleClearPlacementDirect}
                                                className="px-2 py-1 text-[9px] font-bold text-rose-600 hover:bg-rose-50 border border-[#e2dcd0] rounded transition cursor-pointer"
                                              >
                                                Clear Assignment
                                              </button>
                                            ) : <div />}
                                            <div className="flex gap-1.5">
                                              <button
                                                onClick={() => setIsEditingPlacement(false)}
                                                className="px-2.5 py-1 border border-slate-200 text-slate-600 text-[10px] font-semibold rounded cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                onClick={handleSavePlacement}
                                                className="px-3.5 py-1 bg-[#1e293b] text-[#faf8f4] text-[10px] font-bold rounded cursor-pointer"
                                              >
                                                Save Assignment
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2 pt-0.5">
                                          {vol.eventAssignments?.[activeEventId] ? (
                                            <div className="space-y-2">
                                              <div className="flex flex-wrap gap-4 items-center">
                                                <div className="space-y-0.5">
                                                  <p className="text-[8px] font-bold uppercase text-slate-400">Assigned Role</p>
                                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${getRoleBadgeColors(vol.eventAssignments[activeEventId].role)}`}>
                                                    {vol.eventAssignments[activeEventId].role}
                                                  </span>
                                                </div>
                                                <div className="space-y-0.5">
                                                  <p className="text-[8px] font-bold uppercase text-slate-400 font-medium font-medium">Station</p>
                                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#faf8f4] text-slate-705 border border-[#e2dcd0] shadow-xs">
                                                    <MapPin size={10} className="text-[#856637]" />
                                                    {vol.eventAssignments[activeEventId].station || 'General Area'}
                                                  </span>
                                                </div>
                                              </div>
                                              {vol.eventAssignments[activeEventId].notes && (
                                                <div className="bg-slate-50 border border-slate-100 p-2 rounded">
                                                  <p className="text-[8px] font-bold uppercase text-slate-400">Placement Notes</p>
                                                  <p className="text-xs text-slate-700 font-serif italic mt-0.5 font-medium">"${vol.eventAssignments[activeEventId].notes}"</p>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="border border-dashed border-[#e2dcd0] rounded-xl p-3 text-center bg-white">
                                              <p className="text-[10px] text-slate-455 italic font-medium">No active assignment role or station mapping.</p>
                                              <button
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
                                  </div>

                                  {/* Right Panel: Private Notes and Email Outreach Communication logs */}
                                  <div className="xl:col-span-6 space-y-4">
                                    {/* Sub-panel 3: Private operational notes */}
                                    <div className="bg-amber-50/20 border border-[#efe0c2] p-4 rounded-xl shadow-xs space-y-3 relative">
                                      <div className="flex justify-between items-center border-b border-[#efe0c2] pb-1.5">
                                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#856637] flex items-center gap-1.5">
                                          <StickyNote size={12} /> Private Operational Notes
                                        </h4>
                                        <button
                                          onClick={() => setIsEditingPrivateNotes(!isEditingPrivateNotes)}
                                          className="text-[10px] font-bold text-[#856637] hover:underline cursor-pointer bg-transparent border-0"
                                        >
                                          {isEditingPrivateNotes ? 'Cancel' : 'Edit Notes'}
                                        </button>
                                      </div>

                                      {isEditingPrivateNotes ? (
                                        <div className="space-y-2 animate-fadeIn">
                                          <textarea
                                            value={detailPrivateNotes}
                                            rows={2.5}
                                            onChange={e => setDetailPrivateNotes(e.target.value)}
                                            className="w-full text-xs p-2 rounded border border-[#efe0c2] bg-white focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                            placeholder="Internal availability notes, scheduling flags, accommodation details..."
                                          />
                                          <div className="flex justify-end gap-1.5">
                                            <button
                                              onClick={() => setIsEditingPrivateNotes(false)}
                                              className="px-2 py-1 border border-slate-655 text-slate-650 text-[10px] font-semibold rounded cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={handleSavePrivateNotes}
                                              className="px-3 py-1 bg-[#1e293b] text-[#faf8f4] text-[10px] font-bold rounded cursor-pointer"
                                            >
                                              Save Notes
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-xs text-slate-755 leading-relaxed pt-0.5">
                                          {vol.notes?.trim() ? (
                                            <p className="bg-white p-2 rounded border border-dashed border-[#efe0c2] italic font-medium">
                                              "\${vol.notes}"
                                            </p>
                                          ) : (
                                            <p className="text-slate-400 italic text-[11px] font-medium">No private operational profile notes logged.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Sub-panel 4: Email outbound logs */}
                                    <div className="bg-white border border-[#e2dcd0] p-4 rounded-xl shadow-xs space-y-3">
                                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5 border-b border-dashed border-slate-200 pb-1.5">
                                        <Mail size={12} /> Communication Outreach Tracker
                                      </h4>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Outbound Logs list */}
                                        <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                          {(!vol.emails || vol.emails.length === 0) ? (
                                            <div className="bg-slate-50 border border-dashed border-slate-200 p-4 rounded text-center text-slate-400 italic text-[11px]">
                                              No outbound communication logged.
                                            </div>
                                          ) : (
                                            <div className="border border-slate-100 rounded overflow-hidden divide-y divide-slate-50">
                                              {vol.emails.map((emailItem) => (
                                                <div key={emailItem.id} className="p-1.5 bg-slate-50/50 hover:bg-slate-50 transition flex items-start justify-between gap-1 text-[11px]">
                                                  <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 truncate" title={emailItem.subject}>
                                                      {emailItem.subject}
                                                    </p>
                                                    <p className="text-[9px] text-slate-455 mt-0.5">
                                                      {emailItem.sender} • <span className="font-mono">{emailItem.dateTime}</span>
                                                    </p>
                                                  </div>
                                                  <div className="flex items-center gap-1 shrink-0">
                                                    <span className={`text-[8px] font-bold px-1.5 border rounded-full ${getStatusBadgeColor(emailItem.status)}`}>
                                                      {emailItem.status}
                                                    </span>
                                                    <button
                                                      onClick={() => handleRemoveEmail(vol.id, emailItem.id)}
                                                      className="p-0.5 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                                                      title="Delete Log"
                                                    >
                                                      <X size={9} />
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Outbound logger form */}
                                        <div className="bg-[#fcfaf7] p-2.5 rounded border border-[#efe0c2]/60 space-y-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-bold uppercase text-[#856637] flex items-center gap-1 font-bold">
                                              <Send size={8} /> Log New Email Action
                                            </span>
                                            <button
                                              onClick={() => setDetailUseCustomSubject(!detailUseCustomSubject)}
                                              className="text-[8px] font-bold text-[#856637] hover:underline cursor-pointer bg-transparent border-0"
                                            >
                                              {detailUseCustomSubject ? 'Presets' : 'Custom'}
                                            </button>
                                          </div>

                                          {detailUseCustomSubject ? (
                                            <input
                                              type="text"
                                              placeholder="Custom subject line..."
                                              value={detailCustomSubject}
                                              onChange={e => setDetailCustomSubject(e.target.value)}
                                              className="w-full text-[10px] p-1 rounded border border-[#efe0c2] bg-white focus:outline-none"
                                            />
                                          ) : (
                                            <select
                                              value={detailEmailSubject}
                                              onChange={e => setDetailEmailSubject(e.target.value)}
                                              className="w-full text-[10px] p-1 rounded border border-[#efe0c2] bg-white focus:outline-none font-semibold text-slate-800"
                                            >
                                              <option value="Ministry Outreach + Volunteer Recruitment">Ministry Outreach + Volunteer Recruitment</option>
                                              <option value="Sorting Day Reminder -- Day 1">Sorting Day Reminder -- Day 1</option>
                                              <option value="Volunteer Handbook + Welcome!">Volunteer Handbook + Welcome!</option>
                                              <option value="Sorting Day Reminder -- Day 2">Sorting Day Reminder -- Day 2</option>
                                              <option value="Volunteer Breakfast Confirmation">Volunteer Breakfast Confirmation</option>
                                              <option value="Post-event Thank you to all Volunteers">Post-event Thank you to all Volunteers</option>
                                            </select>
                                          )}

                                          <div className="grid grid-cols-2 gap-1.5 font-medium">
                                            <div>
                                              <label className="block text-[7px] font-bold uppercase text-slate-450 mb-0.5">Sender</label>
                                              <select
                                                value={detailEmailSender}
                                                onChange={e => setDetailEmailSender(e.target.value)}
                                                className="w-full text-[9px] p-1 rounded border border-[#efe0c2] bg-white focus:outline-none font-semibold text-[#1e293b]"
                                              >
                                                <option value="Joy P.">Joy P.</option>
                                                <option value="Iya G.">Iya G.</option>
                                                <option value="Bea P.">Bea P.</option>
                                                <option value="Neil S.">Neil S.</option>
                                                <option value="System Auto">System Auto</option>
                                              </select>
                                            </div>
                                            <div>
                                              <label className="block text-[7px] font-bold uppercase text-slate-450 mb-0.5">Status</label>
                                              <select
                                                value={detailEmailStatus}
                                                onChange={e => setDetailEmailStatus(e.target.value as any)}
                                                className="w-full text-[9px] p-1 rounded border border-[#efe0c2] bg-white focus:outline-none font-semibold text-[#1e293b]"
                                              >
                                                <option value="Sent">Sent</option>
                                                <option value="Delivered">Delivered</option>
                                                <option value="Opened">Opened</option>
                                                <option value="Failed">Failed</option>
                                              </select>
                                            </div>
                                          </div>

                                          <div className="flex gap-1.5 items-center">
                                            <input
                                              type="text"
                                              value={detailEmailDateTime}
                                              onChange={e => setDetailEmailDateTime(e.target.value)}
                                              className="flex-1 text-[8px] p-1 rounded border border-[#efe0c2] bg-white font-mono font-bold"
                                              placeholder="YYYY-MM-DD HH:MM"
                                            />
                                            <button
                                              onClick={handleAddEmailDirect}
                                              className="py-1 px-2.5 bg-[#1e293b] text-[#faf8f4] text-[9px] font-bold rounded cursor-pointer"
                                            >
                                              Log Outbound
                                            </button>
                                          </div>
                                        </div>
                                      </div>
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
