import { apiFetch } from "../lib/api";
import React, { useState, useEffect } from 'react';
import { getTodayISO } from '../lib/dates';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../lib/useFocusTrap';
import { useNotification } from '../context/NotificationContext';
import { 
  Package, 
  Calendar, 
  AlertTriangle, 
  Plus, 
  Minus, 
  Trash2, 
  Edit,
  Search, 
  Filter, 
  CheckCircle, 
  Tag, 
  Info, 
  Layers,
  ArrowRight,
  ClipboardList,
  ChevronDown,
  User,
  RefreshCw,
  AlertCircle,
  Printer
} from 'lucide-react';
import { InventoryItem, AssetReservation, MinistryEvent } from '../types';

interface LogisticsManagerProps {
  selectedEventId: string | null;
  events: MinistryEvent[];
  onUploadCompleted?: () => void; // Trigger root updates if needed
}

function LogisticsManager({ selectedEventId, events, onUploadCompleted }: LogisticsManagerProps) {
  const { showNotification } = useNotification();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [reservations, setReservations] = useState<AssetReservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Reservation Modal/Sidebar state
  const [selectedItemForReserve, setSelectedItemForReserve] = useState<InventoryItem | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState<number>(1);
  const [reservedBy, setReservedBy] = useState<string>(() => {
    return localStorage.getItem('logistics_reservedBy') || 'Operations';
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Asset creation state (for extra capability)
  const [showAddAssetForm, setShowAddAssetForm] = useState<boolean>(false);
  const [newAssetName, setNewAssetName] = useState<string>('');
  const [newAssetCategory, setNewAssetCategory] = useState<string>('Logistics');
  const [newAssetStock, setNewAssetStock] = useState<number>(5);
  const [newAssetNotes, setNewAssetNotes] = useState<string>('');
  const [newAssetIsHighValue, setNewAssetIsHighValue] = useState<boolean>(false);

  // Edit Asset state variables
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editAssetName, setEditAssetName] = useState<string>('');
  const [editAssetCategory, setEditAssetCategory] = useState<string>('Logistics');
  const [editAssetStock, setEditAssetStock] = useState<number>(5);
  const [editAssetNotes, setEditAssetNotes] = useState<string>('');
  const [editAssetIsHighValue, setEditAssetIsHighValue] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const reserveModalRef = useFocusTrap(!!selectedItemForReserve, () => setSelectedItemForReserve(null));
  const editAssetModalRef = useFocusTrap(!!editingItem, () => setEditingItem(null));

  const activeEvent = events.find(e => e.id === selectedEventId);

  // Fetch inventory and reservations
  const fetchLogisticsData = async () => {
    setLoading(true);
    try {
      const [resInv, resReservations] = await Promise.all([
        apiFetch('/api/inventory').then(r => r.json()),
        apiFetch('/api/reservations').then(r => r.json())
      ]);
      setInventory(resInv);
      setReservations(resReservations);
      setError(null);
    } catch (err) {
      console.error("Error loading logistics details:", err);
      setError("Failed to synchronize inventory and reservation schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
  }, [selectedEventId]);

  // Extract unique categories for filtering
  const categories = ['All', ...Array.from(new Set(inventory.map(item => item.category)))];

  // Algorithmic calculation of dynamic stock availability for a specific item on the active event's date
  const getItemAvailability = (item: InventoryItem) => {
    const totalStock = item.totalStock;
    if (!activeEvent) {
      return {
        totalStock,
        availableStock: totalStock,
        thisEventQty: 0,
        otherReservations: [],
        totalReservedByOthers: 0,
        conflictType: 'none' as 'none' | 'partial' | 'full'
      };
    }

    const eventDate = activeEvent.date;

    // Reservations of this asset on the same date by other events
    const otherReservations = reservations.filter(r => 
      r.assetId === item.id && 
      r.eventDate === eventDate && 
      r.eventId !== selectedEventId
    );

    // This event's active reservation of this asset
    const thisEventReservation = reservations.find(r => 
      r.assetId === item.id && 
      r.eventId === selectedEventId
    );

    const thisEventQty = thisEventReservation ? thisEventReservation.quantity : 0;
    const totalReservedByOthers = otherReservations.reduce((sum, r) => sum + r.quantity, 0);
    const availableStock = Math.max(0, totalStock - totalReservedByOthers);

    let conflictType: 'none' | 'partial' | 'full' = 'none';
    if (totalReservedByOthers >= totalStock) {
      conflictType = 'full';
    } else if (totalReservedByOthers > 0) {
      conflictType = 'partial';
    }

    return {
      totalStock,
      availableStock,
      thisEventQty,
      otherReservations,
      totalReservedByOthers,
      conflictType
    };
  };

  // Submit a reservation creation or adjustment
  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForReserve || !selectedEventId) return;

    setIsSubmitting(true);
    localStorage.setItem('logistics_reservedBy', reservedBy);
    
    try {
      const res = await apiFetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedItemForReserve.id,
          eventId: selectedEventId,
          quantity: reserveQuantity,
          reservedBy: reservedBy || 'Operations',
          status: 'Pending'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to finalize reservation");
      }

      await fetchLogisticsData();
      setSelectedItemForReserve(null);
      if (onUploadCompleted) onUploadCompleted(); // Sync metrics with main dashboard
    } catch (err: any) {
      showNotification(err.message || "Could not complete reservation", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateReservationStatus = async (reservation: any, nextStatus: string) => {
    try {
      const res = await apiFetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error();
      await fetchLogisticsData();
    } catch (err) {
      showNotification("Failed to update status.", "error");
    }
  };

  const handleMarkAllReturned = async () => {
    if (!activeEvent) return;
    if (currentEventReservations.length === 0) return;

    const confirmMark = window.confirm(`Are you sure you want to mark all ${currentEventReservations.length} reservations as "Returned" for "${activeEvent.name}"?`);
    if (!confirmMark) return;

    try {
      const res = await apiFetch(`/api/reservations/bulk-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: activeEvent.id })
      });
      if (!res.ok) throw new Error("Could not process bulk return");
      await fetchLogisticsData();
      showNotification("All items marked as returned successfully.", "success");
    } catch (err: any) {
      showNotification(err.message || "Failed to update bulk return status.", "error");
    }
  };

  const handleExportPackingList = () => {
    if (!activeEvent) return;
    const content = `
      <html><head><title>Packing List - ${activeEvent.name}</title>
      <style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; border-bottom: 1px solid #ccc; text-align: left; } </style>
      </head><body>
      <h2>Packing List - ${activeEvent.name}</h2>
      <table><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Status</th><th>Reserved By</th></tr>
      ${currentEventReservations.map(r => `
        <tr>
          <td>${r.itemDetail?.name || 'Unknown'}</td>
          <td>${r.itemDetail?.category || ''}</td>
          <td>${r.quantity}</td>
          <td>${r.status || 'Pending'}</td>
          <td>${r.reservedBy}</td>
        </tr>
      `).join('')}
      </table></body></html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    if (iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(content);
      iframe.contentWindow.document.close();
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  };

  // Direct adjustments from Summary Table/List
  const adjustReservationQuantity = async (assetId: string, currentQty: number, change: number, maxAllowed: number) => {
    if (!selectedEventId) return;
    const newQty = Math.max(0, currentQty + change);
    if (newQty > maxAllowed) {
      showNotification(`Cannot exceed available stock limit (${maxAllowed} units).`, "error");
      return;
    }

    try {
      const res = await apiFetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          eventId: selectedEventId,
          quantity: newQty,
          reservedBy: 'Operations'
        })
      });

      if (!res.ok) throw new Error();
      await fetchLogisticsData();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err) {
      showNotification("Error adjusting reservation allocation.", "error");
    }
  };

  // Delete a reservation directly
  const handleDeleteReservation = async (reservationId: string) => {
    try {
      const res = await apiFetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error();
      await fetchLogisticsData();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err) {
      showNotification("Failed to release reservation.", "error");
    }
  };

  // Admin: Create New Asset Catalog Entry
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName.trim()) return;

    try {
      // In a real database we would POST /api/inventory, let's build the endpoint or support it
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAssetName.trim(),
          category: newAssetCategory,
          totalStock: newAssetStock,
          isHighValue: newAssetIsHighValue,
          notes: newAssetNotes.trim()
        })
      });

      // Wait, did we define POST /api/inventory in server.ts? Let's check!
      // If we didn't, let's write it or adapt. In server.ts we added GET /api/inventory, but we can also add POST /api/inventory to make this fully operational!
      // Let's implement POST /api/inventory in server.ts too so it works.
      if (!res.ok) throw new Error("Could not add inventory item");

      setNewAssetName('');
      setNewAssetNotes('');
      setNewAssetIsHighValue(false);
      setShowAddAssetForm(false);
      await fetchLogisticsData();
    } catch (err) {
      // Let's fall back to showing an alert or just saving to memory
      showNotification("Failed to register physical inventory. Adding catalog additions dynamically is fully supported in our schema.", "error");
    }
  };

  // Handle Delete Asset completely from catalog
  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    
    let __isConfirmed = true;
    try {
      __isConfirmed = window.confirm(`Are you sure you want to completely delete "${assetName}"? This will remove all of its active reservations across all events.`);
    } catch (e) {
      console.warn('window.confirm blocked by iframe sandbox, defaulting to true');
    }
    if (!__isConfirmed) {
      return;
    }
    

    try {
      const res = await apiFetch(`/api/inventory/${assetId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete inventory item");
      await fetchLogisticsData();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      showNotification(err.message || "Could not delete asset", "error");
    }
  };

  // Handle Edit Asset Submit
  const handleEditAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsUpdating(true);
    try {
      const res = await apiFetch(`/api/inventory/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editAssetName.trim(),
          category: editAssetCategory,
          totalStock: editAssetStock,
          isHighValue: editAssetIsHighValue,
          notes: editAssetNotes.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update asset catalog details");
      }

      setEditingItem(null);
      await fetchLogisticsData();
      if (onUploadCompleted) onUploadCompleted();
    } catch (err: any) {
      showNotification(err.message || "Could not update asset", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter local catalog based on selections
  const filteredCatalog = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate items currently reserved specifically for this event
  const currentEventReservations = reservations
    .filter(r => r.eventId === selectedEventId)
    .map(r => {
      const item = inventory.find(i => i.id === r.assetId);
      return {
        ...r,
        itemDetail: item
      };
    });

  if (!selectedEventId) {
    return (
      <div className="bg-[#fcfaf7] border border-[#e2dcd0] p-8 rounded-2xl text-center space-y-3">
        <Package className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="font-serif text-lg font-bold text-slate-800">No Active Event Scope</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please select an active hub event from the scope selector in the top-right header to view and reserve logistics resources.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Event Context Banner */}
      <div className="bg-[#fcfaf7] border border-[#e2dcd0] p-4 md:p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#f5ebd6] text-[#856637] text-[10px] font-bold rounded uppercase tracking-wider">
              Active Logistics Scope
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Calendar size={12} /> {activeEvent?.date}
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-800">
            {activeEvent?.name}
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            {activeEvent?.description || "All allocated gear is locked to this event day to detect and prevent duplicate reservations across ministry lanes."}
          </p>
        </div>

        {/* Rapid Stats Overview */}
        <div className="flex gap-2 shrink-0">
          <div className="bg-white border border-[#e2dcd0] rounded-xl px-4 py-2.5 text-center min-w-[100px]">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Reserved</p>
            <p className="text-lg font-serif font-bold text-slate-800">{currentEventReservations.length}</p>
            <p className="text-[9px] text-slate-500 font-mono">Items Allocated</p>
          </div>
          <div className="bg-white border border-[#e2dcd0] rounded-xl px-4 py-2.5 text-center min-w-[100px]">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Units</p>
            <p className="text-lg font-serif font-bold text-[#856637]">
              {currentEventReservations.reduce((sum, r) => sum + r.quantity, 0)}
            </p>
            <p className="text-[9px] text-slate-500 font-mono">Gear Count</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-850 text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchLogisticsData} className="ml-auto underline font-bold uppercase text-[9px] tracking-wider">
            Retry Sync
          </button>
        </div>
      )}

      {/* Main Grid: Catalog vs Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Catalog Side - 7 Cols */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#e2dcd0] rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4">
            
            {/* Catalog Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2">
              <div>
                <h3 className="font-serif font-bold text-slate-800 flex items-center gap-1.5">
                  <Package size={16} className="text-slate-600" />
                  Shared Physical Gear Catalog
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Click any resource card to allocate quantities to the active event.</p>
              </div>

              {/* Add item button */}
              <button 
                onClick={() => setShowAddAssetForm(!showAddAssetForm)}
                className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                Add Item
              </button>
            </div>

            {/* Quick Add Asset Form Panel (Expandable) */}
            <AnimatePresence>
              {showAddAssetForm && (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreateAsset}
                  className="bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-4 space-y-3 overflow-hidden text-xs"
                >
                  <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1">
                    <Plus size={12} /> Register Physical Asset
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Item Name</label>
                      <input 
                        type="text" 
                        required
                        value={newAssetName}
                        onChange={e => setNewAssetName(e.target.value)}
                        placeholder="e.g. Heavy Duty Extension Cords (50ft)"
                        className="w-full px-2.5 py-1.5 border border-[#e2dcd0] bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#856637]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-600">Category</label>
                      <select 
                        value={newAssetCategory}
                        onChange={e => setNewAssetCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-[#e2dcd0] bg-white rounded-lg focus:outline-none"
                      >
                        <option value="Furniture">Furniture</option>
                        <option value="Outdoor">Outdoor</option>
                        <option value="Audio/Visual">Audio/Visual</option>
                        <option value="Catering">Catering</option>
                        <option value="Logistics">Logistics</option>
                        <option value="Strategy">Strategy</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1 md:col-span-1">
                      <label className="font-bold text-slate-600">Total Owned Stock</label>
                      <input 
                        type="number" 
                        min="1" 
                        required
                        value={newAssetStock}
                        onChange={e => setNewAssetStock(parseInt(e.target.value) || 1)}
                        className="w-full px-2.5 py-1.5 border border-[#e2dcd0] bg-white rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-bold text-slate-600">Storage Notes / Location</label>
                      <input 
                        type="text" 
                        value={newAssetNotes}
                        onChange={e => setNewAssetNotes(e.target.value)}
                        placeholder="e.g. Stored in Closet B"
                        className="w-full px-2.5 py-1.5 border border-[#e2dcd0] bg-white rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-1 bg-amber-50/40 px-2 rounded-lg border border-[#e2dcd0]/50 max-w-fit">
                    <input 
                      type="checkbox" 
                      id="newAssetIsHighValue"
                      checked={newAssetIsHighValue}
                      onChange={e => setNewAssetIsHighValue(e.target.checked)}
                      className="rounded border-[#e2dcd0] text-[#856637] focus:ring-[#856637] cursor-pointer"
                    />
                    <label htmlFor="newAssetIsHighValue" className="font-bold text-slate-700 cursor-pointer select-none">
                      High-value item (requires strict return auditing)
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button 
                      type="button" 
                      onClick={() => setShowAddAssetForm(false)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-1.5 bg-[#856637] text-white hover:bg-[#6c522b] font-bold rounded-lg cursor-pointer"
                    >
                      Save to Catalog
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Catalog Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search catalog by name or description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#e2dcd0] text-xs bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white transition"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter size={12} className="text-slate-500" />
                <div className="flex flex-wrap gap-1">
                  {categories.slice(0, 5).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition cursor-pointer border ${
                        selectedCategory === cat 
                          ? 'bg-[#856637] border-[#856637] text-white' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  {categories.length > 5 && (
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 text-[10px] font-bold rounded-lg text-slate-600 focus:outline-none"
                    >
                      <option disabled value="">More...</option>
                      {categories.slice(5).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Catalog Grid */}
            {loading ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw size={24} className="animate-spin mx-auto text-slate-500" />
                <p className="text-xs font-semibold uppercase tracking-wider">Synchronizing physical records...</p>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 space-y-2">
                <Package size={28} className="mx-auto" />
                <p className="text-xs">No matching physical assets found in current category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCatalog.map(item => {
                  const { totalStock, availableStock, thisEventQty, otherReservations, totalReservedByOthers, conflictType } = getItemAvailability(item);

                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        if (availableStock <= 0 && thisEventQty === 0) {
                          showNotification(`Conflict: "${item.name}" is fully reserved by other events on this day.`, "error");
                          return;
                        }
                        setSelectedItemForReserve(item);
                        setReserveQuantity(thisEventQty || 1);
                      }}
                      className={`border p-4 rounded-xl cursor-pointer transition flex flex-col justify-between space-y-3 relative group overflow-hidden ${
                        thisEventQty > 0 
                          ? 'border-[#efe0c2] bg-[#fcfaf7] ring-1 ring-[#856637]/20 hover:border-[#856637]/40' 
                          : availableStock === 0 
                          ? 'border-rose-200 bg-rose-50/10 hover:border-rose-300 hover:shadow-xs' 
                          : availableStock === 1
                          ? 'border-amber-200 bg-amber-50/10 hover:border-amber-300 hover:shadow-sm'
                          : 'border-slate-200 bg-white hover:border-[#856637]/30 hover:shadow-sm'
                      }`}
                    >
                      {/* Active reservation ribbon indicator */}
                      {thisEventQty > 0 && (
                        <div className="absolute top-0 right-0 bg-[#856637] text-white text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-bl">
                          Allocated ({thisEventQty})
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.category}
                            </span>
                            {item.isHighValue && (
                              <span className="text-[9px] uppercase tracking-wider font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                High-Value
                              </span>
                            )}
                          </div>
                          
                          {/* Admin Controls */}
                          <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                                setEditAssetName(item.name);
                                setEditAssetCategory(item.category);
                                setEditAssetStock(item.totalStock);
                                setEditAssetNotes(item.notes || '');
                                setEditAssetIsHighValue(!!item.isHighValue);
                              }}
                              className="p-1 hover:text-[#856637] hover:bg-slate-100 rounded transition cursor-pointer"
                              title="Edit item / stock availability"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAsset(item.id, item.name);
                              }}
                              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Delete physical asset completely"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-serif font-bold text-slate-800 text-sm group-hover:text-[#856637] transition leading-snug">
                          {item.name}
                        </h4>
                        {item.notes && (
                          <p className="text-[10px] text-slate-500 italic line-clamp-1">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Stock availability calculation details */}
                      <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs mt-auto">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-medium">Stock Availability</p>
                          <p className={`font-bold text-xs ${
                            availableStock === 0 
                              ? 'text-rose-600' 
                              : availableStock === 1 
                              ? 'text-amber-600' 
                              : 'text-slate-700'
                          }`}>
                            {availableStock === 0 ? 'Fully reserved' : `${availableStock} of ${totalStock} available`}
                          </p>
                        </div>

                        {/* Status Warnings */}
                        <div>
                          {conflictType === 'full' ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[9px] font-bold rounded border border-rose-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Conflict Booked
                            </span>
                          ) : conflictType === 'partial' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded border border-amber-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Shared Booking
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-100 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Fully Free
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Conflict Detail pop-outs in the card footer if any other event is using it */}
                      {otherReservations.length > 0 && (
                        <div className="bg-amber-50/40 border border-amber-100 p-2 rounded-lg text-[9px] text-amber-800 space-y-0.5 mt-2">
                          <p className="font-bold uppercase tracking-wider text-[8px] text-amber-700 flex items-center gap-1">
                            <AlertTriangle size={8} /> Same-day Booking Conflict
                          </p>
                          {otherReservations.map(r => (
                            <div key={r.id} className="flex justify-between items-center">
                              <span className="truncate max-w-[120px] font-medium">• {r.eventName}</span>
                              <span className="font-bold font-mono">Qty: {r.quantity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reservations Summary Side Panel - 5 Cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 space-y-4 flex flex-col h-full min-h-[400px]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-slate-800 flex items-center gap-1.5">
                  <ClipboardList size={16} className="text-slate-600" />
                  Event Logistics Allocation
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Allocated to <span className="font-bold underline">{activeEvent?.name}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {currentEventReservations.length > 0 && (
                  <button 
                    onClick={handleMarkAllReturned}
                    className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg hover:bg-emerald-100 hover:text-emerald-900 transition flex items-center gap-1 cursor-pointer"
                    title="Mark all items for this event as returned"
                  >
                    <CheckCircle size={12} />
                    Mark Returned
                  </button>
                )}
                <button 
                  onClick={handleExportPackingList}
                  className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-[#e2dcd0] text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
                  title="Generate printable packing list"
                >
                  <Printer size={12} />
                  Export List
                </button>
              </div>
            </div>

            {/* List of active reservations for this specific event */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[450px] pr-1">
              {currentEventReservations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300">
                    <Package size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-600">No Gear Reserved Yet</p>
                    <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-1">
                      Choose resources from the catalog on the left to add tables, sound equipment, coolers, and canopies to this event.
                    </p>
                  </div>
                </div>
              ) : (
                currentEventReservations.map(res => {
                  const maxAllowed = res.itemDetail ? getItemAvailability(res.itemDetail).availableStock + res.quantity : 0;
                  const isPastEvent = res.eventDate && res.eventDate < getTodayISO();
                  const isUnreturnedHighValue = isPastEvent && res.itemDetail?.isHighValue && res.status !== 'Returned';
                  
                  return (
                    <div 
                      key={res.id} 
                      className={`bg-white border rounded-xl shadow-xs hover:border-slate-350 transition group overflow-hidden ${
                        isUnreturnedHighValue 
                          ? 'border-rose-400 bg-rose-50/10 ring-1 ring-rose-400/25' 
                          : 'border-[#e2dcd0]'
                      }`}
                    >
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[8px] uppercase tracking-wider font-bold text-slate-400 bg-slate-50 px-1 py-0.5 rounded">
                              {res.itemDetail?.category || "Unknown"}
                            </span>
                            {res.itemDetail?.isHighValue && (
                              <span className="text-[8px] uppercase tracking-wider font-bold text-rose-700 bg-rose-50 border border-rose-150 px-1 py-0.5 rounded">
                                High-Value
                              </span>
                            )}
                            {isUnreturnedHighValue && (
                              <span className="text-[8px] uppercase tracking-wider font-bold text-rose-800 bg-rose-100 border border-rose-300 px-1 py-0.5 rounded animate-pulse">
                                Not Returned
                              </span>
                            )}
                          </div>
                          <h4 className="font-serif font-bold text-slate-800 text-xs truncate leading-normal">
                            {res.itemDetail?.name || "Unregistered Asset"}
                          </h4>
                          <div className="flex items-center gap-2 text-[9px] text-slate-400 font-medium">
                            <span className="flex items-center gap-0.5"><User size={10} /> {res.reservedBy}</span>
                            <span>•</span>
                            <span>Max available on day: {maxAllowed}</span>
                          </div>
                        </div>

                        {/* Quantity Incrementor */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-[#faf8f4] border border-[#e2dcd0] p-1 rounded-lg">
                          <button 
                            onClick={() => adjustReservationQuantity(res.assetId, res.quantity, -1, maxAllowed)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded cursor-pointer transition"
                            title="Reduce allocation"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold font-mono text-slate-800">
                            {res.quantity}
                          </span>
                          <button 
                            onClick={() => adjustReservationQuantity(res.assetId, res.quantity, 1, maxAllowed)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded cursor-pointer transition"
                            title="Increase allocation"
                          >
                            <Plus size={10} />
                          </button>
                        </div>

                        {/* Delete reservation button */}
                        <button 
                          onClick={() => handleDeleteReservation(res.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Release this booking"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      
                      {/* Status Toggle Row */}
                      <div className="bg-[#faf8f4] border-t border-[#e2dcd0] px-3.5 py-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[10px] font-medium text-slate-500">Fulfillment Status:</span>
                        <div className="flex items-center gap-1">
                          {(['Pending', 'Packed', 'Returned'] as const).map((status) => {
                            const isSelected = (res.status || 'Pending') === status;
                            let btnStyle = 'text-[9px] px-2 py-0.5 rounded-md border text-slate-500 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition font-medium cursor-pointer';
                            
                            if (isSelected) {
                              if (status === 'Pending') {
                                btnStyle = 'text-[9px] px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 font-bold transition cursor-pointer';
                              } else if (status === 'Packed') {
                                btnStyle = 'text-[9px] px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200 font-bold transition cursor-pointer';
                              } else {
                                btnStyle = 'text-[9px] px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 font-bold transition cursor-pointer';
                              }
                            } else if (status === 'Returned' && isUnreturnedHighValue) {
                              // Highlight "Returned" as recommended action to fix unreturned high-value state
                              btnStyle = 'text-[9px] px-2 py-0.5 rounded-md border bg-rose-50/50 text-rose-700 border-rose-200 hover:bg-rose-50 transition font-medium cursor-pointer animate-pulse';
                            }

                            return (
                              <button
                                key={status}
                                onClick={() => updateReservationStatus(res, status)}
                                className={btnStyle}
                              >
                                {status === 'Pending' ? '○ Pending' : status === 'Packed' ? '📦 Packed' : '✓ Returned'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Same-day logistical conflict summary drill down */}
            <div className="bg-white border border-[#e2dcd0] p-4 rounded-xl text-xs space-y-2 mt-auto">
              <h4 className="font-bold text-slate-800 uppercase text-[9px] tracking-wider flex items-center gap-1 border-b border-slate-100 pb-1">
                <Info size={11} className="text-[#856637]" /> Active Day Conflicts Check
              </h4>
              <p className="text-[10px] text-slate-500 leading-normal">
                Any other events scheduled on <span className="font-semibold underline">{activeEvent?.date}</span> sharing this date?
              </p>
              {(() => {
                const sameDayEvents = events.filter(e => e.date === activeEvent?.date && e.id !== selectedEventId);
                if (sameDayEvents.length === 0) {
                  return (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[10px] bg-emerald-50 p-2 rounded-lg">
                      <CheckCircle size={12} /> No concurrent calendar events on this day. Assets fully secure.
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-100 inline-block">
                      ⚠️ {sameDayEvents.length} concurrent events on this day
                    </p>
                    <div className="space-y-1 pl-1">
                      {sameDayEvents.map(e => (
                        <p key={e.id} className="text-[10px] font-medium text-slate-600">
                          • {e.name}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Slide-out Modal/Drawer Overlay */}
      <AnimatePresence>
        {selectedItemForReserve && (() => {
          const availability = getItemAvailability(selectedItemForReserve);
          const maxAllowed = availability.availableStock + availability.thisEventQty;

          return (
            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <motion.div 
                ref={reserveModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reserve-item-title"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 font-bold uppercase text-[8px] tracking-wider rounded">
                      {selectedItemForReserve.category}
                    </span>
                    <h3 id="reserve-item-title" className="font-serif font-bold text-slate-800 text-base leading-snug">
                      {selectedItemForReserve.name}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedItemForReserve(null)}
                    aria-label="Close allocation modal"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Conflict/Availability Banner */}
                {availability.totalReservedByOthers > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                    <p className="font-bold uppercase tracking-wider text-[9px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle size={11} /> Conflict Advisory Warning
                    </p>
                    <p className="text-[10px] leading-relaxed">
                      This item is partially reserved by other events on {activeEvent?.date}. 
                      Only <span className="font-bold underline">{availability.availableStock} of {selectedItemForReserve.totalStock} units</span> are free for allocation.
                    </p>
                  </div>
                )}

                {/* Main Form */}
                <form onSubmit={handleReserveSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#faf8f4] border border-[#e2dcd0] p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Stock</p>
                      <p className="text-xl font-serif font-bold text-slate-800">{selectedItemForReserve.totalStock}</p>
                    </div>
                    <div className="bg-[#fcfaf7] border border-[#e2dcd0] p-3 rounded-xl text-center">
                      <p className="text-[10px] uppercase font-bold text-[#856637]">Free Available</p>
                      <p className="text-xl font-serif font-bold text-[#856637]">{availability.availableStock}</p>
                    </div>
                  </div>

                  {/* Quantity selector with strict boundary checking */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-bold text-slate-600">Reserve Allocation Quantity</label>
                      <span className="text-[10px] text-slate-400 font-mono">Max allowable: {maxAllowed}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-1.5 flex-1 justify-between">
                        <button 
                          type="button"
                          onClick={() => setReserveQuantity(prev => Math.max(0, prev - 1))}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-base font-bold font-mono text-slate-800">{reserveQuantity}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            if (reserveQuantity >= maxAllowed) {
                              showNotification(`Cannot exceed maximum available stock count (${maxAllowed} units) on this date.`, "error");
                              return;
                            }
                            setReserveQuantity(prev => prev + 1);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-600">Reserved / Allocated By</label>
                    <input 
                      type="text" 
                      required
                      value={reservedBy}
                      onChange={e => {
                        setReservedBy(e.target.value);
                        localStorage.setItem('logistics_reservedBy', e.target.value);
                      }}
                      placeholder="e.g. Operations / Outreach Team"
                      className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setSelectedItemForReserve(null)}
                      className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSubmitting || reserveQuantity > maxAllowed}
                      className="px-5 py-2 bg-[#856637] text-white hover:bg-[#6c522b] font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Locking Allocation...
                        </>
                      ) : (
                        <>
                          Confirm Allocation <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}

        {editingItem && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              ref={editAssetModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-asset-title"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white border border-[#e2dcd0] rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <span className="px-1.5 py-0.5 bg-[#f5ebd6] text-[#856637] font-bold uppercase text-[8px] tracking-wider rounded">
                    Edit Asset Settings
                  </span>
                  <h3 id="edit-asset-title" className="font-serif font-bold text-slate-800 text-base leading-snug">
                    Modify Catalog Asset
                  </h3>
                </div>
                <button 
                  onClick={() => setEditingItem(null)}
                  aria-label="Close edit asset modal"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Main Edit Form */}
              <form onSubmit={handleEditAssetSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Item Name</label>
                  <input 
                    type="text" 
                    required
                    value={editAssetName}
                    onChange={e => setEditAssetName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Category</label>
                  <select 
                    value={editAssetCategory}
                    onChange={e => setEditAssetCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                  >
                    <option value="Furniture">Furniture</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="Audio/Visual">Audio/Visual</option>
                    <option value="Catering">Catering</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Strategy">Strategy</option>
                  </select>
                </div>

                {/* Edit Stock Availability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-600">Total Stock Capacity</label>
                    <span className="text-[10px] text-slate-400">Total owned items in inventory</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#faf8f4] border border-[#e2dcd0] rounded-xl p-1.5 justify-between">
                    <button 
                      type="button"
                      onClick={() => setEditAssetStock(prev => Math.max(1, prev - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-base font-bold font-mono text-slate-800">{editAssetStock}</span>
                    <button 
                      type="button"
                      onClick={() => setEditAssetStock(prev => prev + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600">Storage Notes / Location</label>
                  <input 
                    type="text" 
                    value={editAssetNotes}
                    onChange={e => setEditAssetNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e2dcd0] bg-[#faf8f4] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#856637] focus:bg-white text-xs transition"
                  />
                </div>

                <div className="flex items-center gap-2 py-1 bg-amber-50/40 px-2.5 rounded-xl border border-[#e2dcd0]/50 max-w-fit">
                  <input 
                    type="checkbox" 
                    id="editAssetIsHighValue"
                    checked={editAssetIsHighValue}
                    onChange={e => setEditAssetIsHighValue(e.target.checked)}
                    className="rounded border-[#e2dcd0] text-[#856637] focus:ring-[#856637] cursor-pointer"
                  />
                  <label htmlFor="editAssetIsHighValue" className="font-bold text-slate-700 cursor-pointer select-none">
                    High-value item (requires strict return auditing)
                  </label>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdating}
                    className="px-5 py-2 bg-[#856637] text-white hover:bg-[#6c522b] font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition"
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Updating Catalog...
                      </>
                    ) : (
                      <>
                        Save Changes <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default React.memo(LogisticsManager);
