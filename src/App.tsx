import { apiFetch, auth } from "./lib/api";
import { parseLocalDate, getTodayISO } from './lib/dates';
import { signInWithPopup, GoogleAuthProvider, User, onAuthStateChanged } from 'firebase/auth';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationProvider, useNotification } from './context/NotificationContext';
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
  Coins,
  Download,
  Upload
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
  Task,
  CollabTable,
  Expense,
  AttachedDoc
} from './types';

// Component imports
import EventScopeSelector from './components/EventScopeSelector';
import ConfirmDialog from './components/ConfirmDialog';
import { ErrorBoundary } from './components/ErrorBoundary';

const DashboardOverview = React.lazy(() => import('./components/DashboardOverview'));
const VolunteerTable = React.lazy(() => import('./components/VolunteerTable'));
const PlanningCentre = React.lazy(() => import('./components/PlanningCentre'));
const LogisticsManager = React.lazy(() => import('./components/LogisticsManager'));
const BudgetExpenseTracker = React.lazy(() => import('./components/BudgetExpenseTracker'));
const ReverseTimeline = React.lazy(() => import('./components/ReverseTimeline'));
const DebriefArchive = React.lazy(() => import('./components/DebriefArchive'));

const LazyLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[300px] w-full py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-[#856637]/20 border-t-[#856637] rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-400 font-mono tracking-wider uppercase animate-pulse">Loading Hub...</span>
    </div>
  </div>
);

export function deduplicateVolunteers(vols: Volunteer[]): Volunteer[] {
  const seenIds = new Set<string>();
  const seenEmailsOrNames = new Set<string>();
  
  return vols.filter((v: Volunteer) => {
    if (!v) return false;
    // 1. Dedupe by ID first
    if (v.id) {
      if (seenIds.has(v.id)) {
        return false;
      }
      seenIds.add(v.id);
    }
    
    // 2. Dedupe by email or name
    const emailLower = (v.email || '').toLowerCase().trim();
    const nameLower = (v.name || '').toLowerCase().trim();
    const key = emailLower || nameLower;
    if (key) {
      if (seenEmailsOrNames.has(key)) {
        return false;
      }
      seenEmailsOrNames.add(key);
    }
    return true;
  });
}

export function deduplicateEvents(evts: MinistryEvent[]): MinistryEvent[] {
  const seenIds = new Set<string>();
  return evts.filter((evt: MinistryEvent) => {
    if (!evt || !evt.id) return false;
    if (seenIds.has(evt.id)) {
      return false;
    }
    seenIds.add(evt.id);
    return true;
  });
}

interface SummaryData {
  totalEvents: number;
  totalAssets: number;
  totalVolunteers: number;
  totalTasks: number;
  completedTasks: number;
  missingHighValueCount: number;
  overburdenedVolunteersCount: number;
}

const recalculateSummary = (
  currentEvents: MinistryEvent[],
  currentVolunteers: Volunteer[],
  currentLanes: LaneDetail[],
  previousSummary: SummaryData
): SummaryData => {
  const totalEvents = currentEvents.length;
  
  // Deduplicate volunteers by email or name
  const uniqueVolunteers = deduplicateVolunteers(currentVolunteers);
  const totalVolunteers = uniqueVolunteers.length;

  let completedTasks = 0;
  let totalTasks = 0;
  currentEvents.forEach((evt) => {
    if (evt && Array.isArray(evt.tasks)) {
      evt.tasks.forEach((t) => {
        if (t) {
          totalTasks++;
          if (t.completed) completedTasks++;
        }
      });
    }
  });

  const activeTasksByLane: Record<string, Task[]> = {};
  currentEvents.forEach((evt) => {
    if (evt && Array.isArray(evt.tasks)) {
      evt.tasks.forEach((t) => {
        if (t && !t.completed) {
          const lName = t.lane || 'Strategy';
          if (!activeTasksByLane[lName]) {
            activeTasksByLane[lName] = [];
          }
          activeTasksByLane[lName].push(t);
        }
      });
    }
  });

  const LEAD_TASK_CAPACITY = 12;
  const leadStats: Record<string, { activeTasksCount: number }> = {};
  currentLanes.forEach((lane) => {
    if (!lane) return;
    const leadName = lane.leadName;
    if (!leadName) return;
    if (!leadStats[leadName]) {
      leadStats[leadName] = { activeTasksCount: 0 };
    }
    const tasksInLane = activeTasksByLane[lane.name] || [];
    leadStats[leadName].activeTasksCount += tasksInLane.length;
  });

  let overallocatedLeadsCount = 0;
  Object.values(leadStats).forEach((stats) => {
    if (stats.activeTasksCount > LEAD_TASK_CAPACITY) {
      overallocatedLeadsCount++;
    }
  });

  return {
    ...previousSummary,
    totalEvents,
    totalVolunteers,
    totalTasks,
    completedTasks,
    overburdenedVolunteersCount: overallocatedLeadsCount,
  };
};

