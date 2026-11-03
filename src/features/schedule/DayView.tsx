import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import type { AppointmentWithDetails, Specialist } from '@/domain/types';
import { APPOINTMENT_STATUS_LABELS, STATUS_TONE } from '@/domain/types';
import {
  formatTimeRange,
  isToday,
  minutesFromTime,
  timeFromMinutes,
} from '@/domain/date';
import { formatRub, pluralize } from '@/domain/money';
import { cn } from '@/lib/utils';

const PX_PER_MINUTE = 1;

interface DayViewProps {
  dateKey: string;
  appointments: AppointmentWithDetails[];
  specialists: Specialist[];
  workdayStart: string;
  workdayEnd: string;
  onCreate: (startTime: string, specialistId: string) => void;
  onOpen: (appointmentId: string) => void;
}

export function DayView({
  dateKey,
  appointments,
  specialists,
  workdayStart,
  workdayEnd,
  onCreate,
  onOpen,
}: DayViewProps) {
  const startMin = minutesFromTime(workdayStart);
  const endMin = minutesFromTime(workdayEnd);
  const totalHeight = Math.max(endMin - startMin, 60) * PX_PER_MINUTE;

  const hours = useMemo(() => {
    const result: number[] = [];
    for (let minute = startMin; minute <= endMin; minute += 60) result.push(minute);
    return result;
  }, [startMin, endMin]);

  const date = useMemo(() => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [dateKey]);

  const nowTop = useMemo(() => {
    if (!isToday(date)) return null;
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    if (minute < startMin || minute > endMin) return null;
    return (minute - startMin) * PX_PER_MINUTE;
  }, [date, startMin, endMin]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex min-w-[820px]">
        <div className="w-[58px] shrink-0 border-r border-line bg-[#FBFCFB]">
          <div className="h-[58px] border-b border-line" />
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 text-[9px] font-medium tabular-nums text-[#9AA29D]"
                style={{
                  top:
                    (minute - startMin) * PX_PER_MINUTE +
                    (minute === startMin ? 4 : minute === endMin ? -12 : -5),
                }}
              >
                {timeFromMinutes(minute)}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {specialists.map((specialist) => {
            const own = appointments.filter(
              (appointment) => appointment.specialistId === specialist.id,
            );
            const active = own.filter(
              (appointment) =>
                appointment.status !== 'cancelled' && appointment.status !== 'no_show',
            );
            const revenue = active.reduce((sum, appointment) => sum + appointment.totalRub, 0);

            return (
              <div
                key={specialist.id}
                className="min-w-[210px] flex-1 border-r border-line last:border-r-0"
              >
                <div className="flex h-[58px] items-center gap-2.5 border-b border-line px-3.5">
                  <Avatar name={specialist.name} color={specialist.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-bold text-ink">{specialist.name}</div>
                    <div className="truncate text-[10px] text-muted">{specialist.role}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-bold tabular-nums text-ink">
                      {active.length} {pluralize(active.length, 'запись', 'записи', 'записей')}
                    </div>
                    <div className="text-[9px] tabular-nums text-muted">{formatRub(revenue)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreate(workdayStart, specialist.id)}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-primary"
                    aria-label={`Добавить запись к ${specialist.name}`}
                    title="Добавить запись"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div
                  className="relative cursor-copy"
                  style={{ height: totalHeight }}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const offset = event.clientY - rect.top;
                    const minute = startMin + Math.round(offset / PX_PER_MINUTE / 15) * 15;
                    if (minute < startMin || minute + 15 > endMin) return;
                    onCreate(timeFromMinutes(minute), specialist.id);
                  }}
                >
                  {hours.map((minute) => (
                    <div
                      key={minute}
                      className="pointer-events-none absolute left-0 right-0 border-t border-line/70"
                      style={{ top: (minute - startMin) * PX_PER_MINUTE }}
                    />
                  ))}
                  {hours.slice(0, -1).map((minute) => (
                    <div
                      key={`half-${minute}`}
                      className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-line/40"
                      style={{ top: (minute + 30 - startMin) * PX_PER_MINUTE }}
                    />
                  ))}

                  {nowTop !== null && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 border-t border-danger"
                      style={{ top: nowTop }}
                    >
                      <span className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-danger" />
                    </div>
                  )}

                  {own.map((appointment) => {
                    const top = (minutesFromTime(appointment.startTime) - startMin) * PX_PER_MINUTE;
                    const height = Math.max(appointment.durationMin * PX_PER_MINUTE - 4, 34);
                    const tone = STATUS_TONE[appointment.status];
                    const services = appointment.services
                      .map((line) => line.nameSnapshot)
                      .join(', ');
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(appointment.id);
                        }}
                        className={cn(
                          'absolute left-1.5 right-1.5 z-20 overflow-hidden rounded-lg border border-transparent border-l-[3px] px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgba(16,24,20,0.05)] transition hover:z-30 hover:shadow-pop focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                          tone.bg,
                          tone.border,
                        )}
                        style={{ top, height }}
                        title={`${formatTimeRange(appointment.startTime, appointment.durationMin)} · ${
                          appointment.client ? `${appointment.client.firstName} ${appointment.client.lastName}` : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[9px] font-semibold tabular-nums text-[#5C6761]">
                            {formatTimeRange(appointment.startTime, appointment.durationMin)}
                          </span>
                          <span className="shrink-0 text-[9px] font-bold tabular-nums text-[#4E5C55]">
                            {formatRub(appointment.totalRub)}
                          </span>
                        </div>
                        <div className={cn('mt-0.5 truncate text-[11px] font-bold leading-4', tone.text)}>
                          {appointment.client
                            ? `${appointment.client.firstName} ${appointment.client.lastName}`
                            : 'Клиент удалён'}
                        </div>
                        {height >= 52 && (
                          <div className="truncate text-[10px] leading-4 text-[#5C6761]">{services}</div>
                        )}
                        {height >= 76 && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                            <span className={cn('text-[9px] font-semibold', tone.text)}>
                              {APPOINTMENT_STATUS_LABELS[appointment.status]}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {own.length === 0 && (
                    <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-[10px] text-[#A7AEA9]">
                      Нажмите, чтобы добавить
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-[#FBFCFB] px-4 py-2.5">
        <div className="flex items-center gap-3 text-[10px] text-muted">
          {(['confirmed', 'pending', 'completed', 'cancelled'] as const).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_TONE[status].dot)} />
              {APPOINTMENT_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-muted">Рабочий день {workdayStart}–{workdayEnd}</span>
      </div>
    </div>
  );
}
