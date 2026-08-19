import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, Info, X as LucideX } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
      if (duration > 0) {
        const timer = setTimeout(() => remove(id), duration);
        timers.current.set(id, timer);
      }
    },
    [remove]
  );

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} />,
    error: <AlertTriangle size={16} />,
    warning: <AlertTriangle size={16} />,
    info: <Info size={16} />,
  };

  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
    warning: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24' },
    info: { bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.3)', text: '#60a5fa' },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          {toasts.map((t) => {
            const c = colors[t.type];
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  color: c.text,
                  fontSize: '0.82rem',
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 500,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto',
                  animation: 'toastSlideIn 0.2s ease-out',
                  maxWidth: 380,
                }}
              >
                {icons[t.type]}
                <span style={{ flex: 1 }}>{t.message}</span>
                <button
                  onClick={() => remove(t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: c.text,
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    opacity: 0.7,
                  }}
                >
                  <LucideX size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
