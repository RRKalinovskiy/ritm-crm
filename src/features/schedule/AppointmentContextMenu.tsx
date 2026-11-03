import { useEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Copy,
  Pencil,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { AppointmentStatus, AppointmentWithDetails } from '@/domain/types';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_ORDER,
  STATUS_TONE,
} from '@/domain/types';
import { formatRuDate, formatTimeRange, fromDateKey } from '@/domain/date';
import { cn } from '@/lib/utils';

interface AppointmentContextMenuProps {
  appointment: AppointmentWithDetails | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onStatusChange: (status: AppointmentStatus) => void;
}

export function AppointmentContextMenu({
  appointment,
  position,
  onClose,
  onEdit,
  onCopy,
  onDelete,
  onStatusChange,
}: AppointmentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setStatusOpen(false);
  }, [appointment?.id, position?.x, position?.y]);

  useEffect(() => {
    if (!appointment || !position) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onCloseRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    const handleViewportChange = () => onCloseRef.current();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    const timer = window.setTimeout(() => firstItemRef.current?.focus(), 20);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [appointment?.id, position?.x, position?.y]);

  if (!appointment || !position) return null;

  const width = 248;
  const estimatedHeight = statusOpen ? 470 : 270;
  const left = Math.max(8, Math.min(position.x, window.innerWidth - width - 8));
  const top = Math.max(
    8,
    Math.min(position.y, window.innerHeight - estimatedHeight - 8),
  );
  const clientName = appointment.client
    ? `${appointment.client.firstName} ${appointment.client.lastName}`.trim()
    : 'Клиент удалён';

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Действия с записью"
      className="fixed z-[120] max-h-[calc(100vh-16px)] w-[248px] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-pop"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="border-b border-line px-2.5 pb-2.5 pt-2">
        <div className="truncate text-[11px] font-bold text-ink">{clientName}</div>
        <div className="mt-0.5 text-[10px] text-muted">
          {formatRuDate(fromDateKey(appointment.date))} ·{' '}
          {formatTimeRange(appointment.startTime, appointment.durationMin)}
        </div>
      </div>

      <div className="py-1">
        <MenuItem
          firstItemRef={firstItemRef}
          icon={Pencil}
          label="Редактировать"
          onClick={onEdit}
        />
        <MenuItem icon={Copy} label="Копировать" onClick={onCopy} />
      </div>

      <div className="border-t border-line pt-1">
        <button
          type="button"
          role="menuitem"
          onClick={() => setStatusOpen((current) => !current)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-ink transition hover:bg-[#F3F6F4] focus-visible:bg-[#F3F6F4] focus-visible:outline-none"
        >
          <RefreshCw size={14} className="shrink-0 text-muted" />
          <span className="flex-1">Сменить статус</span>
          <ChevronDown
            size={13}
            className={cn('shrink-0 text-muted transition-transform', statusOpen && 'rotate-180')}
          />
        </button>

        {statusOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-line pl-2">
            {APPOINTMENT_STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                role="menuitemradio"
                aria-checked={appointment.status === status}
                onClick={() => onStatusChange(status)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] font-semibold transition hover:bg-[#F3F6F4] focus-visible:bg-[#F3F6F4] focus-visible:outline-none',
                  appointment.status === status ? 'text-ink' : 'text-[#5C6761]',
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_TONE[status].dot)} />
                <span className="flex-1">{APPOINTMENT_STATUS_LABELS[status]}</span>
                {appointment.status === status && <Check size={12} className="text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 border-t border-line pt-1">
        <MenuItem icon={Trash2} label="Удалить запись" onClick={onDelete} danger />
      </div>
    </div>,
    document.body,
  );
}

function MenuItem({
  firstItemRef,
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  firstItemRef?: Ref<HTMLButtonElement>;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      ref={firstItemRef}
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold transition focus-visible:outline-none',
        danger
          ? 'text-danger hover:bg-danger-soft focus-visible:bg-danger-soft'
          : 'text-ink hover:bg-[#F3F6F4] focus-visible:bg-[#F3F6F4]',
      )}
    >
      <Icon size={14} className={cn('shrink-0', danger ? 'text-danger' : 'text-muted')} />
      {label}
    </button>
  );
}
