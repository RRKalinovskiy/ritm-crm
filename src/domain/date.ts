import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/** Начало недели в календаре. */
export const WEEK_STARTS_ON = 1 as const;

export const WEEKDAY_NAMES = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье',
] as const;

export const WEEKDAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export const MONTH_NAMES_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
] as const;

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date {
  return parse(key, 'yyyy-MM-dd', new Date());
}

export function formatRuDate(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: ru });
}

export function formatRuDateLong(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy', { locale: ru });
}

export function formatRuDateShort(date: Date): string {
  return format(date, 'd MMM', { locale: ru });
}

export function formatMonthYear(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: ru });
}

export function formatMonthShort(date: Date): string {
  return format(date, 'LLL', { locale: ru });
}

export function formatWeekdayShort(date: Date): string {
  return format(date, 'EEEEEE', { locale: ru });
}

export function minutesFromTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return timeFromMinutes(minutesFromTime(time) + minutes);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatTimeRange(start: string, durationMin: number): string {
  return `${start}–${addMinutesToTime(start, durationMin)}`;
}

export function getMonthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start, end });
}

export function getMonthDays(month: Date): Date[] {
  return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
}

export function getMonthMatrix(month: Date): Date[][] {
  const days = getMonthGrid(month);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export {
  addDays,
  addMonths,
  addYears,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  endOfMonth,
};

export const DATE_FNS_LOCALE = ru;
