import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Calendar, Check } from 'lucide-react';
import { MinistryEvent } from '../types';

interface EventScopeSelectorProps {
  events: MinistryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}

export default function EventScopeSelector({
  events,
  selectedEventId,
  onSelectEvent
}: EventScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRefs = useRef<(HTMLElement | null)[]>([]);

  const activeEvent = events.find(e => e.id === selectedEventId) || events[0];

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Adjust options refs length
  useEffect(() => {
    optionsRefs.current = optionsRefs.current.slice(0, events.length);
  }, [events]);

  // Handle focus scrolling for keyboard navigation
  useEffect(() => {
    if (focusedIndex >= 0 && optionsRefs.current[focusedIndex]) {
      optionsRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [focusedIndex]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Find index of currently selected event to focus initially
      const currentIndex = events.findIndex(e => e.id === (selectedEventId || events[0]?.id));
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      setFocusedIndex(-1);
    }
  };

  const handleSelect = (eventId: string) => {
    onSelectEvent(eventId);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const formatEventDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!events.length) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          toggleDropdown();
        } else if (focusedIndex >= 0) {
          handleSelect(events[focusedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          toggleDropdown();
        } else {
          setFocusedIndex(prev => (prev + 1) % events.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          toggleDropdown();
        } else {
          setFocusedIndex(prev => (prev - 1 + events.length) % events.length);
        }
        break;
      case 'Tab':
        // Let natural tab order work, but close dropdown
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative text-left sm:text-right" ref={containerRef}>
      <p id="scope-selector-label" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
        Active Hub Scope
      </p>
      
      {/* Selector Trigger */}
      <button
        ref={triggerRef}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby="scope-selector-label"
        className="group flex items-center gap-2 px-3 py-1.5 -mx-3 rounded-lg hover:bg-[#f5ebd6]/30 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#856637]/35 transition-all text-left sm:text-right cursor-pointer"
        type="button"
      >
        <span className="text-sm md:text-base font-serif font-semibold leading-tight border-b border-dashed border-[#856637]/40 group-hover:border-[#856637] transition-all text-slate-800">
          {activeEvent ? (
            `${activeEvent.name} — ${formatEventDate(activeEvent.date)}`
          ) : (
            'Operations Roster'
          )}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="text-[#856637] shrink-0"
        >
          <ChevronDown size={15} aria-hidden="true" />
        </motion.span>
      </button>

      {/* Dropdown Menu Listbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#e2dcd0] rounded-xl shadow-lg overflow-hidden z-50 origin-top-right"
          >
            <div className="p-2 bg-[#faf8f4] border-b border-[#e2dcd0] px-4 py-2.5">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#856637] flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" /> Select Active Event Scope
              </span>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
                Switching scope filters all timeline milestones, task lists, and volunteer rosters instantly.
              </p>
            </div>

            <ul
              role="listbox"
              aria-label="Active Event Scope Options"
              className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-[#faf8f4]"
            >
              {events.map((evt, idx) => {
                const isSelected = evt.id === (selectedEventId || events[0]?.id);
                const isFocused = idx === focusedIndex;

                return (
                  <li
                    key={evt.id}
                    ref={el => { optionsRefs.current[idx] = el; }}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(evt.id)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className={`group w-full p-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#faf6ee] text-[#856637]'
                        : isFocused
                        ? 'bg-slate-50 text-slate-800'
                        : 'bg-white hover:bg-slate-50/50 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`font-serif font-bold text-sm truncate ${
                        isSelected ? 'text-[#856637]' : 'text-[#0f172a]'
                      }`}>
                        {evt.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5 font-sans">
                        <Calendar size={10} className={isSelected ? "text-[#856637]" : "text-slate-450"} aria-hidden="true" />
                        <span>{formatEventDate(evt.date)}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-[#856637] bg-[#efe0c2]/60 p-1 rounded-full shrink-0"
                      >
                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                      </motion.span>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
