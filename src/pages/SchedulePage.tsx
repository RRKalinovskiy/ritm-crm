import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { AppointmentEditor } from '@/features/schedule/AppointmentEditor';
import { DayView } from '@/features/schedule/DayView';
import { MonthView } from '@/features/schedule/MonthView';
import { YearView } from '@/features/schedule/YearView';
import {
  getAppointmentsForRange,
  getSettings,
  listActiveSpecialists,
} from '@/db/repositories';
import {
  DEMO_TODAY,
  MONTH_NAMES_PREPOSITIONAL,
  addDays,
  addMonths,
  addYears,
  formatMonthYear,
  formatRuDate,
  getMonthGrid,
  isSameMonth,
  toDateKey,
} from '@/domain/date';
import { formatRub, pluralize } from '@/domain/money';
import { cn } from '@/lib/utils';

type ViewMode = 'day' | 'month' | 'year';

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'День',
  month: 'Месяц',
  year: 'Год',
};

export function SchedulePage() {
  const [view, setView] = useState<ViewMode>('day');
  const [cursor, setCursor] = useState<Date>(DEMO_TODAY);
  const [specialistFilter, setSpecialistFilter] = useState<string>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<{
    date?: string;
    startTime?: string;
    specialistId?: string;
  }>({});

  const specialists = useLiveQuery(() => listActiveSpecialists(), []);
  const settings = useLiveQuery(() => getSettings(), []);

  const range = useMemo(() => {
    if (view === 'year') {
      return { from: `${cursor.getFullYear()}-01-01`, to: `${cursor.getFullYear()}-12-31` };
    }
    if (view === 'month') {
      const grid = getMonthGrid(cursor);
      return { from: toDateKey(grid[0]), to: toDateKey(grid[grid.length - 1]) };
    }
    const key = toDateKey(cursor);
    return { from: key, to: key };
  }, [view, cursor]);

  const appointments = useLiveQuery(
    () => getAppointmentsForRange(range.from, range.to),
    [range.from, range.to],
  );

  const filtered = useMemo(() => {
    const list = appointments ?? [];
    if (specialistFilter === 'all') return list;
    return list.filter((appointment) => appointment.specialistId === specialistFilter);
  }, [appointments, specialistFilter]);

  const visibleSpecialists = useMemo(() => {
    const list = specialists ?? [];
    if (specialistFilter === 'all') return list;
    return list.filter((specialist) => specialist.id === specialistFilter);
  }, [specialists, specialistFilter]);

  const dayKey = toDateKey(cursor);
  const dayAppointments = useMemo(
    () => filtered.filter((appointment) => appointment.date === dayKey),
    [filtered, dayKey],
  );

  const activeAppointments = useMemo(
    () =>
      filtered.filter(
        (appointment) =>
          appointment.status !== 'cancelled' && appointment.status !== 'no_show',
      ),
    [filtered],
  );

  const calendarToday = settings?.demoMode === false ? new Date() : DEMO_TODAY;

  const summary = useMemo(() => {
    if (view === 'day') {
      return {
        count: filtered.length,
        revenue: activeAppointments.reduce((sum, appointment) => sum + appointment.totalRub, 0),
        specialists: new Set(activeAppointments.map((appointment) => appointment.specialistId)).size,
      };
    }
    if (view === 'month') {
      const ownAll = filtered.filter((appointment) => {
        const [year, month] = appointment.date.split('-').map(Number);
        return isSameMonth(new Date(year, month - 1, 1), cursor);
      });
      const ownActive = activeAppointments.filter((appointment) => {
        const [year, month] = appointment.date.split('-').map(Number);
        return isSameMonth(new Date(year, month - 1, 1), cursor);
      });
      return {
        count: ownAll.length,
        revenue: ownActive.reduce((sum, appointment) => sum + appointment.totalRub, 0),
        specialists: new Set(ownActive.map((appointment) => appointment.specialistId)).size,
      };
    }
    const yearPrefix = String(cursor.getFullYear());
    const ownAll = filtered.filter((appointment) => appointment.date.startsWith(yearPrefix));
    const ownActive = activeAppointments.filter((appointment) =>
      appointment.date.startsWith(yearPrefix),
    );
    return {
      count: ownAll.length,
      revenue: ownActive.reduce((sum, appointment) => sum + appointment.totalRub, 0),
      specialists: new Set(ownActive.map((appointment) => appointment.specialistId)).size,
    };
  }, [view, filtered, activeAppointments, cursor]);

  const label = useMemo(() => {
    if (view === 'day') return formatRuDate(cursor);
    if (view === 'month') {
      const formatted = formatMonthYear(cursor);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return `${cursor.getFullYear()} год`;
  }, [view, cursor]);

  useEffect(() => {
    if (specialistFilter === 'all') return;
    if ((specialists ?? []).length > 0 && !specialists?.some((item) => item.id === specialistFilter)) {
      setSpecialistFilter('all');
    }
  }, [specialists, specialistFilter]);

  function shift(direction: -1 | 1) {
    setCursor((current) =>
      view === 'day'
        ? addDays(current, direction)
        : view === 'month'
          ? addMonths(current, direction)
          : addYears(current, direction),
    );
  }

  function openCreate(options?: { dateKey?: string; startTime?: string; specialistId?: string }) {
    setEditingId(null);
    setDefaults({
      date: options?.dateKey ?? dayKey,
      startTime: options?.startTime ?? settings?.workdayStart ?? '09:00',
      specialistId:
        options?.specialistId ??
        (specialistFilter !== 'all' ? specialistFilter : visibleSpecialists[0]?.id),
    });
    setEditorOpen(true);
  }

  function openAppointment(appointmentId: string) {
    setEditingId(appointmentId);
    setDefaults({});
    setEditorOpen(true);
  }

  function openDay(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    setCursor(new Date(year, month - 1, day));
    setView('day');
  }

  function openMonth(monthIndex: number) {
    setCursor(new Date(cursor.getFullYear(), monthIndex, 1));
    setView('month');
  }

  const summaryText = useMemo(() => {
    const appointmentsWord = pluralize(summary.count, 'запись', 'записи', 'записей');
    const specialistsWord = pluralize(summary.specialists, 'специалист', 'специалиста', 'специалистов');
    if (view === 'day') {
      return `${summary.count} ${appointmentsWord} · ${summary.specialists} ${specialistsWord} · Плановая выручка ${formatRub(summary.revenue)}`;
    }
    if (view === 'month') {
      const monthName = MONTH_NAMES_PREPOSITIONAL[cursor.getMonth()];
      return `${summary.count} ${appointmentsWord} в ${monthName} · ${summary.specialists} ${specialistsWord} · Плановая выручка ${formatRub(summary.revenue)}`;
    }
    return `${summary.count} ${appointmentsWord} в ${cursor.getFullYear()} году · Плановая выручка ${formatRub(summary.revenue)}`;
  }, [view, summary, cursor]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Расписание"
        subtitle={
          view === 'day'
            ? 'Все записи и загрузка студии — в одном месте'
            : view === 'month'
              ? 'Планируйте загрузку и находите свободные дни'
              : 'Год целиком — для спокойного планирования наперёд'
        }
        actions={
          <Button onClick={() => openCreate()}>
            <Plus size={16} />
            Новая запись
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(DEMO_TODAY)}
            className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3.5 text-[11px] font-semibold text-ink shadow-sm transition hover:bg-[#F8FAF8]"
          >
            Сегодня
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-[#EEF2EF] hover:text-ink"
              aria-label="Предыдущий период"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-[#EEF2EF] hover:text-ink"
              aria-label="Следующий период"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">{label}</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <SlidersHorizontal
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted"
            />
            <Select
              value={specialistFilter}
              onChange={(event) => setSpecialistFilter(event.target.value)}
              className="h-9 w-[196px] pl-9"
              aria-label="Фильтр по специалисту"
            >
              <option value="all">Все специалисты</option>
              {(specialists ?? []).map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center rounded-xl border border-line bg-[#F1F4F2] p-1">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  'inline-flex h-7 items-center rounded-lg px-3 text-[11px] font-semibold transition',
                  view === mode
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink',
                )}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted">
          <CalendarDays size={13} className="text-primary" />
          <span className="font-semibold text-[#4E5C55]">{summaryText}</span>
        </div>
        {view === 'month' && (
          <span className="text-muted">Выберите день, чтобы открыть расписание</span>
        )}
        {specialistFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setSpecialistFilter('all')}
            className="text-[10px] font-semibold text-primary hover:underline"
          >
            Сбросить фильтр
          </button>
        )}
      </div>

      {view === 'day' && (
        <DayView
          dateKey={dayKey}
          appointments={dayAppointments}
          specialists={visibleSpecialists}
          workdayStart={settings?.workdayStart ?? '09:00'}
          workdayEnd={settings?.workdayEnd ?? '18:00'}
          onCreate={(startTime, specialistId) =>
            openCreate({ dateKey: dayKey, startTime, specialistId })
          }
          onOpen={openAppointment}
        />
      )}

      {view === 'month' && (
        <MonthView
          month={cursor}
          today={calendarToday}
          appointments={filtered}
          onOpenDay={openDay}
          onOpenAppointment={openAppointment}
          onCreate={(dateKey) => openCreate({ dateKey })}
        />
      )}

      {view === 'year' && (
        <YearView
          year={cursor.getFullYear()}
          today={calendarToday}
          appointments={filtered}
          onOpenMonth={openMonth}
          onOpenDay={openDay}
        />
      )}

      <AppointmentEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        appointmentId={editingId}
        defaults={defaults}
      />
    </div>
  );
}
