import { describe, expect, it } from 'vitest';
import {
  columnLetter,
  detectColumnMapping,
  detectHeaderRow,
  parseDuration,
  parseMoney,
  parsePriceRows,
  splitSpecialists,
  type ColumnMapping,
} from './priceImport';

describe('price import parsing', () => {
  it('находит поля по разным названиям колонок', () => {
    const mapping = detectColumnMapping([
      'Группа',
      'Наименование услуги',
      'Стоимость',
      'Длительность, мин',
      'Закупка',
      'Примечание',
      'Мастера',
    ]);

    expect(mapping.category).toBe(0);
    expect(mapping.name).toBe(1);
    expect(mapping.price).toBe(2);
    expect(mapping.duration).toBe(3);
    expect(mapping.cost).toBe(4);
    expect(mapping.description).toBe(5);
    expect(mapping.specialist).toBe(6);
  });

  it('не путает себестоимость с ценой', () => {
    const mapping = detectColumnMapping([
      'Категория',
      'Название',
      'Цена',
      'Время',
      'Себестоимость',
    ]);

    expect(mapping.price).toBe(2);
    expect(mapping.cost).toBe(4);
  });

  it('находит строку заголовков среди шапки и пустых строк', () => {
    const rows = [
      ['Прайс студии «Аврора»'],
      [],
      ['Категория', 'Название услуги', 'Цена', 'Время'],
      ['Стрижки', 'Женская стрижка', '3500', '60'],
    ];
    expect(detectHeaderRow(rows)).toBe(3);
  });

  it('разбирает цены с валютой и пробелами', () => {
    expect(parseMoney('3 500 ₽')).toBe(3500);
    expect(parseMoney('1 200,50 руб.')).toBe(1200.5);
    expect(parseMoney('2 000')).toBe(2000);
    expect(parseMoney('')).toBeNull();
  });

  it('разбирает длительность в разных форматах', () => {
    expect(parseDuration('60')).toBe(60);
    expect(parseDuration('90 мин')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1 ч 30 мин')).toBe(90);
    expect(parseDuration('1,5 ч')).toBe(90);
    expect(parseDuration('0.0416666667')).toBe(60);
    expect(parseDuration('не время')).toBeNull();
  });

  it('делит специалистов по запятой и точке с запятой без повторов', () => {
    expect(splitSpecialists('Анна, Мария; Анна')).toEqual(['Анна', 'Мария']);
    expect(splitSpecialists('')).toEqual([]);
  });

  it('собирает строки и отмечает ошибки', () => {
    const mapping: ColumnMapping = {
      category: 0,
      name: 1,
      price: 2,
      duration: 3,
      cost: 4,
      description: 5,
      specialist: 6,
    };
    const rows = [
      ['Стрижки', 'Женская стрижка', '3 500 ₽', '1 ч', '500', 'Мягкая укладка', 'Анна, Мария'],
      ['', 'Без категории', '1000', '30', '', '', ''],
      ['Уход', 'Маска', '', '20', '', '', ''],
    ];

    const parsed = parsePriceRows(rows, mapping, 2);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      rowNumber: 2,
      categoryName: 'Стрижки',
      name: 'Женская стрижка',
      priceRub: 3500,
      durationMin: 60,
      costRub: 500,
      description: 'Мягкая укладка',
      specialistNames: ['Анна', 'Мария'],
      errors: [],
    });
    expect(parsed[1].errors).toContain('не указана категория');
    expect(parsed[2].errors).toContain('не указана цена');
  });

  it('строит буквы колонок', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
  });
});
