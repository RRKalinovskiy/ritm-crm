import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Phone,
  Plus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { completeOnboarding, type OnboardingInput } from '@/db/repositories';
import { minutesFromTime } from '@/domain/date';
import { formatRub } from '@/domain/money';
import { SERVICE_DURATIONS, formatServiceDuration } from '@/features/services/durations';
import { cn, uid } from '@/lib/utils';

interface FirstRunSetupProps {
  onComplete: () => void;
}

const COLORS = ['#376451', '#8A6D3B', '#5E718A', '#8A4F63', '#5C6B3D', '#7A5C8A'];

const STEPS = [
  {
    title: 'Студия',
    hint: 'Название, контакты и рабочие часы',
    icon: Store,
  },
  {
    title: 'Команда',
    hint: 'Специалисты, которые ведут приём',
    icon: Users,
  },
  {
    title: 'Прайс',
    hint: 'Категории, услуги и цены',
    icon: Scissors,
  },
  {
    title: 'Готово',
    hint: 'Проверьте настройки и начните',
    icon: Check,
  },
] as const;

interface SpecialistDraft {
  key: string;
  name: string;
  role: string;
  color: string;
}

interface CategoryDraft {
  key: string;
  name: string;
}

interface ServiceDraft {
  key: string;
  name: string;
  categoryKey: string;
  price: string;
  durationMin: number;
}

function newSpecialist(index: number): SpecialistDraft {
  return {
    key: uid('draft'),
    name: '',
    role: 'Мастер',
    color: COLORS[index % COLORS.length],
  };
}

