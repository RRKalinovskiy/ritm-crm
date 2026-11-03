import { describe, expect, it } from 'vitest';
import {
  lineCostTotal,
  lineDurationTotal,
  linePriceTotal,
  lineQuantity,
} from './appointmentLines';

describe('appointment line quantity', () => {
  it('считает старые строки как одну единицу', () => {
    expect(lineQuantity({})).toBe(1);
    expect(lineQuantity({ quantity: undefined })).toBe(1);
    expect(lineQuantity({ quantity: 0 })).toBe(1);
    expect(lineQuantity({ quantity: -5 })).toBe(1);
  });

  it('нормализует и ограничивает количество', () => {
    expect(lineQuantity({ quantity: 3 })).toBe(3);
    expect(lineQuantity({ quantity: 2.4 })).toBe(2);
    expect(lineQuantity({ quantity: 2000 })).toBe(999);
  });

  it('умножает цену, время и себестоимость на количество', () => {
    const line = {
      priceRub: 500,
      durationMin: 15,
      costRub: 100,
      quantity: 4,
    };
    expect(linePriceTotal(line)).toBe(2000);
    expect(lineDurationTotal(line)).toBe(60);
    expect(lineCostTotal(line)).toBe(400);
  });

  it('не придумывает себестоимость, если её нет', () => {
    expect(lineCostTotal({ costRub: undefined, quantity: 2 })).toBeUndefined();
  });
});
