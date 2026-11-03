import { useMemo } from 'react';
import type { AppointmentWithDetails } from '@/domain/types';
import {
  MONTH_NAMES,
  WEEKDAY_NAMES_SHORT,
  getMonthMatrix,
  isSameDay,
  isSameMonth,
  toDateKey,
} from '@/domain/date';
import { pluralize } from '@/domain/money';
import { cn } from '@/lib/utils';

interface YearViewProps {
  year: number;
  today: Date;
  appointments: AppointmentWithDetails[];
  onOpenMonth: (monthIndex: number) => void;
  onOpenDay: (dateKey: string) => void;
}

export function YearView({ year, today, appointments, onOpenMonth, onOpenDay }: YearViewProps) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const appointment of appointments) {
      const key = appointment.date;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const total = useMemo(
    () => Array.from(counts.values()).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        {MONTH_NAMES.map((name, monthIndex) => {
          const monthDate = new Date(year, monthIndex, 1);
          const weeks = getMonthMatrix(monthDate);
          const monthTotal = weeks
            .flat()
            .filter((day) => isSameMonth(day, monthDate))
            .reduce((sum, day) => sum + (counts.get(toDateKey(day)) ?? 0), 0);

          return (
            <div
              key={name}
              role="button"
              tabIndex={0}
              onClick={() => onOpenMonth(monthIndex)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenMonth(monthIndex);
                }
              }}
              className="cursor-pointer rounded-2xl border border-line bg-surface p-3.5 shadow-card outline-none transition hover:border-primary/30 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="flex items-baseline justify-between gap-2 px-1">
                <span className="text-[13px] font-bold text-ink">{name}</span>
                <span className="text-[9px] font-medium text-muted">
                  {monthTotal} {pluralize(monthTotal, 'запись', 'записи', 'записей')}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-7 gap-y-1">
                {WEEKDAY_NAMES_SHORT.map((weekday) => (
                  <div key={weekday} className="text-center text-[7px] font-semibold text-[#A7AEA9]">
                    {weekday}
                  </div>
                ))}
                {weeks.flat().map((day) => {
                  const key = toDateKey(day);
                  const count = counts.get(key) ?? 0;
                  const inMonth = isSameMonth(day, monthDate);
                  const isCurrentDay = isSameDay(day, today);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenDay(key);
                      }}
                      className={cn(
                        'mx-auto flex h-[19px] w-[19px] items-center justify-center rounded-[5px] text-[8px] font-medium tabular-nums transition hover:ring-1 hover:ring-primary/40',
                        !inMonth && 'text-[#C3CAC5]',
                        inMonth && isCurrentDay && 'bg-primary font-bold text-white',
                        inMonth && !isCurrentDay && count === 0 && 'text-[#5C6761] hover:bg-primary-faint',
                        inMonth && !isCurrentDay && count > 0 && count <= 2 && 'bg-[#EDF4F0] text-[#2F5545]',
                        inMonth && !isCurrentDay && count > 2 && count <= 5 && 'bg-[#D4E7DC] text-[#244A3B]',
                        inMonth && !isCurrentDay && count > 5 && 'bg-[#A9CBB8] font-semibold text-[#16392C]',
                      )}
                      aria-label={`${key}: ${count} записей`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5 shadow-card">
        <div className="text-[12px] text-muted">
          <span className="font-bold text-ink">{total}</span>{' '}
          {pluralize(total, 'запись', 'записи', 'записей')} в {year} году
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted">
          <span>Загруженность:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#EDF4F0]" /> 1–2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#D4E7DC]" /> 3–5
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#A9CBB8]" /> 6+
          </span>
        </div>
      </div>
    </div>
  );
}
