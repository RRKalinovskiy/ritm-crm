import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Check,
  Database,
  Download,
  HardDrive,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Store,
  Tags,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { SpecialistDrawer } from '@/features/settings/SpecialistDrawer';
import {
  clearAllData,
  deleteCategory,
  exportSnapshot,
  getSettings,
  importSnapshot,
  listCategories,
  listServices,
  listSpecialists,
  saveCategory,
  saveSettings,
  setSpecialistActive,
} from '@/db/repositories';
import { EMPTY_START_FLAG } from '@/db/bootstrap';
import type { Category, Settings, Specialist } from '@/domain/types';
import { formatRuDate } from '@/domain/date';
import { formatRub, pluralize } from '@/domain/money';
import { cn } from '@/lib/utils';

type Tab = 'studio' | 'specialists' | 'categories' | 'data' | 'about';

const TABS: Array<{ id: Tab; label: string; icon: typeof Store }> = [
  { id: 'studio', label: 'Студия', icon: Store },
  { id: 'specialists', label: 'Специалисты', icon: Users },
  { id: 'categories', label: 'Категории', icon: Tags },
  { id: 'data', label: 'Данные', icon: Database },
  { id: 'about', label: 'О приложении', icon: Info },
];

const TIME_OPTIONS = (() => {
  const result: string[] = [];
  for (let minute = 7 * 60; minute <= 22 * 60; minute += 30) {
    result.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return result;
})();

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('studio');
  const settings = useLiveQuery(() => getSettings(), []);
  const [specialistDrawerOpen, setSpecialistDrawerOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Настройки"
        subtitle="Студия, команда, прайс и сохранность данных"
        actions={
          settings?.demoMode ? (
            <Badge tone="warning" dot>
              Демо-данные
            </Badge>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[11px] font-semibold transition',
              tab === id ? 'bg-primary-soft text-primary-dark' : 'text-muted hover:bg-[#F6F7F8] hover:text-ink',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'studio' && <StudioSettings settings={settings} />}
      {tab === 'specialists' && (
        <SpecialistsSettings
          onEdit={(specialist) => {
            setEditingSpecialist(specialist);
            setSpecialistDrawerOpen(true);
          }}
          onCreate={() => {
            setEditingSpecialist(null);
            setSpecialistDrawerOpen(true);
          }}
        />
      )}
      {tab === 'categories' && <CategoriesSettings />}
      {tab === 'data' && <DataSettings settings={settings} />}
      {tab === 'about' && <AboutSettings />}

      <SpecialistDrawer
        open={specialistDrawerOpen}
        onOpenChange={setSpecialistDrawerOpen}
        specialist={editingSpecialist}
      />
    </div>
  );
}

function StudioSettings({ settings }: { settings: Settings | undefined }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    studioName: '',
    address: '',
    phone: '',
    workdayStart: '09:00',
    workdayEnd: '18:00',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      studioName: settings.studioName,
      address: settings.address,
      phone: settings.phone,
      workdayStart: settings.workdayStart,
      workdayEnd: settings.workdayEnd,
    });
  }, [settings]);

  async function handleSave() {
    if (!settings) return;
    if (!form.studioName.trim()) {
      toast({ title: 'Укажите название студии', tone: 'error' });
      return;
    }
    if (form.workdayStart >= form.workdayEnd) {
      toast({ title: 'Проверьте рабочие часы', description: 'Начало должно быть раньше окончания.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        ...settings,
        studioName: form.studioName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        workdayStart: form.workdayStart,
        workdayEnd: form.workdayEnd,
      });
      toast({ title: 'Настройки студии сохранены' });
    } catch (cause) {
      toast({
        title: 'Не удалось сохранить',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="text-[14px] font-bold text-ink">Информация о студии</div>
        <div className="mt-0.5 text-[10px] text-muted">Отображается в сайдбаре и резервных копиях</div>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Название" htmlFor="settings-studio-name">
            <Input
              id="settings-studio-name"
              value={form.studioName}
              onChange={(event) => update('studioName', event.target.value)}
              placeholder="Студия «Форма»"
            />
          </Field>
          <Field label="Адрес" htmlFor="settings-address">
            <Input
              id="settings-address"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              placeholder="Москва, ул. Лесная, 12"
            />
          </Field>
          <Field label="Телефон" htmlFor="settings-phone">
            <Input
              id="settings-phone"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="+7 (495) 120-45-67"
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="text-[14px] font-bold text-ink">Рабочие часы</div>
          <div className="mt-0.5 text-[10px] text-muted">Сетка дня строится по этому интервалу</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Начало" htmlFor="settings-workday-start">
              <Select
                id="settings-workday-start"
                value={form.workdayStart}
                onChange={(event) => update('workdayStart', event.target.value)}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Окончание" htmlFor="settings-workday-end">
              <Select
                id="settings-workday-end"
                value={form.workdayEnd}
                onChange={(event) => update('workdayEnd', event.target.value)}
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 rounded-xl bg-primary-faint px-3.5 py-3 text-[10px] leading-4 text-muted">
            Продолжительность рабочего дня:{' '}
            <span className="font-bold text-ink">
              {Math.max(
                0,
                Number(form.workdayEnd.slice(0, 2)) * 60 +
                  Number(form.workdayEnd.slice(3, 5)) -
                  (Number(form.workdayStart.slice(0, 2)) * 60 + Number(form.workdayStart.slice(3, 5))),
              ) / 60}{' '}
              ч
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <ShieldCheck size={15} className="text-primary" />
            Локальный режим
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Все данные хранятся в IndexedDB на этом устройстве. Приложение не отправляет их в интернет.
            Регулярно делайте резервную копию во вкладке «Данные».
          </p>
        </div>
      </div>

      <div className="col-span-2 flex justify-end">
        <Button onClick={handleSave} disabled={saving || !settings}>
          <Save size={15} />
          {saving ? 'Сохраняем…' : 'Сохранить настройки'}
        </Button>
      </div>
    </div>
  );
}

function SpecialistsSettings({
  onEdit,
  onCreate,
}: {
  onEdit: (specialist: Specialist) => void;
  onCreate: () => void;
}) {
  const { toast } = useToast();
  const specialists = useLiveQuery(() => listSpecialists(), []);
  const services = useLiveQuery(() => listServices(), []);

  async function toggle(specialist: Specialist) {
    try {
      await setSpecialistActive(specialist.id, !specialist.active);
      toast({
        title: specialist.active ? 'Специалист скрыт' : 'Специалист снова в работе',
        description: specialist.name,
      });
    } catch (cause) {
      toast({
        title: 'Не удалось изменить статус',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <div className="text-[14px] font-bold text-ink">Команда студии</div>
          <div className="mt-0.5 text-[10px] text-muted">Специалисты, которые видны в расписании</div>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus size={14} />
          Добавить специалиста
        </Button>
      </div>

      <div className="divide-y divide-line">
        {(specialists ?? []).map((specialist) => {
          const own = (services ?? []).filter((service) => specialist.serviceIds.includes(service.id));
          const activeServices = own.filter((service) => service.active).length;
          return (
            <div key={specialist.id} className="flex items-center gap-4 px-5 py-3.5">
              <Avatar name={specialist.name} color={specialist.color} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-bold text-ink">{specialist.name}</span>
                  {!specialist.active && <Badge tone="neutral">Не работает</Badge>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted">{specialist.role}</div>
              </div>
              <div className="hidden w-[180px] text-[11px] text-muted xl:block">
                {activeServices} {pluralize(activeServices, 'услуга', 'услуги', 'услуг')} в прайсе
              </div>
              <div className="hidden w-[130px] text-[11px] text-muted 2xl:block">
                {own.length > 0
                  ? `от ${formatRub(Math.min(...own.map((service) => service.priceRub)))}`
                  : 'нет услуг'}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => onEdit(specialist)} aria-label={`Редактировать ${specialist.name}`}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggle(specialist)}
                  aria-label={specialist.active ? `Скрыть ${specialist.name}` : `Вернуть ${specialist.name}`}
                >
                  {specialist.active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                </Button>
              </div>
            </div>
          );
        })}
        {(specialists ?? []).length === 0 && (
          <div className="px-5 py-10 text-center text-[11px] text-muted">
            Специалистов пока нет — добавьте первого.
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesSettings() {
  const { toast } = useToast();
  const categories = useLiveQuery(() => listCategories(), []);
  const services = useLiveQuery(() => listServices(), []);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  async function addCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await saveCategory({ name: newName.trim() });
      setNewName('');
      toast({ title: 'Категория добавлена', description: newName.trim() });
    } catch (cause) {
      toast({
        title: 'Не удалось добавить категорию',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateCategory() {
    if (!editing || !editingName.trim()) return;
    setSaving(true);
    try {
      await saveCategory({ id: editing.id, name: editingName.trim(), order: editing.order });
      setEditing(null);
      toast({ title: 'Категория переименована' });
    } catch (cause) {
      toast({
        title: 'Не удалось сохранить',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Удалить категорию «${category.name}»?`)) return;
    try {
      await deleteCategory(category.id);
      toast({ title: 'Категория удалена', description: category.name });
    } catch (cause) {
      toast({
        title: 'Удаление недоступно',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="text-[14px] font-bold text-ink">Категории услуг</div>
          <div className="mt-0.5 text-[10px] text-muted">Порядок категорий задаёт группировку в прайсе</div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void addCategory();
            }}
            placeholder="Новая категория"
            className="h-9 w-[200px]"
            aria-label="Название новой категории"
          />
          <Button size="sm" onClick={addCategory} disabled={saving || !newName.trim()}>
            <Plus size={14} />
            Добавить
          </Button>
        </div>
      </div>

      <div className="divide-y divide-line">
        {(categories ?? []).map((category) => {
          const count = (services ?? []).filter((service) => service.categoryId === category.id).length;
          return (
            <div key={category.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Tags size={14} />
              </span>
              {editing?.id === category.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void updateCategory();
                      if (event.key === 'Escape') setEditing(null);
                    }}
                    className="h-8 max-w-[280px]"
                    aria-label="Название категории"
                    autoFocus
                  />
                  <Button size="sm" onClick={updateCategory} disabled={saving}>
                    <Check size={13} />
                    Сохранить
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(null)} aria-label="Отменить">
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-ink">{category.name}</div>
                    <div className="text-[10px] text-muted">
                      {count} {pluralize(count, 'услуга', 'услуги', 'услуг')}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditing(category);
                      setEditingName(category.name);
                    }}
                    aria-label={`Переименовать ${category.name}`}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCategory(category)}
                    aria-label={`Удалить ${category.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataSettings({ settings }: { settings: Settings | undefined }) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ persisted: boolean | null; usage: number; quota: number }>({
    persisted: null,
    usage: 0,
    quota: 0,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const persisted = await navigator.storage?.persisted?.();
        const estimate = await navigator.storage?.estimate?.();
        if (!cancelled) {
          setStorage({
            persisted: persisted ?? null,
            usage: estimate?.usage ?? 0,
            quota: estimate?.quota ?? 0,
          });
        }
      } catch {
        if (!cancelled) setStorage({ persisted: null, usage: 0, quota: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function exportBackup() {
    setBusy(true);
    try {
      const snapshot = await exportSnapshot();
      const now = new Date().toISOString();
      if (settings) {
        await saveSettings({ ...settings, lastBackupAt: now });
      }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ritm-backup-${now.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Резервная копия скачана', description: 'Сохраните файл в надёжном месте.' });
    } catch (cause) {
      toast({
        title: 'Не удалось создать копию',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File) {
    if (!window.confirm('Импорт заменит все текущие данные. Продолжить?')) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Awaited<ReturnType<typeof exportSnapshot>>;
      await importSnapshot(parsed);
      toast({ title: 'Данные восстановлены', description: 'Перезагружаем приложение…' });
      window.setTimeout(() => window.location.reload(), 700);
    } catch (cause) {
      toast({
        title: 'Не удалось импортировать',
        description: cause instanceof Error ? cause.message : 'Проверьте формат файла',
        tone: 'error',
      });
      setBusy(false);
    }
  }

  async function resetDemo() {
    if (!window.confirm('Сбросить все данные и загрузить демо-набор заново?')) return;
    setBusy(true);
    try {
      window.localStorage.removeItem(EMPTY_START_FLAG);
      await clearAllData();
      window.location.reload();
    } catch (cause) {
      toast({
        title: 'Не удалось сбросить данные',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
      setBusy(false);
    }
  }

  async function clearEverything() {
    if (!window.confirm('Удалить все данные и начать с пустой базы? Это действие нельзя отменить.')) return;
    setBusy(true);
    try {
      window.localStorage.setItem(EMPTY_START_FLAG, '1');
      await clearAllData();
      window.location.reload();
    } catch (cause) {
      toast({
        title: 'Не удалось очистить данные',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[1.3fr_1fr] gap-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="text-[14px] font-bold text-ink">Резервные копии</div>
        <div className="mt-0.5 text-[10px] text-muted">
          JSON-файл содержит услуги, клиентов, записи и настройки
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={exportBackup} disabled={busy}>
            <Download size={15} />
            Скачать копию
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload size={15} />
            Импортировать
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file);
              event.target.value = '';
            }}
          />
        </div>

        <div className="mt-4 rounded-xl bg-primary-faint px-4 py-3 text-[11px] leading-5 text-muted">
          {settings?.lastBackupAt ? (
            <>
              Последняя копия:{' '}
              <span className="font-semibold text-ink">
                {formatRuDate(new Date(settings.lastBackupAt))}
              </span>
              . Рекомендуем повторять экспорт не реже раза в неделю.
            </>
          ) : (
            'Резервная копия ещё не создавалась. Скачайте первый файл после заполнения данных.'
          )}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <AlertTriangle size={15} className="text-warning" />
            Опасная зона
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">
            Сброс вернёт демонстрационные данные июня 2026. Полная очистка оставит пустую базу.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={resetDemo} disabled={busy}>
              <RotateCcw size={14} />
              Сбросить демо-данные
            </Button>
            <Button variant="danger" size="sm" onClick={clearEverything} disabled={busy}>
              <Trash2 size={14} />
              Очистить всё
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <HardDrive size={16} className="text-primary" />
            Хранилище
          </div>
          <div className="mt-4 flex flex-col gap-3 text-[11px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Постоянное хранилище</span>
              <Badge tone={storage.persisted ? 'primary' : 'warning'} dot>
                {storage.persisted == null ? 'Неизвестно' : storage.persisted ? 'Разрешено' : 'Не разрешено'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Занято</span>
              <span className="font-semibold text-ink">{formatBytes(storage.usage)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Доступно</span>
              <span className="font-semibold text-ink">{formatBytes(storage.quota)}</span>
            </div>
            {storage.quota > 0 && (
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF2EF]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min((storage.usage / storage.quota) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="text-[12px] font-bold text-ink">Как хранятся данные</div>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            Записи сохраняются в IndexedDB сразу после каждого действия. Браузер может очистить
            хранилище при нехватке места — поэтому резервная копия остаётся главной защитой.
          </p>
        </div>
      </div>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="grid grid-cols-[1.3fr_1fr] gap-4">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Store size={20} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-ink">РИТМ</div>
            <div className="text-[10px] text-muted">Офлайн CRM для студии красоты · версия 0.1.0</div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-muted">
          Приложение работает полностью на устройстве: без сервера, аккаунта и интернета.
          Интерфейс и данные не покидают компьютер. Для переноса на другое устройство используйте
          резервную копию JSON.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <InfoTile label="Хранилище" value="IndexedDB" />
          <InfoTile label="Режим" value="Офлайн" />
          <InfoTile label="Шрифт" value="Manrope (OFL)" />
          <InfoTile label="Иконки" value="Lucide (ISC)" />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
          <ShieldCheck size={15} className="text-primary" />
          Памятка по бэкапу
        </div>
        <ol className="mt-3 flex list-decimal flex-col gap-2.5 pl-4 text-[11px] leading-5 text-muted">
          <li>Откройте «Настройки → Данные» и скачайте JSON-копию.</li>
          <li>Сохраните файл на внешний диск или в личную папку.</li>
          <li>Для восстановления импортируйте файл и подтвердите замену.</li>
          <li>Повторяйте экспорт после важных изменений и раз в неделю.</li>
        </ol>
        <div className="mt-4 rounded-xl bg-warning-soft px-3.5 py-3 text-[10px] leading-4 text-[#7A5010]">
          Очистка кэша браузера или хранилища приложения может удалить базу. Без резервной копии
          восстановить данные невозможно.
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#FBFCFB] px-3.5 py-3">
      <div className="text-[9px] uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-1 text-[12px] font-bold text-ink">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} КБ`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} ГБ`;
}
