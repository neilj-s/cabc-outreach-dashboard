import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from 'react';
import { parseLocalDate, getTodayISO } from '../lib/dates';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../context/NotificationContext';
import { useFocusTrap } from '../lib/useFocusTrap';
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
  ChevronRight,
  Download
} from 'lucide-react';
import { MinistryEvent, Expense } from '../types';

interface BudgetExpenseTrackerProps {
  events: MinistryEvent[];
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  pendingExpensesRef: React.MutableRefObject<Map<string, { timeoutId: NodeJS.Timeout; expense: Expense }>>;
  pendingBulkDeletesRef: React.MutableRefObject<Map<string, { timeoutId: NodeJS.Timeout; expenses: Expense[] }>>;
  onUploadCompleted?: () => void;
  loading?: boolean;
}

const CATEGORIES = ['Food', 'Supplies', 'Marketing', 'Other'] as const;
const AUTOSAVE_KEY = 'budgetLedger_draft';

function BudgetExpenseTracker({
  events,
  expenses,
  setExpenses,
  pendingExpensesRef,
  pendingBulkDeletesRef,
  onUploadCompleted,
  loading: parentLoading = false
}: BudgetExpenseTrackerProps) {
  const { showNotification } = useNotification();

  // Clean up pending timeouts on unmount
  useEffect(() => {
    return () => {
      pendingExpensesRef.current.forEach(val => clearTimeout(val.timeoutId));
      pendingBulkDeletesRef.current.forEach(val => clearTimeout(val.timeoutId));
    };
  }, []);

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentlyLoading = parentLoading || loading;

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense, direction: 'asc' | 'desc' } | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
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
  const [formPaidBy, setFormPaidBy] = useState<string>('');
  const [formReimbursed, setFormReimbursed] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Receipt preview modal state
  const [previewReceipt, setPreviewReceipt] = useState<{ name: string; data: string } | null>(null);

  const expenseFormModalRef = useFocusTrap(isFormOpen, () => setIsFormOpen(false));
  const previewReceiptModalRef = useFocusTrap(!!previewReceipt, () => setPreviewReceipt(null));
  const bulkCategoryModalRef = useFocusTrap(isBulkCategoryModalOpen, () => setIsBulkCategoryModalOpen(false));

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
        formPaidBy,
        formReimbursed,
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
    formPaidBy,
    formReimbursed,
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
        <p>No events found. Please create an event first inside the Reverse-Timeline or Overview.</p>
      </div>
    );
  }

  // Calculate stats for current event
  const currentExpenses = expenses.filter(exp => exp.eventId === activeEvent.id);
  const totalSpent = currentExpenses.reduce((sum, exp) => sum + exp.cost, 0);
  const budgetCap = activeEvent.budgetCap || 500;
  const remainingBudget = budgetCap - totalSpent;
  const spentPercentage = Math.round((totalSpent / budgetCap) * 100);
  const totalOwed = currentExpenses
    .filter(exp => !exp.reimbursed && exp.paidBy && exp.paidBy.trim().length > 0)
    .reduce((sum, exp) => sum + exp.cost, 0);

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
      showNotification('Please enter a valid positive number for the budget.', 'error');
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
      showNotification(err.message || 'Could not update budget.', 'error');
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
      showNotification('Please upload an image file (PNG/JPG) or PDF of the receipt.', 'error');
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
        setFormPaidBy(parsed.formPaidBy || '');
        setFormReimbursed(parsed.formReimbursed || false);
      } catch (e) {
        setFormDescription('');
        setFormCategory('Food');
        setFormCost('');
        setFormPurchaser('');
        setFormDate(new Date().toISOString().split('T')[0]);
        setAttachedFileName('');
        setAttachedFileData('');
        setFormPaidBy('');
        setFormReimbursed(false);
      }
    } else {
      setFormDescription('');
      setFormCategory('Food');
      setFormCost('');
      setFormPurchaser('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setAttachedFileName('');
      setAttachedFileData('');
      setFormPaidBy('');
      setFormReimbursed(false);
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
    setFormPaidBy(expense.paidBy || '');
    setFormReimbursed(expense.reimbursed || false);
    setIsFormOpen(true);
  };

  // Delete expense
  const handleDeleteExpense = (id: string, desc: string) => {
    const expenseToDelete = expenses.find(exp => exp.id === id);
    if (!expenseToDelete) return;

    // Optimistically remove from state
    setExpenses(prev => prev.filter(exp => exp.id !== id));

    const timeoutId = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete expense record.');
        pendingExpensesRef.current.delete(id);
        if (onUploadCompleted) onUploadCompleted();
      } catch (err: any) {
        const msg = err.message || 'Could not delete expense.';
        showNotification(msg, 'error');
        // Restore on server failure
        setExpenses(prev => {
          if (prev.some(exp => exp.id === id)) return prev;
          return [...prev, expenseToDelete];
        });
      }
    }, 5000);

    const existing = pendingExpensesRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    pendingExpensesRef.current.set(id, { timeoutId, expense: expenseToDelete });

    showNotification(`Expense "${desc}" removed.`, 'success', {
      label: 'Undo',
      onClick: () => {
        const pending = pendingExpensesRef.current.get(id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          setExpenses(prev => {
            if (prev.some(exp => exp.id === id)) return prev;
            return [...prev, pending.expense];
          });
          pendingExpensesRef.current.delete(id);
          showNotification(`Restored "${desc}"`, 'success');
        }
      }
    });
  };

  // Form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCost = parseFloat(formCost);
    if (!formDescription.trim() || isNaN(parsedCost) || parsedCost <= 0 || !formPurchaser.trim() || !formDate) {
      showNotification('Please fill out all required fields with valid values.', 'error');
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
        receiptData: attachedFileData || undefined,
        paidBy: formPaidBy || undefined,
        reimbursed: formReimbursed
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
      showNotification(
        editingExpense 
          ? `Expense "${formDescription}" updated successfully!` 
          : `Expense "${formDescription}" saved successfully!`, 
        'success'
      );
    } catch (err: any) {
      const msg = err.message || 'Error occurred while saving expense.';
      showNotification(msg, 'error');
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

  const handleBulkDelete = () => {
    if (selectedExpenseIds.size === 0) return;

    const idsToDelete = Array.from(selectedExpenseIds);
    const expensesToDelete = expenses.filter(exp => selectedExpenseIds.has(exp.id));
    const deletedCount = selectedExpenseIds.size;

    // Clear selection
    setSelectedExpenseIds(new Set());

    // Optimistically remove from state
    setExpenses(prev => prev.filter(exp => !idsToDelete.includes(exp.id)));

    const batchId = Math.random().toString(36).substring(2, 9);

    const timeoutId = setTimeout(async () => {
      try {
        await Promise.all(idsToDelete.map(id => 
          apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
        ));
        pendingBulkDeletesRef.current.delete(batchId);
        if (onUploadCompleted) onUploadCompleted();
      } catch (err: any) {
        showNotification('Error during bulk delete: ' + err.message, 'error');
        // Restore on server failure
        setExpenses(prev => {
          const newExpenses = [...prev];
          expensesToDelete.forEach(exp => {
            if (!newExpenses.some(e => e.id === exp.id)) {
              newExpenses.push(exp);
            }
          });
          return newExpenses;
        });
      }
    }, 5000);

    const existing = pendingBulkDeletesRef.current.get(batchId);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    pendingBulkDeletesRef.current.set(batchId, { timeoutId, expenses: expensesToDelete });

    showNotification(`${deletedCount} expenses removed.`, 'success', {
      label: 'Undo',
      onClick: () => {
        const pending = pendingBulkDeletesRef.current.get(batchId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          setExpenses(prev => {
            const newExpenses = [...prev];
            pending.expenses.forEach(exp => {
              if (!newExpenses.some(e => e.id === exp.id)) {
                newExpenses.push(exp);
              }
            });
            return newExpenses;
          });
          pendingBulkDeletesRef.current.delete(batchId);
          showNotification(`Restored ${deletedCount} expenses`, 'success');
        }
      }
    });
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
      const updatedCount = selectedExpenseIds.size;
      setSelectedExpenseIds(new Set());
      setIsBulkCategoryModalOpen(false);
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
      showNotification(`Successfully recategorized ${updatedCount} expenses to ${bulkCategoryTarget}!`, 'success');
    } catch (err: any) {
      showNotification('Error during bulk update: ' + err.message, 'error');
    }
  };

  // Filtered list
  const filteredExpenses = currentExpenses.filter(exp => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = exp.description.toLowerCase().includes(q) ||
                          exp.category.toLowerCase().includes(q) ||
                          exp.purchaser.toLowerCase().includes(q);
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

  const handleExportExpensesCSV = () => {
    if (!filteredExpenses || filteredExpenses.length === 0) {
      showNotification('No expenses found matching the current filters to export.', 'error');
      return;
    }

    const hasReimbursement = expenses.some(exp => 'paidBy' in exp || 'reimbursed' in exp);
    const headers = ['Date', 'Description', 'Category', 'Cost', 'Receipt Status'];
    if (hasReimbursement) {
      headers.push('Paid By', 'Reimbursed');
    }

    const rows = filteredExpenses.map(exp => {
      const row = [
        exp.date || '',
        exp.description || '',
        exp.category || '',
        exp.cost !== undefined ? exp.cost.toString() : '0',
        exp.receiptName || exp.receiptData ? 'Attached' : 'None'
      ];
      if (hasReimbursement) {
        row.push(
          (exp as any).paidBy || '',
          (exp as any).reimbursed !== undefined ? ((exp as any).reimbursed ? 'Yes' : 'No') : ''
        );
      }
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = getTodayISO();
    const eventNameSlug = activeEvent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `cabc-expenses-${eventNameSlug}-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleReimbursed = async (expense: Expense) => {
    try {
      const res = await apiFetch(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expense,
          reimbursed: !expense.reimbursed
        })
      });
      if (!res.ok) throw new Error('Failed to update reimbursement status');
      await fetchExpenses();
      if (onUploadCompleted) onUploadCompleted();
      showNotification(
        `Expense "${expense.description}" marked as ${!expense.reimbursed ? 'Reimbursed' : 'Owed'}.`,
        'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'Failed to update reimbursement status.', 'error');
    }
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

          <div className="border-t border-[#e2dcd0]/60 pt-3">
            <div className="grid grid-cols-2 gap-3">
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
            <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-[#e2dcd0]/40 pt-1.5 font-medium">
              <span>Owed to volunteers:</span>
              <span className={`font-mono font-bold ${totalOwed > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                ${totalOwed.toFixed(2)}
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
        <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left side: Search input and dropdowns */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
              {/* Search Box */}
              <div className="relative flex-1 max-w-sm">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search description, category, purchaser..."
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

              {/* Category Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryDropdown(!showCategoryDropdown);
                    setShowSortDropdown(false);
                  }}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2dcd0] rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#faf8f4] transition cursor-pointer select-none min-w-[150px] shadow-sm w-full md:w-auto"
                >
                  <span className="truncate">
                    {categoryFilters.length === 0 
                      ? 'All Categories' 
                      : `${categoryFilters.length} Categor${categoryFilters.length > 1 ? 'ies' : 'y'} Active`}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {showCategoryDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowCategoryDropdown(false)} 
                    />
                    <div className="absolute left-0 mt-1 w-56 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-lg z-20 p-3 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#efe0c2]">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Categories</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCategoryFilters([])}
                            className="text-[9px] font-bold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryFilters([...CATEGORIES])}
                            className="text-[9px] font-bold text-[#856637] hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {CATEGORIES.map(cat => (
                          <label key={cat} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[#faf8f4] cursor-pointer text-xs font-semibold text-slate-700 select-none">
                            <input
                              type="checkbox"
                              checked={categoryFilters.includes(cat)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCategoryFilters([...categoryFilters, cat]);
                                } else {
                                  setCategoryFilters(categoryFilters.filter(c => c !== cat));
                                }
                              }}
                              className="accent-[#856637] cursor-pointer"
                            />
                            <span className="truncate">{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSortDropdown(!showSortDropdown);
                    setShowCategoryDropdown(false);
                  }}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white border border-[#e2dcd0] rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#faf8f4] transition cursor-pointer select-none min-w-[150px] shadow-sm w-full md:w-auto"
                >
                  <span className="truncate">
                    {sortConfig 
                      ? sortConfig.key === 'cost' 
                        ? `Cost: ${sortConfig.direction === 'desc' ? 'High to Low' : 'Low to High'}`
                        : sortConfig.key === 'date'
                          ? `Date: ${sortConfig.direction === 'desc' ? 'Newest' : 'Oldest'}`
                          : `Description: ${sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'}`
                      : 'Sort: Date (Newest)'}
                  </span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {showSortDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowSortDropdown(false)} 
                    />
                    <div className="absolute left-0 mt-1 w-56 bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl shadow-lg z-20 p-2 space-y-1 animate-fadeIn">
                      <div className="pb-1 border-b border-[#efe0c2] px-2 mb-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Sort Ledger</span>
                      </div>
                      {[
                        { label: 'Date: Newest First', key: 'date', dir: 'desc' },
                        { label: 'Date: Oldest First', key: 'date', dir: 'asc' },
                        { label: 'Cost: High to Low', key: 'cost', dir: 'desc' },
                        { label: 'Cost: Low to High', key: 'cost', dir: 'asc' },
                        { label: 'Description: A-Z', key: 'description', dir: 'asc' },
                        { label: 'Description: Z-A', key: 'description', dir: 'desc' },
                      ].map((opt) => {
                        const isSelected = sortConfig?.key === opt.key && sortConfig?.direction === opt.dir;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => {
                              setSortConfig({ key: opt.key as keyof Expense, direction: opt.dir as 'asc' | 'desc' });
                              setShowSortDropdown(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded hover:bg-[#faf8f4] text-xs font-semibold flex items-center justify-between cursor-pointer ${
                              isSelected ? 'text-[#856637] bg-[#f5ebd6]/30' : 'text-slate-700'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check size={12} className="text-[#856637]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Clear Filters Button */}
              {(searchQuery || categoryFilters.length > 0 || sortConfig) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilters([]);
                    setSortConfig(null);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 cursor-pointer self-start md:self-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
              <button
                type="button"
                onClick={handleExportExpensesCSV}
                className="px-4 py-2 bg-white border border-[#e2dcd0] text-slate-700 hover:bg-[#faf8f4] hover:text-slate-900 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
                title="Export filtered expenses as CSV"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="px-4 py-2 bg-[#856637] text-white hover:bg-[#6c522b] rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition whitespace-nowrap"
              >
                <Plus size={14} /> Log Purchase Expense
              </button>
            </div>
          </div>

          {/* Info label about active filters */}
          {(searchQuery || categoryFilters.length > 0 || sortConfig) && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1 bg-[#faf8f4] border border-[#efe0c2]/50 px-3 py-1.5 rounded-lg animate-fadeIn">
              <span className="font-semibold text-[#856637]">Active Configuration:</span>
              {searchQuery && <span>Search for <strong className="text-slate-700">"{searchQuery}"</strong></span>}
              {searchQuery && (categoryFilters.length > 0 || sortConfig) && <span className="mx-1">•</span>}
              {categoryFilters.length > 0 && (
                <span>
                  Categories: <strong className="text-slate-700">{categoryFilters.join(', ')}</strong>
                </span>
              )}
              {categoryFilters.length > 0 && sortConfig && <span className="mx-1">•</span>}
              {sortConfig && (
                <span>
                  Sorted by: <strong className="text-slate-700">{
                    sortConfig.key === 'cost' ? 'Cost' : sortConfig.key === 'date' ? 'Date' : 'Description'
                  } ({sortConfig.direction === 'desc' ? 'descending' : 'ascending'})</strong>
                </span>
              )}
              <span className="ml-auto text-slate-400 font-mono text-[10px] shrink-0">
                Showing {filteredExpenses.length} of {currentExpenses.length} expenses
              </span>
            </div>
          )}
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
        {isCurrentlyLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 pl-4 w-10">
                      <div className="w-4 h-4 bg-[#efe9dc]/70 rounded"></div>
                    </th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Cost</th>
                    <th className="p-3.5">Purchaser</th>
                    <th className="p-3.5">Purchase Date</th>
                    <th className="p-3.5 text-center">Reimbursement</th>
                    <th className="p-3.5 text-center">Receipt Status</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3.5 pl-4">
                        <div className="w-4 h-4 bg-[#efe9dc]/50 rounded"></div>
                      </td>
                      <td className="p-3.5 max-w-xs space-y-1.5">
                        <div className="h-3.5 bg-[#efe9dc]/70 rounded w-2/3"></div>
                        <div className="h-2 bg-[#efe9dc]/50 rounded w-1/3"></div>
                      </td>
                      <td className="p-3.5">
                        <div className="h-5 bg-[#efe9dc]/60 rounded-full w-16"></div>
                      </td>
                      <td className="p-3.5">
                        <div className="h-4 bg-[#efe9dc]/70 rounded w-12"></div>
                      </td>
                      <td className="p-3.5 space-y-1">
                        <div className="h-3 bg-[#efe9dc]/60 rounded w-20"></div>
                      </td>
                      <td className="p-3.5">
                        <div className="h-3 bg-[#efe9dc]/50 rounded w-24"></div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="h-5 bg-[#efe9dc]/50 rounded-full w-24 mx-auto"></div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="h-5 bg-[#efe9dc]/50 rounded-full w-28 mx-auto"></div>
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-6 h-6 bg-[#efe9dc]/50 rounded"></div>
                          <div className="w-6 h-6 bg-[#efe9dc]/50 rounded"></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400 border border-dashed border-[#efe0c2] rounded-2xl bg-[#fcfaf7] text-center">
            <Receipt size={40} className="text-[#c2aa80] mb-3" />
            <h3 className="font-serif font-black text-[#1e293b] text-base">
              {searchQuery || categoryFilters.length > 0 ? 'No expenses matched' : 'No expenses logged'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-normal">
              {searchQuery || categoryFilters.length > 0 
                ? 'Try clearing your search query or category filters to see your ledger logs.' 
                : 'Keep your outreach events within budget. Get started by logging your purchase receipts and operational costs.'}
            </p>
            {searchQuery || categoryFilters.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilters([]);
                  setSortConfig(null);
                }}
                className="px-4 py-2 bg-[#856637] text-white hover:bg-[#6c522b] rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-[#856637] text-[#faf8f4] hover:bg-[#6c522b] rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition"
              >
                <Plus size={14} /> Add expense
              </button>
            )}
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
                    <th className="p-3.5 text-center">Reimbursement</th>
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

                    const formattedDate = exp.date ? parseLocalDate(exp.date).toLocaleDateString('en-US', {
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
                        {exp.paidBy ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[120px]" title={`Paid by ${exp.paidBy}`}>
                              {exp.paidBy}
                            </span>
                            <button
                              onClick={() => toggleReimbursed(exp)}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition cursor-pointer ${
                                exp.reimbursed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              }`}
                              title={`Click to mark as ${exp.reimbursed ? 'Owed' : 'Reimbursed'}`}
                            >
                              {exp.reimbursed ? 'Reimbursed' : 'Owed'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Church Paid</span>
                        )}
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
              ref={expenseFormModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="expense-form-title"
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
                  <h3 id="expense-form-title" className="font-serif font-bold text-slate-800 text-base leading-snug">
                    {editingExpense ? 'Edit Event Expense Details' : 'Log Community Relations Outlay'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  aria-label="Close expense form"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X size={15} aria-hidden="true" />
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

                {/* Paid By & Reimbursed Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Paid By (Volunteer Name)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe (if self-funded)"
                      value={formPaidBy}
                      onChange={e => setFormPaidBy(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-6">
                    <input 
                      type="checkbox" 
                      id="form-reimbursed"
                      checked={formReimbursed}
                      onChange={e => setFormReimbursed(e.target.checked)}
                      className="w-4 h-4 text-[#856637] border-slate-300 rounded focus:ring-[#856637] focus:ring-1 cursor-pointer accent-[#856637]"
                    />
                    <label htmlFor="form-reimbursed" className="font-bold text-slate-600 cursor-pointer select-none">
                      Reimbursed / Settled
                    </label>
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
              ref={previewReceiptModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="receipt-preview-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#e2dcd0]"
            >
              <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-[#856637]" aria-hidden="true" />
                  <span id="receipt-preview-title" className="font-serif font-bold text-slate-800 text-sm truncate max-w-md">{previewReceipt.name}</span>
                </div>
                <button
                  onClick={() => setPreviewReceipt(null)}
                  aria-label="Close receipt preview"
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition cursor-pointer"
                >
                  <X size={16} aria-hidden="true" />
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
              ref={bulkCategoryModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-category-title"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-5"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <h3 id="bulk-category-title" className="font-serif font-bold text-slate-800 text-base leading-snug">
                  Bulk Re-categorize
                </h3>
                <button 
                  onClick={() => setIsBulkCategoryModalOpen(false)}
                  aria-label="Close bulk category modal"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <X size={15} aria-hidden="true" />
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

export default React.memo(BudgetExpenseTracker);