export function FirstRunSetup({ onComplete }: FirstRunSetupProps) {
  const [step, setStep] = useState(0);
  const [studioName, setStudioName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [workdayStart, setWorkdayStart] = useState('09:00');
  const [workdayEnd, setWorkdayEnd] = useState('18:00');
  const [specialists, setSpecialists] = useState<SpecialistDraft[]>([newSpecialist(0)]);
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [services, setServices] = useState<ServiceDraft[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const filledSpecialists = useMemo(
    () => specialists.filter((specialist) => specialist.name.trim().length > 0),
    [specialists],
  );
  const filledCategories = useMemo(
    () => categories.filter((category) => category.name.trim().length > 0),
    [categories],
  );
  const filledServices = useMemo(
    () =>
      services.filter(
        (service) =>
          service.name.trim().length > 0 ||
          service.price.trim().length > 0 ||
          service.categoryKey.length > 0,
      ),
    [services],
  );

  const hasPricing = filledCategories.length > 0 || filledServices.length > 0;

  function updateSpecialist(key: string, patch: Partial<SpecialistDraft>) {
    setSpecialists((current) =>
      current.map((specialist) =>
        specialist.key === key ? { ...specialist, ...patch } : specialist,
      ),
    );
  }

  function updateCategory(key: string, name: string) {
    setCategories((current) =>
      current.map((category) => (category.key === key ? { ...category, name } : category)),
    );
  }

  function updateService(key: string, patch: Partial<ServiceDraft>) {
    setServices((current) =>
      current.map((service) => (service.key === key ? { ...service, ...patch } : service)),
    );
  }

  function removeSpecialist(key: string) {
    setSpecialists((current) => current.filter((specialist) => specialist.key !== key));
  }

  function addSpecialist() {
    setSpecialists((current) => [...current, newSpecialist(current.length)]);
  }

  function addCategory() {
    setCategories((current) => [...current, { key: uid('draft'), name: '' }]);
  }

  function removeCategory(key: string) {
    setCategories((current) => current.filter((category) => category.key !== key));
    setServices((current) =>
      current.map((service) =>
        service.categoryKey === key ? { ...service, categoryKey: '' } : service,
      ),
    );
  }

  function addService() {
    if (categories.length === 0) return;
    setServices((current) => [
      ...current,
      {
        key: uid('draft'),
        name: '',
        categoryKey: categories[0]?.key ?? '',
        price: '',
        durationMin: 60,
      },
    ]);
  }

  function removeService(key: string) {
    setServices((current) => current.filter((service) => service.key !== key));
  }

  function validateStep(current: number): string {
    if (current === 0) {
      if (!studioName.trim()) return 'Укажите название студии.';
      if (!workdayStart || !workdayEnd) return 'Укажите начало и окончание рабочего дня.';
      if (minutesFromTime(workdayStart) >= minutesFromTime(workdayEnd)) {
        return 'Начало рабочего дня должно быть раньше окончания.';
      }
    }

    if (current === 1 && filledSpecialists.length === 0) {
      return 'Добавьте хотя бы одного специалиста — без него нельзя создать запись.';
    }

    if (current === 2) {
      const categoryKeys = new Set(filledCategories.map((category) => category.key));
      for (const service of filledServices) {
        const name = service.name.trim();
        if (!name) return 'Укажите название для каждой добавленной услуги.';
        if (!service.categoryKey || !categoryKeys.has(service.categoryKey)) {
          return `Выберите категорию для услуги «${name}».`;
        }
        const price = Number(service.price);
        if (!Number.isFinite(price) || price <= 0) {
          return `Укажите цену больше нуля для услуги «${name}».`;
        }
        if (!service.durationMin || service.durationMin <= 0) {
          return `Укажите длительность услуги «${name}».`;
        }
      }
    }

    return '';
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  function skipPricing() {
    setError('');
    setStep(3);
  }

  async function finish() {
    setError('');
    const message = validateStep(0) || validateStep(1) || validateStep(2);
    if (message) {
      setError(message);
      return;
    }

    const categoryIndex = new Map(
      filledCategories.map((category, index) => [category.key, index]),
    );

    const payload: OnboardingInput = {
      studioName: studioName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      workdayStart,
      workdayEnd,
      specialists: filledSpecialists.map((specialist) => ({
        name: specialist.name.trim(),
        role: specialist.role.trim() || 'Мастер',
        color: specialist.color,
      })),
      categories: filledCategories.map((category) => ({ name: category.name.trim() })),
      services: filledServices.map((service) => ({
        name: service.name.trim(),
        categoryIndex: categoryIndex.get(service.categoryKey) ?? 0,
        priceRub: Number(service.price),
        durationMin: service.durationMin,
      })),
    };

    setSaving(true);
    try {
      await completeOnboarding(payload);
      onComplete();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Не удалось сохранить настройки. Попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  }

  const currentStep = STEPS[step];
  const canSkipPricing = step === 2 && !hasPricing;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-6 py-6 xl:px-8 xl:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-[15px] font-extrabold text-white shadow-sm">
              Р
            </div>
            <div>
              <div className="text-[15px] font-extrabold tracking-[0.04em] text-ink">РИТМ</div>
              <div className="text-[10px] text-muted">Офлайн CRM для студии красоты</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[10px] font-semibold text-muted sm:flex">
            <ShieldCheck size={13} className="text-primary" />
            Данные хранятся только на этом компьютере
          </div>
        </header>

        <div className="mt-7 grid flex-1 grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-surface p-5 shadow-card lg:sticky lg:top-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Первый запуск
            </div>
            <div className="mt-1 text-[13px] font-bold text-ink">Настройка студии</div>

            <nav className="mt-5 flex flex-col gap-1" aria-label="Шаги настройки">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const done = index < step;
                const active = index === step;
                return (
                  <div
                    key={item.title}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition',
                      active && 'bg-primary-faint',
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold',
                        done && 'border-primary bg-primary text-white',
                        active && !done && 'border-primary bg-surface text-primary ring-2 ring-primary/15',
                        !active && !done && 'border-line bg-[#FBFCFB] text-muted',
                      )}
                    >
                      {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block text-[12px] font-bold',
                          active || done ? 'text-ink' : 'text-muted',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-muted">
                        {item.hint}
                      </span>
                    </span>
                  </div>
                );
              })}
            </nav>

            <div className="mt-5 rounded-xl border border-line bg-[#FBFCFB] p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink">
                <Sparkles size={14} className="text-primary" />
                Всё можно изменить
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                После настройки студия, специалисты и прайс доступны в разделе «Настройки».
              </p>
            </div>
          </aside>

          <section className="flex min-h-[610px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-7 py-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                Шаг {step + 1} из {STEPS.length}
              </div>
              <h1 className="mt-1.5 text-[23px] font-extrabold tracking-[-0.02em] text-ink">
                {step === 0 && 'Расскажите о студии'}
                {step === 1 && 'Кто работает в студии?'}
                {step === 2 && 'Добавьте категории и услуги'}
                {step === 3 && 'Студия готова к работе'}
              </h1>
              <p className="mt-1.5 max-w-[560px] text-[12px] leading-5 text-muted">
                {step === 0 &&
                  'Эти данные появятся в шапке приложения и в рабочих документах. Рабочие часы задают сетку расписания.'}
                {step === 1 &&
                  'Добавьте мастеров, которые ведут приём. Все услуги из следующего шага будут доступны каждому из них.'}
                {step === 2 &&
                  'Создайте структуру прайса. Если пока нет готового списка, этот шаг можно пропустить и добавить услуги позже.'}
                {step === 3 &&
                  'Проверьте введённые данные. После нажатия «Начать работу» откроется расписание.'}
              </p>
            </div>

            <div className="flex-1 px-7 py-6">
              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[11px] font-medium leading-5 text-danger"
                >
                  <X size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {step === 0 && (
                <div className="flex flex-col gap-5">
                  <Field label="Название студии" required htmlFor="setup-studio-name">
                    <Input
                      id="setup-studio-name"
                      value={studioName}
                      onChange={(event) => setStudioName(event.target.value)}
                      placeholder="Например, студия «Ритм»"
                      autoFocus
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Адрес" htmlFor="setup-address">
                      <div className="relative">
                        <MapPin
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <Input
                          id="setup-address"
                          value={address}
                          onChange={(event) => setAddress(event.target.value)}
                          placeholder="Город, улица, дом"
                          className="pl-9"
                        />
                      </div>
                    </Field>
                    <Field label="Телефон" htmlFor="setup-phone">
                      <div className="relative">
                        <Phone
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <Input
                          id="setup-phone"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="+7 (900) 000-00-00"
                          className="pl-9"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="rounded-xl border border-line bg-[#FBFCFB] p-4">
                    <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
                      <Clock3 size={15} className="text-primary" />
                      Рабочие часы
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      В этом интервале будет строиться сетка дня и проверяться время записей.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Начало" htmlFor="setup-workday-start">
                        <Input
                          id="setup-workday-start"
                          type="time"
                          value={workdayStart}
                          onChange={(event) => setWorkdayStart(event.target.value)}
                        />
                      </Field>
                      <Field label="Окончание" htmlFor="setup-workday-end">
                        <Input
                          id="setup-workday-end"
                          type="time"
                          value={workdayEnd}
                          onChange={(event) => setWorkdayEnd(event.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="flex flex-col gap-3">
                  {specialists.map((specialist, index) => (
                    <div
                      key={specialist.key}
                      className="rounded-xl border border-line bg-[#FBFCFB] p-3.5"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={specialist.name || 'Новый специалист'}
                          color={specialist.color}
                          size="md"
                        />
                        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_160px] gap-2.5">
                          <Input
                            value={specialist.name}
                            onChange={(event) =>
                              updateSpecialist(specialist.key, { name: event.target.value })
                            }
                            placeholder={`Имя и фамилия${index === 0 ? ' (обязательно)' : ''}`}
                            aria-label={`Имя специалиста ${index + 1}`}
                            autoFocus={index === 0}
                          />
                          <Input
                            value={specialist.role}
                            onChange={(event) =>
                              updateSpecialist(specialist.key, { role: event.target.value })
                            }
                            placeholder="Роль, например «Мастер»"
                            aria-label={`Роль специалиста ${index + 1}`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSpecialist(specialist.key)}
                          className="rounded-lg p-2 text-muted transition hover:bg-white hover:text-danger"
                          aria-label={`Удалить специалиста ${index + 1}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2 pl-12">
                        <span className="text-[10px] font-semibold text-muted">Цвет</span>
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => updateSpecialist(specialist.key, { color })}
                            className={cn(
                              'flex h-6 w-6 items-center justify-center rounded-full transition',
                              specialist.color === color
                                ? 'ring-2 ring-primary ring-offset-2'
                                : 'hover:scale-105',
                            )}
                            style={{ backgroundColor: color }}
                            aria-label={`Цвет ${color}`}
                          >
                            {specialist.color === color && (
                              <Check size={11} className="text-white" strokeWidth={3} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {specialists.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line bg-[#FBFCFB] px-4 py-8 text-center">
                      <Users size={22} className="mx-auto text-muted" />
                      <div className="mt-2 text-[12px] font-bold text-ink">
                        Специалистов пока нет
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        Добавьте хотя бы одного мастера, чтобы создать первую запись.
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addSpecialist}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-[12px] font-semibold text-primary transition hover:border-primary/40 hover:bg-primary-faint"
                  >
                    <Plus size={14} />
                    Добавить специалиста
                  </button>

                  <div className="mt-1 flex items-start gap-2 rounded-xl bg-primary-faint px-4 py-3 text-[10px] leading-4 text-[#4E5C65]">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" />
                    Если мастеров несколько, услуги из следующего шага будут доступны всем. В
                    дальнейшем можно гибко настроить список услуг для каждого.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-5">
                  <div className="rounded-xl border border-line">
                    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                      <div>
                        <div className="text-[12px] font-bold text-ink">Категории</div>
                        <div className="text-[10px] text-muted">
                          Например: стрижки, окрашивание, уход
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={addCategory}>
                        <Plus size={13} />
                        Категория
                      </Button>
                    </div>
                    <div className="p-3">
                      {categories.length === 0 ? (
                        <button
                          type="button"
                          onClick={addCategory}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-4 text-[11px] font-semibold text-muted transition hover:border-primary/40 hover:text-primary"
                        >
                          <Plus size={13} />
                          Добавить первую категорию
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {categories.map((category, index) => (
                            <div key={category.key} className="flex items-center gap-2">
                              <Input
                                value={category.name}
                                onChange={(event) =>
                                  updateCategory(category.key, event.target.value)
                                }
                                placeholder={`Название категории ${index + 1}`}
                                aria-label={`Название категории ${index + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => removeCategory(category.key)}
                                className="rounded-lg p-2 text-muted transition hover:bg-[#F1F4F2] hover:text-danger"
                                aria-label={`Удалить категорию ${index + 1}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line">
                    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                      <div>
                        <div className="text-[12px] font-bold text-ink">Услуги</div>
                        <div className="text-[10px] text-muted">
                          Название, категория, цена и длительность
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={addService}
                        disabled={categories.length === 0}
                      >
                        <Plus size={13} />
                        Услуга
                      </Button>
                    </div>
                    <div className="p-3">
                      {services.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-line px-3 py-5 text-center">
                          <Scissors size={20} className="mx-auto text-muted" />
                          <div className="mt-2 text-[11px] font-semibold text-ink">
                            В прайсе пока нет услуг
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-muted">
                            {categories.length === 0
                              ? 'Сначала добавьте категорию — услуга должна к ней относиться.'
                              : 'Нажмите «Услуга», чтобы добавить первую позицию.'}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {services.map((service, index) => (
                            <div
                              key={service.key}
                              className="rounded-lg border border-line bg-[#FBFCFB] p-3"
                            >
                              <div className="flex items-center gap-2">
                                <Input
                                  value={service.name}
                                  onChange={(event) =>
                                    updateService(service.key, { name: event.target.value })
                                  }
                                  placeholder={`Название услуги ${index + 1}`}
                                  aria-label={`Название услуги ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeService(service.key)}
                                  className="rounded-lg p-2 text-muted transition hover:bg-white hover:text-danger"
                                  aria-label={`Удалить услугу ${index + 1}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_120px_150px] gap-2">
                                <Select
                                  value={service.categoryKey}
                                  onChange={(event) =>
                                    updateService(service.key, {
                                      categoryKey: event.target.value,
                                    })
                                  }
                                  aria-label={`Категория услуги ${index + 1}`}
                                >
                                  <option value="">Категория</option>
                                  {categories.map((category) => (
                                    <option key={category.key} value={category.key}>
                                      {category.name.trim() || 'Без названия'}
                                    </option>
                                  ))}
                                </Select>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={50}
                                    value={service.price}
                                    onChange={(event) =>
                                      updateService(service.key, { price: event.target.value })
                                    }
                                    placeholder="Цена, ₽"
                                    aria-label={`Цена услуги ${index + 1}`}
                                    className="pr-7"
                                  />
                                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                                    ₽
                                  </span>
                                </div>
                                <Select
                                  value={service.durationMin}
                                  onChange={(event) =>
                                    updateService(service.key, {
                                      durationMin: Number(event.target.value),
                                    })
                                  }
                                  aria-label={`Длительность услуги ${index + 1}`}
                                >
                                  {SERVICE_DURATIONS.map((minutes) => (
                                    <option key={minutes} value={minutes}>
                                      {formatServiceDuration(minutes)}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-primary-faint px-4 py-3 text-[10px] leading-4 text-[#4E5C65]">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" />
                    Услуги из прайса будут доступны всем специалистам. Стоимость и длительность
                    можно изменить в любой момент.
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary-faint px-4 py-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <Check size={22} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="text-[14px] font-extrabold text-ink">
                        Всё готово к первому рабочему дню
                      </div>
                      <div className="mt-0.5 text-[11px] leading-4 text-muted">
                        Настройки сохранятся в локальной базе на этом компьютере.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <SummaryTile
                      icon={<Store size={15} />}
                      label="Студия"
                      value={studioName.trim() || 'Не указана'}
                      hint={address.trim() || 'Адрес не указан'}
                    />
                    <SummaryTile
                      icon={<Clock3 size={15} />}
                      label="Рабочие часы"
                      value={`${workdayStart}–${workdayEnd}`}
                      hint="Ежедневно"
                    />
                    <SummaryTile
                      icon={<Users size={15} />}
                      label="Команда"
                      value={
                        filledSpecialists.length > 0
                          ? `${filledSpecialists.length} ${specialistWord(filledSpecialists.length)}`
                          : 'Не добавлена'
                      }
                      hint={
                        filledSpecialists.length > 0
                          ? filledSpecialists.map((specialist) => specialist.name.trim()).join(', ')
                          : 'Добавьте специалиста'
                      }
                    />
                    <SummaryTile
                      icon={<Scissors size={15} />}
                      label="Прайс"
                      value={
                        filledServices.length > 0
                          ? `${filledServices.length} ${serviceWord(filledServices.length)}`
                          : 'Пока пуст'
                      }
                      hint={
                        filledCategories.length > 0
                          ? `${filledCategories.length} ${categoryWord(filledCategories.length)}`
                          : 'Добавьте услуги позже'
                      }
                    />
                  </div>

                  {filledServices.length > 0 && (
                    <div className="rounded-xl border border-line">
                      <div className="border-b border-line px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                        Услуги в прайсе
                      </div>
                      <div className="max-h-[170px] overflow-y-auto p-2">
                        {filledServices.map((service) => {
                          const category = categories.find(
                            (item) => item.key === service.categoryKey,
                          );
                          return (
                            <div
                              key={service.key}
                              className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                            >
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink">
                                {service.name.trim()}
                              </span>
                              <span className="shrink-0 text-[10px] text-muted">
                                {category?.name.trim() || 'Без категории'} ·{' '}
                                {service.durationMin} мин
                              </span>
                              <span className="w-[80px] shrink-0 text-right text-[11px] font-bold tabular-nums text-ink">
                                {formatRub(Number(service.price) || 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filledServices.length === 0 && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-[#FBFCFB] px-4 py-3">
                      <Sparkles size={15} className="mt-0.5 shrink-0 text-primary" />
                      <div className="text-[10px] leading-4 text-muted">
                        <span className="font-bold text-ink">Прайс пока пуст.</span> Услугу можно
                        добавить в разделе «Услуги» или прямо из карточки записи в расписании.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-line bg-[#FBFCFB] px-7 py-4">
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <Button variant="ghost" onClick={goBack} disabled={saving}>
                    <ArrowLeft size={14} />
                    Назад
                  </Button>
                )}
                {canSkipPricing && (
                  <Button variant="ghost" onClick={skipPricing} disabled={saving}>
                    Пропустить прайс
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLast ? (
                  <Button onClick={finish} disabled={saving}>
                    {saving ? 'Сохраняем…' : 'Начать работу'}
                    {!saving && <ArrowRight size={15} />}
                  </Button>
                ) : (
                  <Button onClick={goNext}>
                    Продолжить
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </footer>
          </section>
        </div>

        <div className="mt-4 text-center text-[10px] text-muted">
          {currentStep.title} · шаг {step + 1} из {STEPS.length}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-[#FBFCFB] p-3.5">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 truncate text-[13px] font-extrabold text-ink">{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted">{hint}</div>
    </div>
  );
}

function specialistWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'специалист';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'специалиста';
  return 'специалистов';
}

function serviceWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'услуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'услуги';
  return 'услуг';
}

function categoryWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'категория';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'категории';
  return 'категорий';
}
