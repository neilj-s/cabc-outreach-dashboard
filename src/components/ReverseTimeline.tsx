import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../context/NotificationContext';
import { useFocusTrap } from '../lib/useFocusTrap';
import { useLocalStorageState } from '../lib/useLocalStorageState';
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Filter, 
  CheckSquare, 
  Square, 
  Clock, 
  CheckCircle2, 
  Users, 
  Info,
  ChevronDown,
  ChevronUp,
  Printer,
  FileText,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  List,
  Scale
} from 'lucide-react';
import { MinistryEvent, Task, MinistryLane, MilestoneKey, EventDoc, LaneDetail, Volunteer } from '../types';
import TaskCard from './TaskCard';
import ConfirmDialog from './ConfirmDialog';
import { getTodayISO, parseLocalDate, formatDisplayDate } from '../lib/dates';

interface ReverseTimelineProps {
  events: MinistryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  onCreateEvent: (name: string, date: string, description: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onToggleTask: (eventId: string, taskId: string, completed: boolean) => Promise<void>;
  onUpdateTaskLane: (eventId: string, taskId: string, lane: MinistryLane) => Promise<void>;
  onUpdateTaskAssignment: (eventId: string, taskId: string, assignedTo: string) => Promise<void>;
  onAddTask: (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string; priority?: 'High' | 'Medium' | 'Low' }) => Promise<void>;
  onUpdateEventDocs?: (eventId: string, docs: EventDoc[]) => Promise<void>;
  onUpdateEvent?: (eventId: string, data: Partial<MinistryEvent>) => Promise<void>;
  onUpdateTaskDueDate?: (eventId: string, taskId: string, dueDate: string) => Promise<void>;
  onRescaleTimeline?: (eventId: string, updates: { taskId: string; dueDate: string }[]) => Promise<void>;
  onUpdateTask?: (eventId: string, taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask?: (eventId: string, taskId: string) => Promise<void>;
  lanes?: LaneDetail[];
  volunteers?: Volunteer[];
}

export default function ReverseTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  onCreateEvent,
  onDeleteEvent,
  onToggleTask,
  onUpdateTaskLane,
  onUpdateTaskAssignment,
  onAddTask,
  onUpdateEventDocs,
  onUpdateEvent,
  onUpdateTaskDueDate,
  onRescaleTimeline,
  onUpdateTask,
  onDeleteTask,
  lanes = [],
  volunteers = []
}: ReverseTimelineProps) {
  const { showNotification } = useNotification();

  // Event creation form state
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isTeamSectionExpanded, setIsTeamSectionExpanded] = useState(false);

  // Event editing form state
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventName, setEditEventName] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editEventDesc, setEditEventDesc] = useState('');

  // Filter state
  const [selectedLaneFilter, setSelectedLaneFilter] = useLocalStorageState<MinistryLane | 'All'>('cabc.timeline.laneFilter', 'All');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useLocalStorageState<string>('cabc.timeline.assigneeFilter', 'All');
  const [taskSortOrder, setTaskSortOrder] = useLocalStorageState<'default' | 'priority-desc' | 'due-date'>('cabc.timeline.sortOrder', 'default');
  const [timelineViewMode, setTimelineViewMode] = useLocalStorageState<'list' | 'calendar'>('cabc.timeline.viewMode', 'list');
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(getTodayISO());

  // Custom task form state (for selected event)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskLane, setNewTaskLane] = useState<string>('');
  const [newTaskMilestone, setNewTaskMilestone] = useState<MilestoneKey>('12_weeks_out');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [showTaskFormForMilestone, setShowTaskFormForMilestone] = useState<MilestoneKey | null>(null);

  // Collapsed status for description
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Collapsed status for milestone groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [showBriefingModal, setShowBriefingModal] = useState(false);

  // Rescale Timeline modal & formula states
  const [showRescaleModal, setShowRescaleModal] = useState(false);
  const [rescaleConfirming, setRescaleConfirming] = useState(false);
  const [planningStartDate, setPlanningStartDate] = useState(() => getTodayISO());

  useEffect(() => {
    setRescaleConfirming(false);
  }, [showRescaleModal]);
  
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
          resolve(val);
          setConfirmState(null);
        }
      });
    });
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  const assigneeOptions = useMemo(() => {
    const allTasks = selectedEvent?.tasks || [];
    const uniqueAssignees = new Set<string>();
    allTasks.forEach(task => {
      if (task.assignedTo && task.assignedTo.trim() !== '') {
        uniqueAssignees.add(task.assignedTo.trim());
      }
    });
    return Array.from(uniqueAssignees).sort();
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (selectedAssigneeFilter === 'All' || selectedAssigneeFilter === 'Unassigned') return;
    if (!assigneeOptions.includes(selectedAssigneeFilter)) {
      setSelectedAssigneeFilter('All');
    }
  }, [selectedEvent, selectedAssigneeFilter, assigneeOptions]);

  const isOverdue = (task: Task) => {
    if (task.completed) return false;
    if (!task.dueDate) return false;

    const taskDate = parseLocalDate(task.dueDate);
    const todayDate = parseLocalDate(getTodayISO());

    return taskDate.getTime() < todayDate.getTime();
  };

  const briefingModalRef = useFocusTrap(showBriefingModal && !!selectedEvent, () => setShowBriefingModal(false));
  const rescaleModalRef = useFocusTrap(showRescaleModal && !!selectedEvent, () => setShowRescaleModal(false));

  const rescaledTasks = useMemo(() => {
    if (!selectedEvent || !selectedEvent.tasks || selectedEvent.tasks.length === 0) return [];

    const eventDateStr = selectedEvent.date;

    const formatLocalDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const getDaysDiff = (dateAStr: string, dateBStr: string): number => {
      const dateA = parseLocalDate(dateAStr);
      const dateB = parseLocalDate(dateBStr);
      const diffMs = dateA.getTime() - dateB.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    };

    const addDays = (dateStr: string, days: number): string => {
      const date = parseLocalDate(dateStr);
      date.setDate(date.getDate() + days);
      return formatLocalDate(date);
    };

    // Compute offset = (event date - current due date) in days
    const tasksWithOffset = selectedEvent.tasks.map(t => {
      const offset = getDaysDiff(eventDateStr, t.dueDate);
      return { task: t, offset };
    });

    // originalSpan = largest offset among tasks (earliest task)
    const originalSpan = Math.max(...tasksWithOffset.map(t => t.offset), 0);

    // newSpan = (event date - planning start date) in days
    const newSpan = getDaysDiff(eventDateStr, planningStartDate);

    // scale = newSpan / originalSpan (guard against divide-by-zero and negative spans)
    let scale = 1;
    if (originalSpan > 0 && newSpan >= 0) {
      scale = newSpan / originalSpan;
    }

    // Calculate new due dates
    return tasksWithOffset.map(({ task, offset }) => {
      let newDueDateStr = task.dueDate;
      if (originalSpan > 0 && newSpan >= 0) {
        const daysToSubtract = Math.round(offset * scale);
        newDueDateStr = addDays(eventDateStr, -daysToSubtract);
      }

      // Clamp: never after event date, never before planning start date
      const dNew = parseLocalDate(newDueDateStr);
      const dEvent = parseLocalDate(eventDateStr);
      const dStart = parseLocalDate(planningStartDate);

      if (dNew.getTime() > dEvent.getTime()) {
        newDueDateStr = eventDateStr;
      } else if (dNew.getTime() < dStart.getTime()) {
        newDueDateStr = planningStartDate;
      }

      return {
        taskId: task.id,
        title: task.title,
        currentDueDate: task.dueDate,
        newDueDate: newDueDateStr,
        milestoneKey: task.milestoneKey,
        milestoneTitle: task.milestoneTitle || ''
      };
    });
  }, [selectedEvent, planningStartDate]);

  const handleApplyRescale = () => {
    if (!selectedEvent || !onRescaleTimeline) return;
    setRescaleConfirming(true);
  };

  const handleConfirmRescale = async () => {
    if (!selectedEvent || !onRescaleTimeline) return;

    const previewTasks = rescaledTasks;
    const updates = previewTasks.map(t => ({
      taskId: t.taskId,
      dueDate: t.newDueDate
    }));

    try {
      setSubmitting(true);
      await onRescaleTimeline(selectedEvent.id, updates);
      showNotification('Timeline rescaled successfully!', 'success');
      setShowRescaleModal(false);
    } catch (err) {
      showNotification('Failed to rescale timeline. Please try again.', 'error');
    } finally {
      setSubmitting(false);
      setRescaleConfirming(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName || !newEventDate) return;
    setSubmitting(true);
    try {
      await onCreateEvent(newEventName, newEventDate, newEventDesc);
      setNewEventName('');
      setNewEventDate('');
      setNewEventDesc('');
      setShowCreateForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditEvent = () => {
    if (!selectedEvent) return;
    setEditEventName(selectedEvent.name);
    setEditEventDate(selectedEvent.date);
    setEditEventDesc(selectedEvent.description || '');
    setIsEditingEvent(true);
  };

  const handleUpdateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !editEventName || !editEventDate || !onUpdateEvent) return;
    setSubmitting(true);
    try {
      await onUpdateEvent(selectedEvent.id, {
        name: editEventName,
        date: editEventDate,
        description: editEventDesc
      });
      setIsEditingEvent(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTaskSubmit = async (milestoneKey: MilestoneKey) => {
    if (!selectedEvent || !newTaskTitle) return;
    
    // Calculate a default due date based on other tasks in that milestone, or fallback to the event date
    const peerTask = selectedEvent.tasks.find(t => t.milestoneKey === milestoneKey);
    const dueDate = peerTask ? peerTask.dueDate : selectedEvent.date;

    try {
      await onAddTask(selectedEvent.id, {
        title: newTaskTitle,
        description: newTaskDesc,
        milestoneKey,
        lane: newTaskLane || lanes[0]?.name || 'Strategy',
        dueDate,
        priority: newTaskPriority
      });
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskLane('');
      setNewTaskPriority('Medium');
      setShowTaskFormForMilestone(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  // Group tasks by milestone
  const milestoneGroups = useMemo(() => {
    const groups: { key: MilestoneKey; title: string; tasks: Task[] }[] = [
      { key: '12_weeks_out', title: 'Vision & Scope (12 Weeks Out)', tasks: [] },
      { key: '10_weeks_out', title: 'Planning (10 Weeks Out)', tasks: [] },
      { key: '8_weeks_out', title: 'Build (8 Weeks Out)', tasks: [] },
      { key: '4_weeks_out', title: 'Confirmation (4 Weeks Out)', tasks: [] },
      { key: '2_weeks_out', title: 'Final Push (2 Weeks Out)', tasks: [] }
    ];

    if (!selectedEvent) return groups;

    selectedEvent.tasks.forEach(task => {
      const group = groups.find(g => g.key === task.milestoneKey);
      if (group) {
        const matchesLane = selectedLaneFilter === 'All' || task.lane === selectedLaneFilter;
        let matchesAssignee = false;
        if (selectedAssigneeFilter === 'All') {
          matchesAssignee = true;
        } else if (selectedAssigneeFilter === 'Unassigned') {
          matchesAssignee = !task.assignedTo || task.assignedTo.trim() === '';
        } else {
          matchesAssignee = task.assignedTo === selectedAssigneeFilter;
        }

        if (matchesLane && matchesAssignee) {
          group.tasks.push(task);
        }
      }
    });

    // Apply sorting to tasks within each group
    groups.forEach(group => {
      if (taskSortOrder === 'priority-desc') {
        group.tasks.sort((a, b) => {
          const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
          const weightA = priorityWeight[a.priority || 'Medium'] || 2;
          const weightB = priorityWeight[b.priority || 'Medium'] || 2;
          return weightB - weightA;
        });
      } else if (taskSortOrder === 'due-date') {
        group.tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      }
    });

    return groups;
  }, [selectedEvent, selectedLaneFilter, selectedAssigneeFilter, taskSortOrder]);

  const getLaneColor = (lane: string) => {
    const key = (lane || '').toLowerCase();
    if (key.includes('strategy') || key.includes('vision')) {
      return { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', border: 'border-indigo-200', bg: 'bg-indigo-50/30' };
    }
    if (key.includes('finance') || key.includes('budget') || key.includes('money')) {
      return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-emerald-200', bg: 'bg-emerald-50/30' };
    }
    if (key.includes('media') || key.includes('tech') || key.includes('photo') || key.includes('video')) {
      return { badge: 'bg-purple-100 text-purple-700 border-purple-200', border: 'border-purple-200', bg: 'bg-purple-50/30' };
    }
    if (key.includes('logistics') || key.includes('operations') || key.includes('setup')) {
      return { badge: 'bg-sky-100 text-sky-700 border-sky-200', border: 'border-sky-200', bg: 'bg-sky-50/30' };
    }
    return { badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-amber-200', bg: 'bg-amber-50/30' };
  };

  // Human date formatting helper

  const milestoneNames: Record<string, string> = {
    '12_weeks_out': 'Vision & Scope',
    '10_weeks_out': 'Planning',
    '8_weeks_out': 'Build',
    '4_weeks_out': 'Confirmation',
    '2_weeks_out': 'Final Push'
  };

  const getTimeOutLabel = (dueDateStr: string, eventDateStr: string): string => {
    if (!dueDateStr || !eventDateStr) return '';
    try {
      const dateA = parseLocalDate(eventDateStr);
      const dateB = parseLocalDate(dueDateStr);
      const diffMs = dateA.getTime() - dateB.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      
      if (days <= 0) {
        return "Due on event day";
      }
      if (days >= 1 && days <= 13) {
        return `${days} days out`;
      }
      return `${Math.round(days / 7)} weeks out`;
    } catch (e) {
      return '';
    }
  };

  const assignedVolunteers = useMemo(() => {
    if (!selectedEvent) return [];
    
    // 1. Find all leads explicitly assigned to tasks in the selected event
    const assignedLeadNames = new Set(
      selectedEvent.tasks
        .map(t => t.assignedTo)
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    );

    // 2. Filter the overall volunteers list
    return volunteers.filter(vol => {
      // Is task lead
      const isLead = assignedLeadNames.has(vol.name);
      
      // Is registered for the event via eventAssignments
      const isRegistered = !!(vol.eventAssignments && vol.eventAssignments[selectedEvent.id]);
      
      return isLead || isRegistered;
    });
  }, [selectedEvent, volunteers]);

  // Names available for task assignment: everyone on the roster, plus anyone
  // already assigned to a task in this event — so a reassign <select> always has
  // a matching option even if that person isn't in the volunteers list. Replaces
  // the old hardcoded fallback names (Joy/Bea/Iya/Neil/Sofiya).
  const assignableNames = useMemo(() => {
    const names = new Set<string>();
    volunteers.forEach(v => { if (v.name?.trim()) names.add(v.name.trim()); });
    selectedEvent?.tasks?.forEach(t => { if (t.assignedTo?.trim()) names.add(t.assignedTo.trim()); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [selectedEvent, volunteers]);

  // Calendar calculations & navigation
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

  const calendarDays: { day: number | null; dateString: string | null }[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push({ day: null, dateString: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ day: d, dateString: dateStr });
  }

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(y => y - 1);
    } else {
      setCalMonth(m => m - 1);
    }
    setSelectedCalDay(null);
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(y => y + 1);
    } else {
      setCalMonth(m => m + 1);
    }
    setSelectedCalDay(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar - Event Selector & Creator */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-slate-800 text-sm">Select Event</h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="p-1.5 text-[#856637] hover:bg-[#f5ebd6]/50 rounded-lg transition cursor-pointer"
              title="Add New Event"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* New Event Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateEvent} className="p-3 bg-[#faf8f4] rounded-lg border border-[#e2dcd0] space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Event Name</label>
                <input
                  type="text"
                  placeholder="Hallelujah Night"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Target Date</label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Brief Description</label>
                <textarea
                  placeholder="Outreach details..."
                  value={newEventDesc}
                  onChange={e => setNewEventDesc(e.target.value)}
                  className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] h-16 resize-none font-sans"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-[11px] font-bold py-1.5 rounded transition cursor-pointer"
                >
                  {submitting ? 'Generating...' : 'Calculate Timeline'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-2.5 py-1.5 bg-[#efe0c2] text-[#856637] text-[11px] font-bold rounded hover:bg-[#f5ebd6] transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Event selector list */}
          <div>
            {events.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2 text-center">No events scheduled.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1 gap-1.5">
                {events.map(evt => (
                  <div 
                    key={evt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectEvent(evt.id)}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition relative group w-full flex flex-col justify-between ${
                      selectedEvent?.id === evt.id 
                        ? 'bg-[#1e293b] border-[#1e293b] text-[#faf8f4] shadow-sm' 
                        : 'bg-[#faf8f4] border-[#efe0c2]/30 hover:border-[#c2aa80] text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-5 w-full">
                      <p className={`text-xs font-serif font-bold leading-tight truncate ${
                        selectedEvent?.id === evt.id ? 'text-[#faf8f4]' : 'text-slate-800'
                      }`}>
                        {evt.name}
                      </p>
                      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${
                        selectedEvent?.id === evt.id ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        <Calendar size={10} className="shrink-0" />
                        <span>{formatDisplayDate(evt.date, { month: 'short', emptyLabel: '' })}</span>
                      </p>
                    </div>
                    {events.length > 1 && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteEvent(evt.id);
                        }}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition cursor-pointer ${
                          selectedEvent?.id === evt.id 
                            ? 'text-slate-400 hover:text-rose-400' 
                            : 'text-slate-400 hover:text-rose-600 sm:opacity-0 group-hover:opacity-100'
                        }`}
                        title="Delete Event"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Timeline View */}
      <div className="lg:col-span-3 space-y-6">
        {selectedEvent ? (
          <>
            {/* View Selection Tab Bar */}
            <div className="flex items-center justify-between bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-2 shadow-sm">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTimelineViewMode('list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                    timelineViewMode === 'list'
                      ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-[#f5ebd6]/30'
                  }`}
                >
                  <List size={14} /> Milestone Steps
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineViewMode('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                    timelineViewMode === 'calendar'
                      ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-[#f5ebd6]/30'
                  }`}
                >
                  <Calendar size={14} /> Interactive Calendar
                </button>
              </div>
              <div className="text-[10px] font-mono text-slate-400 pr-2 hidden sm:block">
                ● Current Mode: {timelineViewMode === 'list' ? 'Milestones List' : 'Monthly Master Grid'}
              </div>
            </div>

            {timelineViewMode === 'list' ? (
              <>
                {/* Event Header Panel */}
            <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-3">
              {isEditingEvent ? (
                <form onSubmit={handleUpdateEventSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Event Name</label>
                      <input
                        type="text"
                        value={editEventName}
                        onChange={e => setEditEventName(e.target.value)}
                        className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Event Date</label>
                      <input
                        type="date"
                        value={editEventDate}
                        onChange={e => setEditEventDate(e.target.value)}
                        className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] font-semibold"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Description</label>
                    <textarea
                      value={editEventDesc}
                      onChange={e => setEditEventDesc(e.target.value)}
                      className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:outline-none focus:ring-1 focus:ring-[#c2aa80] h-20 resize-none font-sans"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingEvent(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#1e293b] text-[#faf8f4] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                          Timeline Active
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-black text-[#1e293b] mt-1">{selectedEvent.name}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#f5ebd6] border border-[#efe0c2] px-3 py-1.5 rounded-lg text-[#856637]">
                        <Calendar size={16} />
                        <span className="text-xs font-bold">Event Date: {formatDisplayDate(selectedEvent.date, { month: 'short', emptyLabel: '' })}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartEditEvent}
                        className="px-3 py-1.5 border border-[#e2dcd0] bg-[#faf8f4] text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded hover:bg-[#f5ebd6]/50 transition cursor-pointer"
                      >
                        Edit Event
                      </button>
                      {onRescaleTimeline && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlanningStartDate(getTodayISO());
                            setShowRescaleModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2dcd0] bg-[#faf8f4] text-slate-700 text-[11px] font-bold uppercase tracking-wider rounded hover:bg-[#f5ebd6]/50 transition cursor-pointer"
                          title="Rescale Timeline"
                        >
                          <Scale size={13} />
                          Rescale Timeline
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowBriefingModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#856637] hover:bg-[#6b522b] text-white text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer shadow-sm"
                        title="Generate Printable Briefing PDF"
                      >
                        <Printer size={13} />
                        Generate PDF Report
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed border-t border-[#e2dcd0] pt-3">
                    {selectedEvent.description || 'No description provided.'}
                  </p>
                </>
              )}

              {/* Lane Filters & Sorting */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#e2dcd0]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mr-2">
                    <Filter size={12} /> Filter Lane:
                  </span>
                  {['All', ...lanes.map(l => l.name)].map(lane => (
                    <button
                      key={lane}
                      onClick={() => setSelectedLaneFilter(lane as any)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition cursor-pointer ${
                        selectedLaneFilter === lane
                          ? 'bg-[#1e293b] border-[#1e293b] text-white font-medium'
                          : 'bg-[#faf8f4] border-[#e2dcd0] hover:border-[#c2aa80] text-slate-600'
                      }`}
                    >
                      {lane}
                    </button>
                  ))}

                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 ml-2 sm:ml-4 border-l border-slate-200 pl-3">
                    Assignee:
                  </span>
                  <select
                    value={selectedAssigneeFilter}
                    onChange={e => setSelectedAssigneeFilter(e.target.value)}
                    className="text-[11px] font-bold border border-[#efe0c2] bg-[#fcfaf7] rounded-lg px-2 py-1 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
                  >
                    <option value="All">All</option>
                    <option value="Unassigned">Unassigned</option>
                    {assigneeOptions.map(assignee => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <ArrowUpDown size={12} /> Sort:
                  </span>
                  <select
                    value={taskSortOrder}
                    onChange={e => setTaskSortOrder(e.target.value as any)}
                    className="text-[11px] font-bold border border-[#efe0c2] bg-[#fcfaf7] rounded-lg px-2 py-1 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
                  >
                    <option value="default">Timeline Order</option>
                    <option value="priority-desc">Priority: High to Low</option>
                    <option value="due-date">Due Date</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Team & Assignments Section */}
            <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm space-y-3">
              <button 
                type="button"
                onClick={() => setIsTeamSectionExpanded(!isTeamSectionExpanded)}
                className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#856637]" />
                  <span className="font-serif font-bold text-slate-800 text-sm">Team & Assignments</span>
                  <span className="text-[10px] bg-amber-100 text-[#856637] border border-[#efe0c2] px-2 py-0.5 rounded-full font-sans font-bold">
                    {assignedVolunteers.length} Members
                  </span>
                </div>
                {isTeamSectionExpanded ? (
                  <ChevronUp size={16} className="text-slate-500" />
                ) : (
                  <ChevronDown size={16} className="text-slate-500" />
                )}
              </button>

              {isTeamSectionExpanded && (
                <div className="border-t border-[#e2dcd0] pt-4 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Volunteers list column */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={12} /> Team Members & Their Tasks
                      </h4>
                      {assignedVolunteers.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-[#efe0c2]/50">
                          No team members assigned or registered for this event.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {assignedVolunteers.map(vol => {
                            const volTasks = selectedEvent.tasks.filter(t => t.assignedTo === vol.name);
                            return (
                              <div key={vol.id} className="bg-white border border-[#e2dcd0] rounded-xl p-3.5 space-y-2 shadow-xs">
                                <div className="flex items-center justify-between border-b border-dashed border-slate-100 pb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-[#f5ebd6] text-[#856637] text-[10px] font-bold flex items-center justify-center uppercase">
                                      {vol.name.slice(0, 2)}
                                    </div>
                                    <span className="text-xs font-bold text-slate-800">{vol.name}</span>
                                  </div>
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {volTasks.length} task{volTasks.length !== 1 ? 's' : ''}
                                  </span>
                                </div>

                                {volTasks.length === 0 ? (
                                  <p className="text-[11px] text-slate-400 italic px-1 py-1">
                                    Registered for support (No tasks currently assigned).
                                  </p>
                                ) : (
                                  <div className="space-y-2 pt-0.5">
                                    {volTasks.map(task => {
                                      const { badge } = getLaneColor(task.lane);
                                      return (
                                        <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-slate-750 truncate" title={task.title}>
                                              {task.title}
                                            </p>
                                            <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded-full border ${badge} mt-1 font-semibold`}>
                                              {task.lane}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] text-slate-400">Reassign:</span>
                                            <select
                                              value={task.assignedTo || ''}
                                              onChange={async (e) => {
                                                try {
                                                  await onUpdateTaskAssignment(selectedEvent.id, task.id, e.target.value);
                                                  showNotification(`Reassigned "${task.title}" to ${e.target.value || 'Unassigned'}`, 'success');
                                                } catch (err) {
                                                  showNotification('Failed to update assignment', 'error');
                                                }
                                              }}
                                              className="text-[10px] border border-[#e2dcd0] bg-white rounded px-1.5 py-0.5 text-slate-700 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-semibold"
                                            >
                                              <option value="">Unassigned</option>
                                              {assignableNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Unassigned tasks column */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare size={12} className="text-amber-500" /> Unassigned Tasks (Gaps)
                      </h4>
                      {(() => {
                        const unassignedTasks = selectedEvent.tasks.filter(t => !t.assignedTo || t.assignedTo.trim() === '');
                        if (unassignedTasks.length === 0) {
                          return (
                            <div className="bg-emerald-50/50 border border-emerald-200 text-emerald-850 p-4 rounded-xl flex items-center gap-2 text-xs">
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              <span className="font-medium">All tasks are assigned! Excellent coverage. 🎉</span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            {unassignedTasks.map(task => {
                              const { badge } = getLaneColor(task.lane);
                              return (
                                <div key={task.id} className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-xs hover:border-amber-450 transition-colors">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 leading-snug">{task.title}</p>
                                      <span className={`inline-block text-[9px] px-1.5 py-0.2 rounded-full border ${badge} mt-1 font-semibold`}>
                                        {task.lane}
                                      </span>
                                    </div>
                                    <span className="text-[9px] bg-amber-50 border border-amber-200 text-[#856637] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                                      No Lead
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-dashed border-slate-100 pt-2 text-[10px]">
                                    <span className="text-slate-400 font-mono">Due: {formatDisplayDate(task.dueDate, { month: 'short', emptyLabel: '' })}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-slate-500 font-bold">Assign to:</span>
                                      <select
                                        value={task.assignedTo || ''}
                                        onChange={async (e) => {
                                          try {
                                            await onUpdateTaskAssignment(selectedEvent.id, task.id, e.target.value);
                                            showNotification(`Assigned "${task.title}" to ${e.target.value}`, 'success');
                                          } catch (err) {
                                            showNotification('Failed to update assignment', 'error');
                                          }
                                        }}
                                        className="text-[10px] border border-[#e2dcd0] bg-white rounded px-1.5 py-0.5 text-[#856637] cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-semibold"
                                      >
                                        <option value="">Unassigned</option>
                                        {assignableNames.map(name => (
                                          <option key={name} value={name}>{name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Event Task Progress Header */}
            {(() => {
              const allTasks = selectedEvent?.tasks || [];
              const totalTasks = allTasks.length;
              const completedTasks = allTasks.filter(t => t.completed).length;
              const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <div className="bg-white border border-[#e2dcd0] rounded-xl p-4 shadow-sm mb-6 max-w-3xl">
                  {totalTasks === 0 ? (
                    <div className="text-xs text-slate-500 italic font-medium">
                      No tasks yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">
                          {completedTasks} of {totalTasks} tasks complete
                        </span>
                        <span className="font-mono font-bold text-[#856637]">
                          {percent}%
                        </span>
                      </div>
                      <div className="w-full bg-[#efe9dc]/40 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-[#856637] h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Timelines container */}
            <div className="relative border-l-2 border-[#e2dcd0] ml-4 pl-6 space-y-8">
              {milestoneGroups.map(group => {
                const totalInGroup = group.tasks.length;
                const completedInGroup = group.tasks.filter(t => t.completed).length;
                const groupDate = group.tasks[0]?.dueDate || selectedEvent.date;

                const cleanedTitle = group.title.replace(/\s*\(\d+\s*Weeks\s*Out\)/i, '').trim();
                const dynamicLabel = getTimeOutLabel(groupDate, selectedEvent.date);
                const displayedTitle = dynamicLabel ? `${cleanedTitle} (${dynamicLabel})` : cleanedTitle;

                const isExpanded = !collapsedGroups[group.key];

                return (
                  <div key={group.key} className="relative">
                    {/* Timeline Node Ring */}
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-[#c2aa80] bg-[#faf8f4] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#856637]" />
                    </div>

                    {/* Milestone Header */}
                    <div 
                      onClick={() => {
                        setCollapsedGroups(prev => ({
                          ...prev,
                          [group.key]: !prev[group.key]
                        }));
                      }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 bg-[#fcfaf7] border border-[#e2dcd0] p-3 rounded-xl cursor-pointer hover:bg-[#faf8f4] transition select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown 
                          size={16} 
                          className={`text-slate-400 transition-transform duration-200 shrink-0 ${isExpanded ? '' : '-rotate-90'}`} 
                        />
                        <div>
                          <h4 className="font-serif font-bold text-[#1e293b] text-sm leading-tight">{displayedTitle}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                            <Clock size={10} />
                            <span>Estimated Due: {formatDisplayDate(groupDate, { month: 'short', emptyLabel: '' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] text-slate-500 font-bold bg-[#efe9dc]/40 px-2 py-0.5 rounded-full">
                          {completedInGroup} / {totalInGroup} done
                        </span>
                        <button
                          onClick={() => {
                            if (!isExpanded) {
                              setCollapsedGroups(prev => ({
                                ...prev,
                                [group.key]: false
                              }));
                            }
                            setShowTaskFormForMilestone(showTaskFormForMilestone === group.key ? null : group.key);
                            setNewTaskMilestone(group.key);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#856637] bg-[#faf8f4] border border-[#efe0c2] hover:bg-[#f5ebd6]/50 px-2 py-1 rounded shadow-sm cursor-pointer"
                        >
                          <Plus size={10} /> Add Custom Task
                        </button>
                      </div>
                    </div>

                    {/* Custom Task Injection Form inside Milestone */}
                    {isExpanded && showTaskFormForMilestone === group.key && (
                      <div className="mb-4 bg-[#fcfaf7] border border-[#efe0c2] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-3 ml-2 animate-fadeIn">
                        <h5 className="text-xs font-serif font-bold text-slate-750">Add custom task to milestone</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Task Title</label>
                            <input
                              type="text"
                              placeholder="Assemble name tags"
                              value={newTaskTitle}
                              onChange={e => setNewTaskTitle(e.target.value)}
                              className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:ring-[#c2aa80] font-semibold"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Ministry Lane</label>
                            <select
                              value={newTaskLane || (lanes[0]?.name || 'Strategy')}
                              onChange={e => setNewTaskLane(e.target.value)}
                              className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:ring-[#c2aa80] font-semibold"
                            >
                              {lanes.map(lane => (
                                <option key={lane.id} value={lane.name}>{lane.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Priority</label>
                            <select
                              value={newTaskPriority}
                              onChange={e => setNewTaskPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                              className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:ring-[#c2aa80] font-semibold"
                            >
                              <option value="High">🔴 High</option>
                              <option value="Medium">🟡 Medium</option>
                              <option value="Low">🟢 Low</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">Details & Description</label>
                          <textarea
                            placeholder="Add brief helper notes..."
                            value={newTaskDesc}
                            onChange={e => setNewTaskDesc(e.target.value)}
                            className="w-full text-xs p-2 rounded border border-[#e2dcd0] bg-[#faf8f4] focus:ring-[#c2aa80] h-16 resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleAddTaskSubmit(group.key)}
                            className="bg-[#1e293b] hover:bg-[#0f172a] text-white font-semibold px-3 py-1.5 rounded cursor-pointer transition"
                          >
                            Save Task
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTaskFormForMilestone(null)}
                            className="bg-slate-100 text-slate-750 font-medium px-3 py-1.5 rounded hover:bg-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Task Cards Stack */}
                    {isExpanded && (
                      <div className="space-y-2.5 ml-2">
                        {group.tasks.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No tasks matching the lane filter in this milestone.</p>
                        ) : (
                          group.tasks.map(task => (
                            <TaskCard
                              key={task.id}
                              eventId={selectedEvent.id}
                              task={task}
                              onToggleTask={onToggleTask}
                              onUpdateTaskLane={onUpdateTaskLane}
                              onUpdateTaskAssignment={onUpdateTaskAssignment}
                              onUpdateTaskDueDate={onUpdateTaskDueDate}
                              onUpdateTask={onUpdateTask}
                              onDeleteTask={onDeleteTask}
                              lanes={lanes}
                              volunteers={volunteers}
                              isOverdue={isOverdue(task)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* OPTION 1: Monthly Master Calendar Grid View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-[#fcfaf7] border border-[#e2dcd0] rounded-2xl p-6 shadow-sm animate-fadeIn">
            {/* Left Column: Calendar Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-3">
                <h3 className="text-sm font-serif font-bold text-slate-800">
                  {monthNames[calMonth]} {calYear}
                </h3>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-[#f5ebd6]/50 rounded-lg border border-[#e2dcd0] transition text-slate-600 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCalMonth(new Date().getMonth());
                      setCalYear(new Date().getFullYear());
                    }}
                    className="px-2.5 py-1 text-[10px] uppercase font-bold hover:bg-[#f5ebd6]/50 rounded-lg border border-[#e2dcd0] transition text-slate-600 cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
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

                  const isToday = cell.dateString === getTodayISO();
                  const isSelected = selectedCalDay === cell.dateString;
                  
                  // Filter events & tasks
                  const dayEvents = events.filter(e => e.date === cell.dateString);
                  const dayTasks = events.flatMap(evt => 
                    (evt.tasks || []).map(t => ({ ...t, eventName: evt.name, eventId: evt.id }))
                  ).filter(t => t.dueDate === cell.dateString);

                  const hasHighPriority = dayTasks.some(t => t.priority === 'High');
                  const hasMediumPriority = dayTasks.some(t => t.priority === 'Medium');
                  const hasLowPriority = dayTasks.some(t => t.priority === 'Low');
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <button
                      key={`day-${cell.day}`}
                      type="button"
                      onClick={() => setSelectedCalDay(cell.dateString)}
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

                      {/* Indicators row */}
                      <div className="flex flex-wrap gap-1 mt-auto w-full justify-start items-center">
                        {hasEvents && (
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white shadow-sm" title={`${dayEvents.length} Event Launch(es)`} />
                        )}
                        {dayTasks.length > 0 && (
                          <span className={`w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
                            hasHighPriority ? 'bg-rose-500 animate-pulse' : hasMediumPriority ? 'bg-amber-500' : 'bg-emerald-500'
                          }`} title={`${dayTasks.length} Task(s) Due`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Day Details & Planning Agenda */}
            <div className="bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-5 flex flex-col justify-between space-y-4 font-sans">
              <div>
                <div className="pb-3 border-b border-[#e2dcd0]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    TIMELINE AGENDA
                  </span>
                  <h4 className="text-base font-serif font-bold text-slate-800 mt-0.5">
                    {selectedCalDay ? formatDisplayDate(selectedCalDay, { month: 'short', emptyLabel: '' }) : 'Select a Day'}
                  </h4>
                  <p className="text-[9px] font-mono font-medium text-slate-400 mt-0.5">
                    {selectedCalDay === getTodayISO() ? '● Current Planning Today' : ''}
                  </p>
                </div>

                {/* Selected Day Content */}
                <div className="mt-4 space-y-4 overflow-y-auto max-h-[340px] pr-1">
                  {(() => {
                    const dayStr = selectedCalDay || getTodayISO();
                    const dayEvents = events.filter(e => e.date === dayStr);
                    const dayTasks = events.flatMap(evt => 
                      (evt.tasks || []).map(t => ({ ...t, eventName: evt.name, eventId: evt.id }))
                    ).filter(t => t.dueDate === dayStr);

                    if (dayEvents.length === 0 && dayTasks.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center space-y-1">
                          <Calendar size={20} className="text-slate-300" />
                          <span>No event launches or deadlines scheduled.</span>
                        </div>
                      );
                    }

                    return (
                      <>
                        {/* Event Launches */}
                        {dayEvents.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 font-sans">
                              🚀 Upcoming Launches ({dayEvents.length})
                            </h5>
                            {dayEvents.map(evt => (
                              <div 
                                key={evt.id}
                                onClick={() => {
                                  onSelectEvent(evt.id);
                                  setTimelineViewMode('list');
                                }}
                                className="p-3 rounded-lg bg-indigo-50 border border-indigo-150 hover:border-indigo-350 hover:shadow-sm transition cursor-pointer"
                                title="Click to view full Milestone Steps"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <h6 className="text-xs font-bold text-indigo-950 font-serif leading-tight">{evt.name}</h6>
                                  <span className="text-[8px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0">Launch</span>
                                </div>
                                <p className="text-[10px] text-indigo-800 mt-1 line-clamp-2 leading-relaxed">{evt.description || 'No description.'}</p>
                                <div className="text-[9px] font-bold text-indigo-600 mt-2 flex items-center gap-1">
                                  <span>View Steps & Milestones &rarr;</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Tasks Due */}
                        {dayTasks.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 font-sans">
                              📋 Active Milestones & Deadlines ({dayTasks.length})
                            </h5>
                            <div className="space-y-2 animate-fadeIn">
                              {dayTasks.map(task => {
                                const overdue = isOverdue(task);
                                return (
                                  <div 
                                    key={task.id}
                                    className={`p-3 rounded-lg border space-y-2.5 shadow-sm transition-all ${
                                      task.completed
                                        ? 'bg-[#faf8f4]/60 border-[#e2dcd0]/50 opacity-75'
                                        : overdue
                                        ? 'bg-rose-50/40 border-rose-200 border-l-4 border-l-rose-500 shadow-xs'
                                        : 'bg-white border-[#e2dcd0]'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <button
                                          type="button"
                                          onClick={() => onToggleTask(task.eventId, task.id, !task.completed)}
                                          className="mt-0.5 shrink-0 text-slate-400 hover:text-[#856637] transition"
                                        >
                                          {task.completed ? (
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                          ) : (
                                            <div className="w-3.5 h-3.5 border border-slate-350 rounded-sm hover:border-[#856637]" />
                                          )}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                          <h6 className={`text-xs font-bold text-slate-800 leading-snug break-words ${task.completed ? 'line-through text-slate-400' : ''}`}>
                                            {task.title}
                                          </h6>
                                          {overdue && (
                                            <span className="inline-flex items-center text-[8px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 uppercase tracking-wider mt-1">
                                              Overdue
                                            </span>
                                          )}
                                        </div>
                                      </div>
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
                                  <p className="text-[10px] text-slate-500 leading-relaxed pl-5">{task.description}</p>
                                  
                                  <div className="flex flex-wrap gap-1 items-center justify-between pt-1.5 border-t border-[#f2ece2] text-[9px] font-medium text-slate-400 pl-5">
                                    <span>For: <strong className="text-slate-600 font-serif">{task.eventName}</strong></span>
                                    <span className="bg-[#f5ebd6] px-1.5 py-0.5 rounded text-slate-700 font-mono text-[8px]">
                                      {task.lane} Lane
                                    </span>
                                  </div>
                                </div>
                              );})}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Tip / Action Footer */}
              <div className="pt-3 border-t border-[#e2dcd0] text-[9px] text-slate-400 font-medium leading-relaxed">
                <span className="text-amber-600 font-bold">Interactive Power-Tip:</span> Under the calendar view, you can check off deadlines directly or select events to configure their milestones.
              </div>
            </div>
          </div>
        )}
          </>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-sm text-slate-400 text-center px-4">
            <Calendar size={40} className="text-[#c2aa80] mb-3" />
            <h3 className="font-serif font-black text-[#1e293b] text-base">No events yet</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 max-w-sm mx-auto leading-normal">
              Get started by creating your first event to calculate its reverse timeline and manage tasks.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer inline-flex"
            >
              <Plus size={14} /> Create Event
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-sm text-slate-400 text-center">
            <Calendar size={48} className="text-[#c2aa80] mb-3" />
            <h3 className="font-serif font-bold text-slate-700 text-sm">No Event Selected</h3>
            <p className="text-xs text-slate-400 mt-1">Select an event or generate a new one from the sidebar.</p>
          </div>
        )}
      </div>

      {/* Operational Briefing Print Preview Modal */}
      {showBriefingModal && selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          {/* Modal container */}
          <div 
            ref={briefingModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="briefing-sheet-title"
            className="bg-[#faf8f4] w-full max-w-4xl rounded-none sm:rounded-xl border border-[#efe0c2] shadow-2xl flex flex-col max-h-full my-auto text-slate-800 animate-fadeIn"
          >
            {/* Top action bar (non-printable) */}
            <div className="no-print bg-[#f5ebd6]/95 border-b border-[#efe0c2] px-6 py-4 flex items-center justify-between sticky top-0 z-50 rounded-t-none sm:rounded-t-xl">
              <div className="flex items-center gap-2">
                <FileText className="text-[#856637]" size={18} aria-hidden="true" />
                <h3 id="briefing-sheet-title" className="font-serif font-black text-slate-800 text-sm">Operational Briefing Sheet Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#856637] hover:bg-[#6b522b] text-white text-xs font-bold rounded-lg transition shadow-sm cursor-pointer"
                >
                  <Printer size={14} />
                  Print / Save to PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowBriefingModal(false)}
                  className="px-4 py-2 border border-[#e2dcd0] bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* Briefing printable sheet */}
            <div id="briefing-print-area" className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-8 bg-white text-black leading-relaxed font-sans print:p-0">
              
              {/* Dynamic Stylesheet injection to control paper format and print visibility */}
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body {
                    background-color: white !important;
                    color: black !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #briefing-print-area, #briefing-print-area * {
                    visibility: visible !important;
                  }
                  #briefing-print-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    box-shadow: none !important;
                    border: none !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  /* Avoid breaking inside table rows and sections */
                  .print-avoid-break {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }
                }
              `}} />

              {/* Header decoration */}
              <div className="border-b-4 border-[#856637] pb-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <span className="text-[10px] font-bold tracking-widest text-[#856637] uppercase border border-[#efe0c2] bg-[#fcfaf7] px-2 py-0.5 rounded">
                    Operational Briefing Sheet
                  </span>
                  <h1 className="text-3xl font-serif font-black text-slate-900 tracking-tight leading-tight">{selectedEvent.name}</h1>
                  <p className="text-sm text-slate-600 max-w-2xl font-medium leading-relaxed">
                    {selectedEvent.description || 'No formal description provided.'}
                  </p>
                </div>
                <div className="shrink-0 bg-[#fcfaf7] border border-[#efe0c2] rounded-xl p-4 md:text-right min-w-[200px] space-y-1.5 text-xs text-slate-700 font-medium">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Event Date</span>
                    <span className="text-sm font-bold text-slate-900">{formatDisplayDate(selectedEvent.date, { month: 'short', emptyLabel: '' })}</span>
                  </div>
                  <div className="border-t border-[#efe0c2] pt-1.5 mt-1.5 grid grid-cols-2 gap-2 text-center md:text-right md:flex md:flex-col md:gap-0.5">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold md:inline">Total Tasks: </span>
                      <span className="font-bold text-slate-900">{selectedEvent.tasks.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold md:inline">Completed: </span>
                      <span className="font-bold text-slate-900">{selectedEvent.tasks.filter(t => t.completed).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Event Tasks Sequence */}
              <div className="space-y-4 print-avoid-break">
                <h2 className="text-md font-serif font-extrabold text-slate-900 border-b border-[#e2dcd0] pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <span>1. Calculated Reverse Timeline Tasks</span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-[#e2dcd0] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-2 w-[18%]">Milestone Stage</th>
                        <th className="py-2.5 px-2 w-[32%]">Task Description & Notes</th>
                        <th className="py-2.5 px-2 w-[15%]">Ministry Lane</th>
                        <th className="py-2.5 px-2 w-[12%]">Priority</th>
                        <th className="py-2.5 px-2 w-[13%]">Lead Owner</th>
                        <th className="py-2.5 px-2 w-[10%] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dcd0] text-slate-700">
                      {selectedEvent.tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-2 font-bold text-slate-900 whitespace-nowrap align-top">
                            {(() => {
                              const phaseName = task.milestoneTitle 
                                ? task.milestoneTitle.replace(/\s*\(\d+\s*Weeks\s*Out\)/i, '').trim() 
                                : (milestoneNames[task.milestoneKey] || 'Milestone');
                              const taskDynamicLabel = getTimeOutLabel(task.dueDate, selectedEvent.date);
                              return taskDynamicLabel ? `${phaseName} (${taskDynamicLabel})` : phaseName;
                            })()}
                          </td>
                          <td className="py-3 px-2 align-top">
                            <p className="font-bold text-slate-900 leading-tight">{task.title}</p>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 mt-1 leading-normal max-w-md">{task.description}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">Due: {formatDisplayDate(task.dueDate, { month: 'short', emptyLabel: '' })}</p>
                          </td>
                          <td className="py-3 px-2 align-top whitespace-nowrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {task.lane} Lane
                            </span>
                          </td>
                          <td className="py-3 px-2 align-top whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              (task.priority || 'Medium') === 'High' 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : (task.priority || 'Medium') === 'Medium'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                (task.priority || 'Medium') === 'High' ? 'bg-rose-600' :
                                (task.priority || 'Medium') === 'Medium' ? 'bg-amber-500' :
                                'bg-emerald-500'
                              }`} />
                              {(task.priority || 'Medium')}
                            </span>
                          </td>
                          <td className="py-3 px-2 align-top font-semibold text-slate-800 whitespace-nowrap">
                            {task.assignedTo ? (
                              <span className="flex items-center gap-1">
                                <Users size={11} className="text-slate-400" />
                                {task.assignedTo}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-2 align-top text-center">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              task.completed 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                : 'bg-amber-50 text-amber-700 border border-amber-150'
                            }`}>
                              {task.completed ? 'Done' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Roster & Assigned Volunteers */}
              <div className="space-y-4 print-avoid-break">
                <h2 className="text-md font-serif font-extrabold text-slate-900 border-b border-[#e2dcd0] pb-1.5 uppercase tracking-wider">
                  2. Roster &amp; Assigned Volunteers
                </h2>
                {assignedVolunteers.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 italic leading-relaxed">
                    No specific volunteer roster assignments logged yet for this event ID. Any coordinators assigned directly to timeline tasks above are listed here. You can assign additional volunteers in the Roster tab.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-[#e2dcd0] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-2 w-[20%]">Volunteer Name</th>
                          <th className="py-2.5 px-2 w-[30%]">Contact Information</th>
                          <th className="py-2.5 px-2 w-[25%]">Assigned Role &amp; Station</th>
                          <th className="py-2.5 px-2 w-[25%]">Volunteer Skills &amp; Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2dcd0] text-slate-700">
                        {assignedVolunteers.map((vol) => {
                          const eventAssignment = vol.eventAssignments && vol.eventAssignments[selectedEvent.id];
                          return (
                            <tr key={vol.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-2 font-bold text-slate-900 align-top">{vol.name}</td>
                              <td className="py-3 px-2 align-top text-[11px] leading-normal">
                                <p className="font-semibold text-slate-800">{vol.email}</p>
                                <p className="text-slate-500 mt-0.5">{vol.phone || 'No phone'}</p>
                              </td>
                              <td className="py-3 px-2 align-top text-[11px] leading-normal">
                                {eventAssignment ? (
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-slate-900">{eventAssignment.role}</p>
                                    <p className="text-slate-500 text-[10px] font-semibold uppercase">{eventAssignment.station}</p>
                                  </div>
                                ) : (
                                  <span className="text-indigo-700 font-bold">Timeline Task Lead</span>
                                )}
                              </td>
                              <td className="py-3 px-2 align-top text-[11px] text-slate-505 leading-normal">
                                {eventAssignment?.notes ? (
                                  <p className="italic">" {eventAssignment.notes} "</p>
                                ) : (
                                  <p>{vol.notes || vol.skills || 'No coordinator notes logged.'}</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 3: Key Briefing Documents Checklist */}
              <div className="space-y-4 print-avoid-break">
                <h2 className="text-md font-serif font-extrabold text-slate-900 border-b border-[#e2dcd0] pb-1.5 uppercase tracking-wider">
                  3. Operational Documents Checklist
                </h2>
                {!selectedEvent.docs || selectedEvent.docs.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 italic leading-relaxed">
                    No operational checklists or Google Drive briefing attachments have been specified for this event. Specify required documentation inside the Planning Centre tab.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedEvent.docs.map((doc, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 text-xs">
                        <div className="mt-0.5 text-slate-400">
                          {doc.done ? (
                            <span className="font-bold text-emerald-600 border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] uppercase">Ready</span>
                          ) : (
                            <span className="font-bold text-amber-600 border border-amber-300 bg-amber-50 px-1.5 py-0.5 rounded text-[9px] uppercase">Pending</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{doc.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {doc.required ? '★ Mandatory Operational Asset' : 'Optional planning document'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footnote branding and status */}
              <div className="border-t border-[#e2dcd0] pt-6 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider print:mt-12">
                <span>Briefing Sheet generated automatically in Planning Centre</span>
                <span>Security Status: Internal Briefing Only</span>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Rescale Timeline Modal */}
      {showRescaleModal && selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div 
            ref={rescaleModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rescale-modal-title"
            className="bg-[#faf8f4] w-full max-w-2xl rounded-xl border border-[#efe0c2] shadow-2xl flex flex-col max-h-[90vh] text-slate-800 animate-fadeIn"
          >
            <div className="bg-[#f5ebd6] border-b border-[#efe0c2] px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <Scale className="text-[#856637]" size={18} aria-hidden="true" />
                <h3 id="rescale-modal-title" className="font-serif font-black text-slate-800 text-sm uppercase tracking-wider">
                  Rescale Timeline Dates
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRescaleModal(false)}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold uppercase cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <p className="text-xs text-slate-600 leading-relaxed">
                Compress or expand task due dates proportionally to fit a new planning window. Clamps results between your planning start date and the event date, preserving task order and milestones.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Read-Only Event Date
                  </label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500">
                    {formatDisplayDate(selectedEvent.date, { month: 'short', emptyLabel: '' })} ({selectedEvent.date})
                  </div>
                </div>

                <div>
                  <label htmlFor="planning-start-date" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Planning Start Date
                  </label>
                  <input
                    id="planning-start-date"
                    type="date"
                    value={planningStartDate}
                    max={selectedEvent.date}
                    onChange={(e) => setPlanningStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#e2dcd0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#856637] focus:border-[#856637] font-semibold text-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Preview of Shifts (Grouped by Milestone)
                </h4>
                
                <div className="border border-[#efe0c2] rounded-xl overflow-hidden bg-white max-h-[250px] overflow-y-auto shadow-inner">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#fcfaf7] border-b border-[#efe0c2] text-[10px] font-bold text-slate-400 uppercase">
                        <th className="py-2.5 px-4">Task Details</th>
                        <th className="py-2.5 px-4 text-center w-28">Original</th>
                        <th className="py-2.5 px-4 text-center w-8"></th>
                        <th className="py-2.5 px-4 text-center w-28">New Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {(() => {
                        const previewTasks = rescaledTasks;
                        if (previewTasks.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                No tasks found for this event.
                              </td>
                            </tr>
                          );
                        }

                        const milestoneOrder: Record<string, number> = {
                          '12_weeks_out': 1,
                          '10_weeks_out': 2,
                          '8_weeks_out': 3,
                          '4_weeks_out': 4,
                          '2_weeks_out': 5
                        };

                        const sorted = [...previewTasks].sort((a, b) => {
                          const orderA = milestoneOrder[a.milestoneKey] || 99;
                          const orderB = milestoneOrder[b.milestoneKey] || 99;
                          if (orderA !== orderB) return orderA - orderB;
                          return a.currentDueDate.localeCompare(b.currentDueDate);
                        });

                        let lastMilestone = '';
                        return sorted.map((task) => {
                          const showHeader = task.milestoneTitle !== lastMilestone;
                          if (showHeader) {
                            lastMilestone = task.milestoneTitle;
                          }

                          const hasChanged = task.currentDueDate !== task.newDueDate;

                          return (
                            <React.Fragment key={task.taskId}>
                              {showHeader && (
                                <tr className="bg-slate-50/70">
                                  <td colSpan={4} className="py-1 px-4 font-serif font-black text-[#856637] text-[10px] uppercase tracking-wider">
                                    {task.milestoneTitle || 'Milestone Tasks'}
                                  </td>
                                </tr>
                              )}
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-2 px-4 font-medium text-slate-700 truncate max-w-[200px]" title={task.title}>
                                  {task.title}
                                </td>
                                <td className="py-2 px-4 text-center text-slate-400 line-through">
                                  {formatDisplayDate(task.currentDueDate, { month: 'short', emptyLabel: '' })}
                                </td>
                                <td className="py-2 px-1 text-center text-[#856637] font-bold">
                                  →
                                </td>
                                <td className={`py-2 px-4 text-center font-semibold ${hasChanged ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-600'}`}>
                                  {formatDisplayDate(task.newDueDate, { month: 'short', emptyLabel: '' })}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {rescaleConfirming ? (
              <div className="bg-[#fcfaf7] border-t border-[#efe0c2] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl w-full">
                <span className="text-xs font-medium text-slate-700">
                  This will shift {rescaledTasks.length} task dates for "{selectedEvent.name}". Apply?
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setRescaleConfirming(false)}
                    disabled={submitting}
                    className="px-4 py-2 border border-[#e2dcd0] bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRescale}
                    disabled={submitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Applying...' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#fcfaf7] border-t border-[#efe0c2] px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowRescaleModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-[#e2dcd0] bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyRescale}
                  disabled={submitting || (selectedEvent.tasks || []).length === 0}
                  className="px-4 py-2 bg-[#856637] hover:bg-[#6b522b] text-white text-xs font-bold rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Applying...' : 'Apply New Dates'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={() => confirmState.resolve(true)}
          onCancel={() => confirmState.resolve(false)}
        />
      )}
    </div>
  );
}
