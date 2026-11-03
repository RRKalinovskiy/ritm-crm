import { Link, NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  HelpCircle,
  Scissors,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDaySummary, getSettings } from '@/db/repositories';
import { toDateKey } from '@/domain/date';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function Sidebar() {
  const settings = useLiveQuery(() => getSettings(), []);
  const todayKey = toDateKey(new Date());
  const todaySummary = useLiveQuery(() => getDaySummary(todayKey), [todayKey]);

  const items: NavItem[] = [
    { to: '/schedule', label: 'Расписание', icon: CalendarDays, badge: todaySummary?.count },
    { to: '/services', label: 'Услуги', icon: Scissors },
    { to: '/clients', label: 'Клиенты', icon: Users },
    { to: '/statistics', label: 'Статистика', icon: BarChart3 },
    { to: '/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-[72px] items-center gap-2.5 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
          <CalendarDays size={20} strokeWidth={2.2} />
        </div>
        <div className="text-[21px] font-extrabold tracking-[0.08em] text-ink">РИТМ</div>
      </div>

      <div className="px-3">
        <Link
          to="/settings"
          className="flex w-full items-center gap-2.5 rounded-xl bg-[#F6F7F8] px-3 py-2.5 text-left transition hover:bg-[#F1F4F2]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Scissors size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-bold text-ink">
              {settings?.studioName ?? 'Моя студия'}
            </div>
            <div className="truncate text-[10px] text-muted">
              {settings?.address ?? 'Адрес не указан'}
            </div>
          </div>
          <ChevronDown size={14} className="shrink-0 text-muted" />
        </Link>
      </div>

      <nav className="mt-5 flex flex-col gap-1 px-2">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'group flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold transition',
                isActive
                  ? 'bg-primary-soft text-primary-dark'
                  : 'text-[#5C6761] hover:bg-[#F6F7F8] hover:text-ink',
              )
            }
          >
            <Icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{label}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[10px] font-bold text-primary shadow-sm">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-3 pb-4">
        <button className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-[#5C6761] transition hover:bg-[#F6F7F8] hover:text-ink">
          <HelpCircle size={16} />
          Помощь и поддержка
        </button>

        <div className="rounded-xl border border-line p-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar name="Администратор" color="#376451" size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-ink">Администратор</div>
              <div className="truncate text-[10px] text-muted">Локальный профиль</div>
            </div>
            <ChevronDown size={14} className="text-muted" />
          </div>
        </div>
      </div>
    </aside>
  );
}
