import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  formatDuration,
  formatTimeRange,
  fromDateKey,
  getMonthMatrix,
  isWeekend,
  minutesFromTime,
  timeFromMinutes,
  toDateKey,
} from '@/domain/date';

describe('date', () => {
  it('переводит локальную дату в ключ и обратно', () => {
    const date = new Date(2026, 5, 18);
    expect(toDateKey(date)).toBe('2026-06-18');
    expect(toDateKey(fromDateKey('2026-06-18'))).toBe('2026-06-18');
  });

  it('работает со временем в минутах', () => {
    expect(minutesFromTime('09:30')).toBe(570);
    expect(timeFromMinutes(570)).toBe('09:30');
    expect(timeFromMinutes(0)).toBe('00:00');
    expect(addMinutesToTime('09:00', 90)).toBe('10:30');
    // Дата записи хранится отдельно, поэтому конец дня не переносится на следующие сутки.
    expect(addMinutesToTime('23:30', 45)).toBe('24:15');
  });

  it('форматирует длительность и интервал', () => {
    expect(formatDuration(45)).toBe('45 мин');
    expect(formatDuration(60)).toBe('1 ч');
    expect(formatDuration(90)).toBe('1 ч 30 мин');
    expect(formatTimeRange('09:00', 90)).toBe('09:00–10:30');
  });

  it('строит месячную сетку с понедельника', () => {
    const weeks = getMonthMatrix(new Date(2026, 5, 1));
    expect(weeks.length).toBeGreaterThanOrEqual(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].getDay()).toBe(1);
    expect(toDateKey(weeks[0][0])).toBe('2026-06-01');
  });

  it('определяет выходные', () => {
    expect(isWeekend(new Date(2026, 5, 20))).toBe(true);
    expect(isWeekend(new Date(2026, 5, 21))).toBe(true);
    expect(isWeekend(new Date(2026, 5, 18))).toBe(false);
  });
});
