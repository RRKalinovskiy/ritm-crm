import { db } from '@/db/db';
import type {
  Appointment,
  AppointmentService,
  Category,
  Client,
  Service,
  Settings,
  Specialist,
} from '@/domain/types';
import { minutesFromTime, toDateKey } from '@/domain/date';
import { normalizePhone } from '@/domain/money';

const CREATED = '2026-01-10T10:00:00.000Z';

export const DEMO_SETTINGS: Settings = {
  id: 'app',
  studioName: 'Студия «Форма»',
  address: 'Москва, ул. Лесная, 12',
  phone: '+7 (495) 120-45-67',
  workdayStart: '09:00',
  workdayEnd: '18:00',
  weekStart: 'monday',
  demoMode: true,
};

export const DEMO_SPECIALISTS: Specialist[] = [
  {
    id: 'sp-anna',
    name: 'Анна Сидорова',
    role: 'Топ-мастер',
    color: '#376451',
    active: true,
    serviceIds: ['svc-women-haircut', 'svc-coloring', 'svc-styling', 'svc-hair-care'],
  },
  {
    id: 'sp-maria',
    name: 'Мария Фомина',
    role: 'Мастер',
    color: '#8A6D3B',
    active: true,
    serviceIds: ['svc-women-haircut', 'svc-men-haircut', 'svc-styling', 'svc-hair-care'],
  },
  {
    id: 'sp-olga',
    name: 'Ольга Соколова',
    role: 'Мастер',
    color: '#5E718A',
    active: true,
    serviceIds: ['svc-manicure', 'svc-pedicure', 'svc-brows'],
  },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-hair', name: 'Волосы', order: 1 },
  { id: 'cat-nails', name: 'Ногти', order: 2 },
  { id: 'cat-brows', name: 'Брови', order: 3 },
];

