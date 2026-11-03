import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Avatar } from '@/components/ui/Avatar';
import {
  listCategories,
  listSpecialists,
  saveService,
} from '@/db/repositories';
import type { Category, Service, Specialist } from '@/domain/types';
import { formatRub } from '@/domain/money';
import { cn } from '@/lib/utils';

interface ServiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  onSaved?: () => void;
}

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];

interface FormState {
  name: string;
  categoryId: string;
  price: string;
  cost: string;
  durationMin: number;
  description: string;
  specialistIds: string[];
  active: boolean;
}

const EMPTY: FormState = {
  name: '',
  categoryId: '',
  price: '',
  cost: '',
  durationMin: 60,
  description: '',
  specialistIds: [],
  active: true,
};

export function ServiceDrawer({ open, onOpenChange, service, onSaved }: ServiceDrawerProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [specialistQuery, setSpecialistQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    void Promise.all([listCategories(), listSpecialists()]).then(([nextCategories, nextSpecialists]) => {
      setCategories(nextCategories);
      setSpecialists(nextSpecialists);
      if (service) {
        setForm({
          name: service.name,
          categoryId: service.categoryId,
          price: String(service.priceRub),
          cost: service.costRub != null ? String(service.costRub) : '',
          durationMin: service.durationMin,
          description: service.description ?? '',
          specialistIds: service.specialistIds,
          active: service.active,
        });
      } else {
        setForm({
          ...EMPTY,
          categoryId: nextCategories[0]?.id ?? '',
          specialistIds: nextSpecialists.map((specialist) => specialist.id),
        });
      }
      setErrors({});
      setSpecialistQuery('');
    });
  }, [open, service]);

  const visibleSpecialists = useMemo(() => {
    const query = specialistQuery.trim().toLowerCase();
    if (!query) return specialists;
    return specialists.filter((specialist) => specialist.name.toLowerCase().includes(query));
  }, [specialists, specialistQuery]);

  const price = Number(form.price) || 0;
  const duration = form.durationMin;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function toggleSpecialist(id: string) {
    setForm((current) => ({
      ...current,
      specialistIds: current.specialistIds.includes(id)
        ? current.specialistIds.filter((item) => item !== id)
        : [...current.specialistIds, id],
    }));
    setErrors((current) => {
      if (!current.specialistIds) return current;
      const next = { ...current };
      delete next.specialistIds;
      return next;
    });
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Укажите название услуги';
    if (!form.categoryId) nextErrors.categoryId = 'Выберите категорию';
    if (!form.price || price <= 0) nextErrors.price = 'Укажите цену больше нуля';
    if (form.cost && Number(form.cost) < 0) nextErrors.cost = 'Себестоимость не может быть отрицательной';
    if (form.specialistIds.length === 0) nextErrors.specialistIds = 'Выберите хотя бы одного специалиста';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await saveService({
        ...(service ? { id: service.id } : {}),
        name: form.name.trim(),
        categoryId: form.categoryId,
        priceRub: Math.round(price),
        costRub: form.cost ? Math.round(Number(form.cost)) : undefined,
        durationMin: duration,
        description: form.description.trim() || undefined,
        specialistIds: form.specialistIds,
        active: form.active,
      });
      toast({
        title: service ? 'Услуга обновлена' : 'Услуга добавлена',
        description: service ? form.name : 'Новая услуга появилась в прайсе студии.',
      });
      onSaved?.();
      onOpenChange(false);
    } catch (cause) {
      toast({
        title: 'Не удалось сохранить',
        description: cause instanceof Error ? cause.message : 'Попробуйте ещё раз',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={service ? 'Редактирование услуги' : 'Новая услуга'}
      description={service ? 'Измените параметры услуги в прайсе' : 'Добавьте услугу в прайс студии'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохраняем…' : service ? 'Сохранить изменения' : 'Добавить услугу'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-6 py-6">
        <Field label="Название услуги" required error={errors.name} htmlFor="service-name">
          <Input
            id="service-name"
            value={form.name}
            placeholder="Например, Женская стрижка"
            onChange={(event) => update('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

        <Field label="Категория" required error={errors.categoryId} htmlFor="service-category">
          <Select
            id="service-category"
            value={form.categoryId}
            onChange={(event) => update('categoryId', event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Цена" required error={errors.price} htmlFor="service-price">
            <div className="relative">
              <Input
                id="service-price"
                inputMode="numeric"
                value={form.price}
                placeholder="2 200"
                className="pr-8"
                onChange={(event) => update('price', event.target.value.replace(/[^\d]/g, ''))}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                ₽
              </span>
            </div>
          </Field>
          <Field label="Длительность" required htmlFor="service-duration">
            <Select
              id="service-duration"
              value={duration}
              onChange={(event) => update('durationMin', Number(event.target.value))}
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes < 60 ? `${minutes} минут` : minutes === 60 ? '1 час' : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ''}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Себестоимость"
          hint="Необязательно. Нужна для расчёта прибыли в статистике."
          error={errors.cost}
          htmlFor="service-cost"
        >
          <div className="relative">
            <Input
              id="service-cost"
              inputMode="numeric"
              value={form.cost}
              placeholder="Например, 700"
              className="pr-8"
              onChange={(event) => update('cost', event.target.value.replace(/[^\d]/g, ''))}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
              ₽
            </span>
          </div>
        </Field>

        <Field label="Описание" hint="Коротко о том, что входит в услугу." htmlFor="service-description">
          <Textarea
            id="service-description"
            value={form.description}
            placeholder="Например: мытьё, стрижка и укладка"
            onChange={(event) => update('description', event.target.value)}
          />
        </Field>

        <Field label="Кто оказывает услугу" required error={errors.specialistIds}>
          <div className="rounded-xl border border-line">
            <div className="relative border-b border-line p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={specialistQuery}
                onChange={(event) => setSpecialistQuery(event.target.value)}
                placeholder="Найти специалиста"
                className="h-8 border-0 bg-transparent pl-7 focus:ring-0"
              />
            </div>
            <div className="max-h-[180px] overflow-y-auto p-2">
              {visibleSpecialists.map((specialist) => {
                const checked = form.specialistIds.includes(specialist.id);
                return (
                  <button
                    key={specialist.id}
                    type="button"
                    onClick={() => toggleSpecialist(specialist.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition',
                      checked ? 'bg-primary-soft' : 'hover:bg-[#F6F7F8]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-primary bg-primary text-white' : 'border-[#C8D0CB] bg-surface',
                      )}
                    >
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <Avatar name={specialist.name} color={specialist.color} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">{specialist.name}</span>
                      <span className="block truncate text-[10px] text-muted">{specialist.role}</span>
                    </span>
                  </button>
                );
              })}
              {visibleSpecialists.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-muted">Специалист не найден</div>
              )}
            </div>
          </div>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-[#FBFCFB] px-4 py-3.5">
          <div>
            <div className="text-[12px] font-bold text-ink">Доступна для записи</div>
            <div className="mt-0.5 text-[11px] text-muted">
              Архивные услуги остаются в истории, но не предлагаются при создании записи.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.active}
            onClick={() => update('active', !form.active)}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition',
              form.active ? 'bg-primary' : 'bg-[#D5DBD7]',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                form.active ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </button>
        </div>

        <div className="rounded-xl bg-primary-faint px-4 py-3 text-[11px] leading-4 text-muted">
          В прайсе: <span className="font-semibold text-ink">{price ? formatRub(price) : '—'}</span>
          {' · '}
          {duration} мин
          {form.cost && Number(form.cost) > 0 ? (
            <>
              {' · '}
              прибыль с услуги{' '}
              <span className="font-semibold text-primary-dark">{formatRub(price - Number(form.cost))}</span>
            </>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}
