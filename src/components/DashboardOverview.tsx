import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../lib/useFocusTrap';
import { 
  Calendar, 
  Users, 
  AlertTriangle,
  Activity,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  Settings,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  MapPin,
  Loader2,
  Info,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  List,
  Upload, Copy,
  Coins,
  TrendingUp,
  BookOpen,
  Link2,
  QrCode
} from 'lucide-react';
import { LaneDetail, MinistryEvent, RecentActivity, Volunteer, MilestoneKey, MinistryLane, Expense, Debrief } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { apiFetch } from '../lib/api';
import { getDaysOut, getTodayISO, formatDisplayDate, getFutureISO } from '../lib/dates';
import { buildRegistrationLink } from '../lib/registration';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

interface SummaryData {
  totalEvents: number;
  totalAssets: number;
  totalVolunteers: number;
  totalTasks: number;
  completedTasks: number;
  missingHighValueCount: number;
  overburdenedVolunteersCount: number;
}

interface DashboardOverviewProps {
  summary: SummaryData;
  onNavigate: (tab: string) => void;
  events?: MinistryEvent[];
  selectedEventId?: string;
  onSelectEvent?: (id: string) => void;
  lanes?: LaneDetail[];
  laneLoading?: boolean;
  onCreateLane?: (name: string, leadName: string) => Promise<void>;
  onUpdateLane?: (id: string, name: string, leadName: string) => Promise<void>;
  onDeleteLane?: (id: string) => Promise<void>;
  activities?: RecentActivity[];
  volunteers?: Volunteer[];
  onCreateEvent?: (name: string, date: string, description: string) => Promise<void>;
  onCloneEvent?: (id: string, newDate: string, carryVolunteerIds: string[], copyEquipment: boolean) => Promise<void>;
  onAddTask?: (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string; assignedTo?: string }) => Promise<void>;
  onCreateVolunteer?: (volunteerData: Omit<Volunteer, 'id'>) => Promise<void>;
  onUploadCompleted?: () => Promise<void>;
  loading?: boolean;
  debriefs?: Debrief[];
  onPrefillDebrief?: (data: { name: string; date: string; id?: string }) => void;
}

