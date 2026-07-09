import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Coins, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  UploadCloud, 
  FileText, 
  Check, 
  ArrowRight, 
  Calendar, 
  User, 
  Eye, 
  X, 
  Receipt,
  Percent,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MinistryEvent, Expense } from '../types';

interface BudgetExpenseTrackerProps {
  events: MinistryEvent[];
  onUploadCompleted?: () => void;
}

const CATEGORIES = ['Food', 'Supplies', 'Marketing', 'Other'] as const;
const AUTOSAVE_KEY = 'budgetLedger_draft';

export default function BudgetExpenseTracker({
  events,
  onUploadCompleted
}: BudgetExpenseTrackerProps) {
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense, direction: 'asc' | 'desc' } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Bulk actions state
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<Expense['category']>('Food');

  // Add/Edit modal states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Budget edit state
  const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
  const [budgetCapInput, setBudgetCapInput] = useState<string>('');
  const [isUpdatingBudget, setIsUpdatingBudget] = useState<boolean>(false);

  // Form input states
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<Expense['category']>('Food');
  const [formCost, setFormCost] = useState<string>('');
  const [formPurchaser, setFormPurchaser] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [attachedFileData, setAttachedFileData] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Receipt preview modal state
  const [previewReceipt, setPreviewReceipt] = useState<{ name: string; data: string } | null>(null);

  const firstEventId = events[0]?.id;

  // Auto-save form data for new expenses
  useEffect(() => {
    if (isFormOpen && !editingExpense) {
      const draft = {
        formDescription,
        formCategory,
        formCost,
        formPurchaser,
        formDate,
        attachedFileName,
        attachedFileData,
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
    }
  }, [
    isFormOpen,
    editingExpense,
    formDescription,
    formCategory,
    formCost,
    formPurchaser,
    formDate,
    attachedFileName,
    attachedFileData,
  ]);

  // Default to first event if events are loaded
  useEffect(() => {
    if (firstEventId && !selectedEventId) {
      setSelectedEventId(firstEventId);
    }
  }, [firstEventId, selectedEventId]);

  // Fetch expenses from API
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/expenses');
      if (!res.ok) throw new Error('Failed to load expenses ledger');
      const data = await res.json();
      setExpenses(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error loading budget data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const activeEvent = events.find(e => e.id === selectedEventId) || events[0];
  const activeEventId = activeEvent?.id;
  const activeEventBudgetCap = activeEvent?.budgetCap;

  useEffect(() => {
    if (activeEvent) {
      setBudgetCapInput(activeEvent.budgetCap?.toString() || '500');
      // Reset state on event change
      setSelectedExpenseIds(new Set());
      setCurrentPage(1);
    }
  }, [activeEventId, activeEventBudgetCap]);

  if (!activeEvent) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500">
        <p>No events found. Please create an event first inside the Reverse-Timeline or Command Overview.</p>
      </div>
    );
  }

  // Calculate stats for current event
  const currentExpenses = expenses.filter(exp => exp.eventId === activeEvent.id);
  const totalSpent = currentExpenses.reduce((sum, exp) => sum + exp.cost, 0);
  const budgetCap = activeEvent.budgetCap || 500;
  const remainingBudget = budgetCap - totalSpent;
  const spentPercentage = Math.round((totalSpent / budgetCap) * 100);

  // Color dynamics based on spent percentage
  let progressColor = 'bg-emerald-600';
  let progressBg = 'bg-emerald-50';
  let progressText = 'text-emerald-700';
  let progressBorder = 'border-emerald-200';
  let statusBadge = 'Under Budget';

  if (spentPercentage >= 75 && spentPercentage < 90) {
    progressColor = 'bg-amber-500';
    progressBg = 'bg-amber-50';
    progressText = 'text-amber-700';
    progressBorder = 'border-amber-200';
    statusBadge = 'Approaching Limit';
  } else if (spentPercentage >= 90) {
    progressColor = 'bg-rose-600';
    progressBg = 'bg-rose-50';
    progressText = 'text-rose-700';
    progressBorder = 'border-rose-200';
    statusBadge = spentPercentage > 100 ? 'Budget Overdraft!' : 'Critical Cap Limit';
  }

  // Category breakdown stats
  const categorySpent = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = currentExpenses
      .filter(exp => exp.category === cat)
      .reduce((sum, exp) => sum + exp.cost, 0);
    return acc;
  }, {} as Record<string, number>);

  // Handle setting/editing budget cap
  const handleUpdateBudgetCap = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(budgetCapInput);
    if (isNaN(parsed) || parsed < 0) {
      alert('Please enter a valid positive number for the budget.');
      return;
    }

    setIsUpdatingBudget(true);
    try {
      const res = await apiFetch(`/api/events/${activeEvent.id}/budget`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetCap: parsed })
      });
      if (!res.ok) throw new Error('Failed to update event budget cap');
      
      setIsEditingBudget(false);
      if (onUploadCompleted) onUploadCompleted(); // triggers main refresh
    } catch (err: any) {
      alert(err.message || 'Could not update budget.');
    } finally {
      setIsUpdatingBudget(false);
    }
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    
    // Check file type
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!isValidType) {
      alert('Please upload an image file (PNG/JPG) or PDF of the receipt.');
      return;
    }

    setAttachedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAttachedFileData(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Open modal for add
  const openAddModal = () => {
    setEditingExpense(null);
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormDescription(parsed.formDescription || '');
        setFormCategory(parsed.formCategory || 'Food');
        setFormCost(parsed.formCost || '');
        setFormPurchaser(parsed.formPurchaser || '');
        setFormDate(parsed.formDate || new Date().toISOString().split('T')[0]);
        setAttachedFileName(parsed.attachedFileName || '');
        setAttachedFileData(parsed.attachedFileData || '');
      } catch (e) {
        setFormDescription('');
        setFormCategory('Food');
        setFormCost('');
        setFormPurchaser('');
        setFormDate(new Date().toISOString().split('T')[0]);
        setAttachedFileName('');
        setAttachedFileData('');
      }
    } else {
      setFormDescription('');
      setFormCategory('Food');
      setFormCost('');
      setFormPurchaser('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setAttachedFileName('');
      setAttachedFileData('');
    }
    setIsFormOpen(true);
  };

  // Open modal for edit
  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormCost(expense.cost.toString());
    setFormPurchaser(expense.purchaser);
    setFormDate(expense.date);
    setAttachedFileName(expense.receiptName || '');
    setAttachedFileData(expense.receiptData || '');
    setIsFormOpen(true);
  };

  // Delete expense
  const handleDeleteExpense = async (id: string, desc: string) => {
    
    let __isConfirmed = true;
    try {
      __isConfirmed = window.confirm(`Are you sure you want to delete this expense record: "${desc}"?`);
    } catch (e) {
      console.warn('window.confirm blocked by iframe sandbox, defaulting to true');
    }
    if (!__isConfirmed) {
      return;
    }
    

    try {
      const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete expense record.');
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      alert(err.message || 'Could not delete expense.');
    }
  };

  // Form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCost = parseFloat(formCost);
    if (!formDescription.trim() || isNaN(parsedCost) || parsedCost <= 0 || !formPurchaser.trim() || !formDate) {
      alert('Please fill out all required fields with valid values.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        eventId: activeEvent.id,
        description: formDescription,
        category: formCategory,
        cost: parsedCost,
        purchaser: formPurchaser,
        date: formDate,
        receiptName: attachedFileName || undefined,
        receiptData: attachedFileData || undefined
      };

      let res;
      if (editingExpense) {
        // Edit existing
        res = await apiFetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new
        res = await apiFetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Failed to save expense');
      
      setIsFormOpen(false);
      if (!editingExpense) {
        localStorage.removeItem(AUTOSAVE_KEY);
      }
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      alert(err.message || 'Error occurred while saving expense.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilters]);

  // Bulk Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedExpenses.map(exp => exp.id));
      setSelectedExpenseIds(allIds);
    } else {
      setSelectedExpenseIds(new Set());
    }
  };

  const handleSelectExpense = (id: string, checked: boolean) => {
    const next = new Set(selectedExpenseIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedExpenseIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedExpenseIds.size === 0) return;
    
    let __isConfirmed = true;
    try {
      __isConfirmed = window.confirm(`Are you sure you want to delete ${selectedExpenseIds.size} expenses?`);
    } catch (e) {
      console.warn('window.confirm blocked by iframe sandbox, defaulting to true');
    }
    if (!__isConfirmed) return;
    

    try {
      // For simplicity, running them in sequence or parallel
      await Promise.all(Array.from(selectedExpenseIds).map(id => 
        apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
      ));
      setSelectedExpenseIds(new Set());
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      alert('Error during bulk delete: ' + err.message);
    }
  };

  const handleBulkRecategorize = async () => {
    if (selectedExpenseIds.size === 0) return;
    
    try {
      await Promise.all(Array.from(selectedExpenseIds).map(id => 
        apiFetch(`/api/expenses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: bulkCategoryTarget })
        })
      ));
      setSelectedExpenseIds(new Set());
      setIsBulkCategoryModalOpen(false);
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      alert('Error during bulk update: ' + err.message);
    }
  };

  // Filtered list
  const filteredExpenses = currentExpenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          exp.purchaser.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(exp.category);
    return matchesSearch && matchesCategory;
  });

  // Sort the filtered list
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aVal = a[key] ?? '';
    let bVal = b[key] ?? '';
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = sortedExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key: keyof Expense) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Expense) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} className="inline ml-1" />
      : <ChevronDown size={12} className="inline ml-1" />;
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2dcd0] pb-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-800">Budget Ledger</h2>
          <p className="text-xs text-slate-500">Track and authorize community event spending against assigned caps.</p>
        </div>

        {/* Event Selection Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5 whitespace-nowrap">Event Scope:</span>
          {events.map(e => (
            <button
              key={e.id}
              onClick={() => setSelectedEventId(e.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition whitespace-nowrap ${
                selectedEventId === e.id
                  ? 'bg-[#856637] text-white shadow-sm'
                  : 'bg-white border border-[#e2dcd0] text-slate-600 hover:bg-slate-50'
              }`}
            >
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Progress Banner Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-sm">
        {/* Left Span: Financial Status Progress Meter */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider ${progressBg} ${progressText} border ${progressBorder}`}>
                {statusBadge}
              </span>
              <h3 className="font-serif font-bold text-slate-800 text-lg">Event Spending Meter</h3>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-slate-700">{spentPercentage}%</span>
              <span className="text-xs text-slate-400 block">of approved cap</span>
            </div>
          </div>

          {/* Styled Horizontal Gauge Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, spentPercentage)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${progressColor} min-w-[2%]`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>$0.00 Spent</span>
              <span>75% Capacity</span>
              <span>${budgetCap.toFixed(2)} Maximum Approved</span>
            </div>
          </div>

          {/* Quick Context Alerts */}
          {spentPercentage >= 90 && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${progressBg} ${progressText} ${progressBorder}`}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Authorized Cap Alert</p>
                <p className="opacity-90 leading-relaxed">
                  This event spending has consumed {spentPercentage}% of its ${budgetCap.toFixed(2)} limit. Ministry leads must pause additional purchases or request a budget cap increase before cataloging new invoices.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Span: Big Interactive Budget Widget */}
        <div className="bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Approved Budget Cap</span>
              {isEditingBudget ? (
                <form onSubmit={handleUpdateBudgetCap} className="flex items-center gap-1.5 mt-1">
                  <span className="text-slate-500 font-serif font-bold text-lg">$</span>
                  <input
                    type="number"
                    value={budgetCapInput}
                    onChange={e => setBudgetCapInput(e.target.value)}
                    className="w-24 px-1.5 py-0.5 text-sm font-mono border border-[#e2dcd0] bg-white rounded focus:outline-none focus:ring-1 focus:ring-[#856637]"
                    required
                    min="1"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingBudget}
                    className="p-1 bg-[#856637] text-white rounded text-[10px] font-bold hover:bg-[#6c522b] cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingBudget(false);
                      setBudgetCapInput(budgetCap.toString());
                    }}
                    className="p-1 bg-slate-200 text-slate-600 rounded text-[10px] hover:bg-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif font-bold text-2xl text-slate-800">${budgetCap.toFixed(2)}</span>
                  <button
                    onClick={() => setIsEditingBudget(true)}
                    className="p-1 text-[#856637] hover:bg-[#856637]/5 rounded transition cursor-pointer"
                    title="Change approved event budget"
                  >
                    <Edit size={12} />
                  </button>
                </div>
              )}
            </div>
            <Coins size={20} className="text-[#856637] opacity-60" />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#e2dcd0]/60 pt-3">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Total Logged</span>
              <span className="text-sm font-serif font-bold text-slate-800">${totalSpent.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">Remaining Funds</span>
              <span className={`text-sm font-serif font-bold ${remainingBudget < 0 ? 'text-rose-600 font-mono' : 'text-slate-800'}`}>
                {remainingBudget < 0 ? '-' : ''}${Math.abs(remainingBudget).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.map(cat => {
          const capPct = Math.min(100, budgetCap > 0 ? Math.round((categorySpent[cat] / budgetCap) * 100) : 0);
          let catColor = 'bg-slate-500';
          let catBg = 'bg-slate-50';
          let catBorder = 'border-slate-200';
          let catText = 'text-slate-600';

          if (cat === 'Food') {
            catColor = 'bg-amber-500';
            catBg = 'bg-amber-50/70';
            catBorder = 'border-amber-100';
            catText = 'text-amber-800';
          } else if (cat === 'Supplies') {
            catColor = 'bg-indigo-500';
            catBg = 'bg-indigo-50/70';
            catBorder = 'border-indigo-100';
            catText = 'text-indigo-800';
          } else if (cat === 'Marketing') {
            catColor = 'bg-violet-500';
            catBg = 'bg-violet-50/70';
            catBorder = 'border-violet-100';
            catText = 'text-violet-800';
          }

          return (
            <div key={cat} className={`p-3 rounded-xl border ${catBg} ${catBorder} space-y-2`}>
              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${catText}`}>{cat}</span>
                <span className="text-[10px] font-mono text-slate-400">{capPct}%</span>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-serif font-bold text-slate-800">${categorySpent[cat].toFixed(2)}</div>
                <div className="h-1 w-full bg-slate-200/50 rounded-full overflow-hidden">
                  <div className={`h-full ${catColor}`} style={{ width: `${capPct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Ledger Section */}
      <div className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-2xl">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search description, purchaser name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] text-xs focus:bg-white"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCategoryFilters([])}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border ${
                  categoryFilters.length === 0 
                    ? 'bg-slate-800 border-slate-800 text-white shadow-md' 
                    : 'bg-white border-[#e2dcd0] text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                All
              </button>
              {CATEGORIES.map(cat => {
                const isSelected = categoryFilters.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      if (isSelected) {
                        setCategoryFilters(categoryFilters.filter(c => c !== cat));
                      } else {
                        setCategoryFilters([...categoryFilters, cat]);
                      }
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#856637] border-[#856637] text-white shadow-md' 
                        : 'bg-white border-[#e2dcd0] text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={openAddModal}
            className="w-full md:w-auto px-4 py-2 bg-[#856637] text-white hover:bg-[#6c522b] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
          >
            <Plus size={14} /> Log Purchase Expense
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedExpenseIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center justify-between bg-[#fdfaf2] border border-[#ebd8b7] rounded-xl p-3 text-sm shadow-sm"
          >
            <div className="font-bold text-[#856637]">
              {selectedExpenseIds.size} expenses selected
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkCategoryModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-[#e2dcd0] text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                Change Category
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                Delete Selected
              </button>
            </div>
          </motion.div>
        )}

        {/* Ledger Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-[#856637] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase tracking-wider font-semibold">Synchronizing Expense Log...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
            <Receipt size={32} className="opacity-40 mb-2 text-slate-400" />
            <p className="text-sm font-serif font-semibold text-slate-700">No expense records found</p>
            <p className="text-[11px] text-slate-400 max-w-xs text-center mt-0.5">
              {searchQuery || categoryFilters.length > 0 
                ? 'Try clearing your filters or searching for another description.' 
                : 'Get started by clicking the "Log Purchase Expense" button above to log community outreach supplies.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 pl-4 w-10">
                      <input 
                        type="checkbox"
                        checked={paginatedExpenses.length > 0 && selectedExpenseIds.size === paginatedExpenses.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-[#856637] focus:ring-[#856637] cursor-pointer"
                      />
                    </th>
                    <th 
                      className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                      onClick={() => handleSort('description')}
                    >
                      Description {renderSortIcon('description')}
                    </th>
                    <th 
                      className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                      onClick={() => handleSort('category')}
                    >
                      Category {renderSortIcon('category')}
                    </th>
                    <th 
                      className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                      onClick={() => handleSort('cost')}
                    >
                      Cost {renderSortIcon('cost')}
                    </th>
                    <th 
                      className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                      onClick={() => handleSort('purchaser')}
                    >
                      Purchaser {renderSortIcon('purchaser')}
                    </th>
                    <th 
                      className="p-3.5 cursor-pointer hover:bg-slate-100 transition select-none"
                      onClick={() => handleSort('date')}
                    >
                      Purchase Date {renderSortIcon('date')}
                    </th>
                    <th className="p-3.5 text-center">Receipt Status</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedExpenses.map(exp => {
                    let badgeStyle = 'bg-slate-100 text-slate-600';
                    if (exp.category === 'Food') badgeStyle = 'bg-amber-100 text-amber-800';
                    else if (exp.category === 'Supplies') badgeStyle = 'bg-indigo-100 text-indigo-800';
                    else if (exp.category === 'Marketing') badgeStyle = 'bg-violet-100 text-violet-800';

                    const formattedDate = exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    }) : '';

                    return (
                      <tr key={exp.id} className={`hover:bg-slate-50/50 group transition ${selectedExpenseIds.has(exp.id) ? 'bg-[#fdfaf2] hover:bg-[#fdfaf2]' : ''}`}>
                        <td className="p-3.5 pl-4">
                          <input 
                            type="checkbox"
                            checked={selectedExpenseIds.has(exp.id)}
                            onChange={(e) => handleSelectExpense(exp.id, e.target.checked)}
                            className="rounded border-slate-300 text-[#856637] focus:ring-[#856637] cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5 max-w-xs">
                        <div className="font-serif font-bold text-slate-800 text-sm group-hover:text-[#856637] transition">
                          {exp.description}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-800 text-sm">
                        ${exp.cost.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-slate-600 flex items-center gap-1.5 mt-1.5">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase border border-slate-200">
                          {exp.purchaser.slice(0, 2)}
                        </div>
                        <span className="font-medium">{exp.purchaser}</span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-medium">
                        {formattedDate}
                      </td>
                      <td className="p-3.5 text-center">
                        {exp.receiptData ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border border-emerald-200" title="Receipt attached">
                              <Check size={10} strokeWidth={3} />
                            </span>
                            <button
                              onClick={() => setPreviewReceipt({ name: exp.receiptName || 'Attached Receipt', data: exp.receiptData || '' })}
                              className="text-[10px] font-bold text-[#856637] hover:underline flex items-center gap-0.5 cursor-pointer"
                              title="View file"
                            >
                              <Eye size={12} /> View
                            </button>
                          </div>
                        ) : exp.receiptName ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                              <FileText size={10} />
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]" title={exp.receiptName}>
                              {exp.receiptName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">No Receipt Attached</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition">
                          <button
                            onClick={() => openEditModal(exp)}
                            className="p-1 hover:text-[#856637] hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Edit Expense Record"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.description)}
                            className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete Expense Record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-2">
              <div>
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length} entries
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 flex items-center justify-center rounded font-bold transition cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#856637] text-white border-transparent shadow-sm'
                        : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Edit/Add Expense Overlay Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="px-1.5 py-0.5 bg-[#f5ebd6] text-[#856637] font-bold uppercase text-[8px] tracking-wider rounded">
                    {editingExpense ? 'Modify Purchase Record' : 'Record New Expense'}
                  </span>
                  <h3 className="font-serif font-bold text-slate-800 text-base leading-snug">
                    {editingExpense ? 'Edit Event Expense Details' : 'Log Community Relations Outlay'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Expense Ledger Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* Description input */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Item Description *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Burgers, soap, sponges, flyers, grill coal"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                  />
                </div>

                {/* Category & Cost Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Expense Category *</label>
                    <select 
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as Expense['category'])}
                      className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Amount Cost ($ USD) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 font-bold">$</span>
                      <input 
                        type="number" 
                        required
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={formCost}
                        onChange={e => setFormCost(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs font-mono transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Purchaser & Purchase Date Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Purchased By (Name) *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Bea P. or Operations team"
                      value={formPurchaser}
                      onChange={e => setFormPurchaser(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Purchase Date *</label>
                    <input 
                      type="date" 
                      required
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition font-mono cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stylized File Upload Target Area for Receipts */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Attach Physical Receipt (Image or PDF)</label>
                  
                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition relative ${
                      isDragOver 
                        ? 'border-[#856637] bg-[#fdfaf2]' 
                        : attachedFileName 
                          ? 'border-emerald-200 bg-emerald-50/25' 
                          : 'border-[#e2dcd0] bg-[#faf8f4] hover:border-slate-400'
                    }`}
                  >
                    {attachedFileName ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-emerald-800">
                          <CheckCircle size={16} className="text-emerald-600" />
                          <span className="font-bold font-mono text-[11px] truncate max-w-xs">{attachedFileName}</span>
                        </div>
                        {attachedFileData && attachedFileData.startsWith('data:image/') && (
                          <div className="flex justify-center">
                            <img 
                              src={attachedFileData} 
                              alt="Receipt Preview" 
                              className="h-16 object-contain rounded border border-slate-200 bg-white shadow-xs p-1"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFileName('');
                            setAttachedFileData('');
                          }}
                          className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-bold text-[10px] hover:bg-rose-100 transition cursor-pointer"
                        >
                          Remove Attached File
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 py-2">
                        <UploadCloud size={24} className="mx-auto text-[#856637] opacity-60" />
                        <div className="text-[11px] text-slate-500">
                          <span className="font-bold text-[#856637]">Click to upload</span> or drag and drop your receipt file here
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">Supports JPG, PNG, and PDF (max 5MB)</p>
                        
                        <input
                          type="file"
                          id="receipt-file-input"
                          accept="image/*,application/pdf"
                          onChange={handleFileInputChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer transition font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#856637] text-white hover:bg-[#6c522b] font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm transition"
                  >
                    {isSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        {editingExpense ? 'Save Changes' : 'Record Expense'} <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Receipt Preview Modal */}
      <AnimatePresence>
        {previewReceipt && (
          <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#e2dcd0]"
            >
              <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-[#856637]" />
                  <span className="font-serif font-bold text-slate-800 text-sm truncate max-w-md">{previewReceipt.name}</span>
                </div>
                <button
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
                {previewReceipt.data && previewReceipt.data.startsWith('data:application/pdf') ? (
                  <div className="text-center p-8 text-slate-500 space-y-3 bg-white border border-slate-200 rounded-xl max-w-sm">
                    <FileText size={48} className="mx-auto text-slate-400" />
                    <p className="font-semibold text-sm">PDF Document Receipt</p>
                    <p className="text-xs">Browser sandbox limits direct PDF previews. Click to open in a new tab or inspect the file attachment directly.</p>
                    <a 
                      href={previewReceipt.data} 
                      download={previewReceipt.name}
                      className="inline-block px-4 py-2 bg-[#856637] text-white hover:bg-[#6c522b] rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Download PDF Receipt
                    </a>
                  </div>
                ) : previewReceipt.data ? (
                  <img
                    src={previewReceipt.data}
                    alt={previewReceipt.name}
                    className="max-w-full max-h-[60vh] object-contain rounded shadow-md border border-slate-200 bg-white p-2"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">Receipt asset unavailable</p>
                    <p className="text-[11px]">No binary base64 file data found for this preview.</p>
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setPreviewReceipt(null)}
                  className="px-4 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Category Modal */}
      <AnimatePresence>
        {isBulkCategoryModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-5"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <h3 className="font-serif font-bold text-slate-800 text-base leading-snug">
                  Bulk Re-categorize
                </h3>
                <button 
                  onClick={() => setIsBulkCategoryModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-600 text-xs">Select New Category</label>
                <select 
                  value={bulkCategoryTarget}
                  onChange={e => setBulkCategoryTarget(e.target.value as Expense['category'])}
                  className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsBulkCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer transition font-medium text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleBulkRecategorize}
                  className="px-5 py-2 bg-[#856637] text-white hover:bg-[#6c522b] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition text-xs"
                >
                  Apply to {selectedExpenseIds.size}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
