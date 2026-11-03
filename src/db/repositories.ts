import { db } from '@/db/db';
import type {
  Appointment,
  AppointmentInput,
  AppointmentWithDetails,
  Category,
  Client,
  ClientWithMeta,
  Service,
  ServiceWithMeta,
  Settings,
  Specialist,
} from '@/domain/types';
import { nowIso, uid } from '@/lib/utils';
import { minutesFromTime } from '@/domain/date';
import { normalizePhone } from '@/domain/money';

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('app');
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put(settings);
}

export interface OnboardingInput {
  studioName: string;
  address: string;
  phone: string;
  workdayStart: string;
  workdayEnd: string;
  specialists: Array<{ name: string; role: string; color: string }>;
  categories: Array<{ name: string }>;
  services: Array<{
    name: string;
    categoryIndex: number;
    priceRub: number;
    durationMin: number;
  }>;
}

/**
 * Сохраняет результат мастера первого запуска одной транзакцией.
 * Услуги автоматически становятся доступны всем добавленным специалистам.
 */
export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const now = nowIso();
  const specialists = input.specialists
    .map((specialist) => ({
      id: uid('sp'),
      name: specialist.name.trim(),
      role: specialist.role.trim() || 'Мастер',
      color: specialist.color,
      active: true,
      serviceIds: [] as string[],
    }))
    .filter((specialist) => specialist.name.length > 0);

  if (specialists.length === 0) {
    throw new Error('Добавьте хотя бы одного специалиста');
  }

  const categories = input.categories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0)
    .map((name, index) => ({ id: uid('cat'), name, order: index + 1 }));

  const services = input.services.map((service) => {
    const category = categories[service.categoryIndex];
    if (!category) {
      throw new Error(`Выберите категорию для услуги «${service.name.trim()}»`);
    }
    if (!service.name.trim() || service.priceRub <= 0 || service.durationMin <= 0) {
      throw new Error('Проверьте название, цену и длительность услуг');
    }
    return {
      id: uid('svc'),
      categoryId: category.id,
      name: service.name.trim(),
      durationMin: service.durationMin,
      priceRub: Math.round(service.priceRub),
      specialistIds: specialists.map((specialist) => specialist.id),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  });

  const serviceIds = services.map((service) => service.id);
  const specialistRows = specialists.map((specialist) => ({
    ...specialist,
    serviceIds,
  }));

  await db.transaction(
    'rw',
    [db.settings, db.specialists, db.categories, db.services],
    async () => {
      await db.settings.put({
        id: 'app',
        studioName: input.studioName.trim(),
        address: input.address.trim(),
        phone: input.phone.trim(),
        workdayStart: input.workdayStart,
        workdayEnd: input.workdayEnd,
        weekStart: 'monday',
      });
      await db.categories.bulkPut(categories);
      await db.specialists.bulkPut(specialistRows);
      await db.services.bulkPut(services);
    },
  );
}

export interface PriceImportServiceRow {
  categoryName: string;
  name: string;
  priceRub: number;
  durationMin: number;
  costRub?: number;
  description?: string;
  specialistNames: string[];
}

export interface PriceImportOptions {
  hasCostColumn: boolean;
  hasDescriptionColumn: boolean;
  hasSpecialistColumn: boolean;
}

export interface PriceImportResult {
  totalRows: number;
  createdServices: number;
  updatedServices: number;
  createdCategories: number;
  createdSpecialists: number;
}

const IMPORT_SPECIALIST_COLORS = [
  '#376451',
  '#8A6D3B',
  '#5E718A',
  '#8A4F63',
  '#5C6B3D',
  '#7A5C8A',
];

