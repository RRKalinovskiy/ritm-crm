import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { listServices, saveSpecialist } from '@/db/repositories';
import type { Service, Specialist } from '@/domain/types';
import { cn } from '@/lib/utils';

const COLORS = ['#376451', '#8A6D3B', '#5E718A', '#8A4F63', '#5C6B3D', '#7A5C8A'];

interface SpecialistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialist?: Specialist | null;
  onSaved?: () => void;
}

export function SpecialistDrawer({ open, onOpenChange, specialist, onSaved }: SpecialistDrawerProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Мастер');
  const [color, setColor] = useState(COLORS[0]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listServices().then(setServices);
    setName(specialist?.name ?? '');
    setRole(specialist?.role ?? 'Мастер');
    setColor(specialist?.color ?? COLORS[0]);
    setServiceIds(specialist?.serviceIds ?? []);
    setActive(specialist?.active ?? true);
    setQuery('');
    setError('');
  }, [open, specialist]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) => service.name.toLowerCase().includes(normalized));
  }, [services, query]);

  function toggleService(id: string) {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Укажите имя специалиста');
      return;
    }
    setSaving(true);
    try {
      await saveSpecialist({
        ...(specialist ? { id: specialist.id } : {}),
        name: name.trim(),
        role,
        color,
        active,
        serviceIds,
      });
      toast({
        title: specialist ? 'Специалист обновлён' : 'Специалист добавлен',
        description: name.trim(),
      });
      onSaved?.();
      onOpenChange(false);
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

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={specialist ? 'Редактирование специалиста' : 'Новый специалист'}
      description="Имя, роль и услуги, которые он оказывает"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохраняем…' : specialist ? 'Сохранить изменения' : 'Добавить специалиста'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-[#FBFCFB] px-4 py-3.5">
          <Avatar name={name || 'Новый специалист'} color={color} size="lg" />
          <div>
            <div className="text-[13px] font-bold text-ink">{name || 'Имя специалиста'}</div>
            <div className="text-[11px] text-muted">{role || 'Мастер'}</div>
          </div>
        </div>

        <Field label="Имя и фамилия" required error={error} htmlFor="specialist-name">
          <Input
            id="specialist-name"
            value={name}
            placeholder="Например, Анна Сидорова"
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
        </Field>

        <Field label="Роль" htmlFor="specialist-role">
          <Input
            id="specialist-role"
            value={role}
            placeholder="Топ-мастер"
            onChange={(event) => setRole(event.target.value)}
          />
        </Field>

        <Field label="Цвет в расписании">
          <div className="flex items-center gap-2">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition',
                  color === item ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-105',
                )}
                style={{ backgroundColor: item }}
                aria-label={`Цвет ${item}`}
              >
                {color === item && <Check size={14} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Услуги специалиста" hint="Услуги, которые можно назначить этому мастеру.">
          <div className="rounded-xl border border-line">
            <div className="relative border-b border-line p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти услугу"
                className="h-8 border-0 bg-transparent pl-7 focus:ring-0"
              />
            </div>
            <div className="max-h-[230px] overflow-y-auto p-1.5">
              {visible.map((service) => {
                const checked = serviceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
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
                      <span className="block text-[10px] text-muted">
                        {service.durationMin} мин · {service.active ? 'активна' : 'архив'}
                      </span>
                    </span>
                  </button>
                );
              })}
              {visible.length === 0 && (
                <div className="px-3 py-4 text-center text-[11px] text-muted">Услуги не найдены</div>
              )}
            </div>
          </div>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-[#FBFCFB] px-4 py-3.5">
          <div>
            <div className="text-[12px] font-bold text-ink">Работает в студии</div>
            <div className="mt-0.5 text-[11px] text-muted">
              Отключённый специалист не показывается при создании записи.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((current) => !current)}
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition',
              active ? 'bg-primary' : 'bg-[#D5DBD7]',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                active ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </button>
        </div>
      </div>
    </Drawer>
  );
}
