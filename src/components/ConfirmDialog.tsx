import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '../lib/useFocusTrap';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useFocusTrap(isOpen, onCancel);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
          >
            {/* Header/Title */}
            <div className="flex items-start gap-3 p-5 border-b border-slate-100">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 leading-6">
                  {title}
                </h3>
              </div>
              <button
                onClick={onCancel}
                aria-label="Close confirmation dialog"
                className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Message Body */}
            <div className="p-5">
              <p id="confirm-dialog-description" className="text-sm text-slate-600 leading-relaxed">
                {message}
              </p>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
