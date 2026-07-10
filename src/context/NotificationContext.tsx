import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

export interface ToastNotification {
  id: string;
  message: string;
  type: NotificationType;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextProps {
  showNotification: (
    message: string, 
    type: NotificationType, 
    action?: { label: string; onClick: () => void }
  ) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showNotification = useCallback((
    message: string, 
    type: NotificationType,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, action }]);

    // Auto dismiss after 5 seconds (5000 ms to give enough time for Undo)
    setTimeout(() => {
      dismissNotification(id);
    }, 5000);
  }, [dismissNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {/* Toast Stack Portal/Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full p-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgClass = 'bg-slate-50 border-slate-200 text-slate-800';
            let icon = <Info className="text-slate-500 shrink-0" size={16} />;

            if (toast.type === 'success') {
              bgClass = 'bg-[#f5ebd6] border-[#efe0c2] text-[#856637]';
              icon = <CheckCircle className="text-[#856637] shrink-0" size={16} />;
            } else if (toast.type === 'error') {
              bgClass = 'bg-rose-50 border-rose-200 text-rose-950';
              icon = <AlertTriangle className="text-rose-600 shrink-0" size={16} />;
            }

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`flex items-center justify-between gap-3 p-4 rounded-xl border shadow-lg pointer-events-auto max-w-full font-sans text-xs font-semibold ${bgClass}`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                  {icon}
                  <div className="flex-1 min-w-0 break-words">
                    {toast.message}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {toast.action && (
                    <button
                      onClick={() => {
                        toast.action?.onClick();
                        dismissNotification(toast.id);
                      }}
                      className="px-2 py-1 rounded bg-black/5 hover:bg-black/10 transition-colors cursor-pointer text-xs underline font-bold"
                    >
                      {toast.action.label}
                    </button>
                  )}
                  <button
                    onClick={() => dismissNotification(toast.id)}
                    className="p-1 rounded-md hover:bg-black/5 text-current/60 hover:text-current transition-colors cursor-pointer shrink-0"
                    aria-label="Dismiss notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
