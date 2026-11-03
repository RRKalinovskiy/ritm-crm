import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Archive,
  ArchiveRestore,
  Clock3,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { ServiceDrawer } from '@/features/services/ServiceDrawer';
import { PriceImportModal } from '@/features/services/PriceImportModal';
import {
  deleteService,
  listCategories,
  listServicesWithMeta,
  setServiceActive,
} from '@/db/repositories';
import type { Service, ServiceWithMeta } from '@/domain/types';
import { formatRub, pluralize } from '@/domain/money';
import { formatDuration } from '@/domain/date';import { cn } from '@/lib/utils';

type SortMode = 'popular' | 'name' | 'price';
type StatusFilter = 'all' | 'active' | 'archived';

const SORT_LABELS: Record<SortMode, string> = {
  popular: 'По популярности',
  name: 'По названию',
  price: 'По цене',
};

export function ServicesPage() {
  const { toast } = useToast();
  const services = useLiveQuery(() => listServicesWithMeta(), []);
  const categories = useLiveQuery(() => listCategories(), []);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('popular');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const list = services ?? [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = list.filter((service) => {
      if (activeCategory !== 'all' && service.categoryId !== activeCategory) return false;
      if (statusFilter === 'active' && !service.active) return false;
      if (statusFilter === 'archived' && service.active) return false;
      if (!normalized) return true;
      return (
        service.name.toLowerCase().includes(normalized) ||
        (service.description ?? '').toLowerCase().includes(normalized) ||
        (service.category?.name ?? '').toLowerCase().includes(normalized)
      );
    });
    return result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
      if (sort === 'price') return b.priceRub - a.priceRub;
      return b.usageCount - a.usageCount;
    });
  }, [list, activeCategory, statusFilter, query, sort]);

  const activeCount = list.filter((service) => service.active).length;
  const totalPrice = list.reduce((sum, service) => sum + service.priceRub, 0);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(service: ServiceWithMeta) {
    setEditing(service);
    setDrawerOpen(true);
  }

  async function toggleArchive(service: ServiceWithMeta) {
    try {
      await setServiceActive(service.id, !service.active);
      toast({
        title: service.active ? 'Услуга в архиве' : 'Услуга возвращена в прайс',
        description: service.name,
      });
    } catch (cause) {
      toast({
        title: 'Не удалось изменить услугу',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    }
  }

  async function remove(service: ServiceWithMeta) {
    if (!window.confirm(`Удалить услугу «${service.name}»? Это действие нельзя отменить.`)) return;
    try {
      await deleteService(service.id);
      toast({ title: 'Услуга удалена', description: service.name });
    } catch (cause) {
      toast({
        title: 'Удаление недоступно',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Услуги"
        subtitle="Единый прайс для записи клиентов и расчёта стоимости"
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              Загрузить прайс
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} />
              Добавить услугу
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryTab
              active={activeCategory === 'all'}
              label="Все услуги"
              count={list.length}
              onClick={() => setActiveCategory('all')}
            />
            {(categories ?? []).map((category) => {
              const count = list.filter((service) => service.categoryId === category.id).length;
              return (
                <CategoryTab
                  key={category.id}
                  active={activeCategory === category.id}
                  label={category.name}
                  count={count}
                  onClick={() => setActiveCategory(category.id)}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-[230px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по названию"
                className="h-9 pl-9"
                aria-label="Поиск услуг"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 w-[130px]"
              aria-label="Статус услуг"
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="h-9 w-[170px]"
              aria-label="Сортировка услуг"
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
              <col className="w-[120px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-[120px]" />
              <col className="w-[50px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A938D]">
                <th className="px-5 py-2.5 font-semibold">Услуга</th>
                <th className="px-3 py-2.5 font-semibold">Категория</th>
                <th className="px-3 py-2.5 font-semibold">Длительность</th>
                <th className="px-3 py-2.5 text-right font-semibold">Цена</th>
                <th className="px-3 py-2.5 font-semibold">Статус</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((service) => (
                <tr
                  key={service.id}
                  className="group border-b border-line/70 last:border-b-0 hover:bg-[#FBFCFB]"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Sparkles size={16} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-ink">{service.name}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">
                          {service.description ?? 'Без описания'}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[12px] text-[#4E5C55]">{service.category?.name ?? '—'}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#4E5C55]">
                      <Clock3 size={13} className="text-muted" />
                      {formatDuration(service.durationMin)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-[13px] font-bold tabular-nums text-ink">
                      {formatRub(service.priceRub)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={service.active ? 'primary' : 'neutral'} dot>
                      {service.active ? 'Активна' : 'Архив'}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <RowMenu
                      service={service}
                      onEdit={() => openEdit(service)}
                      onToggleArchive={() => toggleArchive(service)}
                      onDelete={() => remove(service)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={Sparkles}
              title="Услуги не найдены"
              description="Измените фильтры или добавьте услугу в прайс студии."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} />
                  Добавить услугу
                </Button>
              }
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[#FBFCFB] px-5 py-3.5">
          <div className="text-[11px] text-muted">
            Показано {filtered.length} из {list.length}{' '}
            {pluralize(list.length, 'услуги', 'услуг', 'услуг')}
            {activeCount < list.length ? ` · ${list.length - activeCount} в архиве` : ''}
          </div>
          <div className="text-[11px] text-muted">
            Сумма прайса: <span className="font-bold text-ink">{formatRub(totalPrice)}</span>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
        <Archive size={13} />
        Услугу, которая уже использовалась в записях, нельзя удалить — только отправить в архив.
      </p>

      <ServiceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        service={editing}
      />
      <PriceImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          setActiveCategory('all');
          setStatusFilter('all');
          setQuery('');
        }}
      />
    </div>
  );
}

function CategoryTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition',
        active ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:bg-[#F6F7F8] hover:text-ink',
      )}
    >
      {label}
      <span className={cn('text-[10px] font-bold', active ? 'text-primary' : 'text-[#9AA29D]')}>{count}</span>
    </button>
  );
}

function RowMenu({
  service,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  service: ServiceWithMeta;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted opacity-0 transition hover:bg-[#EEF2EF] hover:text-ink focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Действия с услугой ${service.name}`}
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-[210px] rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-ink outline-none data-[highlighted]:bg-[#F3F6F4]"
          >
            <Pencil size={14} className="text-muted" />
            Редактировать
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onToggleArchive}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-ink outline-none data-[highlighted]:bg-[#F3F6F4]"
          >
            {service.active ? (
              <>
                <Archive size={14} className="text-muted" />
                В архив
              </>
            ) : (
              <>
                <ArchiveRestore size={14} className="text-muted" />
                Вернуть в прайс
              </>
            )}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-danger outline-none data-[highlighted]:bg-danger-soft"
          >
            <Trash2 size={14} />
            Удалить
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
