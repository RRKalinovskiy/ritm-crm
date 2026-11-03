import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { initDatabase, needsOnboarding } from '@/db/bootstrap';
import { FirstRunSetup } from '@/features/onboarding/FirstRunSetup';
import { SchedulePage } from '@/pages/SchedulePage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { StatisticsPage } from '@/pages/StatisticsPage';
import { SettingsPage } from '@/pages/SettingsPage';

type Phase = 'loading' | 'setup' | 'ready' | 'error';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(async () => {
        const setupRequired = await needsOnboarding();
        if (!cancelled) setPhase(setupRequired ? 'setup' : 'ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Не удалось открыть локальную базу данных');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
          <span className="text-[18px] font-extrabold tracking-[0.08em]">Р</span>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-bold text-ink">РИТМ</div>
          <div className="mt-1 text-[12px] text-muted">Открываем локальные данные студии…</div>
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-[460px] rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
          <div className="text-[16px] font-bold text-ink">Не удалось открыть базу</div>
          <p className="mt-2 text-[12px] leading-5 text-muted">{error}</p>
          <p className="mt-3 text-[11px] leading-4 text-muted">
            Проверьте, что браузер разрешает локальное хранилище, и обновите страницу.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-white transition hover:bg-primary-dark"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'setup') {
    return <FirstRunSetup onComplete={() => setPhase('ready')} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Route>
    </Routes>
  );
}
