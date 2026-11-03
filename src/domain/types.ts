export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

export const APPOINTMENT_STATUS_ORDER: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

export interface Settings {
  id: 'app';
  studioName: string;
  address: string;
  phone: string;
  workdayStart: string;
  workdayEnd: string;
  weekStart: 'monday';
  lastBackupAt?: string;
}

export interface Specialist {
  id: string;
  name: string;
  role: string;
  color: string;
  active: boolean;
  serviceIds: string[];
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Service {
  id: string;
  categoryId: string;
  name: string;
  durationMin: number;
  priceRub: number;
  costRub?: number;
  description?: string;
  specialistIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  email?: string;
  birthday?: string;
  comment?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  specialistId: string;
  date: string;
  startTime: string;
  durationMin: number;
  status: AppointmentStatus;
  comment?: string;
  totalRub: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentService {
  id: string;
  appointmentId: string;
  serviceId: string;
  nameSnapshot: string;
  priceRub: number;
  costRub?: number;
  durationMin: number;
  quantity?: number;
}

export interface AppointmentLineInput {
  serviceId: string;
  nameSnapshot: string;
  priceRub: number;
  costRub?: number;
  durationMin: number;
  quantity?: number;
}

export interface AppointmentInput {
  id?: string;
  clientId: string;
  specialistId: string;
  date: string;
  startTime: string;
  /** Фактическая длительность. Если не указана — сумма длительностей услуг. */
  durationMin?: number;
  status: AppointmentStatus;
  comment?: string;
  services: AppointmentLineInput[];
}

export interface AppointmentWithDetails extends Appointment {
  client: Client | undefined;
  specialist: Specialist | undefined;
  services: AppointmentService[];
}

export interface ServiceWithMeta extends Service {
  category: Category | undefined;
  specialists: Specialist[];
  usageCount: number;
}

export interface ClientWithMeta extends Client {
  visitsCount: number;
  lastVisit?: string;
  totalSpentRub: number;
}

export const STATUS_TONE: Record<
  AppointmentStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  pending: {
    bg: 'bg-warning-soft',
    border: 'border-l-warning',
    text: 'text-[#8A5A12]',
    dot: 'bg-warning',
  },
  confirmed: {
    bg: 'bg-primary-soft',
    border: 'border-l-primary',
    text: 'text-primary-dark',
    dot: 'bg-primary',
  },
  completed: {
    bg: 'bg-[#F1F4F2]',
    border: 'border-l-[#7C8B83]',
    text: 'text-[#4E5C55]',
    dot: 'bg-[#7C8B83]',
  },
  cancelled: {
    bg: 'bg-danger-soft',
    border: 'border-l-danger',
    text: 'text-danger',
    dot: 'bg-danger',
  },
  no_show: {
    bg: 'bg-[#F4F4F4]',
    border: 'border-l-[#9A9A9A]',
    text: 'text-[#666666]',
    dot: 'bg-[#9A9A9A]',
  },
};
