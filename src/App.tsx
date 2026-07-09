import { apiFetch } from "./lib/api";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  AlertTriangle, 
  Bell, 
  RotateCcw,
  BookOpen,
  Settings,
  Lightbulb,
  Package,
  Coins
} from 'lucide-react';
import { 
  MinistryEvent, 
  Volunteer, 
  MinistryLane, 
  MilestoneKey, 
  Debrief,
  EventDoc,
  LaneDetail,
  RecentActivity,
  Task
} from './types';

// Component imports
import DashboardOverview from './components/DashboardOverview';
import ReverseTimeline from './components/ReverseTimeline';
import VolunteerTable from './components/VolunteerTable';
import DebriefArchive from './components/DebriefArchive';
import PlanningCentre from './components/PlanningCentre';
import EventScopeSelector from './components/EventScopeSelector';
import LogisticsManager from './components/LogisticsManager';
import BudgetExpenseTracker from './components/BudgetExpenseTracker';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [events, setEvents] = useState<MinistryEvent[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [verses, setVerses] = useState<{ text: string; reference: string; theme: string }[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number>(0);
  const [lanes, setLanes] = useState<LaneDetail[]>([]);
  const [laneLoading, setLaneLoading] = useState<boolean>(false);
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  const [summary, setSummary] = useState<SummaryData>({
    totalEvents: 0,
    totalAssets: 0,
    totalVolunteers: 0,
    totalTasks: 0,
    completedTasks: 0,
    missingHighValueCount: 0,
    overburdenedVolunteersCount: 0,
    nonCompliantVolunteersCount: 0
  });

  const availableYears = Array.isArray(events)
    ? Array.from(new Set(events.map(e => new Date(e.date).getFullYear()))).sort((a: number, b: number) => b - a)
    : [];
  if (!availableYears.includes(new Date().getFullYear())) {
    availableYears.unshift(new Date().getFullYear());
    availableYears.sort((a: number, b: number) => b - a);
  }
  const filteredEvents = Array.isArray(events)
    ? events.filter(e => new Date(e.date).getFullYear() === selectedYear)
    : [];

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Click outside listener for Settings dropdown
  useEffect(() => {
    if (!showSettings) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.settings-container')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSettings]);

  // --- Fetch Methods ---
  const fetchAllData = async () => {
    try {
      const [resSummary, resEvents, resVolunteers, resDebriefs, resVerses, resLanes, resActivities] = await Promise.all([
        apiFetch('/api/dashboard/summary').then(r => r.json()),
        apiFetch('/api/events').then(r => r.json()),
        apiFetch('/api/volunteers').then(r => r.json()),
        apiFetch('/api/debriefs').then(r => r.json()),
        apiFetch('/api/verses').then(r => r.json()),
        apiFetch('/api/lanes').then(r => r.json()),
        apiFetch('/api/activities').then(r => r.json())
      ]);

      if (resSummary && !resSummary.error) {
        setSummary(resSummary);
      }
      if (Array.isArray(resEvents)) {
        setEvents(resEvents);
        if (resEvents.length > 0 && !selectedEventId) {
          setSelectedEventId(resEvents[0].id);
        }
      } else if (resEvents && resEvents.error) {
        throw new Error(resEvents.error);
      }
      if (Array.isArray(resVolunteers)) {
        setVolunteers(resVolunteers);
      }
      if (Array.isArray(resDebriefs)) {
        setDebriefs(resDebriefs);
      }
      if (Array.isArray(resVerses)) {
        setVerses(resVerses);
      }
      if (Array.isArray(resLanes)) {
        setLanes(resLanes);
      }
      if (Array.isArray(resActivities)) {
        setActivities(resActivities);
      }
      setError(null);
    } catch (err) {
      console.error("Error fetching operations dashboard data", err);
      setError("Failed to synch operations data with MinistryOS API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filteredEvents.length > 0 && (!selectedEventId || !filteredEvents.find(e => e.id === selectedEventId))) {
      setSelectedEventId(filteredEvents[0].id);
    } else if (filteredEvents.length === 0 && selectedEventId) {
      setSelectedEventId(null);
    }
  }, [selectedYear, filteredEvents, selectedEventId]);

  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-cycle Scripture Grounding verse every 30 seconds (30,000ms)
  useEffect(() => {
    if (verses.length === 0) return;
    const interval = setInterval(() => {
      setCurrentVerseIndex((prev) => (prev + 1) % verses.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [verses.length]);

  // Sync state on key event actions
  const triggerFreshSync = async () => {
    try {
      const [resSummary, resEvents, resVolunteers, resDebriefs, resLanes, resActivities] = await Promise.all([
        apiFetch('/api/dashboard/summary').then(r => r.json()),
        apiFetch('/api/events').then(r => r.json()),
        apiFetch('/api/volunteers').then(r => r.json()),
        apiFetch('/api/debriefs').then(r => r.json()),
        apiFetch('/api/lanes').then(r => r.json()),
        apiFetch('/api/activities').then(r => r.json())
      ]);
      if (resSummary && !resSummary.error) {
        setSummary(resSummary);
      }
      if (Array.isArray(resEvents)) {
        setEvents(resEvents);
      }
      if (Array.isArray(resVolunteers)) {
        setVolunteers(resVolunteers);
      }
      if (Array.isArray(resDebriefs)) {
        setDebriefs(resDebriefs);
      }
      if (Array.isArray(resLanes)) {
        setLanes(resLanes);
      }
      if (Array.isArray(resActivities)) {
        setActivities(resActivities);
      }
    } catch (err) {
      console.error("Friction syncing background data", err);
    }
  };

  // --- Lane & Lead Actions ---
  const handleCreateLane = async (name: string, leadName: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch('/api/lanes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leadName })
      });
      if (!res.ok) throw new Error("Could not create lane");
      await triggerFreshSync();
    } catch (err) {
      console.error("Error creating lane", err);
    } finally {
      setLaneLoading(false);
    }
  };

  const handleUpdateLane = async (id: string, name: string, leadName: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch(`/api/lanes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leadName })
      });
      if (!res.ok) throw new Error("Could not update lane");
      await triggerFreshSync();
    } catch (err) {
      console.error("Error updating lane", err);
    } finally {
      setLaneLoading(false);
    }
  };

  const handleDeleteLane = async (id: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch(`/api/lanes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Could not delete lane");
      }
      await triggerFreshSync();
    } catch (err: any) {
      alert(err.message || "Error deleting lane");
      console.error("Error deleting lane", err);
    } finally {
      setLaneLoading(false);
    }
  };

  // --- Reverse Timeline & Task Actions ---
  const handleCreateEvent = async (name: string, date: string, description: string) => {
    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, description })
      });
      if (!res.ok) throw new Error("Could not create event timeline");
      const newEvt = await res.json();
      setSelectedEventId(newEvt.id);
      await triggerFreshSync();
    } catch (err) {
      alert("Error generating event timeline");
    }
  };

  const handleCloneEvent = async (id: string, newDate: string) => {
    try {
      const res = await apiFetch(`/api/events/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDate })
      });
      if (!res.ok) throw new Error("Could not clone event");
      const newEvt = await res.json();
      setSelectedEventId(newEvt.id);
      setSelectedYear(new Date(newDate).getFullYear());
      await triggerFreshSync();
    } catch (err) {
      alert("Error cloning event");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      if (selectedEventId === id) {
        setSelectedEventId(null);
      }
      await triggerFreshSync();
    } catch (err) {
      alert("Error removing event");
    }
  };

  const handleToggleTask = async (eventId: string, taskId: string, completed: boolean) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskLane = async (eventId: string, taskId: string, lane: MinistryLane) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane })
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskAssignment = async (eventId: string, taskId: string, assignedTo: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo })
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateEvent = async (id: string, data: Partial<MinistryEvent>) => {
    try {
      const res = await apiFetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
      alert("Error updating event details");
    }
  };

  const handleUpdateTaskDueDate = async (eventId: string, taskId: string, dueDate: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate })
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
      alert("Error updating task due date");
    }
  };

  const handleUpdateTask = async (eventId: string, taskId: string, updates: Partial<Task>) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (eventId: string, taskId: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
      alert("Error deleting task");
    }
  };

  const handleAddTask = async (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string; assignedTo?: string }) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      alert("Error injecting custom task into timeline");
    }
  };



  // --- Volunteer Registry Actions ---
  const handleUpdateVolunteer = async (id: string, updatedData: Partial<Volunteer>) => {
    try {
      const res = await apiFetch(`/api/volunteers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateVolunteer = async (volunteerData: Omit<Volunteer, 'id'>) => {
    try {
      const res = await apiFetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(volunteerData)
      });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      alert("Error compiling volunteer profile");
    }
  };

  const handleRemoveVolunteer = async (id: string) => {
    try {
      const res = await apiFetch(`/api/volunteers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Event Documents Check ---
  const handleUpdateEventDocs = async (eventId: string, docs: EventDoc[]) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs })
      });
      if (!res.ok) throw new Error("Could not update docs checklist");
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Debrief Actions ---
  const handleCreateDebrief = async (data: Omit<Debrief, 'id'>) => {
    try {
      const res = await apiFetch('/api/debriefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Could not file debrief");
      await triggerFreshSync();
    } catch (err) {
      alert("Error filing debrief");
    }
  };

  const handleUpdateDebrief = async (id: string, data: Partial<Debrief>) => {
    try {
      const res = await apiFetch(`/api/debriefs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Could not update debrief");
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDebrief = async (id: string) => {
    try {
      const res = await apiFetch(`/api/debriefs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await triggerFreshSync();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Reset Database Action ---
  const handleResetDatabase = async () => {
    if (confirm("Reset database to starter template? This will restore original events, asset status and logs.")) {
      try {
        const res = await apiFetch('/api/reset', { method: 'POST' });
        if (!res.ok) throw new Error();
        await fetchAllData();
        alert("Database successfully reset!");
      } catch (err) {
        alert("Error resetting database");
      }
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Initializing MinistryOS Hub...</h2>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Loading Community Relations Roster & Database</p>
        </div>
      </div>
    );
  }

  // Layout-independent tabs configuration
  const tabsList = [
    { id: 'dashboard', label: 'Command Overview', icon: <LayoutDashboard size={14} /> },
    { id: 'timeline', label: 'Reverse-Timeline', icon: <Calendar size={14} /> },
    { id: 'planning', label: 'Universal Document Hub', icon: <Lightbulb size={14} /> },
    { id: 'logistics', label: 'Logistics Manager', icon: <Package size={14} /> },
    { id: 'budget', label: 'Budget Ledger', icon: <Coins size={14} /> },
    { id: 'volunteers', label: 'Volunteer Registry', icon: <Users size={14} /> },
    { id: 'debriefs', label: 'Debrief Archive', icon: <BookOpen size={14} /> }
  ];

  // Dynamic Tab Panel Router
  const renderTabContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <DashboardOverview 
            summary={summary}
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(id) => setSelectedEventId(id)}
            onNavigate={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            lanes={lanes}
            laneLoading={laneLoading}
            onCreateLane={handleCreateLane}
            onUpdateLane={handleUpdateLane}
            onDeleteLane={handleDeleteLane}
            activities={activities}
            volunteers={volunteers}
            onCreateEvent={handleCreateEvent}
            onCloneEvent={handleCloneEvent}
            onAddTask={handleAddTask}
            onCreateVolunteer={handleCreateVolunteer}
            onUploadCompleted={triggerFreshSync}
          />
        );
      case 'timeline':
        return (
          <ReverseTimeline
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(id) => setSelectedEventId(id)}
            onCreateEvent={handleCreateEvent}
            onDeleteEvent={handleDeleteEvent}
            onToggleTask={handleToggleTask}
            onUpdateTaskLane={handleUpdateTaskLane}
            onUpdateTaskAssignment={handleUpdateTaskAssignment}
            onAddTask={handleAddTask}
            onUpdateEventDocs={handleUpdateEventDocs}
            onUpdateEvent={handleUpdateEvent}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            lanes={lanes}
            volunteers={volunteers}
          />
        );
      case 'planning':
        return (
          <PlanningCentre
            events={filteredEvents}
            lanes={lanes}
            onCreateEvent={handleCreateEvent}
            onCloneEvent={handleCloneEvent}
            onAddTask={handleAddTask}
            onUpdateEventDocs={handleUpdateEventDocs}
            onUpdateEvent={handleUpdateEvent}
            triggerFreshSync={triggerFreshSync}
          />
        );
      case 'logistics':
        return (
          <LogisticsManager
            selectedEventId={selectedEventId}
            events={filteredEvents}
            onUploadCompleted={triggerFreshSync}
          />
        );
      case 'budget':
        return (
          <BudgetExpenseTracker
            events={filteredEvents}
            onUploadCompleted={triggerFreshSync}
          />
        );
      case 'volunteers':
        return (
          <VolunteerTable
            volunteers={volunteers}
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onUpdateVolunteer={handleUpdateVolunteer}
            onCreateVolunteer={handleCreateVolunteer}
            onRemoveVolunteer={handleRemoveVolunteer}
          />
        );
      case 'debriefs':
        return (
          <DebriefArchive 
            debriefs={debriefs}
            onCreateDebrief={handleCreateDebrief}
            onUpdateDebrief={handleUpdateDebrief}
            onDeleteDebrief={handleDeleteDebrief}
          />
        );
      default:
        return null;
    }
  };

  const renderScriptureBanner = () => {
    if (verses.length === 0) return null;
    return (
      <div className="bg-[#fcfaf7] border border-[#e2dcd0] p-6 rounded-2xl relative overflow-hidden shadow-sm">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Scripture Grounding</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentVerseIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }}
              className="space-y-1.5"
            >
              <p className="font-serif italic text-slate-800 leading-relaxed text-sm md:text-base">
                "{verses[currentVerseIndex].text}"
              </p>
              <p className="text-[11px] font-mono font-medium text-slate-400">
                — {verses[currentVerseIndex].reference} ({verses[currentVerseIndex].theme})
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  };  // 1. Classic Top Nav Layout
  return (
    <div className="min-h-screen bg-[#faf8f4] text-slate-800 font-sans flex flex-col selection:bg-[#f5ebd6] selection:text-[#856637]">
      
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end px-6 md:px-10 py-6 md:py-7 border-b border-[#e2dcd0] gap-4 bg-[#fcfaf7]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-1">Ministry Operations Hub</p>
          <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight text-[#0f172a]">
            Community Relations
          </h1>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 text-left sm:text-right">
          <EventScopeSelector
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="appearance-none px-3 py-1.5 pr-8 border border-[#e2dcd0] bg-[#faf8f4] text-xs font-bold font-serif text-slate-700 hover:bg-[#f5ebd6]/50 rounded-lg shadow-sm transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#856637]"
                title="Select Planning Year"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            
            <div className="settings-container relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1.5 border border-[#e2dcd0] bg-[#faf8f4] text-xs font-medium text-slate-700 hover:bg-[#f5ebd6]/50 hover:text-slate-900 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
                title="System Settings"
              >
                <motion.span
                  animate={{ rotate: showSettings ? 90 : 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-block"
                >
                  <Settings size={14} />
                </motion.span>
                Settings
              </button>

              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-72 bg-white border border-[#e2dcd0] p-4 shadow-xl rounded-xl z-50 text-left"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Settings size={12} className="text-slate-500" />
                        System Administration
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                      This panel contains operations that modify systemic data. Resetting the database will restore original events, asset statuses, and volunteer rosters.
                    </p>
                    <button
                      onClick={async () => {
                        setShowSettings(false);
                        await handleResetDatabase();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      Reset to Starter Data
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Section */}
      <nav className="px-6 md:px-10 py-1.5 border-b border-[#e2dcd0] bg-[#fcfaf7] flex overflow-x-auto gap-1">
        {tabsList.map(tab => (
          <button
            key={tab.id}
            id={`tab-btn-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition shrink-0 cursor-pointer rounded-lg my-1 border ${
              activeTab === tab.id
                ? 'bg-[#f5ebd6] text-[#856637] font-bold border-[#efe0c2] shadow-sm'
                : 'text-slate-500 hover:text-slate-850 hover:bg-[#f5ebd6]/20 border-transparent'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content Container */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-850 text-xs flex items-center justify-between shadow-sm">
            <span>{error}</span>
            <button 
              onClick={fetchAllData} 
              className="px-3 py-1.5 bg-white border border-rose-200 rounded-lg font-bold hover:bg-rose-100 uppercase text-[9px] tracking-wider cursor-pointer transition"
            >
              Retry Sync
            </button>
          </div>
        )}

        {renderScriptureBanner()}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Ticker */}
      <footer className="bg-[#fcfaf7] text-slate-500 px-6 md:px-10 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs border-t border-[#e2dcd0] mt-auto shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">System Status</p>
          <div className="flex items-center gap-2 bg-[#faf8f4] border border-[#e2dcd0] rounded-lg px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[11px] font-mono text-slate-600 leading-normal">
              All systems operational.
            </p>
          </div>
        </div>
        <p className="text-[10px] tracking-wide text-slate-400 font-medium">
          MinistryOS v2.4.0 • Community Relations Roster
        </p>
      </footer>
    </div>
  );
}
