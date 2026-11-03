import { Link, useLocation } from 'react-router-dom';
import { Bell, ChevronRight, CloudOff } from 'lucide-react';
import { DEMO_TODAY, formatRuDateLong } from '@/domain/date';

const TITLES: Array<{ match: RegExp; title: string; href: string }> = [
  { match: /^\/schedule/, title: 'Расписание', href: '/schedule' },
  { match: /^\/services/, title: 'Услуги', href: '/services' },
  { match: /^\/clients/, title: 'Клиенты', href: '/clients' },
  { match: /^\/statistics/, title: 'Статистика', href: '/statistics' },
  { match: /^\/settings/, title: 'Настройки', href: '/settings' },
];

export function Topbar() {  const location = useLocation();
  const current = TITLES.find((item) => item.match.test(location.pathname));
  const title = current?.title ?? 'Расписание';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-7">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px]">
        <span className="text-muted">Рабочее пространство</span>
        <ChevronRight size={12} className="text-[#A7AEA9]" />
        <Link to={current?.href ?? '/schedule'} className="font-semibold text-ink">
          {title}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] text-muted xl:block">
          {capitalize(formatRuDateLong(DEMO_TODAY))}
        </span>
        <span className="hidden h-5 w-px bg-line xl:block" />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-[10px] font-semibold text-primary-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Сохранено локально
        </span>
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-[#F1F4F2] hover:text-ink"
          aria-label="Уведомления"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" />
        </button>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-muted transition hover:bg-[#F1F4F2] hover:text-ink"
          title="Приложение работает без интернета"
        >
          <CloudOff size={14} />
          Офлайн
        </button>
      </div>
    </header>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
