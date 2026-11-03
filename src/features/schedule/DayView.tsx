import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  onMove: (input: {
    id: string;
    date: string;
    specialistId: string;
    startTime: string;
  }) => void;
  onResize: (input: { id: string; durationMin: number }) => void;
  onContextMenu: (
    appointment: AppointmentWithDetails,
    position: { x: number; y: number },
  ) => void;
}

type DragMode = 'move' | 'resize';

interface DragSession {
  appointment: AppointmentWithDetails;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  originalStart: number;
  originalDuration: number;
  targetStart: number;
  targetDuration: number;
  targetSpecialistId: string;
  allowedSpecialistIds: Set<string>;
  moved: boolean;
}

interface DragPreview {
  appointmentId: string;
  mode: DragMode;
  targetStart: number;
  targetDuration: number;
  targetSpecialistId: string;
}

export function DayView({
  dateKey,
  appointments,
  specialists,
  workdayStart,
  workdayEnd,
  onCreate,
  onOpen,
  onMove,
  onResize,
  onContextMenu,
}: DayViewProps) {
  const startMin = minutesFromTime(workdayStart);
  const endMin = minutesFromTime(workdayEnd);
  const totalHeight = Math.max(endMin - startMin, 60) * PX_PER_MINUTE;
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragCleanupRef = useRef<((resetState?: boolean) => void) | null>(null);
  const lastDragAtRef = useRef(0);

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

  const draggedAppointment = dragPreview
    ? appointments.find((appointment) => appointment.id === dragPreview.appointmentId)
    : undefined;

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.(false);
    };
  }, []);

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    appointment: AppointmentWithDetails,
    mode: DragMode,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragCleanupRef.current?.();

    const originalStart = minutesFromTime(appointment.startTime);
    const allowedSpecialistIds = new Set(
      specialists
        .filter((specialist) =>
          appointment.services.every((line) =>
            specialist.serviceIds.includes(line.serviceId),
          ),
        )
        .map((specialist) => specialist.id),
    );
    allowedSpecialistIds.add(appointment.specialistId);

    const session: DragSession = {
      appointment,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalStart,
      originalDuration: appointment.durationMin,
      targetStart: originalStart,
      targetDuration: appointment.durationMin,
      targetSpecialistId: appointment.specialistId,
      allowedSpecialistIds,
      moved: false,
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'resize' ? 'ns-resize' : 'grabbing';
    lastDragAtRef.current = Date.now();

    function handlePointerMove(pointerEvent: PointerEvent) {
      const dx = pointerEvent.clientX - session.startClientX;
      const dy = pointerEvent.clientY - session.startClientY;
      if (!session.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        session.moved = true;
      }
      if (!session.moved) return;
      pointerEvent.preventDefault();

      if (mode === 'resize') {
        const maxDuration = Math.max(15, endMin - session.originalStart);
        const raw = session.originalDuration + dy / PX_PER_MINUTE;
        const snapped = Math.round(raw / 15) * 15;
        session.targetDuration = Math.min(maxDuration, Math.max(15, snapped));
        session.targetStart = session.originalStart;
        session.targetSpecialistId = session.appointment.specialistId;
      } else {
        const maxStart = Math.max(startMin, endMin - session.originalDuration);
        const raw = session.originalStart + dy / PX_PER_MINUTE;
        const snapped = Math.round(raw / 15) * 15;
        session.targetStart = Math.min(maxStart, Math.max(startMin, snapped));
        session.targetDuration = session.originalDuration;

        const columns = Array.from(
          document.querySelectorAll<HTMLElement>('[data-specialist-column]'),
        );
        const hit = columns.find((column) => {
          const rect = column.getBoundingClientRect();
          return (
            pointerEvent.clientX >= rect.left &&
            pointerEvent.clientX <= rect.right
          );
        });
        const targetId = hit?.dataset.specialistId;
        if (targetId && session.allowedSpecialistIds.has(targetId)) {
          session.targetSpecialistId = targetId;
        }
      }

      setDragPreview({
        appointmentId: session.appointment.id,
        mode,
        targetStart: session.targetStart,
        targetDuration: session.targetDuration,
        targetSpecialistId: session.targetSpecialistId,
      });
    }

    function cleanup(resetState = true) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      dragCleanupRef.current = null;
      if (resetState) setDragPreview(null);
    }

    function handlePointerUp() {
      const moved = session.moved;
      cleanup();
      lastDragAtRef.current = Date.now();

      if (!moved) {
        if (mode === 'move') onOpen(session.appointment.id);
        return;
      }

      if (mode === 'resize') {
        if (session.targetDuration !== session.originalDuration) {
          onResize({
            id: session.appointment.id,
            durationMin: session.targetDuration,
          });
        }
        return;
      }

      if (
        session.targetStart !== session.originalStart ||
        session.targetSpecialistId !== session.appointment.specialistId
      ) {
        onMove({
          id: session.appointment.id,
          date: dateKey,
          specialistId: session.targetSpecialistId,
          startTime: timeFromMinutes(session.targetStart),
        });
      }
    }

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

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
                  data-specialist-column
                  data-specialist-id={specialist.id}
                  className="relative cursor-copy"
                  style={{ height: totalHeight }}
                  onClick={(event) => {
                    if (Date.now() - lastDragAtRef.current < 250) return;
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
                    const preview =
                      dragPreview?.appointmentId === appointment.id ? dragPreview : null;
                    const isMoving = preview?.mode === 'move';
                    const isResizing = preview?.mode === 'resize';
                    const displayDuration = isResizing
                      ? preview.targetDuration
                      : appointment.durationMin;
                    const height = Math.max(displayDuration * PX_PER_MINUTE - 4, 34);
                    const tone = STATUS_TONE[appointment.status];
                    const services = appointment.services
                      .map((line) => line.nameSnapshot)
                      .join(', ');
                    const clientName = appointment.client
                      ? `${appointment.client.firstName} ${appointment.client.lastName}`.trim()
                      : 'Клиент удалён';
                    const timeLabel = formatTimeRange(
                      appointment.startTime,
                      displayDuration,
                    );

                    return (
                      <div
                        key={appointment.id}
                        data-appointment-wrapper-id={appointment.id}
                        className={cn(
                          'group absolute left-1.5 right-1.5 z-20',
                          isMoving && 'pointer-events-none opacity-40',
                        )}
                        style={{ top, height }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          data-appointment-id={appointment.id}
                          onPointerDown={(event) => beginDrag(event, appointment, 'move')}
                          onClick={(event) => event.stopPropagation()}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onContextMenu(appointment, {
                              x: event.clientX,
                              y: event.clientY,
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onOpen(appointment.id);
                            }
                          }}
                          className={cn(
                            'flex h-full w-full cursor-grab touch-none select-none flex-col overflow-hidden rounded-lg border border-transparent border-l-[3px] px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgba(16,24,20,0.05)] transition-shadow hover:z-30 hover:shadow-pop focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                            tone.bg,
                            tone.border,
                            isResizing && 'ring-2 ring-primary/30',
                          )}
                          title={`${timeLabel} · ${clientName}. Перетащите карточку, чтобы изменить время, или потяните нижний край для длительности. ПКМ — меню.`}
                          aria-label={`${clientName}, ${timeLabel}. Перетащите, чтобы изменить время.`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[9px] font-semibold tabular-nums text-[#5C6761]">
                              {timeLabel}
                            </span>
                            <span className="shrink-0 text-[9px] font-bold tabular-nums text-[#4E5C55]">
                              {formatRub(appointment.totalRub)}
                            </span>
                          </div>
                          <div className={cn('mt-0.5 truncate text-[11px] font-bold leading-4', tone.text)}>
                            {clientName}
                          </div>
                          {height >= 52 && (
                            <div className="truncate text-[10px] leading-4 text-[#5C6761]">
                              {services}
                            </div>
                          )}
                          {height >= 76 && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                              <span className={cn('text-[9px] font-semibold', tone.text)}>
                                {APPOINTMENT_STATUS_LABELS[appointment.status]}
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          data-resize-handle
                          onPointerDown={(event) => beginDrag(event, appointment, 'resize')}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            event.stopPropagation();
                            const delta = event.key === 'ArrowUp' ? 15 : -15;
                            const maxDuration = Math.max(
                              15,
                              endMin - minutesFromTime(appointment.startTime),
                            );
                            const next = Math.min(
                              maxDuration,
                              Math.max(15, appointment.durationMin + delta),
                            );
                            if (next !== appointment.durationMin) {
                              onResize({ id: appointment.id, durationMin: next });
                            }
                          }}
                          className="absolute bottom-1 left-1/2 z-30 h-1.5 w-12 -translate-x-1/2 cursor-ns-resize rounded-full bg-primary/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-label={`Изменить длительность записи ${clientName}`}
                          title="Потяните или используйте ↑/↓, чтобы изменить длительность"
                        />
                      </div>
                    );
                  })}

                  {dragPreview?.mode === 'move' &&
                    dragPreview.targetSpecialistId === specialist.id &&
                    draggedAppointment && (
                      <div
                        className="pointer-events-none absolute left-1.5 right-1.5 z-40 overflow-hidden rounded-lg border-2 border-dashed border-primary bg-primary/90 px-2.5 py-1.5 text-white shadow-pop"
                        style={{
                          top:
                            (dragPreview.targetStart - startMin) * PX_PER_MINUTE,
                          height: Math.max(
                            dragPreview.targetDuration * PX_PER_MINUTE - 4,
                            34,
                          ),
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[9px] font-semibold tabular-nums">
                            {formatTimeRange(
                              timeFromMinutes(dragPreview.targetStart),
                              dragPreview.targetDuration,
                            )}
                          </span>
                          <span className="shrink-0 text-[9px] font-bold tabular-nums">
                            {formatRub(draggedAppointment.totalRub)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-bold leading-4">
                          {draggedAppointment.client
                            ? `${draggedAppointment.client.firstName} ${draggedAppointment.client.lastName}`
                            : 'Клиент удалён'}
                        </div>
                      </div>
                    )}

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
