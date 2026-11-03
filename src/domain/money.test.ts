import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatPercent,
  formatPhone,
  formatRub,
  normalizePhone,
  pluralize,
} from '@/domain/money';

const normalized = (value: string) => value.replace(/\s+/g, ' ');

describe('money', () => {
  it('форматирует рубли с округлением', () => {
    expect(normalized(formatRub(25800))).toBe('25 800 ₽');
    expect(normalized(formatRub(1500.4))).toBe('1 500 ₽');
    expect(normalized(formatRub(0))).toBe('0 ₽');
  });

  it('форматирует числа и проценты по-русски', () => {
    expect(normalized(formatNumber(1234567))).toBe('1 234 567');
    expect(formatPercent(42.35)).toBe('42,4%');
    expect(formatPercent(10, 0)).toBe('10%');
  });

  it('нормализует и форматирует телефон', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    expect(formatPhone('+7 (999) 123-45-67')).toBe('+7 (999) 123-45-67');
    expect(formatPhone('89991234567')).toBe('+7 (999) 123-45-67');
    expect(formatPhone('123')).toBe('123');
  });

  it('склоняет существительные по правилам русского языка', () => {
    expect(pluralize(1, 'услуга', 'услуги', 'услуг')).toBe('услуга');
    expect(pluralize(2, 'услуга', 'услуги', 'услуг')).toBe('услуги');
    expect(pluralize(5, 'услуга', 'услуги', 'услуг')).toBe('услуг');
    expect(pluralize(11, 'услуга', 'услуги', 'услуг')).toBe('услуг');
    expect(pluralize(21, 'услуга', 'услуги', 'услуг')).toBe('услуга');
    expect(pluralize(24, 'услуга', 'услуги', 'услуг')).toBe('услуги');
  });
});
