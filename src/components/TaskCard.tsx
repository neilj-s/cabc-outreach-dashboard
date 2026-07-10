import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  ChevronUp, 
  ChevronDown, 
  Users, 
  Calendar, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Task, MinistryLane, LaneDetail, Volunteer } from '../types';

interface TaskCardProps {
  key?: string;
  eventId: string;
  task: Task;
  onToggleTask: (eventId: string, taskId: string, completed: boolean) => Promise<void>;
  onUpdateTaskLane: (eventId: string, taskId: string, lane: MinistryLane) => Promise<void>;
  onUpdateTaskAssignment: (eventId: string, taskId: string, assignedTo: string) => Promise<void>;
  onUpdateTaskDueDate?: (eventId: string, taskId: string, dueDate: string) => Promise<void>;
  onUpdateTask?: (eventId: string, taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask?: (eventId: string, taskId: string) => Promise<void>;
  lanes?: LaneDetail[];
  volunteers?: Volunteer[];
}

export default function TaskCard({
  eventId,
  task,
  onToggleTask,
  onUpdateTaskLane,
  onUpdateTaskAssignment,
  onUpdateTaskDueDate,
  onUpdateTask,
  onDeleteTask,
  lanes = [],
  volunteers = []
}: TaskCardProps) {
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(task.description || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setSaveStatus('saving');
    try {
      if (onDeleteTask) {
        await onDeleteTask(eventId, task.id);
      }
    } catch (err) {
      setSaveStatus('error');
      setIsDeleting(false);
    }
  };

  // Sync state if props change externally (e.g. from a fresh server refresh)
  useEffect(() => {
    setLocalTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    setLocalDescription(task.description || '');
  }, [task.description]);

  // Debounced auto-save for Title and Description (Notes)
  useEffect(() => {
    // If local state matches the prop values, do not trigger an auto-save
    if (localTitle === task.title && localDescription === (task.description || '')) {
      return;
    }

    setSaveStatus('saving');
    const delayDebounce = setTimeout(async () => {
      try {
        if (onUpdateTask) {
          await onUpdateTask(eventId, task.id, {
            title: localTitle,
            description: localDescription
          });
          setSaveStatus('saved');
          // Clear "saved" badge after some time
          const timer = setTimeout(() => setSaveStatus('idle'), 2500);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        setSaveStatus('error');
        console.error('Failed to auto-save task updates', err);
      }
    }, 1200); // 1.2s delay to wait for user typing pause

    return () => clearTimeout(delayDebounce);
  }, [localTitle, localDescription, eventId, task.id, onUpdateTask]);

  const handleToggle = async () => {
    setSaveStatus('saving');
    try {
      await onToggleTask(eventId, task.id, !task.completed);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleLaneChange = async (lane: MinistryLane) => {
    setSaveStatus('saving');
    try {
      await onUpdateTaskLane(eventId, task.id, lane);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleAssignmentChange = async (assignedTo: string) => {
    setSaveStatus('saving');
    try {
      await onUpdateTaskAssignment(eventId, task.id, assignedTo);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleDueDateChange = async (dueDate: string) => {
    setSaveStatus('saving');
    try {
      if (onUpdateTaskDueDate) {
        await onUpdateTaskDueDate(eventId, task.id, dueDate);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handlePriorityChange = async (priority: 'High' | 'Medium' | 'Low') => {
    setSaveStatus('saving');
    try {
      if (onUpdateTask) {
        await onUpdateTask(eventId, task.id, { priority });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const getLaneColors = (lane: string) => {
    const key = (lane || '').toLowerCase();
    if (key.includes('strategy') || key.includes('vision')) {
      return { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', border: 'border-indigo-200' };
    }
    if (key.includes('finance') || key.includes('budget') || key.includes('money')) {
      return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', border: 'border-emerald-200' };
    }
    if (key.includes('media') || key.includes('tech') || key.includes('photo') || key.includes('video') || key.includes('multimedia')) {
      return { badge: 'bg-purple-100 text-purple-700 border-purple-200', border: 'border-purple-200' };
    }
    if (key.includes('logistics') || key.includes('operations') || key.includes('setup')) {
      return { badge: 'bg-sky-100 text-sky-700 border-sky-200', border: 'border-sky-200' };
    }
    return { badge: 'bg-amber-100 text-amber-700 border-amber-200', border: 'border-amber-200' };
  };

  const laneStyle = getLaneColors(task.lane);

  // Parse human readable date
  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return d.toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div 
      className={`p-4 rounded-xl border transition-all ${
        task.completed 
          ? 'bg-[#faf8f4]/60 border-[#e2dcd0]/50 opacity-75' 
          : 'bg-[#fcfaf7] border border-[#e2dcd0] hover:border-[#c2aa80] shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 w-full">
          {/* Complete Checkbox */}
          <button
            onClick={handleToggle}
            aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
            className={`mt-0.5 rounded transition cursor-pointer shrink-0 ${
              task.completed ? 'text-[#856637]' : 'text-slate-300 hover:text-slate-400'
            }`}
          >
            {task.completed ? <CheckSquare size={18} aria-hidden="true" /> : <Square size={18} aria-hidden="true" />}
          </button>

          {/* Title Area - Editable when expanded, styled beautifully when collapsed */}
          <div className="space-y-1 flex-1 min-w-0 w-full">
            {isExpanded ? (
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Edit Task Title</span>
                <input
                  type="text"
                  value={localTitle}
                  onChange={e => setLocalTitle(e.target.value)}
                  placeholder="Task Title"
                  aria-label="Edit task title"
                  className="text-xs font-bold w-full bg-[#faf8f4] border border-[#e2dcd0] rounded px-2 py-1.5 focus:ring-1 focus:ring-[#c2aa80] focus:outline-none text-slate-800"
                />
              </div>
            ) : (
              <span 
                onClick={() => setIsExpanded(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsExpanded(true);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`text-xs font-bold leading-tight block cursor-pointer hover:text-[#856637] transition ${
                  task.completed ? 'line-through text-slate-400' : 'text-[#1e293b]'
                }`}
              >
                {localTitle}
              </span>
            )}
            
            {/* Meta Row: Badge and due date */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${laneStyle.badge}`}>
                {task.lane} Lane
              </span>
              <span className="text-[10px] text-slate-400">| Due: {formatHumanDate(task.dueDate)}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border flex items-center gap-1 ${
                (task.priority || 'Medium') === 'High' 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : (task.priority || 'Medium') === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <span className={`w-1 h-1 rounded-full ${
                  (task.priority || 'Medium') === 'High' ? 'bg-rose-600' :
                  (task.priority || 'Medium') === 'Medium' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`} />
                {(task.priority || 'Medium')}
              </span>
              
              {/* Auto-save status feedback */}
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[9px] text-[#856637] font-bold uppercase tracking-wider animate-pulse ml-2">
                  <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold uppercase tracking-wider ml-2 animate-fadeIn">
                  <CheckCircle size={10} aria-hidden="true" />
                  Saved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-[9px] text-rose-500 font-bold uppercase tracking-wider ml-2 animate-bounce">
                  <AlertCircle size={10} aria-hidden="true" />
                  Sync Error
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand Notes and Title Editor button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDeleting ? (
            <div className="flex items-center gap-1 animate-fadeIn">
              <button
                onClick={handleConfirmDelete}
                className="text-[10px] font-bold bg-rose-600 text-white px-2 py-1 rounded hover:bg-rose-700 transition cursor-pointer"
              >
                Confirm
              </button>
              <button
                onClick={() => setIsDeleting(false)}
                className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            onDeleteTask && (
              <button
                onClick={() => setIsDeleting(true)}
                className="p-1.5 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                title="Delete task"
                aria-label={`Delete task: ${task.title}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition cursor-pointer"
            title={isExpanded ? "Collapse task editor" : "Edit title, notes, and briefing options"}
            aria-label={isExpanded ? "Collapse task details" : "Expand task details"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Expanded Title, Description, and Notes editor */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-[#efe0c2] space-y-3 text-xs animate-fadeIn">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Task Description &amp; Coordinator Notes
              </label>
              <span className="text-[9px] text-slate-405 italic">Auto-saves as you type</span>
            </div>
            <textarea
              value={localDescription}
              onChange={e => setLocalDescription(e.target.value)}
              placeholder="Add specific instructions, coordinate briefings, or milestones checklists..."
              className="w-full text-xs p-2.5 rounded-lg border border-[#e2dcd0] bg-[#faf8f4] text-slate-700 leading-relaxed font-sans placeholder-slate-400 focus:ring-1 focus:ring-[#c2aa80] focus:outline-none h-24 resize-none shadow-inner"
            />
          </div>
        </div>
      )}

      {/* Task Assignment / Lane / Date Editor Row */}
      <div className="mt-3 pt-3 border-t border-dashed border-[#e2dcd0]/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Assignee select */}
        <div className="flex items-center gap-1 text-slate-500">
          <Users size={12} className="text-slate-400" aria-hidden="true" />
          <span className="text-[10px] text-slate-400 font-medium">Lead:</span>
          <select
            value={task.assignedTo || ''}
            onChange={e => handleAssignmentChange(e.target.value)}
            aria-label="Assigned Coordinator Lead"
            className="text-[11px] font-semibold border border-[#e2dcd0] bg-[#faf8f4] rounded px-1.5 py-0.5 text-slate-800 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
          >
            <option value="">Unassigned</option>
            {/* Render unique list of volunteers dynamic fallback */}
            {volunteers.map(vol => (
              <option key={vol.id} value={vol.name}>{vol.name}</option>
            ))}
            {/* Legacy hardcoded fallbacks if no volunteers list is available */}
            {!volunteers.some(v => v.name === 'Joy') && <option value="Joy">Joy</option>}
            {!volunteers.some(v => v.name === 'Bea') && <option value="Bea">Bea</option>}
            {!volunteers.some(v => v.name === 'Iya') && <option value="Iya">Iya</option>}
            {!volunteers.some(v => v.name === 'Neil') && <option value="Neil">Neil</option>}
            {!volunteers.some(v => v.name === 'Sofiya') && <option value="Sofiya">Sofiya</option>}
          </select>
        </div>

        {/* Due date input */}
        <div className="flex items-center gap-1 text-slate-500">
          <Calendar size={12} className="text-slate-400" aria-hidden="true" />
          <span className="text-[10px] text-slate-400 font-medium">Due:</span>
          <input
            type="date"
            value={task.dueDate}
            onChange={e => handleDueDateChange(e.target.value)}
            aria-label="Due Date"
            className="text-[11px] font-semibold border border-[#e2dcd0] bg-[#faf8f4] rounded px-1.5 py-0.5 text-slate-800 cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
          />
        </div>

        {/* Priority select */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 font-medium">Priority:</span>
          <select
            value={task.priority || 'Medium'}
            onChange={e => handlePriorityChange(e.target.value as 'High' | 'Medium' | 'Low')}
            aria-label="Task Priority"
            className={`text-[11px] font-bold border-none bg-transparent hover:bg-[#faf8f4]/85 px-1 py-0.5 rounded cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none ${
              (task.priority || 'Medium') === 'High' ? 'text-rose-600' :
              (task.priority || 'Medium') === 'Medium' ? 'text-amber-600' :
              'text-emerald-600'
            }`}
          >
            <option value="High">🔴 High</option>
            <option value="Medium">🟡 Medium</option>
            <option value="Low">🟢 Low</option>
          </select>
        </div>

        {/* Reassign lane select */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400 font-medium">Lane:</span>
          <select
            value={task.lane}
            onChange={e => handleLaneChange(e.target.value as any)}
            aria-label="Ministry Lane"
            className="text-[11px] font-bold border-none bg-transparent hover:bg-[#faf8f4]/85 px-1 py-0.5 rounded text-[#856637] cursor-pointer focus:ring-1 focus:ring-[#c2aa80] focus:outline-none"
          >
            {lanes.map(lane => (
              <option key={lane.id} value={lane.name}>{lane.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
