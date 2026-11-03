import Dexie, { type Table } from 'dexie';
import type {
  Appointment,
  AppointmentService,
  Category,
  Client,
  Service,
  Settings,
  Specialist,
} from '@/domain/types';

export class RitmDatabase extends Dexie {
  settings!: Table<Settings, string>;
  specialists!: Table<Specialist, string>;
  categories!: Table<Category, string>;
  services!: Table<Service, string>;
  clients!: Table<Client, string>;
  appointments!: Table<Appointment, string>;
  appointmentServices!: Table<AppointmentService, string>;

  constructor() {
    super('ritm-crm');

    this.version(1).stores({
      settings: 'id',
      specialists: 'id, active, name',
      categories: 'id, order',
      services: 'id, categoryId, active, name',
      clients: 'id, phoneNormalized, lastName, createdAt',
      appointments: 'id, date, specialistId, clientId, status, [date+specialistId]',
      appointmentServices: 'id, appointmentId, serviceId',
    });
  }
}

export const db = new RitmDatabase();
