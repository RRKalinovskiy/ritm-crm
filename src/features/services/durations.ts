export const SERVICE_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240] as const;

export function formatServiceDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} минут`;
  if (minutes === 60) return '1 час';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}
