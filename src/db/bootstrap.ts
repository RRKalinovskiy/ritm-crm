import { db } from '@/db/db';

let initPromise: Promise<void> | null = null;

/**
 * Готовит локальную базу к работе. Демо-данные больше не загружаются:
 * при пустой базе приложение открывает мастер первого запуска.
 */
export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await navigator.storage?.persist?.();
      } catch {
        // Постоянное хранилище не критично: доступность проверим в настройках.
      }
    })();
  }
  return initPromise;
}

/** Мастер настройки нужен, пока в базе нет ни одной записи настроек. */
export async function needsOnboarding(): Promise<boolean> {
  return (await db.settings.count()) === 0;
}
