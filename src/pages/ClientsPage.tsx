import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClientDrawer } from '@/features/clients/ClientDrawer';
import { listClientsWithMeta } from '@/db/repositories';
import type { Client, ClientWithMeta } from '@/domain/types';
import { formatPhone, formatRub, normalizePhone, pluralize } from '@/domain/money';
import { formatRuDate, fromDateKey } from '@/domain/date';

type SortMode = 'name' | 'lastVisit' | 'spent';

const SORT_LABELS: Record<SortMode, string> = {
  name: 'По имени',
  lastVisit: 'По последнему визиту',
  spent: 'По сумме визитов',
};

export function ClientsPage() {
  const clients = useLiveQuery(() => listClientsWithMeta(), []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const list = clients ?? [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const digits = normalizePhone(normalized);
    const result = list.filter((client) => {
      if (!normalized) return true;
      const name = `${client.firstName} ${client.lastName}`.toLowerCase();
      return (
        name.includes(normalized) ||
        (digits.length > 0 && client.phoneNormalized.includes(digits)) ||
        (client.email ?? '').toLowerCase().includes(normalized) ||
        (client.phone ?? '').toLowerCase().includes(normalized) ||
        (client.comment ?? '').toLowerCase().includes(normalized) ||
        (client.notes ?? '').toLowerCase().includes(normalized)
      );
    });
    return result.sort((a, b) => {
      if (sort === 'name') return a.firstName.localeCompare(b.firstName, 'ru');
      if (sort === 'spent') return b.totalSpentRub - a.totalSpentRub;
      return (b.lastVisit ?? '').localeCompare(a.lastVisit ?? '');
    });
  }, [list, query, sort]);

  const totalSpent = list.reduce((sum, client) => sum + client.totalSpentRub, 0);
  const withVisits = list.filter((client) => client.visitsCount > 0).length;
  const average =
    withVisits > 0 ? Math.round(totalSpent / list.reduce((sum, client) => sum + client.visitsCount, 0)) : 0;

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(client: ClientWithMeta) {
    setEditing(client);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Клиенты"
        subtitle="Контакты, история визитов и комментарии — всё хранится на этом устройстве"
        actions={
          <Button onClick={openCreate}>
            <UserPlus size={16} />
            Добавить клиента
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users} label="Всего клиентов" value={String(list.length)} hint={`${withVisits} с визитами`} />
        <StatCard
          icon={Wallet}
          label="Выручка по клиентам"
          value={formatRub(totalSpent)}
          hint="По выполненным визитам"
        />
        <StatCard
          icon={CalendarDays}
          label="Средний чек"
          value={average ? formatRub(average) : '—'}
          hint="На один выполненный визит"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <Users size={15} className="text-primary" />
            База клиентов
            <span className="rounded-full bg-[#F1F4F2] px-2 py-0.5 text-[10px] font-bold text-muted">
              {list.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[270px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Имя, телефон, email или комментарий"
                className="h-9 pl-9"
                aria-label="Поиск клиентов"
              />
            </div>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="h-9 w-[210px]"
              aria-label="Сортировка клиентов"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {SORT_LABELS[mode]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {filtered.length > 0 ? (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col />
              <col className="w-[170px]" />
              <col className="w-[100px]" />
              <col className="w-[150px]" />
              <col className="w-[140px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A938D]">
                <th className="px-5 py-2.5 font-semibold">Клиент</th>
                <th className="px-3 py-2.5 font-semibold">Телефон</th>
                <th className="px-3 py-2.5 text-center font-semibold">Визиты</th>
                <th className="px-3 py-2.5 font-semibold">Последний визит</th>
                <th className="px-3 py-2.5 text-right font-semibold">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => openEdit(client)}
                  className="cursor-pointer border-b border-line/70 last:border-b-0 hover:bg-[#FBFCFB]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${client.firstName} ${client.lastName}`} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-bold text-ink">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {client.comment ?? client.notes ?? client.email ?? 'Без дополнительных контактов'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#4E5C55]">
                      <Phone size={12} className="text-muted" />
                      {formatPhone(client.phone)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#F1F4F2] px-2 py-0.5 text-[11px] font-bold text-[#5C6761]">
                      {client.visitsCount}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-[#4E5C55]">
                    {client.lastVisit ? formatRuDate(fromDateKey(client.lastVisit)) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-ink">
                    {client.totalSpentRub ? formatRub(client.totalSpentRub) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={Users}
              title="Клиенты не найдены"
              description="Попробуйте изменить запрос или добавьте нового клиента."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} />
                  Добавить клиента
                </Button>
              }
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FBFCFB] px-5 py-3.5 text-[11px] text-muted">
          <span>
            Показано {filtered.length} из {list.length}{' '}
            {pluralize(list.length, 'клиента', 'клиентов', 'клиентов')}
          </span>
          <span>
            Все данные доступны без интернета ·{' '}
            <span className="font-semibold text-primary-dark">локальная база</span>
          </span>
        </div>
      </div>

      <ClientDrawer open={drawerOpen} onOpenChange={setDrawerOpen} client={editing} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon size={15} />
        </span>
      </div>
      <div className="mt-2 text-[22px] font-extrabold tracking-[-0.02em] text-ink">{value}</div>
      <div className="mt-1 text-[10px] text-muted">{hint}</div>
    </div>
  );
}
