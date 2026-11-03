import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import {
  cancelAppointment,
  findConflictingAppointment,
  getAppointmentDetails,
  getSettings,
  listActiveSpecialists,
  listCategories,
  listClients,
  listServices,
  saveAppointment,
  saveCategory,
  saveClient,
  saveService,
} from '@/db/repositories';
import type {
  Appointment,
  AppointmentLineInput,
  AppointmentStatus,
  Category,
  Client,
  Service,
  Specialist,
} from '@/domain/types';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_ORDER } from '@/domain/types';
import {
  addMinutesToTime,
  formatDuration,
  formatTimeRange,
  minutesFromTime,
  timeFromMinutes,
  toDateKey,
} from '@/domain/date';
import { formatPhone, formatRub, normalizePhone } from '@/domain/money';
import { cn } from '@/lib/utils';
import { SERVICE_DURATIONS, formatServiceDuration } from '@/features/services/durations';

interface AppointmentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId?: string | null;
  defaults?: {
    date?: string;
    startTime?: string;
    specialistId?: string;
  };
  onSaved?: () => void;
}

const EMPTY_FORM = {
  clientId: '',
  specialistId: '',
  date: toDateKey(new Date()),
  startTime: '10:00',
  status: 'pending' as AppointmentStatus,
  comment: '',
};