const CITIES = [
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { name: 'Washington D.C.', lat: 38.8951, lon: -77.0364 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { name: 'New York', lat: 40.7128, lon: -74.0060 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
];

function DashboardOverview({
  summary,
  onNavigate,
  events = [],
  selectedEventId,
  onSelectEvent,
  lanes = [],
  laneLoading = false,
  onCreateLane,
  onUpdateLane,
  onDeleteLane,
  activities = [],
  volunteers = [],
  onCreateEvent,
  onCloneEvent,
  onAddTask,
  onCreateVolunteer,
  onUploadCompleted,
  loading = false,
  debriefs = [],
  onPrefillDebrief
 }: DashboardOverviewProps) {
  const [selectedCity, setSelectedCity] = React.useState(CITIES[0]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const fetchExpenses = async () => {
      try {
        const res = await apiFetch('/api/expenses');
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setExpenses(data);
          }
        }
      } catch (err) {
        console.error("Error loading expenses in DashboardOverview:", err);
      } finally {
        if (active) {
          setExpensesLoading(false);
        }
      }
    };
    fetchExpenses();
    return () => {
      active = false;
    };
  }, [selectedEventId]); // re-fetch on selected event change just to keep it fresh

  // Reusable Confirmation Dialog state
  const [confirmState, setConfirmState] = React.useState<{
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
  const [weatherData, setWeatherData] = React.useState<any>(null);
  const [weatherLoading, setWeatherLoading] = React.useState(false);
  const [weatherError, setWeatherError] = React.useState<string | null>(null);

  const [isManaging, setIsManaging] = React.useState(false);
  const [editingLaneId, setEditingLaneId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editLeadName, setEditLeadName] = React.useState('');

  const [newLaneName, setNewLaneName] = React.useState('');
  const [newLaneLeadName, setNewLaneLeadName] = React.useState('');
  // Quick Actions Menu State
  const [isQuickActionsOpen, setIsQuickActionsOpen] = React.useState(false);
  const [activeQuickAction, setActiveQuickAction] = React.useState<'task' | 'volunteer' | 'event' | null>(null);

  // Quick Action - Task Form state
  const [quickTaskEventId, setQuickTaskEventId] = React.useState('');
  const [quickTaskTitle, setQuickTaskTitle] = React.useState('');
  const [quickTaskDesc, setQuickTaskDesc] = React.useState('');
  const [quickTaskMilestone, setQuickTaskMilestone] = React.useState<MilestoneKey>('4_weeks_out');
  const [quickTaskLane, setQuickTaskLane] = React.useState('');
  const [quickTaskDueDate, setQuickTaskDueDate] = React.useState('');
  const [quickTaskAssignedTo, setQuickTaskAssignedTo] = React.useState('');



  // Quick Action - Volunteer Form state
  const [quickVolName, setQuickVolName] = React.useState('');
  const [quickVolEmail, setQuickVolEmail] = React.useState('');
  const [quickVolPhone, setQuickVolPhone] = React.useState('');
  const [quickVolRoles, setQuickVolRoles] = React.useState('');
  const [quickVolSkills, setQuickVolSkills] = React.useState('');
  const [quickVolNotes, setQuickVolNotes] = React.useState('');

  // Quick Action - Event Form state
  const [quickEventName, setQuickEventName] = React.useState('');
  const [quickEventDate, setQuickEventDate] = React.useState('');
  const [quickEventDesc, setQuickEventDesc] = React.useState('');

  const [cloneEventTargetId, setCloneEventTargetId] = React.useState<string | null>(null);
  const [cloneEventNewDate, setCloneEventNewDate] = React.useState('');
  const [isCloning, setIsCloning] = React.useState(false);
  const [selectedVolIds, setSelectedVolIds] = React.useState<string[]>([]);
  const [copyEquipment, setCopyEquipment] = React.useState(true);

  const [copiedRegId, setCopiedRegId] = React.useState<string | null>(null);

  const handleCopyRegLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const link = buildRegistrationLink(id);
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedRegId(id);
    setTimeout(() => setCopiedRegId(prev => (prev === id ? null : prev)), 1800);
  };

  const handleDownloadQR = async (e: React.MouseEvent, ev: MinistryEvent) => {
    e.stopPropagation();
    const link = buildRegistrationLink(ev.id);
    if (!link) return;
    try {
      const QR = await import('qrcode');
      const dataUrl = await QR.toDataURL(link, { width: 512, margin: 2 });
      const slug = ev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `registration-qr-${slug || ev.id}.png`;
      a.click();
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  const assignedVolunteersForClone = React.useMemo(() => {
    if (!cloneEventTargetId || !volunteers) return [];
    return volunteers.filter(vol => vol.eventAssignments && vol.eventAssignments[cloneEventTargetId]);
  }, [cloneEventTargetId, volunteers]);

  React.useEffect(() => {
    if (cloneEventTargetId) {
      const ids = assignedVolunteersForClone.map(v => v.id);
      setSelectedVolIds(ids);
      setCopyEquipment(true);
    } else {
      setSelectedVolIds([]);
    }
  }, [cloneEventTargetId, assignedVolunteersForClone]);

  const quickActionModalRef = useFocusTrap(!!activeQuickAction, () => setActiveQuickAction(null));
  const cloneEventModalRef = useFocusTrap(!!cloneEventTargetId, () => {
    setCloneEventTargetId(null);
    setCloneEventNewDate('');
  });

  // Search and Filter states for Events
  const [eventStatusFilter, setEventStatusFilter] = React.useState<'all' | 'upcoming' | 'finished'>('all');

  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      const daysOut = getDaysOut(event.date);

      if (eventStatusFilter === 'upcoming') {
        return daysOut >= 0;
      } else if (eventStatusFilter === 'finished') {
        return daysOut < 0;
      }
      return true;
    });
  }, [events, eventStatusFilter]);



  const openQuickAction = (action: 'task' | 'volunteer' | 'event') => {
    setActiveQuickAction(action);
    setIsQuickActionsOpen(false);

    if (action === 'task') {
      if (events.length > 0) {
        setQuickTaskEventId(events[0].id);
      } else {
        setQuickTaskEventId('');
      }
      if (lanes.length > 0) {
        setQuickTaskLane(lanes[0].name);
      } else {
        setQuickTaskLane('Outreach');
      }
      setQuickTaskDueDate(getFutureISO(7));
      setQuickTaskTitle('');
      setQuickTaskDesc('');
      setQuickTaskAssignedTo('');
    } else if (action === 'volunteer') {
      setQuickVolName('');
      setQuickVolEmail('');
      setQuickVolPhone('');
      setQuickVolRoles('');
      setQuickVolSkills('');
      setQuickVolNotes('');
    } else if (action === 'event') {
      setQuickEventName('');
      setQuickEventDate(getFutureISO(14));
      setQuickEventDesc('');
    }
  };

  // Weather fetch hook
  React.useEffect(() => {
    let active = true;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`
        );
        if (!res.ok) throw new Error('Failed to fetch weather data');
        const data = await res.json();
        if (active) {
          setWeatherData(data.daily);
        }
      } catch (err: any) {
        if (active) {
          setWeatherError(err.message || 'Error loading forecast');
        }
      } finally {
        if (active) {
          setWeatherLoading(false);
        }
      }
    };

    fetchWeather();
    return () => {
      active = false;
    };
  }, [selectedCity]);

  // Weather code metadata mapping
  const getWeatherDetails = (code: number) => {
    if (code === 0) {
      return {
        icon: <Sun className="text-amber-500" size={24} />,
        label: 'Clear Sky',
        bgColor: 'bg-amber-50/60 border-amber-100 text-amber-900',
        textColor: 'text-amber-800'
      };
    }
    if ([1, 2, 3].includes(code)) {
      return {
        icon: <Cloud className="text-slate-500" size={24} />,
        label: 'Partly Cloudy',
        bgColor: 'bg-slate-50 border-slate-200 text-slate-900',
        textColor: 'text-slate-700'
      };
    }
    if ([45, 48].includes(code)) {
      return {
        icon: <CloudFog className="text-zinc-500" size={24} />,
        label: 'Foggy',
        bgColor: 'bg-zinc-50 border-zinc-200 text-zinc-900',
        textColor: 'text-zinc-700'
      };
    }
    if ([51, 53, 55].includes(code)) {
      return {
        icon: <CloudDrizzle className="text-blue-400" size={24} />,
        label: 'Drizzle',
        bgColor: 'bg-blue-50/40 border-blue-150 text-blue-950',
        textColor: 'text-blue-700'
      };
    }
    if ([61, 63, 65].includes(code)) {
      return {
        icon: <CloudRain className="text-blue-500" size={24} />,
        label: 'Rainy',
        bgColor: 'bg-blue-50 border-blue-200 text-blue-900',
        textColor: 'text-blue-800'
      };
    }
    if ([71, 73, 75, 77].includes(code)) {
      return {
        icon: <CloudSnow className="text-sky-400" size={24} />,
        label: 'Snowy',
        bgColor: 'bg-sky-50 border-sky-100 text-sky-900',
        textColor: 'text-sky-700'
      };
    }
    if ([80, 81, 82].includes(code)) {
      return {
        icon: <CloudRain className="text-indigo-450" size={24} />,
        label: 'Showers',
        bgColor: 'bg-indigo-50 border-indigo-150 text-indigo-950',
        textColor: 'text-indigo-700'
      };
    }
    if ([95, 96, 99].includes(code)) {
      return {
        icon: <CloudLightning className="text-purple-600" size={24} />,
        label: 'Thunderstorm',
        bgColor: 'bg-purple-50 border-purple-200 text-purple-900',
        textColor: 'text-purple-800'
      };
    }
    return {
      icon: <Sun className="text-amber-500" size={24} />,
      label: 'Mainly Sunny',
      bgColor: 'bg-amber-50/60 border-amber-100 text-amber-900',
      textColor: 'text-amber-700'
    };
  };



  // Find the next major event
  const getNextMajorEvent = () => {
    if (!events || events.length === 0) return null;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const todayStr = getTodayISO();
    const futureEvents = sorted.filter(e => e.date >= todayStr);
    return futureEvents.length > 0 ? futureEvents[0] : sorted[sorted.length - 1] || sorted[0];
  };

  const nextEvent = getNextMajorEvent();
  const nextEventDateStr = nextEvent ? nextEvent.date : null;

  // Find index of event date in forecast times
  let eventWeatherIndex = -1;
  if (weatherData && nextEventDateStr) {
    eventWeatherIndex = weatherData.time.indexOf(nextEventDateStr);
  }

  // 1. Calculate active tasks per lane (uncompleted tasks)
  const activeTasksByLane: Record<string, any[]> = {};
  events.forEach((evt) => {
    if (evt.tasks) {
      evt.tasks.forEach((t) => {
        if (!t.completed) {
          const lName = t.lane || 'Strategy';
          if (!activeTasksByLane[lName]) {
            activeTasksByLane[lName] = [];
          }
          activeTasksByLane[lName].push(t);
        }
      });
    }
  });

  // 2. Map lanes to leads
  const LEAD_TASK_CAPACITY = 12;
  const leadStatsMap: Record<string, { leadName: string; lanes: string[]; activeTasksCount: number }> = {};
  lanes.forEach((lane) => {
    const leadName = lane.leadName;
    if (!leadName) return;
    if (!leadStatsMap[leadName]) {
      leadStatsMap[leadName] = { leadName, lanes: [], activeTasksCount: 0 };
    }
    leadStatsMap[leadName].lanes.push(lane.name);
    const tasksInLane = activeTasksByLane[lane.name] || [];
    leadStatsMap[leadName].activeTasksCount += tasksInLane.length;
  });

  const leadStatsList = Object.values(leadStatsMap);
  const overallocatedLeads = leadStatsList.filter(l => l.activeTasksCount > LEAD_TASK_CAPACITY);

  const taskCompletionRate = summary.totalTasks > 0 
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100) 
    : 0;

  // Computed values for KPI and Needs Attention sections
  const overdueTasksCount = events.reduce((count, event) => {
    if (!event.tasks) return count;
    const overdueInEvent = event.tasks.filter(task => !task.completed && task.dueDate && task.dueDate < getTodayISO());
    return count + overdueInEvent.length;
  }, 0);

  const overallocatedLeadsCount = overallocatedLeads.length;
  const missingHighValueCount = summary.missingHighValueCount || 0;

  // Compute past events awaiting a debrief
  const todayStr = getTodayISO();
  const pastEventsAwaitingDebrief = (events || []).filter(evt => {
    const isPast = evt.date < todayStr;
    const hasDebrief = (debriefs || []).some(d => d.name.toLowerCase().trim() === evt.name.toLowerCase().trim());
    return isPast && !hasDebrief;
  });

  const totalAttentionCount = overallocatedLeadsCount + overdueTasksCount + missingHighValueCount + pastEventsAwaitingDebrief.length;

  const attentionItems = [];

  if (overallocatedLeadsCount > 0) {
    const message = overallocatedLeads.length === 1 
      ? `${overallocatedLeads[0].leadName} is over capacity` 
      : `${overallocatedLeads.length} leads over capacity`;
    attentionItems.push({
      id: 'leads-capacity',
      icon: <Activity className="text-rose-500 shrink-0" size={16} />,
      message,
      actionText: 'View workload',
      onClick: () => {
        const el = document.getElementById('team-setup-header');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  if (overdueTasksCount > 0) {
    attentionItems.push({
      id: 'tasks-overdue',
      icon: <Calendar className="text-amber-600 shrink-0" size={16} />,
      message: `${overdueTasksCount} ${overdueTasksCount === 1 ? 'task' : 'tasks'} overdue`,
      actionText: 'View timeline',
      onClick: () => onNavigate('timeline')
    });
  }

  if (missingHighValueCount > 0) {
    attentionItems.push({
      id: 'assets-missing',
      icon: <AlertTriangle className="text-rose-500 shrink-0" size={16} />,
      message: `${missingHighValueCount} high-value ${missingHighValueCount === 1 ? 'asset' : 'assets'} unaccounted for`,
      actionText: 'View logistics',
      onClick: () => onNavigate('logistics')
    });
  }

  // Add past events awaiting debrief to attention list
  pastEventsAwaitingDebrief.forEach(evt => {
    attentionItems.push({
      id: `debrief-awaiting-${evt.id}`,
      icon: <BookOpen className="text-amber-600 shrink-0" size={16} />,
      message: `File a debrief for ${evt.name} (${evt.date})`,
      actionText: 'File debrief',
      onClick: () => {
        if (onPrefillDebrief) {
          onPrefillDebrief({ name: evt.name, date: evt.date, id: evt.id });
        } else {
          onNavigate('debriefs');
        }
      }
    });
  });

  const formatRelativeTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) {
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
        const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return isToday ? `Today at ${timePart}` : `${diffHours}h ago`;
      }
      if (diffDays === 1) {
        const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `Yesterday at ${timePart}`;
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  };

  const getLaneDotColor = (laneName: string) => {
    const key = laneName.toLowerCase();
    if (key.includes('strategy') || key.includes('vision')) return 'bg-indigo-600';
    if (key.includes('finance') || key.includes('budget') || key.includes('money')) return 'bg-emerald-600';
    if (key.includes('media') || key.includes('tech') || key.includes('photo') || key.includes('video')) return 'bg-purple-600';
    if (key.includes('logistics') || key.includes('operations') || key.includes('setup')) return 'bg-sky-600';
    return 'bg-amber-600';
  };

  const getLaneBgAndBorder = (laneName: string) => {
    const key = laneName.toLowerCase();
    if (key.includes('strategy') || key.includes('vision')) return 'bg-indigo-50/40 border border-indigo-100/30';
    if (key.includes('finance') || key.includes('budget') || key.includes('money')) return 'bg-emerald-50/40 border border-emerald-100/30';
    if (key.includes('media') || key.includes('tech') || key.includes('photo') || key.includes('video')) return 'bg-purple-50/40 border border-purple-100/30';
    if (key.includes('logistics') || key.includes('operations') || key.includes('setup')) return 'bg-sky-50/40 border border-sky-100/30';
    return 'bg-amber-50/40 border border-amber-100/30';
  };

  const getLaneBadgeColor = (laneName: string) => {
    const key = laneName.toLowerCase();
    if (key.includes('strategy') || key.includes('vision')) return 'bg-indigo-100 text-indigo-700';
    if (key.includes('finance') || key.includes('budget') || key.includes('money')) return 'bg-emerald-100 text-emerald-700';
    if (key.includes('media') || key.includes('tech') || key.includes('photo') || key.includes('video')) return 'bg-purple-100 text-purple-700';
    if (key.includes('logistics') || key.includes('operations') || key.includes('setup')) return 'bg-sky-100 text-sky-700';
    return 'bg-amber-100 text-amber-700';
  };

  const handleExportCSV = () => {
    // Basic CSV construction using events and summary
    const rows = [];
    
    // Header section for Summary
    rows.push(['--- Overview Summary ---']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Events', summary.totalEvents]);
    rows.push(['Total Assets', summary.totalAssets]);
    rows.push(['Total Volunteers', summary.totalVolunteers]);
    rows.push(['Total Tasks', summary.totalTasks]);
    rows.push(['Completed Tasks', summary.completedTasks]);
    rows.push(['Missing High Value Assets', summary.missingHighValueCount]);
    rows.push(['Overburdened Volunteers', summary.overburdenedVolunteersCount]);
    rows.push([]); // blank line
    
    // Header section for Events
    rows.push(['--- Ministry Events ---']);
    rows.push(['Event ID', 'Name', 'Date', 'Description', 'Budget Cap', 'Tasks Count', 'Documents Count']);
    
    events.forEach(event => {
      // Escape strings containing commas with quotes
      const safeName = `"${event.name.replace(/"/g, '""')}"`;
      const safeDesc = `"${event.description.replace(/"/g, '""')}"`;
      rows.push([
        event.id,
        safeName,
        event.date,
        safeDesc,
        event.budgetCap ?? 'N/A',
        event.tasks?.length || 0,
        event.docs?.length || 0
      ]);
    });

    // Create Blob and trigger download
    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `overview-export-${getTodayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tickerEvent = events.find(e => e.id === selectedEventId) || events[0];
  let tickerDaysOut: number | null = null;
  if (tickerEvent) {
    tickerDaysOut = getDaysOut(tickerEvent.date);
  }

  return (
    <div className="space-y-6">
      {/* Ministry Events at a Glance Section */}
      <div className="space-y-4 animate-fadeIn">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#e2dcd0] gap-4">
          <div>
            <span className="text-xs font-semibold text-[#856637] font-sans">
              Module I • Overview
            </span>
            <h2 className="text-2xl font-serif font-black tracking-tight text-[#1e293b] mt-1">
              Ministry Events at a Glance
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#f5ebd6] hover:bg-[#ebd8b7] text-[#856637] font-bold text-xs rounded-xl border border-[#d6c7b3] transition shadow-sm cursor-pointer"
            >
              <Upload size={14} /> Export to CSV
            </button>
            <button
              onClick={() => onNavigate('timeline')}
              className="px-3.5 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Schedule Event
            </button>
          </div>
        </div>

        {/* SECTION: Status Filter & Event Cards Grid */}
        <div className="space-y-4">
          <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Status:</span>
              <div className="flex items-center gap-1 bg-[#f5ebd6]/30 border border-[#e2dcd0] p-1 rounded-xl shadow-xs">
                {(['all', 'upcoming', 'finished'] as const).map((statusOpt) => (
                  <button
                    key={statusOpt}
                    type="button"
                    onClick={() => setEventStatusFilter(statusOpt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      eventStatusFilter === statusOpt
                        ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {statusOpt === 'all' ? 'All statuses' : statusOpt === 'upcoming' ? 'Upcoming' : 'Finished'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div 
                    key={`skeleton-event-card-${idx}`}
                    className="bg-[#fcfaf7] p-6 rounded-2xl border border-[#e2dcd0] shadow-sm animate-pulse flex flex-col justify-between h-56"
                  >
                    <div className="space-y-2">
                      <div className="h-5 bg-[#efe9dc]/70 rounded w-3/4"></div>
                      <div className="h-3.5 bg-[#efe9dc]/50 rounded w-1/4"></div>
                    </div>
                    <div className="h-8 bg-[#efe9dc]/60 rounded-xl w-1/2"></div>
                    <div className="space-y-3 mt-4">
                      <div className="h-2 bg-[#efe9dc]/50 rounded-full w-full"></div>
                      <div className="flex justify-between">
                        <div className="h-3 bg-[#efe9dc]/50 rounded w-1/4"></div>
                        <div className="h-3 bg-[#efe9dc]/50 rounded w-1/8"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : filteredEvents.map((event) => {
                const daysOut = getDaysOut(event.date);

                // Active milestone step
                const getActiveMilestone = (days: number) => {
                  if (days <= 0) return 'Debrief & Review';
                  if (days <= 14) return 'Final Push';
                  if (days <= 28) return 'Final Push';
                  if (days <= 56) return 'Confirmation';
                  if (days <= 70) return 'Build';
                  if (days <= 84) return 'Planning';
                  return 'Vision & Scope';
                };
                const activeMilestone = getActiveMilestone(daysOut);

                // Progress tracking
                const totalTasks = event.tasks?.length || 0;
                const completedTasks = event.tasks?.filter(t => t.completed).length || 0;
                const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                return (
                  <div 
                    key={event.id}
                    onClick={() => onNavigate('timeline')}
                    className="bg-[#fcfaf7] p-6 rounded-2xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#c2aa80] transition-all cursor-pointer flex flex-col justify-between h-56 group relative overflow-hidden animate-fadeIn"
                  >
                    {/* Header Row */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xl font-serif font-bold text-[#1e293b] leading-snug tracking-tight group-hover:text-black transition">
                          {event.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {formatDisplayDate(event.date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col justify-end h-full">
                        {daysOut < 0 ? (
                          <>
                            <div className="text-3xl font-serif font-bold text-slate-400 leading-none">
                              Done
                            </div>
                            <div className="text-xs font-semibold text-slate-400 mt-1">
                              Finished
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-4xl font-serif font-bold text-[#1e293b] leading-none">
                              {daysOut}
                            </div>
                            <div className="text-xs font-semibold text-slate-450 mt-1">
                              Days out
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Badge/Pill Row */}
                    <div className="mt-2.5 flex justify-between items-center">
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold bg-[#f5ebd6]/80 text-[#856637] border border-[#efe0c2] shadow-sm">
                        Now: {activeMilestone}
                      </span>
                      <div className="flex items-center gap-1">
                        {buildRegistrationLink(event.id) && (
                          <button
                            type="button"
                            onClick={(e) => handleCopyRegLink(e, event.id)}
                            className="p-1.5 text-slate-400 hover:text-[#856637] hover:bg-[#f5ebd6]/50 rounded-lg transition-colors"
                            title={copiedRegId === event.id ? 'Link copied' : 'Copy registration link'}
                          >
                            {copiedRegId === event.id ? <Check size={16} /> : <Link2 size={16} />}
                          </button>
                        )}
                        {buildRegistrationLink(event.id) && (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadQR(e, event)}
                            className="p-1.5 text-slate-400 hover:text-[#856637] hover:bg-[#f5ebd6]/50 rounded-lg transition-colors"
                            title="Download QR code"
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCloneEventTargetId(event.id); setCloneEventNewDate(''); }}
                          className="p-1.5 text-slate-400 hover:text-[#856637] hover:bg-[#f5ebd6]/50 rounded-lg transition-colors "
                          title="Clone to New Year"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Task Progress Footer Row */}
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-[#efe9dc] h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#c2aa80] h-full rounded-full transition-all duration-500" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500">
                        <span>{completedTasks} of {totalTasks} tasks</span>
                        <span className="font-semibold text-slate-700">{progressPercent}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loading && filteredEvents.length === 0 && (
                <div className="col-span-3 p-8 text-center border border-dashed border-[#e2dcd0] rounded-2xl bg-[#fcfaf7] text-slate-400 text-xs">
                  {events.length === 0 
                    ? "No events scheduled yet. Create an event in the reverse-timeline."
                    : "No events match your search/filter criteria."}
                </div>
              )}
            </div>
        </div>

        {/* EVENT SCOPE GLANCEABLE VISUALIZATIONS */}
        {(() => {
          const selectedEvent = events.find(e => e.id === selectedEventId);

          return (
            <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-2xl p-4 shadow-xs animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Title / Info */}
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-[#f5ebd6] text-[#856637] rounded-lg border border-[#efe0c2]">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-serif font-black text-slate-800 flex items-center gap-2">
                      <span>Event Scope Snapshot</span>
                      {selectedEvent && (
                        <span className="text-xs font-sans font-normal text-slate-500">
                          — {selectedEvent.name}
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                {/* Scope selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Scope:</span>
                  <select
                    value={selectedEventId || ''}
                    onChange={(e) => onSelectEvent?.(e.target.value)}
                    className="text-xs font-bold border border-[#efe0c2] bg-[#fcfaf7] rounded-lg px-2.5 py-1 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
                  >
                    <option value="">-- Select Event Scope --</option>
                    {events.map(evt => (
                      <option key={evt.id} value={evt.id}>
                        {evt.name} ({evt.date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="mt-4 pt-3 border-t border-[#efe0c2]/50 grid grid-cols-1 md:grid-cols-3 gap-4 items-center animate-pulse">
                  <div className="h-10 bg-[#efe9dc]/50 rounded-lg w-full"></div>
                  <div className="h-10 bg-[#efe9dc]/50 rounded-lg w-full"></div>
                  <div className="h-10 bg-[#efe9dc]/50 rounded-lg w-full"></div>
                </div>
              ) : !selectedEventId ? (
                <div className="mt-3 py-4 text-center border border-dashed border-[#efe0c2]/60 rounded-xl bg-white text-slate-500 text-xs font-medium">
                  Select an event scope above to see live budget, volunteer, and task progress stats.
                </div>
              ) : !selectedEvent ? (
                <div className="mt-3 py-4 text-center border border-dashed border-[#efe0c2]/60 rounded-xl bg-white text-slate-500 text-xs font-medium">
                  The selected event could not be found. Please select a valid event.
                </div>
              ) : (() => {
                const budgetCap = selectedEvent.budgetCap || 0;
                const eventExpenses = expenses.filter(exp => exp.eventId === selectedEvent.id);
                const totalSpent = eventExpenses.reduce((sum, exp) => sum + exp.cost, 0);
                const overBudget = totalSpent > budgetCap;
                const assignedVolunteers = volunteers.filter(v => v.eventAssignments?.[selectedEvent.id]).length;
                const totalTasksCount = selectedEvent.tasks?.length || 0;
                const completedTasksCount = selectedEvent.tasks?.filter(t => t.completed).length || 0;
                const taskPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

                const daysOut = getDaysOut(selectedEvent.date);

                // Budget status details
                let budgetStatusText = 'On track';
                let budgetStatusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                let budgetBarColorClass = 'bg-emerald-500';
                if (budgetCap > 0) {
                  if (overBudget) {
                    budgetStatusText = 'Over budget';
                    budgetStatusColorClass = 'bg-rose-50 text-rose-700 border-rose-100';
                    budgetBarColorClass = 'bg-rose-500';
                  } else if (totalSpent >= budgetCap * 0.85) {
                    budgetStatusText = 'Near cap';
                    budgetStatusColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                    budgetBarColorClass = 'bg-amber-500';
                  }
                }

                const formattedSpent = totalSpent.toFixed(2);
                const formattedCap = budgetCap > 0 ? budgetCap.toFixed(2) : null;

                return (
                  <div className="mt-4 pt-4 border-t border-[#efe0c2]/50 space-y-4">
                    {/* Compact Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#f5ebd6]/20 p-3 rounded-xl border border-[#efe0c2]/40">
                      <div className="min-w-0">
                        <h4 className="text-sm font-serif font-black text-slate-800 truncate">
                          {selectedEvent.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium font-sans">
                          Scheduled: {formatDisplayDate(selectedEvent.date)}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center">
                        {daysOut < 0 ? (
                          <span className="inline-flex text-[10px] font-bold tracking-wide uppercase bg-slate-150 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200">
                            Finished
                          </span>
                        ) : (
                          <span className="inline-flex text-[10px] font-bold tracking-wide uppercase bg-[#f5ebd6] text-[#856637] px-2.5 py-1 rounded-lg border border-[#efe0c2]">
                            {daysOut} days out
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Responsive Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Tile 1: Budget */}
                      <div className="bg-white border border-[#efe0c2]/60 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-[#c2aa80] h-32">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-[#f5ebd6]/60 text-[#856637] rounded border border-[#efe0c2]/40">
                                <Coins size={14} />
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Budget</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${budgetStatusColorClass}`}>
                              {budgetStatusText}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-lg font-mono font-bold text-slate-800">
                              ${parseFloat(formattedSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">/</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {formattedCap ? `$${parseFloat(formattedCap).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'No limit'}
                            </span>
                          </div>
                        </div>

                        <div className="w-full mt-2">
                          <div className="w-full bg-[#efe9dc]/40 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${budgetBarColorClass}`}
                              style={{ width: `${budgetCap > 0 ? Math.min((totalSpent / budgetCap) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tile 2: Volunteers Assigned */}
                      <div className="bg-white border border-[#efe0c2]/60 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-[#c2aa80] h-32">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="p-1 bg-[#f5ebd6]/60 text-[#856637] rounded border border-[#efe0c2]/40">
                              <Users size={14} />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Volunteers</span>
                          </div>
                          <div className="text-2xl font-serif font-black text-slate-800 mt-1">
                            {assignedVolunteers}
                          </div>
                        </div>

                        <div className="mt-2">
                          {assignedVolunteers === 0 ? (
                            <p className="text-[10px] text-amber-600/80 font-semibold italic bg-amber-50/50 border border-amber-100/50 px-2 py-1 rounded">
                              None yet
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              {assignedVolunteers === 1 ? '1 coordinator / worker' : `${assignedVolunteers} coordinators & workers`}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tile 3: Task Progress */}
                      <div className="bg-white border border-[#efe0c2]/60 rounded-xl p-4 flex flex-col justify-between transition-all hover:border-[#c2aa80] h-32">
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="p-1 bg-[#f5ebd6]/60 text-[#856637] rounded border border-[#efe0c2]/40">
                              <Check size={14} />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Task Progress</span>
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-xl font-mono font-bold text-slate-800">
                              {taskPercent}%
                            </span>
                            <span className="text-xs text-slate-450 font-medium">
                              ({completedTasksCount} / {totalTasksCount})
                            </span>
                          </div>
                        </div>

                        <div className="w-full mt-2">
                          <div className="w-full bg-[#efe9dc]/40 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#856637] h-full rounded-full transition-all duration-300"
                              style={{ width: `${taskPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Section A: At-a-glance KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 2: Volunteers */}
          <div className="bg-white border border-[#e2dcd0] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Volunteers</span>
            <span className="text-2xl font-serif font-black text-slate-800 mt-1">{summary.totalVolunteers}</span>
          </div>

          {/* Card 3: Task progress */}
          <div className="bg-white border border-[#e2dcd0] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <span className="text-xs text-slate-400 font-medium">Task progress</span>
            <div className="mt-1">
              <span className="text-2xl font-serif font-black text-slate-800">{taskCompletionRate}%</span>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-[#856637] h-full rounded-full transition-all duration-300" 
                  style={{ width: `${taskCompletionRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Section B: Needs attention panel */}
        <div className="bg-white border border-[#e2dcd0] rounded-2xl p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <AlertTriangle size={16} className="text-[#856637]" />
            <h3 className="text-sm font-serif font-black text-slate-800">Needs attention</h3>
          </div>

          {attentionItems.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs flex items-center justify-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <span>All clear — nothing needs attention right now.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attentionItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-4">
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span className="text-xs text-slate-700 font-medium">{item.message}</span>
                  </div>
                  <button
                    onClick={item.onClick}
                    className="text-[11px] font-bold text-[#856637] hover:text-[#5c4422] transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>{item.actionText}</span>
                    <ChevronRight size={12} className="stroke-[2.5]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area for Analytics, Burnout, and Lanes */}
      <div className="space-y-6">

          {/* Weather summary widget */}
          {loading ? (
            <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-4 shadow-xs animate-pulse flex items-center justify-between">
              <div className="h-4 bg-[#efe9dc]/70 rounded w-1/4"></div>
              <div className="h-4 bg-[#efe9dc]/70 rounded w-12"></div>
            </div>
          ) : (
            <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#efe0c2]/60 pb-2">
                <div className="flex items-center gap-2">
                  <Sun className="text-amber-500 animate-pulse shrink-0" size={16} />
                  <h3 className="text-sm font-serif font-black text-slate-800">Weather Forecast</h3>
                </div>
                
                {/* City Selection Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                    <MapPin size={12} /> City:
                  </span>
                  <select
                    value={selectedCity.name}
                    onChange={(e) => {
                      const city = CITIES.find(c => c.name === e.target.value);
                      if (city) setSelectedCity(city);
                    }}
                    className="text-xs font-bold border border-[#efe0c2] bg-[#fcfaf7] rounded-md px-2 py-0.5 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
                  >
                    {CITIES.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weather Widget Content */}
              {weatherLoading ? (
                <div className="flex items-center justify-center py-3 text-slate-400 gap-2">
                  <Loader2 className="animate-spin text-[#c2aa80]" size={14} />
                  <span className="text-xs font-medium">Fetching meteorological forecast...</span>
                </div>
              ) : weatherError ? (
                <div className="bg-rose-50 border border-rose-100 rounded-lg py-2 px-3 text-center text-xs text-rose-700 flex items-center justify-center gap-2">
                  <AlertTriangle size={14} />
                  <span>Error: {weatherError}. Retrying soon.</span>
                </div>
              ) : weatherData ? (
                <div className="space-y-2">
                  {nextEvent ? (
                    eventWeatherIndex !== -1 ? (
                      /* Case 1: Event within 16-day range */
                      (() => {
                        const code = weatherData.weathercode[eventWeatherIndex];
                        const maxTemp = weatherData.temperature_2m_max[eventWeatherIndex];
                        const minTemp = weatherData.temperature_2m_min[eventWeatherIndex];
                        const rainProb = weatherData.precipitation_probability_max[eventWeatherIndex];
                        const details = getWeatherDetails(code);

                        return (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-[#856637] bg-[#f5ebd6]/60 border border-[#efe0c2] px-1.5 py-0.5 rounded">
                                  Event Day Weather
                                </span>
                                <strong className="text-slate-800 truncate">{nextEvent.name}</strong>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Scheduled for {formatDisplayDate(nextEvent.date)}
                              </p>
                            </div>

                            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${details.bgColor} max-w-xs w-full sm:w-auto shrink-0`}>
                              <div className="shrink-0 scale-75 origin-left">
                                {React.cloneElement(details.icon as React.ReactElement, { size: 16 })}
                              </div>
                              <div className="min-w-0 leading-tight">
                                <span className="text-[10px] font-extrabold block uppercase tracking-wide opacity-75">{details.label}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs font-mono font-bold">{Math.round(maxTemp)}°C</span>
                                  <span className="text-[10px] opacity-75">/ {Math.round(minTemp)}°C</span>
                                  <span className="text-[10px] opacity-75 ml-1 flex items-center gap-0.5">
                                    💧 {rainProb}%
                                  </span>
                                  {rainProb > 40 && (
                                    <span className="text-rose-700 font-bold bg-rose-50 border border-rose-100 px-1 rounded text-[9px] whitespace-nowrap">
                                      Plan Indoors
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* Case 2: Event outside range. Show nearest 5 days + small note */
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Event Beyond 16-Day Range ({formatDisplayDate(nextEvent.date)})
                              </span>
                              <span className="text-xs font-medium text-slate-800 truncate">{nextEvent.name}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Nearest available outlook for {selectedCity.name}:
                            </p>
                          </div>
                          {weatherData.precipitation_probability_max.slice(0, 5).some((prob: number) => prob > 40) && (
                            <span className="text-rose-700 font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                              ⚠️ Plan Indoors
                            </span>
                          )}
                        </div>

                        <div className="flex items-stretch gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {weatherData.time.slice(0, 5).map((dateStr: string, i: number) => {
                            const code = weatherData.weathercode[i];
                            const maxTemp = weatherData.temperature_2m_max[i];
                            const minTemp = weatherData.temperature_2m_min[i];
                            const rainProb = weatherData.precipitation_probability_max[i];
                            const details = getWeatherDetails(code);

                            const [y, m, d] = dateStr.split('-');
                            const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayMonth = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

                            return (
                              <div 
                                key={dateStr}
                                className="flex-1 min-w-[76px] bg-white border border-[#efe0c2]/60 rounded-lg p-2 flex flex-col items-center justify-between text-center space-y-1 hover:border-[#c2aa80] transition"
                              >
                                <div className="leading-none">
                                  <span className="text-[11px] font-bold text-slate-700 block">{weekday}</span>
                                  <span className="text-[9px] text-slate-400 block mt-0.5">{dayMonth}</span>
                                </div>
                                <div className="scale-75 my-0.5">
                                  {React.cloneElement(details.icon as React.ReactElement, { size: 16 })}
                                </div>
                                <div className="leading-tight">
                                  <div className="text-[10px] font-mono font-bold text-slate-800">
                                    {Math.round(maxTemp)}° / {Math.round(minTemp)}°
                                  </div>
                                  <div className="text-[9px] text-slate-500 mt-0.5 flex items-center justify-center gap-0.5">
                                    💧 {rainProb}%
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    /* Case 3: No event, show general 5-day outlook */
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            General Outlook
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Upcoming 5-day weather outlook for {selectedCity.name}:
                          </p>
                        </div>
                      </div>

                      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 scrollbar-thin">
                        {weatherData.time.slice(0, 5).map((dateStr: string, i: number) => {
                          const code = weatherData.weathercode[i];
                          const maxTemp = weatherData.temperature_2m_max[i];
                          const minTemp = weatherData.temperature_2m_min[i];
                          const rainProb = weatherData.precipitation_probability_max[i];
                          const details = getWeatherDetails(code);

                          const [y, m, d] = dateStr.split('-');
                          const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const dayMonth = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

                          return (
                            <div 
                              key={dateStr}
                              className="flex-1 min-w-[76px] bg-white border border-[#efe0c2]/60 rounded-lg p-2 flex flex-col items-center justify-between text-center space-y-1 hover:border-[#c2aa80] transition"
                            >
                              <div className="leading-none">
                                <span className="text-[11px] font-bold text-slate-700 block">{weekday}</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">{dayMonth}</span>
                              </div>
                              <div className="scale-75 my-0.5">
                                {React.cloneElement(details.icon as React.ReactElement, { size: 16 })}
                              </div>
                              <div className="leading-tight">
                                <div className="text-[10px] font-mono font-bold text-slate-800">
                                  {Math.round(maxTemp)}° / {Math.round(minTemp)}°
                                </div>
                                <div className="text-[9px] text-slate-500 mt-0.5 flex items-center justify-center gap-0.5">
                                  💧 {rainProb}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-400 italic py-2">
                  Unable to load weather forecast data.
                </div>
              )}
            </div>
          )}

      </div>

      {/* Team setup section */}
      <div className="bg-white border border-[#e2dcd0] rounded-2xl overflow-hidden shadow-xs">
        <div
          id="team-setup-header"
          className="w-full flex items-center justify-between p-5 bg-[#fcfaf7] border-b border-[#e2dcd0] text-left"
        >
          <div className="flex items-center gap-3">
            <Settings className="text-[#856637]" size={18} />
            <div>
              <h3 className="font-serif font-black text-slate-800 text-sm leading-tight">Team setup</h3>
              <p className="text-[10px] text-slate-400 font-medium">Manage ministry lanes and lead team coordinators</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#efe0c2]/30">
              <div>
                <h4 className="text-sm font-serif font-bold text-[#1e293b]">Ministry Lanes & Leads</h4>
                <p className="text-xs text-slate-500">
                  Workloads are categorized into tactical lanes. Each has an assigned coordinator on the lead team.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsManaging(!isManaging);
                  setEditingLaneId(null);
                }}
                className="flex items-center justify-center gap-1.5 border border-[#e2dcd0] bg-[#faf8f4] hover:bg-[#f5ebd6]/50 text-slate-700 font-medium text-xs px-3 py-1.5 rounded-lg transition self-start sm:self-auto cursor-pointer"
              >
                <Settings size={14} />
                {isManaging ? 'Done Editing' : 'Edit Lanes & Leads'}
              </button>
            </div>

            {!isManaging ? (
              <div className="space-y-6">
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Ministry Lanes</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {lanes.map((lane) => (
                      <div key={lane.id} className={`flex items-center justify-between p-3 rounded-lg ${getLaneBgAndBorder(lane.name)}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getLaneDotColor(lane.name)}`} />
                          <span className="text-xs font-semibold text-slate-700">{lane.name} Lane</span>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getLaneBadgeColor(lane.name)}`}>
                          Lead: {lane.leadName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lead Burnout Watch</h5>
                  <p className="text-xs text-slate-500 mb-3">Keep leads under the task limit to avoid burnout.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {leadStatsList.map((lead, idx) => {
                      const isOver = lead.activeTasksCount > LEAD_TASK_CAPACITY;
                      return (
                        <div 
                          key={idx} 
                          className={`p-3.5 rounded-xl border transition ${
                            isOver 
                              ? 'bg-rose-50/40 border-rose-200 text-slate-900 shadow-xs' 
                              : 'bg-[#faf8f4]/60 border-[#efe0c2] text-slate-800'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-serif font-bold text-xs flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{lead.leadName}</span>
                                {isOver ? (
                                  <span className="inline-flex text-[9px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                                    At risk of burnout
                                  </span>
                                ) : (
                                  <span className="inline-flex text-[9px] font-semibold bg-[#f5ebd6] text-[#856637] px-1.5 py-0.5 rounded border border-[#efe0c2]">
                                    Safe workload
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                Lanes: {lead.lanes.join(', ')}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold font-mono">
                                {lead.activeTasksCount} <span className="text-slate-400 font-sans font-medium">/ {LEAD_TASK_CAPACITY} Tasks</span>
                              </p>
                            </div>
                          </div>

                          {/* Load bar */}
                          <div className="mt-3 text-[10px] font-semibold text-slate-500 border-t border-[#efe0c2]/30 pt-2">
                            <div>
                              <span className="block text-[9px] text-slate-400">Task Limit ({LEAD_TASK_CAPACITY})</span>
                              <div className="w-full bg-[#efe9dc]/40 h-1.5 rounded-full overflow-hidden mt-0.5">
                                <div 
                                  className={`h-full rounded-full ${lead.activeTasksCount > LEAD_TASK_CAPACITY ? 'bg-rose-500' : 'bg-[#c2aa80]'}`}
                                  style={{ width: `${Math.min((lead.activeTasksCount / LEAD_TASK_CAPACITY) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Table of lanes */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dcd0] text-xs font-semibold text-slate-500">
                        <th className="py-2 px-3">Lane name</th>
                        <th className="py-2 px-3">Lead coordinator</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dcd0] text-xs">
                      {lanes.map((lane) => {
                        const isEditing = editingLaneId === lane.id;
                        return (
                          <tr key={lane.id} className="hover:bg-[#faf8f4]">
                            <td className="py-2 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="border border-[#e2dcd0] bg-[#faf8f4] px-2 py-1 rounded w-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                />
                              ) : (
                                <div className="flex items-center gap-2 font-semibold text-slate-800">
                                  <div className={`w-2 h-2 rounded-full ${getLaneDotColor(lane.name)}`} />
                                  {lane.name}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editLeadName}
                                  onChange={(e) => setEditLeadName(e.target.value)}
                                  className="border border-[#e2dcd0] bg-[#faf8f4] px-2 py-1 rounded w-full text-xs focus:outline-none focus:ring-1 focus:ring-[#c2aa80]"
                                />
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getLaneBadgeColor(lane.name)}`}>
                                  {lane.leadName}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right space-x-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      if (editName.trim() && editLeadName.trim() && onUpdateLane) {
                                        await onUpdateLane(lane.id, editName, editLeadName);
                                        setEditingLaneId(null);
                                      }
                                    }}
                                    className="p-1 text-emerald-650 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Save Changes"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingLaneId(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingLaneId(lane.id);
                                      setEditName(lane.name);
                                      setEditLeadName(lane.leadName);
                                    }}
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded hover:text-slate-700 cursor-pointer"
                                    title="Edit Lane"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (lanes.length <= 1) {
                                        alert("Cannot delete the last remaining ministry lane.");
                                        return;
                                      }
                                      
                                      const isConfirmed = await confirmAction(
                                        "Delete Lane",
                                        `Are you sure you want to delete "${lane.name}"? All tasks and assets assigned to it will be moved to the fallback lane.`
                                      );
                                      if (isConfirmed) {
                                        if (onDeleteLane) {
                                          await onDeleteLane(lane.id);
                                        }
                                      }
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                                    title="Delete Lane"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add New Lane Row */}
                <div className="bg-[#faf8f4] p-4 rounded-xl border border-[#e2dcd0] space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Add New Ministry Lane</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Lane Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Hospitality, Outreach"
                        value={newLaneName}
                        onChange={(e) => setNewLaneName(e.target.value)}
                        className="border border-[#e2dcd0] px-2.5 py-1.5 rounded text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-semibold mb-1">Lead Coordinator</label>
                      <input
                        type="text"
                        placeholder="e.g. Pastor Dan"
                        value={newLaneLeadName}
                        onChange={(e) => setNewLaneLeadName(e.target.value)}
                        className="border border-[#e2dcd0] px-2.5 py-1.5 rounded text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-white font-semibold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={async () => {
                        if (newLaneName.trim() && newLaneLeadName.trim() && onCreateLane) {
                          await onCreateLane(newLaneName, newLaneLeadName);
                          setNewLaneName('');
                          setNewLaneLeadName('');
                        } else {
                          alert("Both Lane Name and Lead Coordinator are required.");
                        }
                      }}
                      disabled={laneLoading}
                      className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#0f172a] disabled:opacity-50 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <Plus size={14} />
                      {laneLoading ? 'Adding...' : 'Add Lane'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>



      {/* Floating Quick Actions Menu */}
      <div className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-3 select-none">
        <AnimatePresence>
          {isQuickActionsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2.5 items-end mb-1"
            >
              {/* Option: Create Event */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-slate-800 font-serif font-bold text-[10px] px-2.5 py-1 rounded-md border border-[#e2dcd0] shadow-sm tracking-wide">
                  New Event
                </span>
                <button
                  onClick={() => openQuickAction('event')}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 text-[#856637] border border-[#e2dcd0] shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Create New Event"
                >
                  <Calendar size={16} />
                </button>
              </div>

              {/* Option: Register Volunteer */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-slate-800 font-serif font-bold text-[10px] px-2.5 py-1 rounded-md border border-[#e2dcd0] shadow-sm tracking-wide">
                  New Volunteer
                </span>
                <button
                  onClick={() => openQuickAction('volunteer')}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 text-[#856637] border border-[#e2dcd0] shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Register New Volunteer"
                >
                  <Users size={16} />
                </button>
              </div>

              {/* Option: Inject Task */}
              <div className="flex items-center gap-2 group">
                <span className="bg-white/95 text-slate-800 font-serif font-bold text-[10px] px-2.5 py-1 rounded-md border border-[#e2dcd0] shadow-sm tracking-wide">
                  New Task
                </span>
                <button
                  onClick={() => openQuickAction('task')}
                  className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 text-[#856637] border border-[#e2dcd0] shadow-md flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Inject Custom Task"
                >
                  <Check size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 cursor-pointer ${
            isQuickActionsOpen 
              ? 'bg-rose-500 hover:bg-rose-600 rotate-45' 
              : 'bg-[#1e293b] hover:bg-[#0f172a] hover:shadow-xl hover:scale-105'
          }`}
          title="Quick Actions Menu"
        >
          {isQuickActionsOpen ? <X size={22} /> : <Zap size={22} className="fill-current" />}
        </button>
      </div>

      {/* Quick Action Modals */}
      <AnimatePresence>
        {activeQuickAction && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <motion.div
              ref={quickActionModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-action-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#e2dcd0] shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-[#fcfaf7] p-5 border-b border-[#e2dcd0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-[#856637] fill-[#efe0c2]/50 animate-pulse" size={20} aria-hidden="true" />
                  <div>
                    <h3 id="quick-action-title" className="font-serif font-black text-slate-800 text-sm leading-tight">
                      {activeQuickAction === 'task' && 'Quick Add: Custom Task'}
                      {activeQuickAction === 'volunteer' && 'Quick Action: Register Volunteer'}
                      {activeQuickAction === 'event' && 'Quick Action: Plan Event'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {activeQuickAction === 'task' && 'Inject a critical task immediately into an existing event timeline.'}
                      {activeQuickAction === 'volunteer' && 'Onboard a new volunteer profile directly into the ministry registry.'}
                      {activeQuickAction === 'event' && 'Launch a new event timeline with automatic template preparation.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveQuickAction(null)}
                  aria-label="Close quick action modal"
                  className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Modal Form Content */}
              <div className="p-6">
                {activeQuickAction === 'task' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!quickTaskEventId) {
                        alert("Please select or create an event first.");
                        return;
                      }
                      if (!quickTaskTitle.trim()) {
                        alert("Task title is required.");
                        return;
                      }
                      if (onAddTask) {
                        await onAddTask(quickTaskEventId, {
                          title: quickTaskTitle.trim(),
                          description: quickTaskDesc.trim(),
                          milestoneKey: quickTaskMilestone,
                          lane: quickTaskLane || 'Outreach',
                          dueDate: quickTaskDueDate,
                          assignedTo: quickTaskAssignedTo ? quickTaskAssignedTo : undefined
                        });
                        setActiveQuickAction(null);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Target event *</label>
                      <select
                        required
                        value={quickTaskEventId}
                        onChange={(e) => setQuickTaskEventId(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer font-medium"
                      >
                        {events.length === 0 ? (
                          <option value="">-- No Active Events Exist --</option>
                        ) : (
                          events.map(ev => (
                            <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Task title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Set up soundboard"
                          value={quickTaskTitle}
                          onChange={(e) => setQuickTaskTitle(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Milestone phase *</label>
                        <select
                          required
                          value={quickTaskMilestone}
                          onChange={(e) => setQuickTaskMilestone(e.target.value as MilestoneKey)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer font-medium text-slate-700"
                        >
                          <option value="12_weeks_out">12 Weeks Out (Strategy)</option>
                          <option value="10_weeks_out">10 Weeks Out (Reservations)</option>
                          <option value="8_weeks_out">8 Weeks Out (Promotion)</option>
                          <option value="4_weeks_out">4 Weeks Out (Logistics)</option>
                          <option value="2_weeks_out">2 Weeks Out (Fulfillment)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Description *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Detailed requirements for this task..."
                        value={quickTaskDesc}
                        onChange={(e) => setQuickTaskDesc(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Department / lane *</label>
                        <select
                          required
                          value={quickTaskLane}
                          onChange={(e) => setQuickTaskLane(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer font-medium text-slate-700"
                        >
                          {lanes.map(l => (
                            <option key={l.id} value={l.name}>{l.name}</option>
                          ))}
                          <option value="Outreach">Outreach</option>
                          <option value="Pastoral Care">Pastoral Care</option>
                          <option value="Media & Tech">Media &amp; Tech</option>
                          <option value="Youth & Children">Youth &amp; Children</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Due date *</label>
                        <input
                          type="date"
                          required
                          value={quickTaskDueDate}
                          onChange={(e) => setQuickTaskDueDate(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned lead</label>
                        <select
                          value={quickTaskAssignedTo}
                          onChange={(e) => setQuickTaskAssignedTo(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer font-medium text-slate-700"
                        >
                          <option value="">-- Unassigned --</option>
                          {/* List leads from lanes */}
                          {Array.from(new Set(lanes.map(l => l.leadName))).map(lead => (
                            <option key={lead} value={lead}>{lead}</option>
                          ))}
                          {/* List volunteers */}
                          {volunteers.map(v => (
                            <option key={v.id} value={v.name}>{v.name} (Volunteer)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveQuickAction(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        Inject Task
                      </button>
                    </div>
                  </form>
                )}

                {activeQuickAction === 'volunteer' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!quickVolName.trim() || !quickVolEmail.trim()) {
                        alert("Volunteer name and email are required.");
                        return;
                      }
                      if (onCreateVolunteer) {
                        await onCreateVolunteer({
                          name: quickVolName.trim(),
                          email: quickVolEmail.trim(),
                          phone: quickVolPhone.trim(),
                          roles: quickVolRoles ? quickVolRoles.split(',').map(r => r.trim()).filter(Boolean) : [],
                          skills: quickVolSkills.trim(),
                          notes: quickVolNotes.trim(),
                          emails: [],
                          eventAssignments: {}
                        });
                        setActiveQuickAction(null);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Full name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Deborah Vance"
                          value={quickVolName}
                          onChange={(e) => setQuickVolName(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Email address *</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. deborah@example.com"
                          value={quickVolEmail}
                          onChange={(e) => setQuickVolEmail(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs font-medium text-slate-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Phone number</label>
                        <input
                          type="tel"
                          placeholder="e.g. (202) 555-0193"
                          value={quickVolPhone}
                          onChange={(e) => setQuickVolPhone(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Primary skills / tags</label>
                        <input
                          type="text"
                          placeholder="e.g. Photography, AV, Coding"
                          value={quickVolSkills}
                          onChange={(e) => setQuickVolSkills(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned roles / stations (comma-separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. Audio Lead, Welcome Desk"
                        value={quickVolRoles}
                        onChange={(e) => setQuickVolRoles(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Separating roles with commas automatically indexes them inside the volunteer database.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Onboarding notes</label>
                      <textarea
                        rows={2}
                        placeholder="General availability, background notes, or preferences..."
                        value={quickVolNotes}
                        onChange={(e) => setQuickVolNotes(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveQuickAction(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        Register Volunteer
                      </button>
                    </div>
                  </form>
                )}

                {activeQuickAction === 'event' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!quickEventName.trim() || !quickEventDate) {
                        alert("Event name and date are required.");
                        return;
                      }
                      if (onCreateEvent) {
                        await onCreateEvent(
                          quickEventName.trim(),
                          quickEventDate,
                          quickEventDesc.trim()
                        );
                        setActiveQuickAction(null);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Event title *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Free Car Wash & BBQ"
                          value={quickEventName}
                          onChange={(e) => setQuickEventName(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs font-semibold text-slate-800"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Launch date *</label>
                        <input
                          type="date"
                          required
                          value={quickEventDate}
                          onChange={(e) => setQuickEventDate(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer text-slate-700 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Strategic description *</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="The core spiritual mission and physical outcomes of this timeline..."
                        value={quickEventDesc}
                        onChange={(e) => setQuickEventDesc(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                    </div>

                    <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl text-[10px] text-amber-800 flex gap-2">
                      <Info size={16} className="text-amber-700 shrink-0 mt-0.5 animate-bounce" />
                      <p>
                        <strong>Timeline Automation:</strong> Creating a new event automatically seeds it with template-driven milestones (strategy, promotion, reservation, fulfillment) and maps standard operational tasks across ministry lanes.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveQuickAction(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        Plan Event
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clone Event Modal */}
      <AnimatePresence>
        {cloneEventTargetId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              ref={cloneEventModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clone-event-overview-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
            >
              <div className="bg-[#faf8f4] border-b border-[#efe0c2] px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 id="clone-event-overview-title" className="font-serif font-bold text-slate-800 text-lg">Clone Event to New Year</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-semibold">Rollover setup</p>
                </div>
                <button 
                  onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                  aria-label="Close clone event modal"
                  className="text-slate-400 hover:text-slate-600 p-1 transition cursor-pointer"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">New event date *</label>
                  <input
                    type="date"
                    required
                    value={cloneEventNewDate}
                    onChange={(e) => setCloneEventNewDate(e.target.value)}
                    className="w-full p-2 border border-[#e2dcd0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#856637] bg-white text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    This will create a fresh copy of the event on this new date. Tasks and asset reservations will be copied but reset to pending/incomplete states.
                  </p>
                </div>

                {/* Carry Volunteers Checklist */}
                <div className="border-t border-slate-100 pt-3">
                  <span className="block text-xs font-semibold text-slate-500 mb-1.5">
                    Carry these volunteers forward (uncheck anyone not returning)
                  </span>
                  {assignedVolunteersForClone.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No volunteers assigned yet</p>
                  ) : (
                    <div className="max-h-28 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2 bg-slate-50">
                      {assignedVolunteersForClone.map((vol) => {
                        const isChecked = selectedVolIds.includes(vol.id);
                        const assignment = vol.eventAssignments?.[cloneEventTargetId!];
                        const roleDesc = assignment ? ` (${assignment.role}${assignment.station ? ` @ ${assignment.station}` : ''})` : '';
                        return (
                          <label key={vol.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVolIds(prev => [...prev, vol.id]);
                                } else {
                                  setSelectedVolIds(prev => prev.filter(id => id !== vol.id));
                                }
                              }}
                              className="rounded text-[#856637] focus:ring-[#856637]"
                            />
                            <span className="truncate">
                              <span className="font-medium text-slate-800">{vol.name}</span>
                              <span className="text-slate-500 text-[11px]">{roleDesc}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Copy Equipment Option */}
                <div className="border-t border-slate-100 pt-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={copyEquipment}
                      onChange={(e) => setCopyEquipment(e.target.checked)}
                      className="rounded text-[#856637] focus:ring-[#856637]"
                    />
                    <span>Copy reserved equipment</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-5">
                    Carries forward reserved assets for this event (status is reset to Pending).
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!cloneEventNewDate || !onCloneEvent) return;
                      setIsCloning(true);
                      await onCloneEvent(cloneEventTargetId, cloneEventNewDate, selectedVolIds, copyEquipment);
                      setIsCloning(false);
                      setCloneEventTargetId(null);
                      setCloneEventNewDate('');
                    }}
                    disabled={!cloneEventNewDate || isCloning}
                    className="px-4 py-2 bg-[#856637] hover:bg-[#6c532b] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isCloning ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                    {isCloning ? 'Cloning...' : 'Confirm Clone'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

export default React.memo(DashboardOverview);
