export type PriceFieldKey =
  | 'category'
  | 'name'
  | 'price'
  | 'duration'
  | 'cost'
  | 'description'
  | 'specialist';

export type ColumnMapping = Record<PriceFieldKey, number | null>;

export interface PriceFieldDefinition {
  key: PriceFieldKey;
  label: string;
  required: boolean;
  hint: string;
  synonyms: string[];
}

export const PRICE_FIELDS: PriceFieldDefinition[] = [
  {
    key: 'category',
    label: 'Категория',
    required: true,
    hint: 'Например: стрижки, окрашивание, уход',
    synonyms: ['категория', 'категории', 'группа', 'раздел', 'category'],
  },
  {
    key: 'name',
    label: 'Название услуги',
    required: true,
    hint: 'Название позиции в прайсе',
    synonyms: [
      'название услуги',
      'наименование услуги',
      'название',
      'наименование',
      'услуга',
      'позиция',
      'service name',
      'service',
      'name',
    ],
  },
  {
    key: 'price',
    label: 'Цена',
    required: true,
    hint: 'Стоимость услуги в рублях',
    synonyms: ['цена', 'стоимость', 'прайс', 'сумма', 'price', 'amount'],
  },
  {
    key: 'duration',
    label: 'Время',
    required: true,
    hint: 'Длительность: минуты или 1:30',
    synonyms: [
      'время',
      'длительность',
      'продолжительность',
      'минуты',
      'мин',
      'duration',
      'time',
    ],
  },
  {
    key: 'cost',
    label: 'Себестоимость',
    required: false,
    hint: 'Необязательно: расходы на услугу',
    synonyms: [
      'себестоимость',
      'закупочная цена',
      'закупка',
      'cost price',
      'cost',
    ],
  },
  {
    key: 'description',
    label: 'Описание',
    required: false,
    hint: 'Необязательно: комментарий или состав услуги',
    synonyms: ['описание', 'комментарий', 'примечание', 'description', 'notes'],
  },
  {
    key: 'specialist',
    label: 'Специалист',
    required: false,
    hint: 'Имена через запятую. Новые мастера создадутся автоматически',
    synonyms: [
      'специалисты',
      'специалист',
      'исполнители',
      'исполнитель',
      'мастера',
      'мастер',
      'сотрудники',
      'сотрудник',
      'specialist',
      'staff',
      'employee',
    ],
  },
];

export const EMPTY_MAPPING: ColumnMapping = {
  category: null,
  name: null,
  price: null,
  duration: null,
  cost: null,
  description: null,
  specialist: null,
};

export interface ParsedPriceRow {
  rowNumber: number;
  categoryName: string;
  name: string;
  priceRub: number;
  durationMin: number;
  costRub?: number;
  description?: string;
  specialistNames: string[];
  errors: string[];
}

export function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '');
}

export function columnLetter(index: number): string {
  let result = '';
  let current = index;
  while (current >= 0) {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  }
  return result;
}

export function detectHeaderRow(rows: string[][]): number {
  let bestRow = 1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 50);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    const nonEmpty = row.filter((cell) => cellText(cell).length > 0).length;
    if (nonEmpty < 2) continue;
    const mapping = detectColumnMapping(row);
    const matched = PRICE_FIELDS.filter((field) => mapping[field.key] != null).length;
    const score = matched * 100 + nonEmpty;
    if (matched >= 2 && score > bestScore) {
      bestScore = score;
      bestRow = index + 1;
    }
  }
  return bestRow;
}

function headerScore(header: string, synonyms: string[]): number {
  const normalized = normalizeKey(header);
  if (!normalized) return 0;
  let best = 0;
  for (const synonym of synonyms) {
    const target = normalizeKey(synonym);
    if (!target) continue;
    if (normalized === target) {
      best = Math.max(best, 1000 + target.length);
    } else if (normalized.startsWith(target) || normalized.endsWith(target)) {
      best = Math.max(best, 500 + target.length);
    } else if (normalized.includes(target)) {
      best = Math.max(best, 100 + target.length);
    }
  }
  return best;
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const usedHeaders = new Set<number>();
  const candidates: Array<{
    field: PriceFieldKey;
    headerIndex: number;
    score: number;
    fieldIndex: number;
  }> = [];

  PRICE_FIELDS.forEach((field, fieldIndex) => {
    headers.forEach((header, headerIndex) => {
      const score = headerScore(header, field.synonyms);
      if (score > 0) {
        candidates.push({ field: field.key, headerIndex, score, fieldIndex });
      }
    });
  });

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.fieldIndex - b.fieldIndex ||
      a.headerIndex - b.headerIndex,
  );

  for (const candidate of candidates) {
    if (mapping[candidate.field] != null || usedHeaders.has(candidate.headerIndex)) continue;
    mapping[candidate.field] = candidate.headerIndex;
    usedHeaders.add(candidate.headerIndex);
  }

  return mapping;
}