export const DEMO_SERVICES: Service[] = [
  {
    id: 'svc-women-haircut',
    categoryId: 'cat-hair',
    name: 'Женская стрижка',
    description: 'Стрижка любой сложности, укладка включена',
    durationMin: 60,
    priceRub: 2200,
    costRub: 700,
    specialistIds: ['sp-anna', 'sp-maria'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-men-haircut',
    categoryId: 'cat-hair',
    name: 'Мужская стрижка',
    description: 'Классическая или модельная стрижка',
    durationMin: 45,
    priceRub: 2000,
    costRub: 600,
    specialistIds: ['sp-maria'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-coloring',
    categoryId: 'cat-hair',
    name: 'Окрашивание волос',
    description: 'Однотонное окрашивание, уход после',
    durationMin: 120,
    priceRub: 6500,
    costRub: 2200,
    specialistIds: ['sp-anna'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-styling',
    categoryId: 'cat-hair',
    name: 'Укладка волос',
    description: 'Брашинг, локоны или гладкая укладка',
    durationMin: 30,
    priceRub: 1400,
    costRub: 400,
    specialistIds: ['sp-anna', 'sp-maria'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-manicure',
    categoryId: 'cat-nails',
    name: 'Маникюр с покрытием',
    description: 'Аппаратный маникюр и гель-лак',
    durationMin: 90,
    priceRub: 2900,
    costRub: 900,
    specialistIds: ['sp-olga'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-pedicure',
    categoryId: 'cat-nails',
    name: 'Педикюр с покрытием',
    description: 'Обработка стоп и гель-лак',
    durationMin: 90,
    priceRub: 3500,
    costRub: 1100,
    specialistIds: ['sp-olga'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-brows',
    categoryId: 'cat-brows',
    name: 'Коррекция и окрашивание брови',
    description: 'Коррекция формы и окрашивание',
    durationMin: 60,
    priceRub: 1800,
    costRub: 500,
    specialistIds: ['sp-olga'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    id: 'svc-hair-care',
    categoryId: 'cat-hair',
    name: 'Уход для волос',
    description: 'Восстанавливающая маска и уход',
    durationMin: 30,
    priceRub: 1500,
    costRub: 400,
    specialistIds: ['sp-anna', 'sp-maria'],
    active: true,
    createdAt: CREATED,
    updatedAt: CREATED,
  },
];

const CLIENT_NAMES = [
  'Анна Морозова',
  'Ольга Никитина',
  'Екатерина Белова',
  'Марина Орлова',
  'Дарья Климова',
  'София Павлова',
  'Виктория Лебедева',
  'Ирина Соколова',
  'Юлия Алексеева',
  'Алина Морозова',
  'Елена Кузнецова',
  'Полина Орлова',
  'Ксения Смирнова',
  'Наталья Волкова',
  'Татьяна Соколова',
  'Светлана Иванова',
  'Анастасия Петрова',
  'Екатерина Смирнова',
  'Мария Кузнецова',
  'Ольга Попова',
  'Вера Николаева',
  'Лидия Фёдорова',
  'Галина Михайлова',
  'Зоя Андреева',
  'Нина Алексеева',
  'Раиса Павлова',
  'Тамара Семёнова',
  'Людмила Григорьева',
  'Валентина Борисова',
  'Евгения Титова',
];

const CLIENTS: Client[] = CLIENT_NAMES.map((fullName, index) => {
  const [firstName, lastName] = fullName.split(' ');
  const code = String(900 + index).padStart(3, '0');
  const phone = `+7 (${code}) ${String(100 + index).slice(0, 3)}-${String(10 + index).padStart(2, '0')}-${String(20 + index).padStart(2, '0')}`;
  return {
    id: `client-${index + 1}`,
    firstName,
    lastName,
    phone,
    phoneNormalized: normalizePhone(phone),
    email: index % 4 === 0 ? `client${index + 1}@example.ru` : undefined,
    notes: index === 0 ? 'Постоянный клиент, любит укладку без запаха.' : undefined,
    createdAt: `2026-0${(index % 5) + 1}-1${index % 9}T10:00:00.000Z`,
    updatedAt: CREATED,
  };
});

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260618);

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function makeLines(
  appointmentId: string,
  services: Service[],
): { lines: AppointmentService[]; total: number; duration: number } {
  const lines = services.map((service, index) => ({
    id: `aps-${appointmentId}-${index + 1}`,
    appointmentId,
    serviceId: service.id,
    nameSnapshot: service.name,
    priceRub: service.priceRub,
    costRub: service.costRub,
    durationMin: service.durationMin,
  }));
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.priceRub, 0),
    duration: lines.reduce((sum, line) => sum + line.durationMin, 0),
  };
}

function statusForDate(dateKey: string): Appointment['status'] {
  const demoKey = toDateKey(new Date(2026, 5, 18));
  if (dateKey < demoKey) {
    const r = rand();
    if (r < 0.06) return 'cancelled';
    if (r < 0.1) return 'no_show';
    return r < 0.72 ? 'completed' : 'confirmed';
  }
  if (dateKey === demoKey) {
    return rand() < 0.25 ? 'pending' : 'confirmed';
  }
  const r = rand();
  if (r < 0.06) return 'cancelled';
  return r < 0.48 ? 'pending' : 'confirmed';
}

function serviceOptionsFor(specialistId: string): Service[] {
  return DEMO_SERVICES.filter(
    (service) => service.active && service.specialistIds.includes(specialistId),
  );
}

function findClientId(fullName: string): string {
  const client = CLIENTS.find(
    (item) => `${item.firstName} ${item.lastName}` === fullName,
  );
  return client?.id ?? CLIENTS[0].id;
}

let seedRun: Promise<void> | null = null;

export function seedDemoData(): Promise<void> {
  if (seedRun) return seedRun;
  seedRun = (async () => {
    const existing = await db.settings.count();
    if (existing > 0) return;

    const appointments: Appointment[] = [];
    const lines: AppointmentService[] = [];
    let counter = 0;

    const addAppointment = (
      dateKey: string,
      specialistId: string,
      startTime: string,
      clientId: string,
      services: Service[],
      status: Appointment['status'],
      comment?: string,
    ) => {
      counter += 1;
      const id = `apt-${String(counter).padStart(4, '0')}`;
      const { lines: nextLines, total, duration } = makeLines(id, services);
      appointments.push({
        id,
        clientId,
        specialistId,
        date: dateKey,
        startTime,
        durationMin: duration,
        status,
        comment,
        totalRub: total,
        createdAt: CREATED,
        updatedAt: CREATED,
      });
      lines.push(...nextLines);
    };

    const busy = new Map<string, Array<[number, number]>>();

    const isFree = (specialistId: string, dateKey: string, start: string, duration: number) => {
      const key = `${dateKey}:${specialistId}`;
      const slots = busy.get(key) ?? [];
      const from = minutesFromTime(start);
      const to = from + duration;
      return !slots.some(([a, b]) => from < b && to > a);
    };

    const markBusy = (specialistId: string, dateKey: string, start: string, duration: number) => {
      const key = `${dateKey}:${specialistId}`;
      const slots = busy.get(key) ?? [];
      const from = minutesFromTime(start);
      slots.push([from, from + duration]);
      busy.set(key, slots);
    };

    // 240 записей: по 8 на каждый день июня.
    for (let day = 1; day <= 30; day += 1) {
      const dateKey = `2026-06-${String(day).padStart(2, '0')}`;
      if (day === 18) {
        const fixed: Array<{
          sp: string;
          time: string;
          client: string;
          services: string[];
          status: Appointment['status'];
        }> = [
          { sp: 'sp-anna', time: '09:00', client: 'Анна Морозова', services: ['svc-women-haircut', 'svc-hair-care'], status: 'confirmed' },
          { sp: 'sp-anna', time: '11:00', client: 'Виктория Лебедева', services: ['svc-coloring'], status: 'pending' },
          { sp: 'sp-anna', time: '14:00', client: 'Ирина Соколова', services: ['svc-women-haircut', 'svc-styling'], status: 'confirmed' },
          { sp: 'sp-maria', time: '10:00', client: 'Екатерина Белова', services: ['svc-women-haircut'], status: 'confirmed' },
          { sp: 'sp-maria', time: '12:00', client: 'Марина Орлова', services: ['svc-styling'], status: 'pending' },
          { sp: 'sp-maria', time: '15:00', client: 'Полина Орлова', services: ['svc-men-haircut'], status: 'confirmed' },
          { sp: 'sp-olga', time: '12:00', client: 'Дарья Климова', services: ['svc-manicure'], status: 'confirmed' },
          { sp: 'sp-olga', time: '13:30', client: 'София Павлова', services: ['svc-pedicure'], status: 'confirmed' },
        ];
        for (const item of fixed) {
          const services = item.services
            .map((serviceId) => DEMO_SERVICES.find((service) => service.id === serviceId))
            .filter((service): service is Service => Boolean(service));
          const duration = services.reduce((sum, service) => sum + service.durationMin, 0);
          if (!isFree(item.sp, dateKey, item.time, duration)) continue;
          addAppointment(
            dateKey,
            item.sp,
            item.time,
            findClientId(item.client),
            services,
            item.status,
            item.sp === 'sp-anna' && item.time === '09:00'
              ? 'Постоянный клиент, предпочитает укладку без запаха.'
              : undefined,
          );
          markBusy(item.sp, dateKey, item.time, duration);
        }
        continue;
      }

      // 3 + 3 + 2 = 8 записей в день, распределённых по специалистам.
      const plan: Array<[string, number]> = [
        ['sp-anna', 3],
        ['sp-maria', 3],
        ['sp-olga', 2],
      ];

      for (const [specialistId, count] of plan) {
        const options = serviceOptionsFor(specialistId);
        for (let attempt = 0; attempt < count * 8; attempt += 1) {
          const placed = (busy.get(`${dateKey}:${specialistId}`) ?? []).length;
          if (placed >= count) break;
          const service = pick(options);
          const startMinute = 9 * 60 + Math.floor(rand() * 16) * 30;
          if (startMinute + service.durationMin > 18 * 60) continue;
          const startTime = `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
          if (!isFree(specialistId, dateKey, startTime, service.durationMin)) continue;
          const client = pick(CLIENTS);
          addAppointment(
            dateKey,
            specialistId,
            startTime,
            client.id,
            [service],
            statusForDate(dateKey),
          );
          markBusy(specialistId, dateKey, startTime, service.durationMin);
        }
      }
    }

    // Ещё 8 записей — добираем до 248.
    const extraDays = [3, 7, 11, 14, 21, 24, 27, 29];
    for (const day of extraDays) {
      const dateKey = `2026-06-${String(day).padStart(2, '0')}`;
      const specialistId = pick(DEMO_SPECIALISTS.map((specialist) => specialist.id));
      const options = serviceOptionsFor(specialistId);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const service = pick(options);
        const startMinute = 9 * 60 + Math.floor(rand() * 16) * 30;
        if (startMinute + service.durationMin > 18 * 60) continue;
        const startTime = `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
        if (!isFree(specialistId, dateKey, startTime, service.durationMin)) continue;
        addAppointment(
          dateKey,
          specialistId,
          startTime,
          pick(CLIENTS).id,
          [service],
          statusForDate(dateKey),
        );
        markBusy(specialistId, dateKey, startTime, service.durationMin);
        break;
      }
    }

    await db.transaction(
      'rw',
      [db.settings, db.specialists, db.categories, db.services, db.clients, db.appointments, db.appointmentServices],
      async () => {
        await db.settings.put(DEMO_SETTINGS);
        await db.specialists.bulkPut(DEMO_SPECIALISTS);
        await db.categories.bulkPut(DEMO_CATEGORIES);
        await db.services.bulkPut(DEMO_SERVICES);
        await db.clients.bulkPut(CLIENTS);
        await db.appointments.bulkPut(appointments);
        await db.appointmentServices.bulkPut(lines);
      },
    );
  })();
  return seedRun;
}

export { CLIENTS as DEMO_CLIENTS };
