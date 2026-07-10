import React, { useState } from 'react';
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
  LayoutGrid,
  List,
  Upload, Copy
} from 'lucide-react';
import { LaneDetail, MinistryEvent, RecentActivity, Volunteer, MilestoneKey, MinistryLane } from '../types';
import ConfirmDialog from './ConfirmDialog';

interface SummaryData {
  totalEvents: number;
  totalAssets: number;
  totalVolunteers: number;
  totalTasks: number;
  completedTasks: number;
  missingHighValueCount: number;
  overburdenedVolunteersCount: number;
  nonCompliantVolunteersCount: number;
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
  onCloneEvent?: (id: string, newDate: string) => Promise<void>;
  onAddTask?: (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string; assignedTo?: string }) => Promise<void>;
  onCreateVolunteer?: (volunteerData: Omit<Volunteer, 'id'>) => Promise<void>;
  onUploadCompleted?: () => Promise<void>;
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
  onUploadCompleted
 }: DashboardOverviewProps) {
  const [selectedCity, setSelectedCity] = React.useState(CITIES[0]);

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
  const [viewMode, setViewMode] = React.useState<'grid' | 'calendar'>('grid');
  const [calendarMonth, setCalendarMonth] = React.useState<number>(new Date('2026-07-08').getMonth()); // July is index 6
  const [calendarYear, setCalendarYear] = React.useState<number>(new Date('2026-07-08').getFullYear()); // 2026
  const [selectedCalendarDay, setSelectedCalendarDay] = React.useState<string | null>(null); // YYYY-MM-DD
  const [weatherData, setWeatherData] = React.useState<any>(null);
  const [weatherLoading, setWeatherLoading] = React.useState(false);
  const [weatherError, setWeatherError] = React.useState<string | null>(null);

  const [isManaging, setIsManaging] = React.useState(false);
  const [editingLaneId, setEditingLaneId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editLeadName, setEditLeadName] = React.useState('');

  const [newLaneName, setNewLaneName] = React.useState('');
  const [newLaneLeadName, setNewLaneLeadName] = React.useState('');

  const [showBurnoutModal, setShowBurnoutModal] = React.useState(false);
  const [hoveredBurnout, setHoveredBurnout] = React.useState(false);

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

  const burnoutModalRef = useFocusTrap(showBurnoutModal, () => setShowBurnoutModal(false));
  const quickActionModalRef = useFocusTrap(!!activeQuickAction, () => setActiveQuickAction(null));
  const cloneEventModalRef = useFocusTrap(!!cloneEventTargetId, () => {
    setCloneEventTargetId(null);
    setCloneEventNewDate('');
  });

  // Search and Filter states for Events
  const [eventSearchTerm, setEventSearchTerm] = React.useState('');
  const [eventStatusFilter, setEventStatusFilter] = React.useState<'all' | 'upcoming' | 'finished'>('all');

  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.name.toLowerCase().includes(eventSearchTerm.toLowerCase().trim());
      
      const [y1, m1, dd1] = event.date.split('-');
      const eventDate = new Date(parseInt(y1, 10), parseInt(m1, 10) - 1, parseInt(dd1, 10));
      const today = new Date(2026, 6, 6); // July 6, 2026
      const d1 = Date.UTC(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const diffDays = Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
      const daysOut = isNaN(diffDays) ? 0 : diffDays;

      if (eventStatusFilter === 'upcoming') {
        return matchesSearch && daysOut >= 0;
      } else if (eventStatusFilter === 'finished') {
        return matchesSearch && daysOut < 0;
      }
      return matchesSearch;
    });
  }, [events, eventSearchTerm, eventStatusFilter]);



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
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setQuickTaskDueDate(d.toISOString().split('T')[0]);
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
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setQuickEventDate(d.toISOString().split('T')[0]);
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

  // Reusable formatHumanDate helper
  const formatHumanDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return d.toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr;
    }
  };

  // Find the next major event
  const getNextMajorEvent = () => {
    if (!events || events.length === 0) return null;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const todayStr = '2026-07-08'; // System current local date
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
  const leadStatsMap: Record<string, { leadName: string; lanes: string[]; activeTasksCount: number; weeklyHours: number }> = {};
  lanes.forEach((lane) => {
    const leadName = lane.leadName;
    if (!leadName) return;
    if (!leadStatsMap[leadName]) {
      leadStatsMap[leadName] = { leadName, lanes: [], activeTasksCount: 0, weeklyHours: 0 };
    }
    leadStatsMap[leadName].lanes.push(lane.name);
    const tasksInLane = activeTasksByLane[lane.name] || [];
    leadStatsMap[leadName].activeTasksCount += tasksInLane.length;
    const hoursInLane = tasksInLane.reduce((sum, t) => sum + (t.estimatedHours || 2), 0);
    leadStatsMap[leadName].weeklyHours += hoursInLane;
  });

  const leadStatsList = Object.values(leadStatsMap);
  const overallocatedLeads = leadStatsList.filter(l => l.activeTasksCount > 15 || l.weeklyHours > 20);

  const taskCompletionRate = summary.totalTasks > 0 
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100) 
    : 0;

  const formatRelativeTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      // July 7, 2026, 21:24:25 local time
      const now = new Date('2026-07-07T21:24:25-07:00');
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

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to get number of days in the month
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  // Helper to get first day of the week index (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  // Generate calendar cells (padding + actual days)
  const calendarDays: { day: number | null; dateString: string | null }[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push({ day: null, dateString: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, dateString: dateStr });
  }

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
    setSelectedCalendarDay(null);
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
    setSelectedCalendarDay(null);
  };

  const handleExportCSV = () => {
    // Basic CSV construction using events and summary
    const rows = [];
    
    // Header section for Summary
    rows.push(['--- Command Overview Summary ---']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Events', summary.totalEvents]);
    rows.push(['Total Assets', summary.totalAssets]);
    rows.push(['Total Volunteers', summary.totalVolunteers]);
    rows.push(['Total Tasks', summary.totalTasks]);
    rows.push(['Completed Tasks', summary.completedTasks]);
    rows.push(['Missing High Value Assets', summary.missingHighValueCount]);
    rows.push(['Overburdened Volunteers', summary.overburdenedVolunteersCount]);
    rows.push(['Non-Compliant Volunteers', summary.nonCompliantVolunteersCount]);
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
    link.setAttribute('download', `command-overview-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tickerEvent = events.find(e => e.id === selectedEventId) || events[0];
  let tickerDaysOut: number | null = null;
  if (tickerEvent) {
    const [y1, m1, dd1] = tickerEvent.date.split('-');
    const eventDate = new Date(parseInt(y1, 10), parseInt(m1, 10) - 1, parseInt(dd1, 10));
    const today = new Date(2026, 6, 6); // July 6, 2026 for consistency with rest of app
    
    const d1 = Date.UTC(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
    tickerDaysOut = isNaN(diffDays) ? 0 : diffDays;
  }

  return (
    <div className="space-y-6">
      {/* Ministry Events at a Glance Section */}
      <div className="space-y-4 animate-fadeIn">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 border-b border-[#e2dcd0] gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#856637] font-sans">
              Module I • Command & Control Center
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
            {/* View Mode Toggle Switch */}
            <div className="flex items-center gap-1 bg-[#f5ebd6]/30 border border-[#e2dcd0] p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid size={13} /> Grid
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'calendar'
                    ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar size={13} /> Calendar Mode
              </button>
            </div>

            <button
              onClick={() => onNavigate('timeline')}
              className="px-3.5 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Schedule Event
            </button>
          </div>
        </div>

        {viewMode === 'grid' && (
          <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search events by name..."
                value={eventSearchTerm}
                onChange={(e) => setEventSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-[#e2dcd0] bg-white focus:outline-none focus:ring-1 focus:ring-[#856637] text-slate-800 placeholder-slate-400 shadow-sm"
              />
              {eventSearchTerm && (
                <button
                  type="button"
                  onClick={() => setEventSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Status:</span>
              <div className="flex items-center gap-1 bg-[#f5ebd6]/30 border border-[#e2dcd0] p-1 rounded-xl shadow-xs">
                {(['all', 'upcoming', 'finished'] as const).map((statusOpt) => (
                  <button
                    key={statusOpt}
                    type="button"
                    onClick={() => setEventStatusFilter(statusOpt)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                      eventStatusFilter === statusOpt
                        ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {statusOpt === 'all' ? 'All Statuses' : statusOpt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              // Calculate days out relative to target date (2026-07-06)
              const [y1, m1, dd1] = event.date.split('-');
              const eventDate = new Date(parseInt(y1, 10), parseInt(m1, 10) - 1, parseInt(dd1, 10));
              const today = new Date(2026, 6, 6); // July 6, 2026
              
              const d1 = Date.UTC(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
              const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
              const diffDays = Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
              const daysOut = isNaN(diffDays) ? 0 : diffDays;

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
                        {formatHumanDate(event.date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col justify-end h-full">
                      {daysOut < 0 ? (
                        <>
                          <div className="text-3xl font-serif font-bold text-slate-400 leading-none">
                            Done
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            FINISHED
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl font-serif font-bold text-[#1e293b] leading-none">
                            {daysOut}
                          </div>
                          <div className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mt-1">
                            DAYS OUT
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
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCloneEventTargetId(event.id); setCloneEventNewDate(''); }}
                      className="p-1.5 text-slate-400 hover:text-[#856637] hover:bg-[#f5ebd6]/50 rounded-lg transition-colors "
                      title="Clone to New Year"
                    >
                      <Copy size={16} />
                    </button>
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
            {filteredEvents.length === 0 && (
              <div className="col-span-3 p-8 text-center border border-dashed border-[#e2dcd0] rounded-2xl bg-[#fcfaf7] text-slate-400 text-xs">
                {events.length === 0 
                  ? "No events scheduled yet. Create an event in the reverse-timeline."
                  : "No events match your search/filter criteria."}
              </div>
            )}
          </div>
        ) : (
          /* OPTION 1: Monthly Master Calendar Grid View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-[#fcfaf7] border border-[#e2dcd0] rounded-2xl p-6 shadow-sm animate-fadeIn">
            {/* Left Column: Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-3">
                <h3 className="text-sm font-serif font-bold text-slate-800">
                  {monthNames[calendarMonth]} {calendarYear}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-[#f5ebd6]/50 rounded-lg border border-[#e2dcd0] transition text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setCalendarMonth(new Date('2026-07-08').getMonth());
                      setCalendarYear(new Date('2026-07-08').getFullYear());
                    }}
                    className="px-2.5 py-1 text-[10px] uppercase font-bold hover:bg-[#f5ebd6]/50 rounded-lg border border-[#e2dcd0] transition text-slate-600 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-[#f5ebd6]/50 rounded-lg border border-[#e2dcd0] transition text-slate-600 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day || !cell.dateString) {
                    return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/20 rounded-xl border border-dashed border-[#e2dcd0]/30" />;
                  }

                  const isToday = cell.dateString === '2026-07-08';
                  const isSelected = selectedCalendarDay === cell.dateString;
                  
                  const dayEvents = events.filter(e => e.date === cell.dateString);
                  const dayTasks = events.flatMap(evt => 
                    (evt.tasks || []).map(t => ({ ...t, eventName: evt.name, eventId: evt.id }))
                  ).filter(t => t.dueDate === cell.dateString);

                  const hasHighPriority = dayTasks.some(t => t.priority === 'High');
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={`day-${cell.day}`}
                      onClick={() => setSelectedCalendarDay(cell.dateString)}
                      className={`aspect-square p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#efe9dc] border-[#c2aa80] ring-1 ring-[#c2aa80]'
                          : isToday
                          ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300'
                          : 'bg-white border-[#e2dcd0] hover:border-[#c2aa80] hover:bg-[#fcfaf7]'
                      }`}
                    >
                      {/* Day Number */}
                      <span className={`text-xs font-bold font-mono ${
                        isToday ? 'text-amber-700' : isSelected ? 'text-slate-900' : 'text-slate-600'
                      }`}>
                        {cell.day}
                      </span>

                      {/* Daily Indicators */}
                      <div className="flex flex-wrap gap-1 mt-auto w-full justify-start items-center">
                        {hasEvents && (
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white shadow-sm" title={`${dayEvents.length} Event Launch(es)`} />
                        )}
                        {dayTasks.length > 0 && (
                          <span className={`w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
                            hasHighPriority ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                          }`} title={`${dayTasks.length} Task(s) Due`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Day Details & Planning Agenda */}
            <div className="bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="pb-3 border-b border-[#e2dcd0]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    AGENDA DETAIL
                  </span>
                  <h4 className="text-lg font-serif font-bold text-slate-800">
                    {selectedCalendarDay ? formatHumanDate(selectedCalendarDay) : 'Select a Day'}
                  </h4>
                  <p className="text-[10px] font-mono font-medium text-slate-400 mt-1">
                    {selectedCalendarDay === '2026-07-08' ? '● System Today' : ''}
                  </p>
                </div>

                {/* Selected Day Content */}
                <div className="mt-4 space-y-4 overflow-y-auto max-h-[320px] pr-1">
                  {(() => {
                    const dayStr = selectedCalendarDay || '2026-07-08';
                    const dayEvents = events.filter(e => e.date === dayStr);
                    const dayTasks = events.flatMap(evt => 
                      (evt.tasks || []).map(t => ({ ...t, eventName: evt.name, eventId: evt.id }))
                    ).filter(t => t.dueDate === dayStr);

                    if (dayEvents.length === 0 && dayTasks.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center space-y-1">
                          <Calendar size={20} className="text-slate-350" />
                          <span>No launches or deadlines on this date.</span>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Event Launches */}
                        {dayEvents.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 font-sans">
                              🚀 Event Launches
                            </h5>
                            {dayEvents.map(evt => (
                              <div 
                                key={evt.id}
                                onClick={() => onNavigate('timeline')}
                                className="p-3 rounded-lg bg-indigo-50 border border-indigo-150 shadow-sm hover:border-indigo-300 transition cursor-pointer"
                              >
                                <h6 className="text-xs font-bold text-indigo-950 font-serif">{evt.name}</h6>
                                <p className="text-[10px] text-indigo-700/80 mt-1 truncate">{evt.description}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tasks Due */}
                        {dayTasks.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 font-sans">
                              📋 Tasks & Deadlines ({dayTasks.length})
                            </h5>
                            <div className="space-y-2">
                              {dayTasks.map(task => (
                                <div 
                                  key={task.id}
                                  className="p-3 rounded-lg bg-white border border-[#e2dcd0] space-y-2 shadow-sm"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <h6 className="text-xs font-bold text-slate-800 line-clamp-2">{task.title}</h6>
                                    <span className={`inline-flex items-center text-[8px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${
                                      task.priority === 'High' 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                        : task.priority === 'Medium'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {task.priority || 'Medium'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 line-clamp-2">{task.description}</p>
                                  
                                  <div className="flex flex-wrap gap-1 items-center justify-between pt-1 border-t border-[#f2ece2] text-[9px] font-medium text-slate-400">
                                    <span>For: <strong className="text-slate-600 font-serif">{task.eventName}</strong></span>
                                    <span className="bg-[#f5ebd6] px-1.5 py-0.5 rounded text-slate-700 font-mono text-[8px]">
                                      {task.lane} Lane
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Tip / Action Footer */}
              <div className="pt-3 border-t border-[#e2dcd0] text-[10px] text-slate-400 font-medium">
                <span className="text-amber-600">Pro-Tip:</span> Click on different calendar cells to see dynamic planning details, due milestones, and priority indicators.
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Main Content Area for Analytics, Burnout, and Lanes */}
      <div className="space-y-6">
          
          {/* Metric Cards Grid (Operational Warnings) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Burnout Tracker */}
            <div 
              onClick={() => setShowBurnoutModal(true)}
              onMouseEnter={() => setHoveredBurnout(true)}
              onMouseLeave={() => setHoveredBurnout(false)}
              className="bg-[#fcfaf7] p-5 rounded-xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#c2aa80] transition duration-200 cursor-pointer group relative"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">BURNOUT WARNINGS</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{overallocatedLeads.length}</h3>
                </div>
                <div className={`p-3 rounded-lg transition ${
                  overallocatedLeads.length > 0 
                    ? 'bg-rose-50 text-rose-650 group-hover:bg-rose-600 group-hover:text-[#faf8f4]' 
                    : 'bg-[#faf8f4] text-slate-600 border border-[#e2dcd0] group-hover:bg-[#f5ebd6] group-hover:text-[#856637]'
                }`}>
                  <AlertTriangle size={20} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-normal">
                {overallocatedLeads.length > 0 
                  ? `${overallocatedLeads.length} Ministry Leads allocated beyond weekly capacity/task targets.`
                  : 'All Ministry Leads are operating within safe workloads.'
                }
              </p>
              <p className="text-[10px] text-amber-800 font-extrabold mt-1.5 underline">
                Click card to view Leads details &amp; active counts
              </p>

              {/* Inline Hover Popover */}
              {hoveredBurnout && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#efe0c2] p-4 rounded-xl shadow-xl z-50 animate-fadeIn space-y-2 pointer-events-none">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#856637] border-b border-[#efe0c2] pb-1">
                    Coordinators Allocation Status
                  </p>
                  {leadStatsList.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No coordinators assigned to any lanes.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {leadStatsList.map((lead, idx) => {
                        const isOver = lead.activeTasksCount > 15 || lead.weeklyHours > 20;
                        return (
                          <div key={idx} className="flex justify-between items-center text-[10px] font-medium">
                            <span className="text-slate-700">{lead.leadName}</span>
                            <span className={isOver ? 'text-rose-650 font-bold' : 'text-slate-500'}>
                              {lead.activeTasksCount} Tasks ({lead.weeklyHours}h) {isOver ? '🚨' : '✓'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Simplified Ministry Total Volunteers */}
            <div 
              onClick={() => onNavigate('volunteers')}
              className="bg-[#fcfaf7] p-5 rounded-xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-[#c2aa80] transition duration-200 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-sans">Total Volunteers</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-1">{summary.totalVolunteers}</h3>
                </div>
                <div className="p-3 bg-[#faf8f4] text-slate-600 border border-[#e2dcd0] group-hover:bg-[#f5ebd6] group-hover:text-[#856637] rounded-lg transition">
                  <Users size={20} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-normal">
                Total registered volunteers across all active ministry rosters.
              </p>
              <p className="text-[10px] text-[#856637] font-extrabold mt-1.5 underline">
                Click to open Volunteer Registry
              </p>
            </div>
          </div>

          {/* Weather summary widget */}
          <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#efe0c2]/60 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#1e293b] flex items-center gap-2">
                  <Sun className="text-amber-500 animate-pulse animate-spin-slow" size={20} />
                  Weather &amp; Event Planning Forecast
                </h3>
                <p className="text-xs text-slate-500">
                  Monitor meteorological conditions for safe setup and execution.
                </p>
              </div>
              
              {/* City Selection Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <MapPin size={12} /> City:
                </span>
                <select
                  value={selectedCity.name}
                  onChange={(e) => {
                    const city = CITIES.find(c => c.name === e.target.value);
                    if (city) setSelectedCity(city);
                  }}
                  className="text-xs font-bold border border-[#efe0c2] bg-[#fcfaf7] rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
                >
                  {CITIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Weather Widget Content */}
            {weatherLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="animate-spin text-[#c2aa80]" size={24} />
                <span className="text-xs font-medium">Fetching 7-day meteorological forecast...</span>
              </div>
            ) : weatherError ? (
              <div className="bg-rose-50 border border-rose-100 rounded-lg p-4 text-center text-xs text-rose-700 flex items-center justify-center gap-2">
                <AlertTriangle size={16} />
                <span>Error fetching forecast: {weatherError}. Retrying soon.</span>
              </div>
            ) : weatherData ? (
              <div className="space-y-4">
                {/* Next Major Event Weather Alert / Highlight */}
                {nextEvent ? (
                  <div className="p-4 rounded-xl border border-[#efe0c2] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#faf5ec] text-[#856637] border border-[#efe0c2]">
                        Next Major Event
                      </span>
                      <h4 className="font-serif font-black text-slate-800 text-sm">
                        {nextEvent.name}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Scheduled for <strong className="text-slate-700">{formatHumanDate(nextEvent.date)}</strong>
                      </p>
                    </div>

                    {eventWeatherIndex !== -1 ? (
                      (() => {
                        const code = weatherData.weathercode[eventWeatherIndex];
                        const maxTemp = weatherData.temperature_2m_max[eventWeatherIndex];
                        const minTemp = weatherData.temperature_2m_min[eventWeatherIndex];
                        const rainProb = weatherData.precipitation_probability_max[eventWeatherIndex];
                        const details = getWeatherDetails(code);

                        return (
                          <div className={`p-3 rounded-lg border flex items-center gap-4 shrink-0 max-w-sm w-full md:w-auto ${details.bgColor}`}>
                            <div className="p-2 bg-white/70 rounded-full border border-white/50 shrink-0">
                              {details.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold leading-tight">{details.label} on Event Day</p>
                              <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-sm font-extrabold font-mono">{Math.round(maxTemp)}°C</span>
                                <span className="text-[10px] opacity-75 font-medium font-sans">Min: {Math.round(minTemp)}°C</span>
                              </div>
                              <p className="text-[10px] font-semibold mt-1 opacity-80 flex items-center gap-1">
                                💧 Precip Chance: {rainProb}%
                                {rainProb > 40 && (
                                  <span className="text-rose-750 font-bold bg-rose-100 border border-rose-200/50 px-1 rounded text-[8px]">
                                    ⚠️ Plan Indoors/Tents
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 font-medium flex items-center gap-2 max-w-sm">
                        <Info size={14} className="text-slate-400 shrink-0" />
                        <span>Event date is beyond the 16-day forecast range. Showing the upcoming week's forecast.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400 italic text-center">
                    No upcoming events scheduled to align weather forecasts.
                  </div>
                )}

                {/* 7-Day Forecast Row */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Upcoming 7-Day Outlook ({selectedCity.name})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {weatherData.time.slice(0, 7).map((timeStr: string, idx: number) => {
                      const dateObj = new Date(timeStr + 'T00:00:00');
                      const isEventDay = timeStr === nextEventDateStr;
                      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      
                      const code = weatherData.weathercode[idx];
                      const maxTemp = weatherData.temperature_2m_max[idx];
                      const minTemp = weatherData.temperature_2m_min[idx];
                      const rainProb = weatherData.precipitation_probability_max[idx];
                      const details = getWeatherDetails(code);

                      return (
                        <div 
                          key={timeStr} 
                          className={`p-3 rounded-lg border text-center transition-all flex flex-col justify-between space-y-2 ${
                            isEventDay 
                              ? 'bg-[#faf5ec] border-[#c2aa80] shadow-sm ring-1 ring-[#c2aa80]/30' 
                              : 'bg-white border-[#e2dcd0] hover:border-slate-350'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-slate-500">{dayName}</span>
                              {isEventDay && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-[#856637] text-white px-1 py-0.2 rounded shrink-0">
                                  Event
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium block">{formattedDate}</span>
                          </div>

                          <div className="flex justify-center py-1">
                            {details.icon}
                          </div>

                          <div>
                            <p className="text-[10px] font-bold font-serif text-slate-850 leading-tight truncate" title={details.label}>
                              {details.label}
                            </p>
                            <div className="flex justify-center items-baseline gap-1 mt-1 text-slate-700">
                              <span className="text-xs font-black font-mono">{Math.round(maxTemp)}°</span>
                              <span className="text-[9px] text-slate-400 font-mono">/{Math.round(minTemp)}°</span>
                            </div>
                            <span className="text-[9px] text-blue-600 font-semibold mt-0.5 block">
                              💧 {rainProb}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 italic py-6">
                Unable to load weather forecast data.
              </div>
            )}
          </div>

          {/* Quick Lane Reference Card */}
          <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-[#1e293b]">Ministry Lanes & Leads</h3>
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
            ) : (
              <div className="space-y-4">
                {/* Table of lanes */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dcd0] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2 px-3">Lane Name</th>
                        <th className="py-2 px-3">Lead Coordinator</th>
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
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
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

      {/* Burnout Modal */}
      {showBurnoutModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div 
            ref={burnoutModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="burnout-modal-title"
            className="bg-white rounded-2xl border border-[#e2dcd0] shadow-2xl max-w-lg w-full overflow-hidden animate-scaleUp"
          >
            {/* Header */}
            <div className="bg-[#fcfaf7] p-5 border-b border-[#e2dcd0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-650" size={20} aria-hidden="true" />
                <div>
                  <h3 id="burnout-modal-title" className="font-serif font-black text-slate-800 text-sm leading-tight">Ministry Lead Workload Auditor</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Workload safety thresholds: Max 15 active tasks OR 20 weekly hours</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBurnoutModal(false)}
                aria-label="Close workload auditor modal"
                className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[350px] overflow-y-auto">
              {leadStatsList.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">No ministry coordinators found.</p>
              ) : (
                <div className="space-y-3">
                  {leadStatsList.map((lead, idx) => {
                    const isOver = lead.activeTasksCount > 15 || lead.weeklyHours > 20;
                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 rounded-xl border transition ${
                          isOver 
                            ? 'bg-rose-50/40 border-rose-200 text-slate-900' 
                            : 'bg-[#faf8f4]/60 border-[#efe0c2] text-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-serif font-bold text-xs flex items-center gap-1.5">
                              {lead.leadName}
                              {isOver ? (
                                <span className="inline-flex text-[8px] font-extrabold uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">
                                  Over-allocated
                                </span>
                              ) : (
                                <span className="inline-flex text-[8px] font-bold uppercase bg-[#f5ebd6] text-[#856637] px-1.5 py-0.5 rounded border border-[#efe0c2]">
                                  Safe Load
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Assigned Lane(s): {lead.lanes.join(', ')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold font-mono">
                              {lead.activeTasksCount} <span className="text-slate-400 font-sans font-medium">/ 15 Tasks</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono font-semibold">
                              {lead.weeklyHours}h <span className="text-slate-400 font-sans font-normal">/ 20 hrs max</span>
                            </p>
                          </div>
                        </div>

                        {/* Visual alerts bar */}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-[9px] font-bold uppercase text-slate-450 border-t border-slate-100 pt-2">
                          <div>
                            <span className="block text-[8px]">Task Limit (15)</span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div 
                                className={`h-full rounded-full ${lead.activeTasksCount > 15 ? 'bg-rose-500' : 'bg-[#c2aa80]'}`}
                                style={{ width: `${Math.min((lead.activeTasksCount / 15) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <span className="block text-[8px]">Hours Limit (20h)</span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div 
                                className={`h-full rounded-full ${lead.weeklyHours > 20 ? 'bg-rose-500' : 'bg-[#c2aa80]'}`}
                                style={{ width: `${Math.min((lead.weeklyHours / 20) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#faf8f4] p-4 border-t border-[#e2dcd0] flex justify-end">
              <button 
                onClick={() => setShowBurnoutModal(false)}
                className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer"
              >
                Done Auditing
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Event *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Task Title *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Milestone Phase *</label>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Description *</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Detailed deliverables for this task..."
                        value={quickTaskDesc}
                        onChange={(e) => setQuickTaskDesc(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Department / Lane *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Due Date *</label>
                        <input
                          type="date"
                          required
                          value={quickTaskDueDate}
                          onChange={(e) => setQuickTaskDueDate(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs cursor-pointer text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Lead</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Email Address *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          placeholder="e.g. (202) 555-0193"
                          value={quickVolPhone}
                          onChange={(e) => setQuickVolPhone(e.target.value)}
                          className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Primary Skills / Tags</label>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assigned Roles / Stations (Comma-separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. Audio Lead, Welcome Desk"
                        value={quickVolRoles}
                        onChange={(e) => setQuickVolRoles(e.target.value)}
                        className="w-full p-2 border border-[#efe0c2] rounded focus:outline-none focus:ring-1 focus:ring-[#c2aa80] bg-[#faf8f4] text-xs text-slate-700"
                      />
                      <span className="text-[9px] text-slate-400 mt-1 block">Separating roles with commas automatically indexes them inside the volunteer database.</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Onboarding Notes</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Event Title *</label>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Launch Date *</label>
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Strategic Description *</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="The core spiritual mission and physical deliverables of this timeline..."
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
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-bold">Rollover Setup</p>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Event Date *</label>
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
                      await onCloneEvent(cloneEventTargetId, cloneEventNewDate);
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
