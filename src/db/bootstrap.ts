import { seedDemoData } from '@/db/seed';

export const EMPTY_START_FLAG = 'ritm-empty-start';

let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (window.localStorage.getItem(EMPTY_START_FLAG) !== '1') {
        await seedDemoData();
      }
      try {
        await navigator.storage?.persist?.();
      } catch {
        // Постоянное хранилище не критично: доступность проверим в настройках.
      }
    })();
  }
  return initPromise;
}
