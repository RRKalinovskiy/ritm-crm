import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { AppointmentWithDetails } from '@/domain/types';
import { STATUS_TONE } from '@/domain/types';
import {
  getMonthMatrix,
  isSameDay,
  isSameMonth,
  isWeekend,
  toDateKey,
  WEEKDAY_NAMES,
} from '@/domain/date';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  month: Date;
  today: Date;
  appointments: AppointmentWithDetails[];
  onOpenDay: (dateKey: string) => void;
  onOpenAppointment: (appointmentId: string) => void;
  onCreate: (dateKey: string) => void;
}

export function MonthView({
  month,
  today,
  appointments,
  onOpenDay,
  onOpenAppointment,
  onCreate,
}: MonthViewProps) {
  const weeks = useMemo(() => getMonthMatrix(month), [month]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentWithDetails[]>();
    for (const appointment of appointments) {
      const list = map.get(appointment.date) ?? [];
      list.push(appointment);
      map.set(appointment.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [appointments]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-line bg-[#FBFCFB]">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="border-r border-line px-3 py-2.5 text-[10px] font-semibold text-[#8A938D] last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((day, index) => {
          const key = toDateKey(day);
          const items = grouped.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const weekend = isWeekend(day);
          const isCurrentDay = isSameDay(day, today);
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onOpenDay(key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenDay(key);
                }
              }}
              className={cn(
                'group relative min-h-[128px] cursor-pointer border-b border-r border-line p-2.5 text-left transition outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
                !inMonth && 'bg-[#FAFBFA]',
                inMonth && weekend && 'bg-[#FCFDFC]',
                isCurrentDay && inMonth && 'bg-primary-faint hover:bg-primary-soft',
                'hover:bg-primary-faint',
                index >= weeks.length * 7 - 7 && 'border-b-0',
                index % 7 === 6 && 'border-r-0',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold tabular-nums',
                    isCurrentDay
                      ? 'bg-primary text-white'
                      : inMonth
                        ? 'text-ink'
                        : 'text-[#AFB7B2]',
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {items.length > 0 && (
                    <span className="text-[9px] font-semibold text-[#8A938D]">
                      {items.length} зап.
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreate(key);
                    }}
                    className="hidden h-5 w-5 items-center justify-center rounded text-muted hover:bg-white hover:text-primary group-hover:flex"
                    aria-label={`Добавить запись на ${key}`}
                  >
                    <Plus size={12} />
                  </span>
                </div>
              </div>

              <div className="mt-1.5 flex flex-col gap-0.5">
                {items.slice(0, 2).map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenAppointment(appointment.id);
                    }}
                    className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left transition hover:bg-white"
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_TONE[appointment.status].dot)} />
                    <span className="shrink-0 text-[9px] font-semibold tabular-nums text-[#69716D]">
                      {appointment.startTime}
                    </span>
                    <span className="truncate text-[10px] font-medium text-[#3F4A44]">
                      {appointment.client
                        ? `${appointment.client.firstName} ${appointment.client.lastName}`
                        : 'Клиент удалён'}
                    </span>
                  </button>
                ))}
                {items.length > 2 && (
                  <span className="px-1 text-[9px] font-semibold text-muted">
                    Ещё {items.length - 2}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 bg-[#FBFCFB] px-4 py-2.5 text-[10px] text-muted">
        <span>Нажмите на день, чтобы открыть расписание</span>
        <span className="flex items-center gap-3">
          {(['confirmed', 'pending', 'completed'] as const).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_TONE[status].dot)} />
              {status === 'confirmed' ? 'Подтверждена' : status === 'pending' ? 'Ожидает' : 'Выполнена'}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