function importLookup(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

/**
 * Импортирует прайс из Excel. Категории и специалисты создаются по имени,
 * услуги с совпадающей категорией и названием обновляются.
 */
export async function importPriceList(
  rows: PriceImportServiceRow[],
  options: PriceImportOptions,
): Promise<PriceImportResult> {
  const prepared = rows.map((row) => ({
    ...row,
    categoryName: row.categoryName.trim(),
    name: row.name.trim(),
    description: row.description?.trim() || undefined,
    specialistNames: row.specialistNames.map((name) => name.trim()).filter(Boolean),
  }));

  for (const row of prepared) {
    if (!row.categoryName || !row.name) {
      throw new Error('В импорте есть услуга без категории или названия');
    }
    if (!Number.isFinite(row.priceRub) || row.priceRub <= 0) {
      throw new Error(`Укажите цену больше нуля для услуги «${row.name}»`);
    }
    if (!Number.isFinite(row.durationMin) || row.durationMin <= 0) {
      throw new Error(`Укажите время для услуги «${row.name}»`);
    }
    if (row.costRub != null && (!Number.isFinite(row.costRub) || row.costRub < 0)) {
      throw new Error(`Проверьте себестоимость услуги «${row.name}»`);
    }
  }

  if (prepared.length === 0) {
    throw new Error('Нет услуг для импорта');
  }

  const now = nowIso();

  return db.transaction('rw', [db.categories, db.specialists, db.services], async () => {
    const [existingCategories, existingSpecialists, existingServices] = await Promise.all([
      db.categories.orderBy('order').toArray(),
      db.specialists.toArray(),
      db.services.toArray(),
    ]);

    const categories = [...existingCategories];
    const specialists = [...existingSpecialists];
    const servicesToPut = new Map<string, Service>();
    const categoryByName = new Map<string, Category>();
    const specialistByName = new Map<string, Specialist>();
    const serviceByKey = new Map<string, Service>();
    const createdCategories: Category[] = [];
    const createdSpecialists: Specialist[] = [];

    let nextCategoryOrder =
      categories.reduce((max, category) => Math.max(max, category.order), 0) + 1;

    for (const category of categories) {
      categoryByName.set(importLookup(category.name), category);
    }
    for (const specialist of specialists) {
      specialistByName.set(importLookup(specialist.name), specialist);
    }
    for (const service of existingServices) {
      const key = `${service.categoryId}|${importLookup(service.name)}`;
      if (!serviceByKey.has(key)) serviceByKey.set(key, service);
    }

    function ensureCategory(name: string): Category {
      const key = importLookup(name);
      const existing = categoryByName.get(key);
      if (existing) return existing;
      const category: Category = {
        id: uid('cat'),
        name,
        order: nextCategoryOrder,
      };
      nextCategoryOrder += 1;
      categories.push(category);
      createdCategories.push(category);
      categoryByName.set(key, category);
      return category;
    }

    function ensureSpecialist(name: string): Specialist {
      const key = importLookup(name);
      const existing = specialistByName.get(key);
      if (existing) return existing;
      const specialist: Specialist = {
        id: uid('sp'),
        name,
        role: 'Мастер',
        color:
          IMPORT_SPECIALIST_COLORS[specialists.length % IMPORT_SPECIALIST_COLORS.length],
        active: true,
        serviceIds: [],
      };
      specialists.push(specialist);
      createdSpecialists.push(specialist);
      specialistByName.set(key, specialist);
      return specialist;
    }

    const uniqueRows = new Map<string, (typeof prepared)[number]>();
    for (const row of prepared) {
      const key = `${importLookup(row.categoryName)}|${importLookup(row.name)}`;
      uniqueRows.delete(key);
      uniqueRows.set(key, row);
    }

    let createdServices = 0;
    let updatedServices = 0;

    for (const row of uniqueRows.values()) {
      const category = ensureCategory(row.categoryName);
      const rowSpecialists = row.specialistNames.map(ensureSpecialist);
      const specialistIds = rowSpecialists.map((specialist) => specialist.id);
      const key = `${category.id}|${importLookup(row.name)}`;
      const existing = serviceByKey.get(key);

      if (existing) {
        const next: Service = {
          ...existing,
          name: row.name,
          categoryId: category.id,
          priceRub: Math.round(row.priceRub),
          durationMin: Math.round(row.durationMin),
          costRub: options.hasCostColumn
            ? row.costRub != null
              ? Math.round(row.costRub)
              : undefined
            : existing.costRub,
          description: options.hasDescriptionColumn
            ? row.description
            : existing.description,
          specialistIds: options.hasSpecialistColumn
            ? specialistIds
            : existing.specialistIds,
          updatedAt: now,
        };
        servicesToPut.set(next.id, next);
        serviceByKey.set(key, next);
        updatedServices += 1;
      } else {
        const next: Service = {
          id: uid('svc'),
          categoryId: category.id,
          name: row.name,
          durationMin: Math.round(row.durationMin),
          priceRub: Math.round(row.priceRub),
          ...(options.hasCostColumn && row.costRub != null
            ? { costRub: Math.round(row.costRub) }
            : {}),
          ...(options.hasDescriptionColumn && row.description
            ? { description: row.description }
            : {}),
          specialistIds: options.hasSpecialistColumn
            ? specialistIds
            : specialists
                .filter((specialist) => specialist.active)
                .map((specialist) => specialist.id),
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        servicesToPut.set(next.id, next);
        serviceByKey.set(key, next);
        createdServices += 1;
      }
    }

    const finalServices = existingServices.map(
      (service) => servicesToPut.get(service.id) ?? service,
    );
    for (const service of servicesToPut.values()) {
      if (!existingServices.some((existing) => existing.id === service.id)) {
        finalServices.push(service);
      }
    }

    const finalSpecialists = specialists.map((specialist) => ({
      ...specialist,
      serviceIds: finalServices
        .filter((service) => service.specialistIds.includes(specialist.id))
        .map((service) => service.id),
    }));

    await db.categories.bulkPut(createdCategories);
    await db.services.bulkPut([...servicesToPut.values()]);
    await db.specialists.bulkPut(finalSpecialists);

    return {
      totalRows: uniqueRows.size,
      createdServices,
      updatedServices,
      createdCategories: createdCategories.length,
      createdSpecialists: createdSpecialists.length,
    };
  });
}

export async function listSpecialists(): Promise<Specialist[]> {
  return db.specialists.orderBy('name').toArray();
}

export async function listActiveSpecialists(): Promise<Specialist[]> {
  return db.specialists.filter((specialist) => specialist.active).toArray();
}

export async function listCategories() {
  return db.categories.orderBy('order').toArray();
}

export type CategoryInput = { id?: string; name: string; order?: number };

export async function saveCategory(input: CategoryInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Название категории обязательно');
  if (input.id) {
    const existing = await db.categories.get(input.id);
    if (!existing) throw new Error('Категория не найдена');
    await db.categories.put({ ...existing, name });
    return input.id;
  }
  const count = await db.categories.count();
  const id = uid('cat');
  await db.categories.put({ id, name, order: input.order ?? count + 1 });
  return id;
}

export async function deleteCategory(id: string): Promise<void> {
  const used = await db.services.where('categoryId').equals(id).count();
  if (used > 0) {
    throw new Error('В категории есть услуги. Сначала перенесите их в другую категорию.');
  }
  await db.categories.delete(id);
}

export type SpecialistInput = {
  id?: string;
  name: string;
  role: string;
  color: string;
  active: boolean;
  serviceIds: string[];
};

export async function saveSpecialist(input: SpecialistInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Имя специалиста обязательно');
  const id = input.id ?? uid('sp');
  const now = nowIso();
  await db.transaction('rw', [db.specialists, db.services], async () => {
    await db.specialists.put({
      id,
      name,
      role: input.role.trim() || 'Мастер',
      color: input.color,
      active: input.active,
      serviceIds: input.serviceIds,
    });
    const services = await db.services.toArray();
    for (const service of services) {
      const shouldInclude = input.serviceIds.includes(service.id);
      const has = service.specialistIds.includes(id);
      if (shouldInclude === has) continue;
      const specialistIds = shouldInclude
        ? [...service.specialistIds, id]
        : service.specialistIds.filter((item) => item !== id);
      await db.services.put({ ...service, specialistIds, updatedAt: now });
    }
  });
  return id;
}

export async function setSpecialistActive(id: string, active: boolean): Promise<void> {
  await db.specialists.update(id, { active });
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.settings,
      db.specialists,
      db.categories,
      db.services,
      db.clients,
      db.appointments,
      db.appointmentServices,
    ],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.specialists.clear(),
        db.categories.clear(),
        db.services.clear(),
        db.clients.clear(),
        db.appointments.clear(),
        db.appointmentServices.clear(),
      ]);
    },
  );
}

