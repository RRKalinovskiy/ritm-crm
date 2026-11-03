import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: Tone;
}

interface ToastContextValue {
  toast: (options: { title: string; description?: string; tone?: Tone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<Tone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-primary' },
  error: { icon: AlertCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = 'success' }: { title: string; description?: string; tone?: Tone }) => {
      const id = crypto.randomUUID();
      setItems((current) => [...current, { id, title, description, tone }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {items.map((item) => {
          const { icon: Icon, className } = toneStyles[item.tone];
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-pop animate-fade-in"
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', className)} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-ink">{item.title}</div>
                {item.description && (
                  <div className="mt-0.5 text-[11px] leading-4 text-muted">{item.description}</div>
                )}
              </div>
              <button
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted transition hover:bg-[#F1F4F2] hover:text-ink"
                aria-label="Закрыть уведомление"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