export function AppointmentEditor({
  open,
  onOpenChange,
  appointmentId,
  defaults,
  onSaved,
}: AppointmentEditorProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workday, setWorkday] = useState({ start: '09:00', end: '18:00' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState<AppointmentLineInput[]>([]);
  const [existing, setExisting] = useState<Appointment | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(true);
  const [conflict, setConflict] = useState<Appointment | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const [quickServiceOpen, setQuickServiceOpen] = useState(false);
  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServiceCategoryId, setQuickServiceCategoryId] = useState('');
  const [quickServiceNewCategory, setQuickServiceNewCategory] = useState('');
  const [quickServicePrice, setQuickServicePrice] = useState('');
  const [quickServiceDuration, setQuickServiceDuration] = useState(60);
  const [quickServiceError, setQuickServiceError] = useState('');
  const [quickServiceSaving, setQuickServiceSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([
      listClients(),
      listActiveSpecialists(),
      listServices(),
      listCategories(),
      getSettings(),
      appointmentId ? getAppointmentDetails(appointmentId) : Promise.resolve(undefined),
    ]).then(([nextClients, nextSpecialists, nextServices, nextCategories, settings, details]) => {
      if (cancelled) return;
      setClients(nextClients);
      setSpecialists(nextSpecialists);
      setServices(nextServices.filter((service) => service.active));
      setCategories(nextCategories);
      setWorkday({
        start: settings?.workdayStart ?? '09:00',
        end: settings?.workdayEnd ?? '18:00',
      });
      setClientQuery('');
      setClientOpen(false);
      setServiceQuery('');
      setServicePickerOpen(true);
      setConflict(null);
      setErrors({});
      setQuickClientOpen(false);
      setQuickName('');
      setQuickPhone('');
      setQuickError('');
      setQuickServiceOpen(false);
      setQuickServiceName('');
      setQuickServiceCategoryId(nextCategories[0]?.id ?? 'new');
      setQuickServiceNewCategory('');
      setQuickServicePrice('');
      setQuickServiceDuration(60);
      setQuickServiceError('');

      if (details) {
        setExisting(details);
        setForm({
          clientId: details.clientId,
          specialistId: details.specialistId,
          date: details.date,
          startTime: details.startTime,
          status: details.status,
          comment: details.comment ?? '',
        });
        setSelected(
          details.services.map((line) => ({
            serviceId: line.serviceId,
            nameSnapshot: line.nameSnapshot,
            priceRub: line.priceRub,
            costRub: line.costRub,
            durationMin: line.durationMin,
          })),
        );
        setServicePickerOpen(details.services.length === 0);
        setClientQuery(
          details.client ? `${details.client.firstName} ${details.client.lastName}` : '',
        );
      } else {
        setExisting(null);
        setSelected([]);
        setServicePickerOpen(true);
        setForm({
          ...EMPTY_FORM,
          date: defaults?.date ?? toDateKey(new Date()),
          startTime: defaults?.startTime ?? '10:00',
          specialistId: defaults?.specialistId ?? nextSpecialists[0]?.id ?? '',
          status: 'pending',
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, appointmentId, defaults?.date, defaults?.startTime, defaults?.specialistId]);

  const selectedClient = clients.find((client) => client.id === form.clientId);

  const qualifiedSpecialists = useMemo(() => {
    if (selected.length === 0) return specialists;
    return specialists.filter((specialist) =>
      selected.every((line) => specialist.serviceIds.includes(line.serviceId)),
    );
  }, [specialists, selected]);

  useEffect(() => {
    if (!open) return;
    if (qualifiedSpecialists.length === 0) return;
    if (!qualifiedSpecialists.some((specialist) => specialist.id === form.specialistId)) {
      setForm((current) => ({ ...current, specialistId: qualifiedSpecialists[0].id }));
    }
  }, [qualifiedSpecialists, form.specialistId, open]);

  const total = selected.reduce((sum, line) => sum + line.priceRub, 0);
  const duration = selected.reduce((sum, line) => sum + line.durationMin, 0);

  useEffect(() => {
    if (!open || !form.specialistId || !form.date || !form.startTime) {
      setConflict(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const found = await findConflictingAppointment({
          id: appointmentId ?? undefined,
          date: form.date,
          specialistId: form.specialistId,
          startTime: form.startTime,
          durationMin: Math.max(duration, 1),
        });
        if (active) setConflict(found ?? null);
      } catch {
        if (active) setConflict(null);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, appointmentId, form.specialistId, form.date, form.startTime, duration]);

  const timeOptions = useMemo(() => {
    const start = Math.min(minutesFromTime(workday.start), minutesFromTime(form.startTime));
    const end = Math.max(minutesFromTime(workday.end), minutesFromTime(form.startTime) + 120);
    const options: string[] = [];
    for (let minute = start; minute <= end; minute += 15) {
      options.push(timeFromMinutes(minute));
    }
    return options;
  }, [workday.start, workday.end, form.startTime]);

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    const digits = normalizePhone(query);
    if (!query) return clients.slice(0, 8);
    return clients
      .filter((client) => {
        const name = `${client.firstName} ${client.lastName}`.toLowerCase();
        return (
          name.includes(query) ||
          (digits.length > 0 && client.phoneNormalized.includes(digits)) ||
          (client.email ?? '').toLowerCase().includes(query) ||
          (client.comment ?? '').toLowerCase().includes(query) ||
          (client.notes ?? '').toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [clients, clientQuery]);

  const filteredServices = useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    const activeServices = query
      ? services.filter(
          (service) =>
            service.name.toLowerCase().includes(query) ||
            (service.description ?? '').toLowerCase().includes(query),
        )
      : services;
    return categories
      .map((category) => ({
        category,
        items: activeServices.filter((service) => service.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [services, categories, serviceQuery]);

  const effectiveQuickServiceCategoryId =
    quickServiceCategoryId === 'new'
      ? 'new'
      : categories.some((category) => category.id === quickServiceCategoryId)
        ? quickServiceCategoryId
        : categories[0]?.id ?? 'new';

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function selectClient(client: Client) {
    update('clientId', client.id);
    setClientQuery(`${client.firstName} ${client.lastName}`);
    setClientOpen(false);
  }

  function toggleService(service: Service) {
    setSelected((current) => {
      const has = current.some((line) => line.serviceId === service.id);
      if (has) return current.filter((line) => line.serviceId !== service.id);
      return [
        ...current,
        {
          serviceId: service.id,
          nameSnapshot: service.name,
          priceRub: service.priceRub,
          costRub: service.costRub,
          durationMin: service.durationMin,
        },
      ];
    });
    setErrors((current) => {
      if (!current.services) return current;
      const next = { ...current };
      delete next.services;
      return next;
    });
  }

  function removeService(serviceId: string) {
    setSelected((current) => current.filter((line) => line.serviceId !== serviceId));
  }

  async function createQuickClient() {
    if (!quickName.trim() || quickPhone.replace(/\D/g, '').length < 10) {
      setQuickError('Укажите имя и телефон полностью');
      return;
    }
    setQuickSaving(true);
    try {
      const [firstName, ...rest] = quickName.trim().split(' ');
      const id = await saveClient({
        firstName,
        lastName: rest.join(' '),
        phone: quickPhone.trim(),
      });
      const client: Client = {
        id,
        firstName,
        lastName: rest.join(' '),
        phone: quickPhone.trim(),
        phoneNormalized: normalizePhone(quickPhone),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setClients((current) => [client, ...current]);
      selectClient(client);
      setQuickClientOpen(false);
      setQuickName('');
      setQuickPhone('');
      setQuickError('');
      toast({ title: 'Клиент добавлен', description: `${client.firstName} ${client.lastName}`.trim() });
    } catch (cause) {
      setQuickError(cause instanceof Error ? cause.message : 'Не удалось добавить клиента');
    } finally {
      setQuickSaving(false);
    }
  }

  function openQuickService() {
    setQuickServiceOpen(true);
    setServicePickerOpen(true);
    setQuickServiceError('');
    setQuickServiceCategoryId((current) =>
      categories.some((category) => category.id === current)
        ? current
        : categories[0]?.id ?? 'new',
    );
  }

  async function createQuickService() {
    const name = quickServiceName.trim();
    const price = Number(quickServicePrice);
    const existingCategory = categories.find(
      (category) => category.id === effectiveQuickServiceCategoryId,
    );

    if (!name) {
      setQuickServiceError('Укажите название услуги');
      return;
    }
    if (!existingCategory && !quickServiceNewCategory.trim()) {
      setQuickServiceError('Укажите название новой категории');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setQuickServiceError('Укажите цену больше нуля');
      return;
    }

    setQuickServiceSaving(true);
    try {
      let categoryId = existingCategory?.id;
      if (!categoryId) {
        const categoryName = quickServiceNewCategory.trim();
        categoryId = await saveCategory({ name: categoryName });
        setCategories((current) => [
          ...current,
          { id: categoryId as string, name: categoryName, order: current.length + 1 },
        ]);
      }

      const roundedPrice = Math.round(price);
      const specialistIds = specialists.map((specialist) => specialist.id);
      const id = await saveService({
        categoryId,
        name,
        durationMin: quickServiceDuration,
        priceRub: roundedPrice,
        specialistIds,
        active: true,
      });
      const now = new Date().toISOString();
      const service: Service = {
        id,
        categoryId,
        name,
        durationMin: quickServiceDuration,
        priceRub: roundedPrice,
        specialistIds,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      setServices((current) =>
        [...current, service].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      );
      setSpecialists((current) =>
        current.map((specialist) =>
          specialist.serviceIds.includes(id)
            ? specialist
            : { ...specialist, serviceIds: [...specialist.serviceIds, id] },
        ),
      );
      setSelected((current) =>
        current.some((line) => line.serviceId === id)
          ? current
          : [
              ...current,
              {
                serviceId: id,
                nameSnapshot: name,
                priceRub: roundedPrice,
                durationMin: quickServiceDuration,
              },
            ],
      );
      setServiceQuery('');
      setServicePickerOpen(false);
      setQuickServiceOpen(false);
      setQuickServiceName('');
      setQuickServiceNewCategory('');
      setQuickServicePrice('');
      setQuickServiceDuration(60);
      setQuickServiceError('');
      setErrors((current) => {
        if (!current.services) return current;
        const next = { ...current };
        delete next.services;
        return next;
      });
      toast({
        title: 'Услуга создана и добавлена в запись',
        description: `${name} · ${formatRub(roundedPrice)}`,
      });
    } catch (cause) {
      setQuickServiceError(
        cause instanceof Error ? cause.message : 'Не удалось создать услугу',
      );
    } finally {
      setQuickServiceSaving(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.clientId) next.client = 'Выберите клиента';
    if (!form.specialistId) next.specialist = 'Выберите специалиста';
    if (form.specialistId && !qualifiedSpecialists.some((item) => item.id === form.specialistId)) {
      next.specialist = 'Специалист не оказывает выбранные услуги';
    }
    if (!form.date) next.date = 'Укажите дату';
    if (!form.startTime) next.time = 'Укажите время';
    if (selected.length === 0) next.services = 'Добавьте хотя бы одну услугу';
    if (form.startTime && minutesFromTime(form.startTime) < minutesFromTime(workday.start)) {
      next.time = `Рабочий день начинается в ${workday.start}`;
    }
    if (
      form.startTime &&
      minutesFromTime(form.startTime) + duration > minutesFromTime(workday.end) &&
      duration > 0
    ) {
      next.time = `Запись выходит за пределы рабочего дня (до ${workday.end})`;
    }
    if (conflict) next.conflict = 'Устраните пересечение с другой записью';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await saveAppointment({
        ...(appointmentId ? { id: appointmentId } : {}),
        clientId: form.clientId,
        specialistId: form.specialistId,
        date: form.date,
        startTime: form.startTime,
        status: form.status,
        comment: form.comment.trim() || undefined,
        services: selected,
      });
      toast({
        title: appointmentId ? 'Запись обновлена' : 'Запись создана',
        description: `${form.date.split('-').reverse().join('.')} в ${form.startTime} · ${formatRub(total)}`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (cause) {
      toast({
        title: 'Не удалось сохранить запись',
        description: cause instanceof Error ? cause.message : 'Попробуйте ещё раз',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelAppointment() {
    if (!appointmentId) return;
    if (!window.confirm('Отменить запись? Она останется в истории со статусом «Отменена».')) return;
    setCancelling(true);
    try {
      await cancelAppointment(appointmentId);
      toast({ title: 'Запись отменена', description: 'Слот освобождён для других клиентов.' });
      onSaved?.();
      onOpenChange(false);
    } catch (cause) {
      toast({
        title: 'Не удалось отменить запись',
        description: cause instanceof Error ? cause.message : undefined,
        tone: 'error',
      });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? 'Редактирование записи' : 'Новая запись'}
      description={
        existing
          ? `${formatRuDateShort(form.date)} · ${selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : 'Клиент не выбран'}`
          : 'Заполните данные — запись сохранится в локальной базе'
      }
      size="lg"
      footer={
        <>
          <div>
            {existing && existing.status !== 'cancelled' && (
              <Button variant="ghost" onClick={handleCancelAppointment} disabled={cancelling || saving}>
                {cancelling ? 'Отменяем…' : 'Отменить запись'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Закрыть
            </Button>
            <Button onClick={handleSave} disabled={saving || Boolean(conflict)}>
              {saving ? 'Сохраняем…' : existing ? 'Сохранить изменения' : 'Создать запись'}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Клиент" required error={errors.client}>
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={clientQuery}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setClientOpen(true);
                    update('clientId', '');
                  }}
                  onFocus={() => setClientOpen(true)}
                  placeholder="Имя или телефон"
                  className="pl-9"
                  aria-expanded={clientOpen}
                  aria-controls="client-options"
                />
                {selectedClient && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-primary">
                    выбран
                  </span>
                )}
              </div>
              {clientOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Закрыть список клиентов"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setClientOpen(false)}
                  />
                  <div
                    id="client-options"
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
                  >
                    <div className="max-h-[240px] overflow-y-auto p-1.5">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => selectClient(client)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-[#F3F6F4]"
                        >
                          <Avatar name={`${client.firstName} ${client.lastName}`} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-ink">
                              {client.firstName} {client.lastName}
                            </span>
                            <span className="block text-[10px] text-muted">{formatPhone(client.phone)}</span>
                          </span>
                          {client.id === form.clientId && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="px-3 py-4 text-center text-[11px] text-muted">
                          Клиент не найден
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickClientOpen(true);
                        setClientOpen(false);
                        setQuickPhone(normalizePhone(clientQuery).length >= 10 ? clientQuery : '');
                        setQuickName(normalizePhone(clientQuery).length >= 10 ? '' : clientQuery);
                      }}
                      className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-[11px] font-semibold text-primary transition hover:bg-primary-faint"
                    >
                      <UserPlus size={14} />
                      Создать нового клиента
                    </button>
                  </div>
                </>
              )}
            </div>
          </Field>

          <Field label="Телефон">
            <Input
              value={selectedClient ? formatPhone(selectedClient.phone) : ''}
              placeholder="Выберите клиента"
              disabled
              readOnly
            />
          </Field>
        </div>

        {quickClientOpen && (
          <div className="rounded-xl border border-primary/25 bg-primary-faint p-3.5">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-ink">Быстрое добавление клиента</div>
              <button
                type="button"
                onClick={() => setQuickClientOpen(false)}
                className="rounded-md p-1 text-muted hover:bg-white hover:text-ink"
                aria-label="Закрыть добавление клиента"
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input
                value={quickName}
                onChange={(event) => setQuickName(event.target.value)}
                placeholder="Имя и фамилия"
                aria-label="Имя нового клиента"
              />
              <Input
                value={quickPhone}
                onChange={(event) => setQuickPhone(event.target.value)}
                placeholder="+7 (900) 000-00-00"
                aria-label="Телефон нового клиента"
              />
            </div>
            {quickError && <div className="mt-2 text-[11px] font-medium text-danger">{quickError}</div>}
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={createQuickClient} disabled={quickSaving}>
                {quickSaving ? 'Добавляем…' : 'Добавить и выбрать'}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Field label="Дата" required error={errors.date}>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => update('date', event.target.value)}
            />
          </Field>
          <Field label="Время" required error={errors.time}>
            <Select
              value={form.startTime}
              onChange={(event) => update('startTime', event.target.value)}
            >
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Длительность" hint="Сумма длительностей услуг">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-[#F6F7F8] px-3 text-[13px] text-[#4E5C55]">
              <Clock3 size={14} className="text-muted" />
              {duration > 0 ? formatDuration(duration) : '—'}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Специалист" required error={errors.specialist}>
            <Select
              value={form.specialistId}
              onChange={(event) => update('specialistId', event.target.value)}
            >
              {qualifiedSpecialists.length === 0 && <option value="">Нет подходящего специалиста</option>}
              {qualifiedSpecialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name} · {specialist.role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Статус" required>
            <Select
              value={form.status}
              onChange={(event) => update('status', event.target.value as AppointmentStatus)}
            >
              {APPOINTMENT_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {conflict && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <div className="text-[11px] leading-5 text-[#7A5010]">
              <span className="font-bold">Пересечение по времени.</span> У специалиста уже есть запись{' '}
              {formatTimeRange(conflict.startTime, conflict.durationMin)}. Выберите другое время или
              специалиста — сохранить запись сейчас нельзя.
            </div>
          </div>
        )}

        <Field label="Услуги" required error={errors.services}>
          <div className="rounded-xl border border-line">
            {selected.length > 0 && (
              <div className="border-b border-line">
                {selected.map((line) => (
                  <div
                    key={line.serviceId}
                    className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-b-0"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                      {line.nameSnapshot}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{line.durationMin} мин</span>
                    <span className="w-[74px] shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">
                      {formatRub(line.priceRub)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeService(line.serviceId)}
                      className="rounded-md p-1 text-muted transition hover:bg-[#F1F4F2] hover:text-danger"
                      aria-label={`Убрать услугу ${line.nameSnapshot}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative border-b border-line p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={serviceQuery}
                onChange={(event) => {
                  setServiceQuery(event.target.value);
                  setServicePickerOpen(true);
                }}
                onFocus={() => setServicePickerOpen(true)}
                placeholder="Найти услугу в прайсе"
                className="h-8 border-0 bg-transparent pl-7 pr-16 focus:ring-0"
              />
              {servicePickerOpen && selected.length > 0 && !serviceQuery && (
                <button
                  type="button"
                  onClick={() => setServicePickerOpen(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-primary hover:underline"
                >
                  Свернуть
                </button>
              )}
            </div>

            {!servicePickerOpen && selected.length > 0 && !serviceQuery ? (
              <button
                type="button"
                onClick={() => setServicePickerOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold text-muted transition hover:bg-primary-faint hover:text-primary"
              >
                <Plus size={12} />
                Добавить ещё услугу
              </button>
            ) : (
              <div className="max-h-[190px] overflow-y-auto p-1.5">
                {filteredServices.map(({ category, items }) => (
                  <div key={category.id}>
                    <div className="px-2 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#9AA29D]">
                      {category.name}
                    </div>
                    {items.map((service) => {
                      const checked = selected.some((line) => line.serviceId === service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => toggleService(service)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition',
                            checked ? 'bg-primary-soft' : 'hover:bg-[#F6F7F8]',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                              checked ? 'border-primary bg-primary text-white' : 'border-[#C8D0CB]',
                            )}
                          >
                            {checked && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-ink">
                              {service.name}
                            </span>
                            <span className="block truncate text-[10px] text-muted">
                              {service.durationMin} мин
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">
                            {formatRub(service.priceRub)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredServices.length === 0 && (
                  <div className="px-3 py-5 text-center text-[11px] text-muted">
                    Услуги не найдены
                  </div>
                )}
              </div>
            )}

            {quickServiceOpen ? (
              <div className="border-t border-line bg-primary-faint p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold text-ink">Новая услуга</div>
                    <div className="mt-0.5 text-[10px] text-muted">
                      Добавится в прайс и сразу в текущую запись
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickServiceOpen(false)}
                    disabled={quickServiceSaving}
                    className="rounded-md p-1 text-muted transition hover:bg-white hover:text-ink"
                    aria-label="Закрыть создание услуги"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <Input
                    value={quickServiceName}
                    onChange={(event) => setQuickServiceName(event.target.value)}
                    placeholder="Название услуги"
                    aria-label="Название новой услуги"
                    autoFocus
                  />
                  <div className="grid grid-cols-[minmax(0,1fr)_110px_145px] gap-2">
                    <Select
                      value={effectiveQuickServiceCategoryId}
                      onChange={(event) => setQuickServiceCategoryId(event.target.value)}
                      aria-label="Категория новой услуги"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      <option value="new">+ Новая категория</option>
                    </Select>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={50}
                        value={quickServicePrice}
                        onChange={(event) => setQuickServicePrice(event.target.value)}
                        placeholder="Цена"
                        aria-label="Цена новой услуги"
                        className="pr-7"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                        ₽
                      </span>
                    </div>
                    <Select
                      value={quickServiceDuration}
                      onChange={(event) => setQuickServiceDuration(Number(event.target.value))}
                      aria-label="Длительность новой услуги"
                    >
                      {SERVICE_DURATIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {formatServiceDuration(minutes)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {effectiveQuickServiceCategoryId === 'new' && (
                    <Input
                      value={quickServiceNewCategory}
                      onChange={(event) => setQuickServiceNewCategory(event.target.value)}
                      placeholder="Название новой категории"
                      aria-label="Название новой категории"
                    />
                  )}
                  {quickServiceError && (
                    <div className="text-[11px] font-medium text-danger">{quickServiceError}</div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickServiceOpen(false)}
                      disabled={quickServiceSaving}
                    >
                      Отмена
                    </Button>
                    <Button size="sm" onClick={createQuickService} disabled={quickServiceSaving}>
                      {quickServiceSaving ? 'Создаём…' : 'Создать и выбрать'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openQuickService}
                className="flex w-full items-center justify-center gap-1.5 border-t border-line px-3 py-2.5 text-[10px] font-semibold text-primary transition hover:bg-primary-faint"
              >
                <Plus size={12} />
                Создать услугу, если её нет в прайсе
              </button>
            )}

            <div className="flex items-center justify-between border-t border-line bg-[#FBFCFB] px-3 py-2.5">
              <div className="text-[11px] text-muted">
                {selected.length > 0
                  ? `${selected.length} услуг · ${formatDuration(duration)} · до ${addMinutesToTime(form.startTime, duration)}`
                  : 'Ничего не выбрано'}
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-[0.08em] text-muted">Сумма записи</div>
                <div className="text-[15px] font-extrabold tabular-nums text-ink">{formatRub(total)}</div>
              </div>
            </div>
          </div>
        </Field>

        <Field label="Комментарий" htmlFor="appointment-comment">
          <Textarea
            id="appointment-comment"
            value={form.comment}
            placeholder="Пожелания клиента, особенности, напоминания"
            className="min-h-[64px]"
            onChange={(event) => update('comment', event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function formatRuDateShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  );
}
