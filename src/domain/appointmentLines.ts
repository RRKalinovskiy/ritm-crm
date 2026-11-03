export interface QuantityLine {
  quantity?: number;
}

/** Количество единиц услуги. Старые записи без поля считаются как 1. */
export function lineQuantity(line: QuantityLine): number {
  const value = Number(line.quantity ?? 1);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(999, Math.round(value));
}

export function linePriceTotal(line: { priceRub: number; quantity?: number }): number {
  return Math.round(line.priceRub * lineQuantity(line));
}

export function lineDurationTotal(line: { durationMin: number; quantity?: number }): number {
  return Math.round(line.durationMin * lineQuantity(line));
}

export function lineCostTotal(line: {
  costRub?: number;
  quantity?: number;
}): number | undefined {
  return line.costRub == null
    ? undefined
    : Math.round(line.costRub * lineQuantity(line));
}
