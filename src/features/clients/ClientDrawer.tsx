import { useEffect, useState } from 'react';
import { CalendarDays, Phone, Mail, Cake, History, Pencil } from 'lucide-react';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Badge, statusTone } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { getClientAppointments, saveClient } from '@/db/repositories';
import type { AppointmentWithDetails, Client } from '@/domain/types';
import { APPOINTMENT_STATUS_LABELS } from '@/domain/types';
import { formatRub } from '@/domain/money';
import { formatRuDate, fromDateKey } from '@/domain/date';

interface ClientDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthday: string;
  comment: string;
  notes: string;
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthday: '',
  comment: '',
  notes: '',
};

export function ClientDrawer({ open, onOpenChange, client, onSaved }: ClientDrawerProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AppointmentWithDetails[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email ?? '',
        birthday: client.birthday ?? '',
        comment: client.comment ?? '',
        notes: client.notes ?? '',
      });
      setShowHistory(false);
      void getClientAppointments(client.id).then((items) => {
        setHistory(
          items
            .filter((item) => item.status !== 'cancelled')
            .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
        );
      });
    } else {
      setForm(EMPTY);
      setHistory([]);
      setShowHistory(false);
    }
    setErrors({});
  }, [open, client]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Укажите имя';
    if (form.phone.replace(/\D/g, '').length < 10) nextErrors.phone = 'Укажите телефон полностью';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Проверьте адрес почты';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await saveClient({
        ...(client ? { id: client.id } : {}),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        birthday: form.birthday || undefined,
        comment: form.comment.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast({
        title: client ? 'Карточка обновлена' : 'Клиент добавлен',
        description: `${form.firstName} ${form.lastName}`.trim(),
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
      title={client ? 'Карточка клиента' : 'Новый клиент'}
      description={client ? 'Контакты, комментарий, заметки и история визитов' : 'Добавьте контакт клиента в локальную базу'}
      width="520px"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Сохраняем…' : client ? 'Сохранить изменения' : 'Добавить клиента'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Имя" required error={errors.firstName} htmlFor="client-first">
            <Input
              id="client-first"
              value={form.firstName}
              placeholder="Анна"
              onChange={(event) => update('firstName', event.target.value)}
            />
          </Field>
          <Field label="Фамилия" htmlFor="client-last">
            <Input
              id="client-last"
              value={form.lastName}
              placeholder="Морозова"
              onChange={(event) => update('lastName', event.target.value)}
            />
          </Field>
        </div>

        <Field label="Телефон" required error={errors.phone} htmlFor="client-phone">
          <Input
            id="client-phone"
            value={form.phone}
            placeholder="+7 (900) 000-00-00"
            inputMode="tel"
            onChange={(event) => update('phone', event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" error={errors.email} htmlFor="client-email">
            <Input
              id="client-email"
              type="email"
              value={form.email}
              placeholder="anna@example.ru"
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
          <Field label="День рождения" htmlFor="client-birthday">
            <Input
              id="client-birthday"
              type="date"
              value={form.birthday}
              onChange={(event) => update('birthday', event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Комментарий"
          hint="Короткая заметка о клиенте: договорённости, удобный способ связи, важные детали."
          htmlFor="client-comment"
        >
          <Textarea
            id="client-comment"
            value={form.comment}
            placeholder="Например: постоянная клиентка, удобнее писать в мессенджер"
            onChange={(event) => update('comment', event.target.value)}
          />
        </Field>

        <Field label="Заметки" hint="Предпочтения, аллергии, особенности — всё, что важно помнить." htmlFor="client-notes">
          <Textarea
            id="client-notes"
            value={form.notes}
            placeholder="Например: предпочитает укладку без запаха"
            onChange={(event) => update('notes', event.target.value)}
          />
        </Field>

        {client && (
          <div className="rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setShowHistory((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="flex items-center gap-2 text-[12px] font-bold text-ink">
                <History size={15} className="text-muted" />
                История визитов
                <span className="rounded-full bg-[#F1F4F2] px-2 py-0.5 text-[10px] font-bold text-muted">
                  {history.length}
                </span>
              </span>
              <span className="text-[11px] font-semibold text-primary">{showHistory ? 'Скрыть' : 'Показать'}</span>
            </button>
            {showHistory && (
              <div className="max-h-[300px] overflow-y-auto border-t border-line">
                {history.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[11px] text-muted">Визитов пока нет</div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 border-b border-line/60 px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-ink">
                          {formatRuDate(fromDateKey(item.date))}, {item.startTime}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {item.services.map((line) => line.nameSnapshot).join(', ')}
                        </div>
                        <div className="mt-1">
                          <Badge tone={statusTone(item.status)}>
                            {APPOINTMENT_STATUS_LABELS[item.status]}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] font-bold tnum text-ink">
                        {formatRub(item.totalRub)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {client && (
          <div className="flex items-center gap-2 rounded-xl bg-primary-faint px-4 py-3 text-[11px] text-muted">
            <Pencil size={13} className="shrink-0" />
            Изменения сохраняются только на этом устройстве и попадут в резервную копию.
          </div>
        )}

        {client && (
          <div className="grid grid-cols-3 gap-2 text-[11px] text-muted">
            <Info icon={Phone} value={client.phone} />
            <Info icon={Mail} value={client.email ?? '—'} />
            <Info
              icon={Cake}
              value={client.birthday ? formatRuDate(fromDateKey(client.birthday)) : '—'}
            />
            <Info
              icon={CalendarDays}
              value={`С нами с ${formatRuDate(new Date(client.createdAt))}`}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Info({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-[#F6F7F8] px-2.5 py-2">
      <Icon size={12} className="shrink-0 text-muted" />
      <span className="truncate">{value}</span>
    </div>
  );
}