export function mappingProblem(mapping: ColumnMapping): string {
  const required = PRICE_FIELDS.filter((field) => field.required);
  const missing = required.filter((field) => mapping[field.key] == null);
  if (missing.length > 0) {
    return `Сопоставьте обязательные поля: ${missing.map((field) => field.label).join(', ')}.`;
  }
  const selected = Object.values(mapping).filter(
    (value): value is number => value != null,
  );
  if (new Set(selected).size !== selected.length) {
    return 'Одна и та же колонка выбрана для нескольких полей.';
  }
  return '';
}

export function parsePriceRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  startRow = 1,
): ParsedPriceRow[] {
  const result: ParsedPriceRow[] = [];

  dataRows.forEach((row, rowIndex) => {
    if (row.every((cell) => cellText(cell).length === 0)) return;

    const value = (field: PriceFieldKey): string => {
      const column = mapping[field];
      if (column == null) return '';
      return cellText(row[column]);
    };

    const categoryName = value('category');
    const name = value('name');
    const priceText = value('price');
    const durationText = value('duration');
    const costText = value('cost');
    const description = value('description');
    const specialistText = value('specialist');

    const errors: string[] = [];
    if (!categoryName) errors.push('не указана категория');
    if (!name) errors.push('не указано название услуги');

    const price = priceText ? parseMoney(priceText) : null;
    if (!priceText) {
      errors.push('не указана цена');
    } else if (price == null || price <= 0) {
      errors.push('цена должна быть больше нуля');
    }

    const duration = durationText ? parseDuration(durationText) : null;
    if (!durationText) {
      errors.push('не указано время');
    } else if (duration == null || duration <= 0) {
      errors.push('не удалось определить время');
    }

    let costRub: number | undefined;
    if (costText) {
      const cost = parseMoney(costText);
      if (cost == null || cost < 0) {
        errors.push('себестоимость должна быть неотрицательной');
      } else {
        costRub = Math.round(cost);
      }
    }

    result.push({
      rowNumber: startRow + rowIndex,
      categoryName,
      name,
      priceRub: price == null ? 0 : Math.round(price),
      durationMin: duration == null ? 0 : Math.round(duration),
      ...(costRub != null ? { costRub } : {}),
      ...(description ? { description } : {}),
      specialistNames: splitSpecialists(specialistText),
      errors,
    });
  });

  return result;
}

export function parseMoney(value: string): number | null {
  const cleaned = value
    .replace(/\u00a0/g, ' ')
    .replace(/[₽]/g, '')
    .replace(/(?:руб\.?|р\.?|rub|rur)/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDuration(value: string): number | null {
  const text = value
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(',', '.');
  if (!text) return null;

  const clock = text.match(/^(\d{1,3}):(\d{1,2})(?::\d{1,2})?$/);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours >= 0 && minutes >= 0 && minutes < 60) return hours * 60 + minutes;
  }

  const hoursMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:часов|часа|час|ч|hours|hour|h)(?=\s|$|[^а-яa-z])/,
  );
  const minutesMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:минут|минуты|минута|мин|minutes|min|m)(?=\s|$|[^а-яa-z])/,
  );

  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
    const total = hours * 60 + minutes;
    return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    // Excel хранит время как долю суток: 1 час = 0.041666…
    if (numeric > 0 && numeric < 1) return Math.round(numeric * 24 * 60);
    return Math.round(numeric);
  }

  return null;
}

export function splitSpecialists(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(/[,;]+/)) {
    const name = part.trim();
    if (!name) continue;
    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
