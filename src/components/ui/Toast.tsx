'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

export type ToastType = 'error' | 'info' | 'success';

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  error: (message: string) => void;
  info: (message: string) => void;
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
};

const defaultNoop = (_message?: string, _type?: ToastType): void => {
  // Fallback no-op when outside ToastProvider
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access the global toast micro-feedback dispatcher.
 *
 * @returns The toast notification methods.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    return {
      error: defaultNoop,
      info: defaultNoop,
      showToast: defaultNoop,
      success: defaultNoop,
    };
  }

  return context;
}

const toastTypeStyles: Record<
  ToastType,
  { bg: string; border: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  error: {
    bg: 'bg-card',
    border: 'border-danger/40',
    icon: AlertCircle,
    iconColor: 'text-danger',
  },
  info: {
    bg: 'bg-card',
    border: 'border-accent/40',
    icon: Info,
    iconColor: 'text-accent',
  },
  success: {
    bg: 'bg-card',
    border: 'border-emerald-500/40',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
};

/**
 * Provides a global toast notification context and renders the notification outlet.
 *
 * @param props - Children components.
 * @returns The Toast provider and viewport.
 */
export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function removeToast(id: string) {
    setToasts((current) => current.filter((item) => item.id !== id));
  }

  function showToast(message: string, type: ToastType = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastItem = { id, message, type };

    setToasts((current) => [...current.slice(-4), newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 2800);
  }

  const contextValue: ToastContextValue = {
    error: (message) => {
      showToast(message, 'error');
    },
    info: (message) => {
      showToast(message, 'info');
    },
    showToast,
    success: (message) => {
      showToast(message, 'success');
    },
  };

  return (
    <ToastContext value={contextValue}>
      {props.children}
      <aside
        aria-label="通知提示"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-5 z-50 flex max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = toastTypeStyles[toast.type];
          const Icon = style.icon;

          return (
            <output
              key={toast.id}
              className={`animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border ${style.border} ${style.bg} px-4 py-2.5 shadow-overlay backdrop-blur-md`}
            >
              <Icon
                aria-hidden="true"
                className={`size-4.5 shrink-0 ${style.iconColor}`}
                strokeWidth={2}
              />
              <span className="min-w-0 flex-1 text-xs font-medium text-ink">{toast.message}</span>
              <button
                type="button"
                aria-label="关闭提示"
                className="grid size-5 place-items-center rounded text-ink-faint transition-colors hover:text-ink"
                onClick={() => {
                  removeToast(toast.id);
                }}
              >
                <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
            </output>
          );
        })}
      </aside>
    </ToastContext>
  );
}
