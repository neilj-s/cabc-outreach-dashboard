import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Award, 
  Calendar,
  User,
  Activity,
  ThumbsUp,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { Debrief } from '../types';
import ConfirmDialog from './ConfirmDialog';

interface DebriefArchiveProps {
  debriefs: Debrief[];
  onCreateDebrief: (data: Omit<Debrief, 'id'>) => Promise<void>;
  onUpdateDebrief: (id: string, data: Partial<Debrief>) => Promise<void>;
  onDeleteDebrief: (id: string) => Promise<void>;
}

export default function DebriefArchive({
  debriefs,
  onCreateDebrief,
  onUpdateDebrief,
  onDeleteDebrief
}: DebriefArchiveProps) {
  const [showForm, setShowForm] = useState(false);

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
  const [editingDebrief, setEditingDebrief] = useState<Debrief | null>(null);

  // Search & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedDebriefs = React.useMemo(() => {
    return debriefs
      .filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (sortDirection === 'asc') {
          return dateA.localeCompare(dateB);
        } else {
          return dateB.localeCompare(dateA);
        }
      });
  }, [debriefs, searchQuery, sortDirection]);

  // Form states
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [attendance, setAttendance] = useState('');
  const [volunteers, setVolunteers] = useState('');
  const [budgetGiven, setBudgetGiven] = useState('');
  const [budgetActual, setBudgetActual] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [change, setChange] = useState('');
  const [filedBy, setFiledBy] = useState('');

  const handleOpenCreate = () => {
    setEditingDebrief(null);
    setName('');
    setDate(new Date().toISOString().split('T')[0]);
    setAttendance('');
    setVolunteers('');
    setBudgetGiven('');
    setBudgetActual('');
    setWentWell('');
    setChange('');
    setFiledBy('');
    setShowForm(true);
  };

  const handleOpenEdit = (d: Debrief) => {
    setEditingDebrief(d);
    setName(d.name);
    setDate(d.date);
    setAttendance(d.attendance);
    setVolunteers(d.volunteers);
    setBudgetGiven(d.budgetGiven);
    setBudgetActual(d.budgetActual);
    setWentWell(d.wentWell);
    setChange(d.change);
    setFiledBy(d.filedBy);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const data = {
      name,
      date,
      attendance,
      volunteers,
      budgetGiven,
      budgetActual,
      wentWell,
      change,
      filedBy
    };

    try {
      if (editingDebrief) {
        await onUpdateDebrief(editingDebrief.id, data);
      } else {
        await onCreateDebrief(data);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const formatHumanDate = (dateStr: string) => {
    if (!dateStr) return 'Date TBD';
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return d.toLocaleDateString('en-US', options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200">
        <div>
          <h2 className="text-2xl font-serif font-black tracking-tight text-[#1e293b]">
            Debrief Archive
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Finished events live here so next year starts from real memory, numbers, and structured learnings.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold uppercase tracking-wider rounded-lg transition shadow-sm cursor-pointer"
        >
          <Plus size={14} /> File Event Debrief
        </button>
      </div>

      {/* Add / Edit Form Modal Dialog */}
      {showForm && (
        <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-md hover:shadow-lg hover:-translate-y-1 transition duration-200 max-w-2xl mx-auto space-y-4 animate-fadeIn">
          <h3 className="font-serif font-bold text-base text-[#1e293b]">
            {editingDebrief ? `Modify Debrief for "${editingDebrief.name}"` : 'File New Event Debrief'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Event Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., Free Market"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Event Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">People Served</label>
                <input
                  type="text"
                  value={attendance}
                  onChange={e => setAttendance(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., ~50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Volunteers</label>
                <input
                  type="text"
                  value={volunteers}
                  onChange={e => setVolunteers(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., 56"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Budget Given ($)</label>
                <input
                  type="text"
                  value={budgetGiven}
                  onChange={e => setBudgetGiven(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., 1800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Budget Actual ($)</label>
                <input
                  type="text"
                  value={budgetActual}
                  onChange={e => setBudgetActual(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., 1500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">What Went Well</label>
              <textarea
                value={wentWell}
                onChange={e => setWentWell(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none resize-y font-medium"
                placeholder="List highlights, layout designs, team operations that worked flawlessly..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">What we'd change next year</label>
              <textarea
                value={change}
                onChange={e => setChange(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none resize-y font-medium"
                placeholder="Note recommendations, timeline bottlenecks, assets to purchase, role capacity changes..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-450 mb-1">Filed By</label>
                <input
                  type="text"
                  value={filedBy}
                  onChange={e => setFiledBy(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#efe0c2] bg-[#faf8f4] focus:ring-1 focus:ring-[#c2aa80] focus:outline-none font-medium"
                  placeholder="e.g., Bea"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-[#efe0c2] pt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-[#1e293b] hover:bg-[#0f172a] text-[#faf8f4] text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
              >
                {editingDebrief ? 'Update Record' : 'File Debrief'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-[#efe0c2] hover:bg-[#faf8f4] text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debriefs Listing */}
      {debriefs.length === 0 ? (
        <div className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] py-16 text-center text-slate-400">
          <Activity size={48} className="mx-auto text-[#c2aa80] mb-3" />
          <h3 className="font-serif font-bold text-slate-700 text-sm">No debriefs filed yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
            After a successful neighborhood outreach, file lessons here to help Bea, Joy, and the team recall key operations next year.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search & Sort Panel */}
          <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search debriefs by event name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-7 py-2 rounded-lg border border-[#e2dcd0] bg-white focus:outline-none focus:ring-1 focus:ring-[#856637] text-slate-800 placeholder-slate-400 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-slate-500">Sort Date:</span>
              <div className="flex items-center gap-1 bg-[#f5ebd6]/30 border border-[#e2dcd0] p-1 rounded-xl shadow-xs">
                <button
                  type="button"
                  onClick={() => setSortDirection('desc')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    sortDirection === 'desc'
                      ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Newest First
                </button>
                <button
                  type="button"
                  onClick={() => setSortDirection('asc')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    sortDirection === 'asc'
                      ? 'bg-[#1e293b] text-[#faf8f4] shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Oldest First
                </button>
              </div>
            </div>
          </div>

          {filteredAndSortedDebriefs.map(d => (
            <div key={d.id} className="bg-[#fcfaf7] rounded-xl border border-[#e2dcd0] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4 relative group">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#1e293b]">{d.name}</h3>
                  <p className="text-[11px] text-slate-450 mt-0.5 flex items-center gap-1 font-medium">
                    <Calendar size={12} className="text-[#856637]" />
                    {formatHumanDate(d.date)}
                  </p>
                </div>
                <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleOpenEdit(d)}
                    className="p-1.5 text-slate-500 hover:text-[#1e293b] hover:bg-[#faf8f4] rounded transition cursor-pointer"
                    title="Edit Debrief"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const isConfirmed = await confirmAction(
                        "Delete Debrief",
                        `Are you sure you want to permanently delete the debrief for "${d.name}"?`
                      );
                      if (isConfirmed) {
                        onDeleteDebrief(d.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    title="Delete Debrief"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Tabular Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#faf8f4] rounded-xl border border-[#efe0c2]/60">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-[#856637] font-semibold flex items-center gap-1">
                    <TrendingUp size={10} /> Served
                  </span>
                  <p className="text-lg font-serif font-black text-[#1e293b] leading-tight">
                    {d.attendance || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-[#856637] font-semibold flex items-center gap-1">
                    <Users size={10} /> Volunteers
                  </span>
                  <p className="text-lg font-serif font-black text-[#1e293b] leading-tight">
                    {d.volunteers || '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-[#856637] font-semibold flex items-center gap-1">
                    <DollarSign size={10} /> Budget Given
                  </span>
                  <p className="text-lg font-serif font-black text-[#1e293b] leading-tight">
                    {d.budgetGiven ? `$${d.budgetGiven}` : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-[#856637] font-semibold flex items-center gap-1">
                    <DollarSign size={10} /> Budget Actual
                  </span>
                  <p className="text-lg font-serif font-black text-[#1e293b] leading-tight">
                    {d.budgetActual ? `$${d.budgetActual}` : '—'}
                  </p>
                </div>
              </div>

              {/* Written Feedbacks */}
              <div className="space-y-3.5 pt-1.5 text-xs">
                {d.wentWell && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#856637] bg-[#f5ebd6] border border-[#efe0c2] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <ThumbsUp size={10} /> What Went Well
                    </span>
                    <p className="text-slate-600 leading-relaxed pl-1 whitespace-pre-wrap">
                      {d.wentWell}
                    </p>
                  </div>
                )}

                {d.change && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#856637] bg-[#faf8f4] border border-[#efe0c2] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <RefreshCw size={10} /> What we'd change next year
                    </span>
                    <p className="text-slate-600 leading-relaxed pl-1 whitespace-pre-wrap font-medium">
                      {d.change}
                    </p>
                  </div>
                )}
              </div>

              {d.filedBy && (
                <div className="border-t border-[#efe0c2] pt-3 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <User size={10} className="text-[#856637]" /> Filed by: <strong className="text-[#1e293b] font-bold">{d.filedBy}</strong>
                  </span>
                  <span className="font-mono text-[9px]">DEBRIEF ID: {d.id}</span>
                </div>
              )}
            </div>
          ))}

          {filteredAndSortedDebriefs.length === 0 && (
            <div className="col-span-3 p-12 text-center border border-dashed border-[#e2dcd0] rounded-2xl bg-[#fcfaf7] text-slate-400 text-xs">
              No debriefs match your search/filter criteria.
            </div>
          )}
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