function MainApp() {
  const { showNotification } = useNotification();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any = null;
    let fired = false;

    // Fallback timeout after 8 seconds
    timer = setTimeout(() => {
      if (!fired) {
        setAuthChecking(false);
        setAuthError("Verification timed out. Please try signing in or reloading the page.");
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (usr) => {
        fired = true;
        if (timer) clearTimeout(timer);
        setAuthUser(usr);
        setAuthChecking(false);
        if (usr) {
          setAuthError(null);
        }
      },
      (error) => {
        fired = true;
        if (timer) clearTimeout(timer);
        console.error("Firebase Auth onAuthStateChanged error:", error);
        setAuthChecking(false);
        setAuthError("Sign-in is currently unavailable. Please refresh or contact support.");
      }
    );

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [events, setEvents] = useState<MinistryEvent[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [prefilledDebrief, setPrefilledDebrief] = useState<{
    name: string;
    date: string;
    budgetGiven?: string;
    budgetActual?: string;
    volunteers?: string;
  } | null>(null);
  const [verses, setVerses] = useState<{ text: string; reference: string; theme: string }[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState<number>(0);
  const [lanes, setLanes] = useState<LaneDetail[]>([]);
  const [laneLoading, setLaneLoading] = useState<boolean>(false);
  const [activities, setActivities] = useState<RecentActivity[]>([]);

  // Lifted expenses and collaborative state definitions
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userId] = useState<string>(() => `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const [userName, setUserName] = useState<string>(() => {
    const names = ['Neil S.', 'Joy P.', 'Bea P.', 'Iya M.', 'Eva L.', 'Jaeden O.', 'Solo K.'];
    return names[Math.floor(Math.random() * names.length)];
  });

  useEffect(() => {
    if (authUser && authUser.displayName) {
      setUserName(authUser.displayName);
    }
  }, [authUser]);
  const [userColor] = useState<string>(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [scratchpadEditors, setScratchpadEditors] = useState<Record<string, boolean>>({});
  const editorTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timeouts = editorTimeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  const [scratchpadText, setScratchpadText] = useState<string>('');
  const [collabTable, setCollabTable] = useState<CollabTable>({
    headers: ['Time', 'Session / Item', 'Lane', 'Lead Officer', 'Required Prep / Notes'],
    rows: []
  });
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);

  const pendingVolunteersRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; volunteer: Volunteer }>>(new Map());
  const pendingEventsRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; event: MinistryEvent }>>(new Map());
  const pendingDebriefsRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; debrief: Debrief }>>(new Map());
  const pendingExpensesRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; expense: Expense }>>(new Map());
  const pendingBulkDeletesRef = useRef<Map<string, { timeoutId: NodeJS.Timeout; expenses: Expense[] }>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const hasConnectedRef = useRef(false);
  const triggerFreshSyncRef = useRef<() => void>(() => {});

  // Centralized WebSocket Connection with automatic reconnection and backoff
  useEffect(() => {
    if (!authUser) return;

    let isUnmounted = false;
    let socket: WebSocket | null = null;
    reconnectDelayRef.current = 1000;

    const connect = () => {
      if (isUnmounted) return;
      setWsStatus(hasConnectedRef.current ? 'reconnecting' : 'connecting');

      authUser.getIdToken().then((token) => {
        if (isUnmounted) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}?token=${encodeURIComponent(token)}`);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isUnmounted) {
            socket.close();
            return;
          }
          console.log('Connected to shared operations WS');
          setWsStatus('live');
          reconnectDelayRef.current = 1000;
          socket.send(JSON.stringify({
            type: 'JOIN',
            payload: {
              userId,
              name: userName,
              color: userColor
            }
          }));
          if (hasConnectedRef.current) {
            triggerFreshSyncRef.current?.();
          } else {
            hasConnectedRef.current = true;
          }
        };

        socket.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case 'INIT_STATE': {
                setScratchpadText(msg.payload.scratchpad);
                setCollabTable(msg.payload.collabTable);
                setAttachedDocs(msg.payload.attachedDocs);
                const otherUsers = msg.payload.users.filter((u: any) => u.id !== userId);
                setConnectedUsers(otherUsers);
                break;
              }
              case 'PRESENCE_CHANGE': {
                const otherUsers = msg.payload.users.filter((u: any) => u.id !== userId);
                setConnectedUsers(otherUsers);
                break;
              }
              case 'CURSOR_MOVE': {
                setConnectedUsers(prev => prev.map(u => {
                  if (u.id === msg.payload.userId) {
                    return { ...u, cursor: msg.payload.cursor, cellFocus: msg.payload.cellFocus };
                  }
                  return u;
                }));
                break;
              }
              case 'TEXT_EDIT': {
                setScratchpadText(msg.payload.text);
                const editorId = msg.payload.userId;
                if (editorId) {
                  setScratchpadEditors(prev => (prev[editorId] ? prev : { ...prev, [editorId]: true }));
                  if (editorTimeoutsRef.current[editorId]) {
                    clearTimeout(editorTimeoutsRef.current[editorId]);
                  }
                  editorTimeoutsRef.current[editorId] = setTimeout(() => {
                    setScratchpadEditors(prev => {
                      const next = { ...prev };
                      delete next[editorId];
                      return next;
                    });
                    delete editorTimeoutsRef.current[editorId];
                  }, 2500);
                }
                break;
              }
              case 'TABLE_EDIT': {
                setCollabTable(msg.payload.collabTable);
                break;
              }
              case 'ATTACH_DOCS_CHANGE': {
                setAttachedDocs(msg.payload.attachedDocs);
                break;
              }
              case 'WEBHOOK_NOTIFICATION': {
                const { docName, status, details, timestamp } = msg.payload;
                showNotification(`[Push Webhook] "${docName}" permission updated at ${timestamp}: ${details}`, status === 'ok' ? 'success' : 'error');
                break;
              }
              case 'VOLUNTEERS_CHANGE': {
                const incoming = msg.payload.volunteers || [];
                const pendingIds = new Set<string>();
                pendingVolunteersRef.current.forEach(val => pendingIds.add(val.volunteer.id));
                const filtered = incoming.filter((vol: Volunteer) => !pendingIds.has(vol.id));
                setVolunteers(deduplicateVolunteers(filtered));
                break;
              }
              case 'EXPENSES_CHANGE': {
                const incoming = msg.payload.expenses || [];
                const pendingIds = new Set<string>();
                pendingExpensesRef.current.forEach(val => pendingIds.add(val.expense.id));
                pendingBulkDeletesRef.current.forEach(val => {
                  val.expenses.forEach(e => pendingIds.add(e.id));
                });
                const filtered = incoming.filter((exp: Expense) => !pendingIds.has(exp.id));
                setExpenses(filtered);
                break;
              }
              case 'EVENTS_CHANGE': {
                const incoming = msg.payload.events || [];
                const pendingIds = new Set<string>();
                pendingEventsRef.current.forEach(val => pendingIds.add(val.event.id));
                const filtered = incoming.filter((evt: MinistryEvent) => !pendingIds.has(evt.id));
                setEvents(deduplicateEvents(filtered));
                break;
              }
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        socket.onclose = () => {
          if (isUnmounted) return;
          setWsStatus('reconnecting');
          console.log(`Shared Operations WS disconnected. Reconnecting in ${reconnectDelayRef.current}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 15000);
            connect();
          }, reconnectDelayRef.current);
        };
      }).catch((err) => {
        console.error('Error fetching ID token for WebSocket:', err);
        if (!isUnmounted) {
          setWsStatus('reconnecting');
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      });
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [userId, userName, userColor, authUser]);

  // Clean up pending timeouts on unmount
  useEffect(() => {
    return () => {
      pendingVolunteersRef.current.forEach(val => clearTimeout(val.timeoutId));
      pendingEventsRef.current.forEach(val => clearTimeout(val.timeoutId));
      pendingDebriefsRef.current.forEach(val => clearTimeout(val.timeoutId));
      pendingExpensesRef.current.forEach(val => clearTimeout(val.timeoutId));
      pendingBulkDeletesRef.current.forEach(val => clearTimeout(val.timeoutId));
    };
  }, []);

  const [summary, setSummary] = useState<SummaryData>({
    totalEvents: 0,
    totalAssets: 0,
    totalVolunteers: 0,
    totalTasks: 0,
    completedTasks: 0,
    missingHighValueCount: 0,
    overburdenedVolunteersCount: 0
  });

  const availableYears = Array.isArray(events)
    ? Array.from(new Set(events.map(e => parseLocalDate(e.date).getFullYear()))).sort((a: number, b: number) => b - a)
    : [];
  if (!availableYears.includes(new Date().getFullYear())) {
    availableYears.unshift(new Date().getFullYear());
    availableYears.sort((a: number, b: number) => b - a);
  }
  const filteredEvents = Array.isArray(events)
    ? events.filter(e => parseLocalDate(e.date).getFullYear() === selectedYear)
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
      const [resSummary, resEvents, resVolunteers, resDebriefs, resVerses, resLanes, resActivities, resExpenses] = await Promise.all([
        apiFetch('/api/dashboard/summary').then(r => r.json()),
        apiFetch('/api/events').then(r => r.json()),
        apiFetch('/api/volunteers').then(r => r.json()),
        apiFetch('/api/debriefs').then(r => r.json()),
        apiFetch('/api/verses').then(r => r.json()),
        apiFetch('/api/lanes').then(r => r.json()),
        apiFetch('/api/activities').then(r => r.json()),
        apiFetch('/api/expenses').then(r => r.json())
      ]);

      if (resSummary && resSummary.error) {
        throw new Error(resSummary.error);
      }
      if (resSummary && !resSummary.error) {
        setSummary(resSummary);
      }
      if (Array.isArray(resEvents)) {
        setEvents(deduplicateEvents(resEvents));
        if (resEvents.length > 0 && !selectedEventId) {
          setSelectedEventId(resEvents[0].id);
        }
      } else if (resEvents && resEvents.error) {
        throw new Error(resEvents.error);
      }
      if (Array.isArray(resVolunteers)) {
        setVolunteers(deduplicateVolunteers(resVolunteers));
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
      if (Array.isArray(resExpenses)) {
        setExpenses(resExpenses);
      }
      setError(null);
    } catch (err: any) {
      console.error("Error fetching operations dashboard data", err);
      if (err.message && (err.message.includes('restricted') || err.message.includes('Unauthorized') || err.message.includes('Access denied'))) {
        setAuthError(err.message);
        auth.signOut();
      } else {
        setError("Failed to synch operations data with MinistryOS API.");
      }
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
    if (authUser) {
      fetchAllData();
    }
  }, [authUser]);

  // Keep summary numbers accurate by recomputing them locally when state changes
  useEffect(() => {
    if (!loading) {
      setSummary(prev => recalculateSummary(events, volunteers, lanes, prev));
    }
  }, [events, volunteers, lanes, loading]);

  // Auto-cycle Scripture Grounding verse every 30 seconds (30,000ms)
  useEffect(() => {
    if (verses.length === 0) return;
    const interval = setInterval(() => {
      setCurrentVerseIndex((prev) => (prev + 1) % verses.length);
    }, 30000);
    return () => clearInterval(interval);
  }, [verses.length]);

  // Sync state on key event actions
  const triggerFreshSync = useCallback(async () => {
    try {
      const [resSummary, resEvents, resVolunteers, resDebriefs, resLanes, resActivities, resExpenses] = await Promise.all([
        apiFetch('/api/dashboard/summary').then(r => r.json()),
        apiFetch('/api/events').then(r => r.json()),
        apiFetch('/api/volunteers').then(r => r.json()),
        apiFetch('/api/debriefs').then(r => r.json()),
        apiFetch('/api/lanes').then(r => r.json()),
        apiFetch('/api/activities').then(r => r.json()),
        apiFetch('/api/expenses').then(r => r.json())
      ]);
      if (resSummary && !resSummary.error) {
        setSummary(resSummary);
      }
      if (Array.isArray(resEvents)) {
        setEvents(deduplicateEvents(resEvents));
      }
      if (Array.isArray(resVolunteers)) {
        setVolunteers(deduplicateVolunteers(resVolunteers));
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
      if (Array.isArray(resExpenses)) {
        setExpenses(resExpenses);
      }
    } catch (err) {
      console.error("Friction syncing background data", err);
    }
  }, []);
  triggerFreshSyncRef.current = triggerFreshSync;

  // --- Lane & Lead Actions ---
  const handleCreateLane = useCallback(async (name: string, leadName: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch('/api/lanes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leadName })
      });
      if (!res.ok) throw new Error("Could not create lane");
      const newLane = await res.json();
      setLanes(prev => [...prev, newLane]);
    } catch (err) {
      console.error("Error creating lane", err);
    } finally {
      setLaneLoading(false);
    }
  }, []);

  const handleUpdateLane = useCallback(async (id: string, name: string, leadName: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch(`/api/lanes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leadName })
      });
      if (!res.ok) throw new Error("Could not update lane");
      const updatedLane = await res.json();
      
      const oldLane = lanes.find(l => l.id === id);
      if (oldLane && oldLane.name !== updatedLane.name) {
        setEvents(prevEvents => prevEvents.map(evt => {
          if (!evt || !Array.isArray(evt.tasks)) return evt;
          return {
            ...evt,
            tasks: evt.tasks.map(task => task.lane === oldLane.name ? { ...task, lane: updatedLane.name } : task)
          };
        }));
      }
      setLanes(prev => prev.map(lane => lane.id === id ? updatedLane : lane));
    } catch (err) {
      console.error("Error updating lane", err);
    } finally {
      setLaneLoading(false);
    }
  }, [lanes]);

  const handleDeleteLane = useCallback(async (id: string) => {
    try {
      setLaneLoading(true);
      const res = await apiFetch(`/api/lanes/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Could not delete lane");
      }
      const deletedLane = lanes.find(l => l.id === id);
      const remainingLanes = lanes.filter(l => l.id !== id);
      if (deletedLane && remainingLanes.length > 0) {
        const fallbackLaneName = remainingLanes[0].name;
        setEvents(prevEvents => prevEvents.map(evt => {
          if (!evt || !Array.isArray(evt.tasks)) return evt;
          return {
            ...evt,
            tasks: evt.tasks.map(task => task.lane === deletedLane.name ? { ...task, lane: fallbackLaneName } : task)
          };
        }));
      }
      setLanes(remainingLanes);
    } catch (err: any) {
      showNotification(err.message || "Error deleting lane", 'error');
      console.error("Error deleting lane", err);
    } finally {
      setLaneLoading(false);
    }
  }, [lanes]);

  // --- Reverse Timeline & Task Actions ---
  const handleCreateEvent = useCallback(async (name: string, date: string, description: string) => {
    try {
      const res = await apiFetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, description })
      });
      if (!res.ok) throw new Error("Could not create event timeline");
      const newEvt = await res.json();
      setSelectedEventId(newEvt.id);
      showNotification(`Event "${name}" generated successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error generating event timeline";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleCloneEvent = useCallback(async (id: string, newDate: string, carryVolunteerIds: string[], copyEquipment: boolean) => {
    try {
      const res = await apiFetch(`/api/events/${id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDate, carryVolunteerIds, copyEquipment })
      });
      if (!res.ok) throw new Error("Could not clone event");
      const newEvt = await res.json();
      setSelectedEventId(newEvt.id);
      setSelectedYear(new Date(newDate).getFullYear());
      showNotification(`Event cloned to ${newDate} successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error cloning event";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    const eventToDelete = events.find(evt => evt.id === id);
    if (!eventToDelete) return;

    // Remove from UI immediately (optimistic UI)
    setEvents(prev => prev.filter(evt => evt.id !== id));
    if (selectedEventId === id) {
      setSelectedEventId(null);
    }

    // Set timeout to delete after 5 seconds
    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Could not remove event");
        pendingEventsRef.current.delete(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error removing event";
        showNotification(msg, 'error');
        // Restore on server failure
        setEvents(prev => {
          if (prev.some(evt => evt.id === id)) return prev;
          return [...prev, eventToDelete];
        });
      }
    }, 5000);

    // Cancel any existing pending delete for the same ID, just in case
    const existing = pendingEventsRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    pendingEventsRef.current.set(id, { timeoutId, event: eventToDelete });

    showNotification(`Event "${eventToDelete.name}" removed.`, 'success', {
      label: 'Undo',
      onClick: () => {
        const pending = pendingEventsRef.current.get(id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          setEvents(prev => {
            if (prev.some(evt => evt.id === id)) return prev;
            return [...prev, pending.event];
          });
          setSelectedEventId(id);
          pendingEventsRef.current.delete(id);
          showNotification(`Restored "${eventToDelete.name}"`, 'success');
        }
      }
    });
  }, [events, selectedEventId, showNotification]);

  const handleToggleTask = useCallback(async (eventId: string, taskId: string, completed: boolean) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed })
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleUpdateTaskLane = useCallback(async (eventId: string, taskId: string, lane: MinistryLane) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lane })
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleUpdateTaskAssignment = useCallback(async (eventId: string, taskId: string, assignedTo: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo })
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleUpdateEvent = useCallback(async (id: string, data: Partial<MinistryEvent>) => {
    try {
      const res = await apiFetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === id ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
      showNotification("Error updating event details", 'error');
    }
  }, [showNotification]);

  const handleUpdateTaskDueDate = useCallback(async (eventId: string, taskId: string, dueDate: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate })
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
      showNotification("Error updating task due date", 'error');
    }
  }, [showNotification]);

  const handleRescaleTimeline = useCallback(async (eventId: string, updates: { taskId: string; dueDate: string }[]) => {
    console.log("handleRescaleTimeline callback triggered in App.tsx", { eventId, updates });
    try {
      const payloadString = JSON.stringify(updates);
      console.log("Sending PATCH request to /api/events/:eventId/tasks/bulk-due-dates", {
        url: `/api/events/${eventId}/tasks/bulk-due-dates`,
        payloadString
      });
      const res = await apiFetch(`/api/events/${eventId}/tasks/bulk-due-dates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString
      });
      console.log("Received response from server for bulk-due-dates", {
        status: res.status,
        ok: res.ok,
        statusText: res.statusText
      });
      if (!res.ok) {
        const errJson = await res.json();
        console.error("Server returned non-ok response status", { errJson });
        throw new Error(errJson.error || 'Failed to rescale timeline');
      }
      const data = await res.json();
      console.log("Successfully parsed JSON response from server for bulk-due-dates", { data });
      const updatedEvent = data.event || data;
      console.log("Updating events in state with updatedEvent", { updatedEvent });
      setEvents(prev => {
        const newEvents = prev.map(evt => evt.id === eventId ? updatedEvent : evt);
        console.log("New events array calculated", { newEvents });
        return newEvents;
      });
      showNotification("Timeline rescaled successfully!", 'success');
    } catch (err: any) {
      console.error("Error inside handleRescaleTimeline callback:", err);
      showNotification(err.message || "Error rescaling timeline", 'error');
      throw err;
    }
  }, [showNotification]);

  const handleUpdateTask = useCallback(async (eventId: string, taskId: string, updates: Partial<Task>) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleDeleteTask = useCallback(async (eventId: string, taskId: string) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      console.error(err);
      showNotification("Error deleting task", 'error');
    }
  }, [showNotification]);

  const handleAddTask = useCallback(async (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string; assignedTo?: string }) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!res.ok) throw new Error();
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
    } catch (err) {
      showNotification("Error injecting custom task into timeline", 'error');
    }
  }, [showNotification]);



  // --- Volunteer Registry Actions ---
  const handleUpdateVolunteer = useCallback(async (id: string, updatedData: Partial<Volunteer>) => {
    try {
      const res = await apiFetch(`/api/volunteers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (!res.ok) throw new Error("Could not update volunteer profile");
      const updatedVol = await res.json();
      setVolunteers(prev => prev.map(vol => vol.id === id ? updatedVol : vol));
      showNotification(`Volunteer "${updatedVol.name}" profile updated successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating volunteer profile";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleCreateVolunteer = useCallback(async (volunteerData: Omit<Volunteer, 'id'>) => {
    try {
      const res = await apiFetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(volunteerData)
      });
      if (!res.ok) throw new Error("Could not compile volunteer profile");
      const newVol = await res.json();
      showNotification(`Volunteer "${newVol.name}" profile compiled successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error compiling volunteer profile";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleRemoveVolunteer = useCallback(async (id: string) => {
    const volunteerToDelete = volunteers.find(vol => vol.id === id);
    if (!volunteerToDelete) return;

    // Optimistic remove
    setVolunteers(prev => prev.filter(vol => vol.id !== id));

    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/volunteers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Could not remove volunteer");
        pendingVolunteersRef.current.delete(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error removing volunteer";
        showNotification(msg, 'error');
        // Restore on server failure
        setVolunteers(prev => {
          if (prev.some(vol => vol.id === id)) return prev;
          return deduplicateVolunteers([...prev, volunteerToDelete]);
        });
      }
    }, 5000);

    const existing = pendingVolunteersRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    pendingVolunteersRef.current.set(id, { timeoutId, volunteer: volunteerToDelete });

    showNotification(`Volunteer "${volunteerToDelete.name}" removed.`, 'success', {
      label: 'Undo',
      onClick: () => {
        const pending = pendingVolunteersRef.current.get(id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          setVolunteers(prev => {
            if (prev.some(v => v.id === id)) return prev;
            return deduplicateVolunteers([...prev, pending.volunteer]);
          });
          pendingVolunteersRef.current.delete(id);
          showNotification(`Restored "${volunteerToDelete.name}"`, 'success');
        }
      }
    });
  }, [volunteers, showNotification]);

  // --- Event Documents Check ---
  const handleUpdateEventDocs = useCallback(async (eventId: string, docs: EventDoc[]) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docs })
      });
      if (!res.ok) throw new Error("Could not update docs checklist");
      const updatedEvent = await res.json();
      setEvents(prev => prev.map(evt => evt.id === eventId ? updatedEvent : evt));
      showNotification('Custom documents checklist updated.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating documents checklist";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  // --- Debrief Actions ---
  const handleCreateDebrief = useCallback(async (data: Omit<Debrief, 'id'>) => {
    try {
      const res = await apiFetch('/api/debriefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Could not file debrief");
      const newDebrief = await res.json();
      setDebriefs(prev => [...prev, newDebrief]);
      showNotification(`Debrief for "${newDebrief.name}" filed successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error filing debrief";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleUpdateDebrief = useCallback(async (id: string, data: Partial<Debrief>) => {
    try {
      const res = await apiFetch(`/api/debriefs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Could not update debrief");
      const updatedDebrief = await res.json();
      setDebriefs(prev => prev.map(d => d.id === id ? updatedDebrief : d));
      showNotification(`Debrief for "${updatedDebrief.name}" updated successfully!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating debrief";
      showNotification(msg, 'error');
    }
  }, [showNotification]);

  const handleDeleteDebrief = useCallback(async (id: string) => {
    const debriefToDelete = debriefs.find(d => d.id === id);
    if (!debriefToDelete) return;

    // Optimistic remove
    setDebriefs(prev => prev.filter(d => d.id !== id));

    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/debriefs/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Could not remove debrief");
        pendingDebriefsRef.current.delete(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error removing debrief";
        showNotification(msg, 'error');
        // Restore on server failure
        setDebriefs(prev => {
          if (prev.some(d => d.id === id)) return prev;
          return [...prev, debriefToDelete];
        });
      }
    }, 5000);

    const existing = pendingDebriefsRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    pendingDebriefsRef.current.set(id, { timeoutId, debrief: debriefToDelete });

    showNotification(`Debrief for "${debriefToDelete.name}" removed.`, 'success', {
      label: 'Undo',
      onClick: () => {
        const pending = pendingDebriefsRef.current.get(id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          setDebriefs(prev => {
            if (prev.some(d => d.id === id)) return prev;
            return [...prev, pending.debrief];
          });
          pendingDebriefsRef.current.delete(id);
          showNotification(`Restored debrief for "${debriefToDelete.name}"`, 'success');
        }
      }
    });
  }, [debriefs, showNotification]);

  // --- Reset Database Action ---
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Export All JSON Data ---
  const handleExportAllJSON = async () => {
    try {
      const [eventsData, volunteersData, debriefsData, lanesData, activitiesData, expensesData, assetsData, inventoryData, reservationsData] = await Promise.all([
        apiFetch('/api/events').then(r => r.json()),
        apiFetch('/api/volunteers').then(r => r.json()),
        apiFetch('/api/debriefs').then(r => r.json()),
        apiFetch('/api/lanes').then(r => r.json()),
        apiFetch('/api/activities').then(r => r.json()),
        apiFetch('/api/expenses').then(r => r.json()),
        apiFetch('/api/assets').then(r => r.json()),
        apiFetch('/api/inventory').then(r => r.json()),
        apiFetch('/api/reservations').then(r => r.json())
      ]);

      const backupData = {
        events: eventsData,
        volunteers: volunteersData,
        debriefs: debriefsData,
        lanes: lanesData,
        activities: activitiesData,
        expenses: expensesData,
        assets: assetsData,
        inventory: inventoryData,
        reservations: reservationsData
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = getTodayISO();
      link.href = url;
      link.download = `cabc-dashboard-backup-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting data:', err);
      showNotification('Failed to export database. Please try again.', 'error');
    }
  };

  // --- Export Volunteers to CSV ---
  const handleExportVolunteersCSV = () => {
    if (!volunteers || volunteers.length === 0) {
      showNotification('No volunteers available to export.', 'error');
      return;
    }

    const headers = ['Name', 'Email', 'Phone', 'Roles', 'Skills', 'Notes'];
    const rows = volunteers.map(vol => [
      vol.name || '',
      vol.email || '',
      vol.phone || '',
      Array.isArray(vol.roles) ? vol.roles.join(', ') : '',
      vol.skills || '',
      vol.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = getTodayISO();
    link.href = url;
    link.download = `cabc-volunteers-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Restore Database from JSON Backup ---
  const handleRestoreFromJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const isConfirmed = await confirmAction(
      "Restore Database Backup",
      `Are you sure you want to restore the database from "${file.name}"? This will COMPLETELY overwrite all current events, volunteers, logistics, and other data in the system. This action cannot be undone.`
    );

    if (!isConfirmed) return;

    try {
      const text = await file.text();
      let parsedData;
      try {
        parsedData = JSON.parse(text);
      } catch (err) {
        showNotification("Invalid file format. The file is not a valid JSON document.", 'error');
        return;
      }

      const res = await apiFetch('/api/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedData)
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || 'Server error during restore');
      }

      await fetchAllData();
      showNotification("Database successfully restored from backup!", 'success');
    } catch (err) {
      console.error('Error restoring database:', err);
      showNotification(err instanceof Error ? err.message : "Failed to restore database from backup.", 'error');
    }
  };



  const handleNavigate = useCallback((tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Layout-independent tabs configuration
  const tabsList = [
    { id: 'dashboard', label: 'Overview', icon: <LayoutDashboard size={14} /> },
    { id: 'timeline', label: 'Reverse-Timeline', icon: <Calendar size={14} /> },
    { id: 'planning', label: 'Planning Centre', icon: <Lightbulb size={14} /> },
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
            onSelectEvent={setSelectedEventId}
            onNavigate={handleNavigate}
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
            loading={loading}
            debriefs={debriefs}
            onPrefillDebrief={(data: { name: string; date: string; id?: string }) => {
              const targetEvent = data.id 
                ? events.find(evt => evt.id === data.id) 
                : events.find(evt => evt.name === data.name && evt.date === data.date);

              let budgetGiven = '';
              let budgetActual = '';
              let computedVolunteers = '';

              if (targetEvent) {
                if (targetEvent.budgetCap !== undefined && targetEvent.budgetCap !== null) {
                  budgetGiven = targetEvent.budgetCap.toString();
                }
                const eventExpenses = expenses.filter(exp => exp.eventId === targetEvent.id);
                const totalActual = eventExpenses.reduce((sum, exp) => sum + exp.cost, 0);
                budgetActual = totalActual.toString();

                const assignedCount = volunteers.filter(
                  vol => vol.eventAssignments && vol.eventAssignments[targetEvent.id]
                ).length;
                computedVolunteers = assignedCount.toString();
              }

              setPrefilledDebrief({
                name: data.name,
                date: data.date,
                budgetGiven,
                budgetActual,
                volunteers: computedVolunteers
              });
              handleNavigate('debriefs');
            }}
          />
        );
      case 'timeline':
        return (
          <ReverseTimeline
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onCreateEvent={handleCreateEvent}
            onDeleteEvent={handleDeleteEvent}
            onToggleTask={handleToggleTask}
            onUpdateTaskLane={handleUpdateTaskLane}
            onUpdateTaskAssignment={handleUpdateTaskAssignment}
            onAddTask={handleAddTask}
            onUpdateEventDocs={handleUpdateEventDocs}
            onUpdateEvent={handleUpdateEvent}
            onUpdateTaskDueDate={handleUpdateTaskDueDate}
            onRescaleTimeline={handleRescaleTimeline}
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
            activities={activities}
            lanes={lanes}
            onCreateEvent={handleCreateEvent}
            onCloneEvent={handleCloneEvent}
            onAddTask={handleAddTask}
            onUpdateEventDocs={handleUpdateEventDocs}
            onUpdateEvent={handleUpdateEvent}
            triggerFreshSync={triggerFreshSync}
            userId={userId}
            userName={userName}
            setUserName={setUserName}
            userColor={userColor}
            connectedUsers={connectedUsers}
            setConnectedUsers={setConnectedUsers}
            scratchpadEditors={scratchpadEditors}
            scratchpadText={scratchpadText}
            setScratchpadText={setScratchpadText}
            collabTable={collabTable}
            setCollabTable={setCollabTable}
            attachedDocs={attachedDocs}
            setAttachedDocs={setAttachedDocs}
            wsRef={wsRef}
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
            expenses={expenses}
            setExpenses={setExpenses}
            pendingExpensesRef={pendingExpensesRef}
            pendingBulkDeletesRef={pendingBulkDeletesRef}
            onUploadCompleted={triggerFreshSync}
            loading={loading}
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
            loading={loading}
          />
        );
      case 'debriefs':
        return (
          <DebriefArchive 
            debriefs={debriefs}
            onCreateDebrief={handleCreateDebrief}
            onUpdateDebrief={handleUpdateDebrief}
            onDeleteDebrief={handleDeleteDebrief}
            loading={loading}
            prefilledDebrief={prefilledDebrief}
            onClearPrefilledDebrief={() => setPrefilledDebrief(null)}
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
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center p-6 text-slate-800 font-sans selection:bg-[#f5ebd6] selection:text-[#856637]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-[#efe0c2] border-t-[#856637] rounded-full animate-spin" />
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-slate-400 font-mono">Verifying credentials...</h2>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#faf8f4] flex flex-col items-center justify-center p-6 text-slate-800 font-sans selection:bg-[#f5ebd6] selection:text-[#856637]">
        <div className="w-full max-w-md bg-white border border-[#e2dcd0] rounded-2xl shadow-xl overflow-hidden p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fcfaf7] border border-[#e2dcd0] text-[#856637] mb-2 shadow-sm">
              <LayoutDashboard size={20} />
            </div>
            <h1 className="text-2xl font-serif font-black tracking-tight text-[#0f172a]">MinistryOS</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Community Relations & Operations Hub</p>
          </div>

          <p className="text-xs text-slate-500 text-center leading-relaxed font-medium font-sans">
            Access is restricted to authorized ministry accounts. Please sign in with your verified Google account to manage resources.
          </p>

          {authError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 shadow-sm leading-relaxed font-sans">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5 text-rose-950">Authorization Failed</span>
                <span>{authError}</span>
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              try {
                setAuthChecking(true);
                setAuthError(null);
                const googleProvider = new GoogleAuthProvider();
                googleProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
                googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
                await signInWithPopup(auth, googleProvider);
              } catch (err: any) {
                console.error(err);
                setAuthError(err.message || 'Failed to authenticate');
              } finally {
                setAuthChecking(false);
              }
            }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-900 hover:bg-slate-950 text-white font-semibold text-xs rounded-xl shadow-md transition cursor-pointer font-sans"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f4] text-slate-800 font-sans flex flex-col selection:bg-[#f5ebd6] selection:text-[#856637]">
      
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end px-6 md:px-10 py-6 md:py-7 border-b border-[#e2dcd0] gap-4 bg-[#fcfaf7]">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-1">Ministry Operations Hub</p>
          <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight text-[#0f172a]">
            Community Relations
          </h1>
          <p className="mt-2 flex items-center gap-2 font-serif italic text-[13px] text-[#856637]">
            <span className="inline-block w-4 h-px bg-[#c2aa80]" aria-hidden="true" />
            To God Be The Glory
            <span className="inline-block w-4 h-px bg-[#c2aa80]" aria-hidden="true" />
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 text-left sm:text-right">
          <EventScopeSelector
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div
              className={`px-2.5 py-1.5 border text-xs font-medium rounded-lg shadow-xs flex items-center gap-1.5 transition-colors ${
                wsStatus === 'live'
                  ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800'
                  : 'border-amber-200/80 bg-amber-50/80 text-amber-800 animate-pulse'
              }`}
              title={
                wsStatus === 'live'
                  ? 'WebSocket connected — receiving real-time operations updates'
                  : 'WebSocket disconnected — attempting to reconnect'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'live' ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`}
              />
              <span>
                {wsStatus === 'live'
                  ? `Live · ${connectedUsers.length + 1} online`
                  : wsStatus === 'connecting'
                  ? 'Connecting…'
                  : 'Reconnecting…'}
              </span>
            </div>

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
                    className="absolute right-0 mt-2 w-80 bg-white border border-[#e2dcd0] p-4 shadow-xl rounded-xl z-50 text-left space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Settings size={12} className="text-slate-500" />
                          System Administration
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Manage database state, export backups, or restore custom backups to the server.
                      </p>
                    </div>

                    {/* Export Section */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                        Data Export
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={async () => {
                            setShowSettings(false);
                            await handleExportAllJSON();
                          }}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Download size={12} />
                          JSON Backup
                        </button>
                        <button
                          onClick={() => {
                            setShowSettings(false);
                            handleExportVolunteersCSV();
                          }}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold rounded-lg transition cursor-pointer"
                        >
                          <Download size={12} />
                          Volunteers CSV
                        </button>
                      </div>
                    </div>

                    {/* Import Section */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                        Data Import / Restore
                      </span>
                      <button
                        onClick={() => {
                          setShowSettings(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        <Upload size={12} className="text-slate-500" />
                        Restore from JSON
                      </button>
                    </div>



                    {/* Account Section */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                        Account
                      </span>
                      <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 gap-2">
                        <div className="flex flex-col truncate">
                          <span className="font-bold truncate text-slate-800">{authUser?.displayName || authUser?.email || 'Active User'}</span>
                          <span className="text-[10px] text-slate-400 truncate">{authUser?.email}</span>
                        </div>
                        <button
                          onClick={async () => {
                            setShowSettings(false);
                            await auth.signOut();
                          }}
                          className="px-2.5 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition cursor-pointer shrink-0"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
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
            <ErrorBoundary section={activeTab}>
              <React.Suspense fallback={<LazyLoadingFallback />}>
                {renderTabContent()}
              </React.Suspense>
            </ErrorBoundary>
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

      {/* Hidden Restore file selector and Reusable Confirmation Dialog */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleRestoreFromJSON}
        accept=".json"
        className="hidden"
      />
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

export default function App() {
  return (
    <NotificationProvider>
      <MainApp />
    </NotificationProvider>
  );
}