export async function listServices(): Promise<Service[]> {
  return db.services.orderBy('name').toArray();
}

export async function listServicesWithMeta(): Promise<ServiceWithMeta[]> {
  const [services, categories, specialists, lines] = await Promise.all([
    db.services.orderBy('name').toArray(),
    db.categories.orderBy('order').toArray(),
    db.specialists.toArray(),
    db.appointmentServices.toArray(),
  ]);
  const usage = new Map<string, number>();
  for (const line of lines) {
    usage.set(line.serviceId, (usage.get(line.serviceId) ?? 0) + 1);
  }
  return services.map((service) => ({
    ...service,
    category: categories.find((category) => category.id === service.categoryId),
    specialists: specialists.filter((specialist) =>
      service.specialistIds.includes(specialist.id),
    ),
    usageCount: usage.get(service.id) ?? 0,
  }));
}

export type ServiceInput = Omit<Service, 'createdAt' | 'updatedAt' | 'id'> & { id?: string };

export async function saveService(input: ServiceInput): Promise<string> {
  const now = nowIso();
  if (input.id) {
    const existing = await db.services.get(input.id);
    if (!existing) throw new Error('Услуга не найдена');
    await db.services.put({
      ...existing,
      ...input,
      id: input.id,
      updatedAt: now,
    });
    return input.id;
  }
  const id = uid('svc');
  await db.services.put({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function setServiceActive(id: string, active: boolean): Promise<void> {
  await db.services.update(id, { active, updatedAt: nowIso() });
}

export async function deleteService(id: string): Promise<void> {
  const usage = await db.appointmentServices.where('serviceId').equals(id).count();
  if (usage > 0) {
    throw new Error('Услуга уже используется в записях. Её можно только архивировать.');
  }
  await db.services.delete(id);
}

export async function listClients(): Promise<Client[]> {
  return db.clients.orderBy('lastName').toArray();
}

export async function listClientsWithMeta(): Promise<ClientWithMeta[]> {
  const [clients, appointments] = await Promise.all([
    db.clients.orderBy('lastName').toArray(),
    db.appointments.toArray(),
  ]);
  return clients.map((client) => {
    const own = appointments.filter(
      (appointment) =>
        appointment.clientId === client.id && appointment.status === 'completed',
    );
    const lastVisit = own
      .map((appointment) => appointment.date)
      .sort()
      .at(-1);
    return {
      ...client,
      visitsCount: own.length,
      lastVisit,
      totalSpentRub: own.reduce((sum, appointment) => sum + appointment.totalRub, 0),
    };
  });
}

export type ClientInput = Omit<Client, 'createdAt' | 'updatedAt' | 'phoneNormalized' | 'id'> & {
  id?: string;
};

export async function saveClient(input: ClientInput): Promise<string> {
  const now = nowIso();
  const phoneNormalized = normalizePhone(input.phone);
  if (input.id) {
    const existing = await db.clients.get(input.id);
    if (!existing) throw new Error('Клиент не найден');
    await db.clients.put({
      ...existing,
      ...input,
      id: input.id,
      phoneNormalized,
      updatedAt: now,
    });
    return input.id;
  }
  const id = uid('client');
  await db.clients.put({
    ...input,
    id,
    phoneNormalized,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function searchClients(query: string, limit = 8): Promise<Client[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return db.clients.limit(limit).toArray();
  const digits = normalizePhone(normalized);
  const all = await db.clients.toArray();
  return all
    .filter((client) => {
      const name = `${client.firstName} ${client.lastName}`.toLowerCase();
      return (
        name.includes(normalized) ||
        client.phoneNormalized.includes(digits) ||
        (client.email ?? '').toLowerCase().includes(normalized) ||
        (client.comment ?? '').toLowerCase().includes(normalized) ||
        (client.notes ?? '').toLowerCase().includes(normalized)
      );
    })
    .slice(0, limit);
}

export async function getAppointmentsForDate(date: string): Promise<AppointmentWithDetails[]> {
  const [appointments, clients, specialists, lines] = await Promise.all([
    db.appointments.where('date').equals(date).toArray(),
    db.clients.toArray(),
    db.specialists.toArray(),
    db.appointmentServices.toArray(),
  ]);
  return appointments
    .map((appointment) => ({
      ...appointment,
      client: clients.find((client) => client.id === appointment.clientId),
      specialist: specialists.find(
        (specialist) => specialist.id === appointment.specialistId,
      ),
      services: lines.filter((line) => line.appointmentId === appointment.id),
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function getAppointmentsForRange(
  from: string,
  to: string,
): Promise<AppointmentWithDetails[]> {
  const [appointments, clients, specialists, lines] = await Promise.all([
    db.appointments.where('date').between(from, to, true, true).toArray(),
    db.clients.toArray(),
    db.specialists.toArray(),
    db.appointmentServices.toArray(),
  ]);
  return appointments.map((appointment) => ({
    ...appointment,
    client: clients.find((client) => client.id === appointment.clientId),
    specialist: specialists.find(
      (specialist) => specialist.id === appointment.specialistId,
    ),
    services: lines.filter((line) => line.appointmentId === appointment.id),
  }));
}

export async function getAppointmentDetails(
  id: string,
): Promise<AppointmentWithDetails | undefined> {
  const appointment = await db.appointments.get(id);
  if (!appointment) return undefined;
  const [client, specialist, services] = await Promise.all([
    db.clients.get(appointment.clientId),
    db.specialists.get(appointment.specialistId),
    db.appointmentServices.where('appointmentId').equals(id).toArray(),
  ]);
  return { ...appointment, client, specialist, services };
}

export async function getClientAppointments(
  clientId: string,
): Promise<AppointmentWithDetails[]> {
  const appointments = await db.appointments.where('clientId').equals(clientId).toArray();
  const [specialists, lines] = await Promise.all([
    db.specialists.toArray(),
    db.appointmentServices.toArray(),
  ]);
  return appointments
    .map((appointment) => ({
      ...appointment,
      client: undefined,
      specialist: specialists.find(
        (specialist) => specialist.id === appointment.specialistId,
      ),
      services: lines.filter((line) => line.appointmentId === appointment.id),
    }))
    .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
}

export async function findConflictingAppointment(params: {
  id?: string;
  date: string;
  specialistId: string;
  startTime: string;
  durationMin: number;
}): Promise<Appointment | undefined> {
  const appointments = await db.appointments
    .where('[date+specialistId]')
    .equals([params.date, params.specialistId])
    .toArray();
  const from = minutesFromTime(params.startTime);
  const to = from + params.durationMin;
  return appointments.find((appointment) => {
    if (appointment.id === params.id) return false;
    if (appointment.status === 'cancelled') return false;
    const otherFrom = minutesFromTime(appointment.startTime);
    const otherTo = otherFrom + appointment.durationMin;
    return from < otherTo && to > otherFrom;
  });
}

export async function saveAppointment(input: AppointmentInput): Promise<string> {
  if (input.services.length === 0) {
    throw new Error('Добавьте хотя бы одну услугу');
  }
  const durationMin = input.services.reduce((sum, line) => sum + line.durationMin, 0);
  const totalRub = input.services.reduce((sum, line) => sum + line.priceRub, 0);

  const conflict = await findConflictingAppointment({
    id: input.id,
    date: input.date,
    specialistId: input.specialistId,
    startTime: input.startTime,
    durationMin,
  });
  if (conflict) {
    throw new Error(
      `У специалиста уже есть запись в ${conflict.startTime}. Выберите другое время.`,
    );
  }

  const now = nowIso();
  const appointmentId = input.id ?? uid('apt');

  await db.transaction('rw', [db.appointments, db.appointmentServices], async () => {
    const existing = input.id ? await db.appointments.get(input.id) : undefined;
    const appointment: Appointment = {
      id: appointmentId,
      clientId: input.clientId,
      specialistId: input.specialistId,
      date: input.date,
      startTime: input.startTime,
      durationMin,
      status: input.status,
      comment: input.comment,
      totalRub,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.appointments.put(appointment);
    if (input.id) {
      await db.appointmentServices.where('appointmentId').equals(input.id).delete();
    }
    await db.appointmentServices.bulkPut(
      input.services.map((line, index) => ({
        id: `aps-${appointmentId}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
        appointmentId,
        serviceId: line.serviceId,
        nameSnapshot: line.nameSnapshot,
        priceRub: line.priceRub,
        costRub: line.costRub,
        durationMin: line.durationMin,
      })),
    );
  });

  return appointmentId;
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment['status'],
): Promise<void> {
  await db.appointments.update(id, { status, updatedAt: nowIso() });
}

export async function cancelAppointment(id: string): Promise<void> {
  await updateAppointmentStatus(id, 'cancelled');
}

export async function getDaySummary(date: string) {
  const appointments = await db.appointments.where('date').equals(date).toArray();
  const active = appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' && appointment.status !== 'no_show',
  );
  return {
    count: active.length,
    plannedRevenue: active.reduce((sum, appointment) => sum + appointment.totalRub, 0),
    specialists: new Set(active.map((appointment) => appointment.specialistId)).size,
  };
}

export async function getMonthSummary(from: string, to: string) {
  const appointments = await db.appointments
    .where('date')
    .between(from, to, true, true)
    .toArray();
  const active = appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' && appointment.status !== 'no_show',
  );
  return {
    count: active.length,
    plannedRevenue: active.reduce((sum, appointment) => sum + appointment.totalRub, 0),
    specialists: new Set(active.map((appointment) => appointment.specialistId)).size,
  };
}

export async function countAppointments(): Promise<number> {
  return db.appointments.count();
}

export async function exportSnapshot() {
  const [
    settings,
    specialists,
    categories,
    services,
    clients,
    appointments,
    appointmentServices,
  ] = await Promise.all([
    db.settings.toArray(),
    db.specialists.toArray(),
    db.categories.toArray(),
    db.services.toArray(),
    db.clients.toArray(),
    db.appointments.toArray(),
    db.appointmentServices.toArray(),
  ]);
  return {
    app: 'ritm-crm',
    version: 1,
    exportedAt: nowIso(),
    data: {
      settings,
      specialists,
      categories,
      services,
      clients,
      appointments,
      appointmentServices,
    },
  };
}

export async function importSnapshot(snapshot: Awaited<ReturnType<typeof exportSnapshot>>) {
  if (snapshot?.app !== 'ritm-crm' || snapshot.version !== 1) {
    throw new Error('Неизвестный формат резервной копии');
  }
  await db.transaction(
    'rw',
    [
      db.settings,
      db.specialists,
      db.categories,
      db.services,
      db.clients,
      db.appointments,
      db.appointmentServices,
    ],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.specialists.clear(),
        db.categories.clear(),
        db.services.clear(),
        db.clients.clear(),
        db.appointments.clear(),
        db.appointmentServices.clear(),
      ]);
      await db.settings.bulkPut(snapshot.data.settings);
      await db.specialists.bulkPut(snapshot.data.specialists);
      await db.categories.bulkPut(snapshot.data.categories);
      await db.services.bulkPut(snapshot.data.services);
      await db.clients.bulkPut(snapshot.data.clients);
      await db.appointments.bulkPut(snapshot.data.appointments);
      await db.appointmentServices.bulkPut(snapshot.data.appointmentServices);
    },
  );
}

