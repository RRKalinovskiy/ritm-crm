import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import {
  getAppointmentsForRange,
  listActiveSpecialists,
  listServices,
} from '@/db/repositories';
import {
  DEMO_TODAY,
  addMonths,
  formatMonthYear,
  formatRuDate,
  startOfMonth,
} from '@/domain/date';
import { formatPercent, formatRub, pluralize } from '@/domain/money';
import type { AppointmentWithDetails, Specialist } from '@/domain/types';
import { cn } from '@/lib/utils';

interface Metrics {
  revenue: number;
  appointments: number;
  sold: number;
  average: number;
  profit: number | null;
}

export function StatisticsPage() {
  const { toast } = useToast();
  const [month, setMonth] = useState<Date>(startOfMonth(DEMO_TODAY));
  const [specialistId, setSpecialistId] = useState('all');
  const [serviceId, setServiceId] = useState('all');

  const specialists = useLiveQuery(() => listActiveSpecialists(), []);
  const services = useLiveQuery(() => listServices(), []);

  const range = useMemo(() => {
    const start = startOfMonth(month);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const prevStart = startOfMonth(addMonths(month, -1));
    const prevEnd = new Date(prevStart.getFullYear(), prevStart.getMonth() + 1, 0);
    return {
      from: key(start),
      to: key(end),
      prevFrom: key(prevStart),
      prevTo: key(prevEnd),
      start,
      end,
    };
  }, [month]);

  const appointments = useLiveQuery(
    () => getAppointmentsForRange(range.prevFrom, range.to),
    [range.prevFrom, range.to],
  );

  const all = appointments ?? [];

  const currentAppointments = useMemo(
    () =>
      all.filter(
        (appointment) =>
          appointment.date >= range.from &&
          appointment.date <= range.to &&
          matchesSpecialist(appointment, specialistId) &&
          matchesService(appointment, serviceId),
      ),
    [all, range.from, range.to, specialistId, serviceId],
  );

  const previousAppointments = useMemo(
    () =>
      all.filter(
        (appointment) =>
          appointment.date >= range.prevFrom &&
          appointment.date <= range.prevTo &&
          matchesSpecialist(appointment, specialistId) &&
          matchesService(appointment, serviceId),
      ),
    [all, range.prevFrom, range.prevTo, specialistId, serviceId],
  );

  const metrics = useMemo(
    () => computeMetrics(currentAppointments, serviceId),
    [currentAppointments, serviceId],
  );
  const prevMetrics = useMemo(
    () => computeMetrics(previousAppointments, serviceId),
    [previousAppointments, serviceId],
  );

  const weekly = useMemo(() => {
    const buckets = [0, 1, 2, 3, 4].map((index) => ({
      label: `${index * 7 + 1}–${Math.min(index * 7 + 7, range.end.getDate())}`,
      revenue: 0,
    }));
    for (const appointment of currentAppointments) {
      if (appointment.status !== 'completed') continue;
      const day = Number(appointment.date.slice(8, 10));
      const index = Math.min(Math.floor((day - 1) / 7), 4);
      buckets[index].revenue += appointmentRevenue(appointment, serviceId);
    }
    return buckets;
  }, [currentAppointments, serviceId, range.end]);

  const bySpecialist = useMemo(() => {
    const map = new Map<
      string,
      { id: string; specialist: Specialist | undefined; revenue: number; visits: number }
    >();
    for (const appointment of currentAppointments) {
      if (appointment.status !== 'completed') continue;
      const entry = map.get(appointment.specialistId) ?? {
        id: appointment.specialistId,
        specialist: appointment.specialist,
        revenue: 0,
        visits: 0,
      };
      entry.revenue += appointmentRevenue(appointment, serviceId);
      entry.visits += 1;
      map.set(appointment.specialistId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [currentAppointments, serviceId]);

  const leaders = useMemo(() => {
    const map = new Map<
      string,
      { name: string; visits: number; revenue: number; prices: number[] }
    >();
    for (const appointment of currentAppointments) {
      if (appointment.status !== 'completed') continue;
      for (const line of appointment.services) {
        if (serviceId !== 'all' && line.serviceId !== serviceId) continue;
        const entry = map.get(line.serviceId) ?? {
          name: line.nameSnapshot,
          visits: 0,
          revenue: 0,
          prices: [],
        };
        entry.visits += 1;
        entry.revenue += line.priceRub;
        entry.prices.push(line.priceRub);
        map.set(line.serviceId, entry);
      }
    }
    const total = Array.from(map.values()).reduce((sum, entry) => sum + entry.revenue, 0);
    return Array.from(map.values())
      .map((entry) => ({
        name: entry.name,
        visits: entry.visits,
        averagePrice: entry.prices.length
          ? Math.round(entry.prices.reduce((sum, price) => sum + price, 0) / entry.prices.length)
          : 0,
        revenue: entry.revenue,
        share: total > 0 ? (entry.revenue / total) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentAppointments, serviceId]);

  const periodLabel = `${range.start.getDate()}–${formatRuDate(range.end)}`;
  const monthName = formatMonthYear(month);

  function downloadCsv() {
    if (metrics.revenue === 0 && leaders.length === 0) {
      toast({ title: 'Нет данных для отчёта', description: 'За выбранный период нет выполненных записей.', tone: 'info' });
      return;
    }
    const rows: string[][] = [
      ['Отчёт РИТМ'],
      ['Период', periodLabel],
      [
        'Специалист',
        specialistId === 'all'
          ? 'Все специалисты'
          : (specialists ?? []).find((item) => item.id === specialistId)?.name ?? '—',
      ],
      [
        'Услуга',
        serviceId === 'all'
          ? 'Все услуги'
          : (services ?? []).find((item) => item.id === serviceId)?.name ?? '—',
      ],
      [],
      ['Показатель', 'Значение'],
      ['Выручка', String(metrics.revenue)],
      ['Записей', String(metrics.appointments)],
      ['Продано услуг', String(metrics.sold)],
      ['Средний чек', String(metrics.average)],
      ['Прибыль', metrics.profit == null ? '—' : String(metrics.profit)],
      [],
      ['Услуга', 'Записей', 'Средняя цена', 'Выручка', 'Доля, %'],
      ...leaders.map((leader) => [
        leader.name,
        String(leader.visits),
        String(leader.averagePrice),
        String(leader.revenue),
        leader.share.toFixed(1).replace('.', ','),
      ]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ritm-statistika-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Отчёт скачан', description: 'CSV можно открыть в Excel или LibreOffice.' });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Статистика"
        subtitle="Продажи услуг и результаты студии за выбранный период"
        actions={
          <Button variant="secondary" onClick={downloadCsv}>
            <Download size={15} />
            Скачать отчёт
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-[#F1F4F2] hover:text-ink"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[124px] px-2 text-center text-[11px] font-bold text-ink">{periodLabel}</span>
          <button
            type="button"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-[#F1F4F2] hover:text-ink"
            aria-label="Следующий месяц"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <Select
          value={specialistId}
          onChange={(event) => setSpecialistId(event.target.value)}
          className="h-9 w-[190px]"
          aria-label="Специалист"
        >
          <option value="all">Все специалисты</option>
          {(specialists ?? []).map((specialist) => (
            <option key={specialist.id} value={specialist.id}>
              {specialist.name}
            </option>
          ))}
        </Select>

        <Select
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="h-9 w-[210px]"
          aria-label="Услуга"
        >
          <option value="all">Все услуги</option>
          {(services ?? []).map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>

        <span className="ml-auto text-[10px] text-muted">Данные по выполненным визитам</span>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Kpi
          label="Выручка"
          value={formatRub(metrics.revenue)}
          delta={delta(metrics.revenue, prevMetrics.revenue)}
        />
        <Kpi
          label="Записей"
          value={String(metrics.appointments)}
          delta={delta(metrics.appointments, prevMetrics.appointments)}
        />
        <Kpi
          label="Продано услуг"
          value={String(metrics.sold)}
          delta={delta(metrics.sold, prevMetrics.sold)}
        />
        <Kpi
          label="Средний чек"
          value={metrics.average ? formatRub(metrics.average) : '—'}
          delta={delta(metrics.average, prevMetrics.average)}
        />
        <Kpi
          label="Прибыль"
          value={metrics.profit == null ? '—' : formatRub(metrics.profit)}
          delta={
            metrics.profit == null || prevMetrics.profit == null
              ? null
              : delta(metrics.profit, prevMetrics.profit)
          }
          hint={metrics.profit == null ? 'Нет себестоимости' : undefined}
        />
      </div>

      <div className="grid grid-cols-[1.45fr_1fr] gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold text-ink">
                Выручка за {monthName}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">По неделям месяца</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-semibold text-primary-dark">
              <TrendingUp size={12} />
              {formatRub(metrics.revenue)}
            </span>
          </div>
          <div className="mt-4 h-[210px]">
            {metrics.revenue > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#EDF0EE" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#8A938D' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#8A938D' }}
                    tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)} тыс.` : String(value))}
                  />
                  <Tooltip formatter={(value) => [formatRub(Number(value)), 'Выручка']} cursor={{ fill: '#F5F8F6' }} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {weekly.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={index === weekly.length - 1 ? '#2C5243' : '#9DBFAD'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <BarChart3 size={24} className="text-[#C3CAC5]" />
                <div className="mt-2 text-[11px] font-semibold text-ink">Пока нет выполненных визитов</div>
                <div className="mt-1 text-[10px] text-muted">Выберите другой период или дождитесь записей.</div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="text-[14px] font-bold text-ink">По специалистам</div>
          <div className="mt-0.5 text-[10px] text-muted">Выручка и визиты за период</div>
          <div className="mt-4 flex flex-col gap-4">
            {bySpecialist.length === 0 && (
              <div className="py-10 text-center text-[11px] text-muted">Нет данных за период</div>
            )}
            {bySpecialist.map((entry) => {
              const max = bySpecialist[0]?.revenue || 1;
              return (
                <div key={entry.id}>
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={entry.specialist?.name ?? 'Специалист'}
                      color={entry.specialist?.color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-ink">
                        {entry.specialist?.name ?? 'Специалист'}
                      </div>
                      <div className="text-[9px] text-muted">
                        {entry.visits} {pluralize(entry.visits, 'визит', 'визита', 'визитов')}
                      </div>
                    </div>
                    <div className="text-[11px] font-bold tabular-nums text-ink">{formatRub(entry.revenue)}</div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEF2EF]">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max((entry.revenue / max) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <div className="text-[14px] font-bold text-ink">Лидеры продаж</div>
            <div className="mt-0.5 text-[10px] text-muted">Услуги, которые принесли больше всего выручки</div>
          </div>
          <span className="text-[10px] text-muted">
            {leaders.length} {pluralize(leaders.length, 'услуга', 'услуги', 'услуг')} в отчёте
          </span>
        </div>

        {leaders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={BarChart3}
              title="Нет выполненных записей"
              description="Статистика появится, когда в выбранном периоде будут выполненные визиты."
            />
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col />
              <col className="w-[100px]" />
              <col className="w-[130px]" />
              <col className="w-[140px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A938D]">
                <th className="px-5 py-2.5 font-semibold">Услуга</th>
                <th className="px-3 py-2.5 text-center font-semibold">Записей</th>
                <th className="px-3 py-2.5 text-right font-semibold">Средняя цена</th>
                <th className="px-3 py-2.5 text-right font-semibold">Выручка</th>
                <th className="px-3 py-2.5 font-semibold">Доля</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader) => (
                <tr key={leader.name} className="border-b border-line/70 last:border-b-0">
                  <td className="px-5 py-3 text-[12px] font-semibold text-ink">{leader.name}</td>
                  <td className="px-3 py-3 text-center text-[12px] tabular-nums text-[#4E5C55]">
                    {leader.visits}
                  </td>
                  <td className="px-3 py-3 text-right text-[12px] tabular-nums text-[#4E5C55]">
                    {formatRub(leader.averagePrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-ink">
                    {formatRub(leader.revenue)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEF2EF]">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(leader.share, 2)}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-[10px] tabular-nums text-muted">
                        {formatPercent(leader.share, 0)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function key(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function matchesSpecialist(appointment: AppointmentWithDetails, specialistId: string): boolean {
  return specialistId === 'all' || appointment.specialistId === specialistId;
}

function matchesService(appointment: AppointmentWithDetails, serviceId: string): boolean {
  return serviceId === 'all' || appointment.services.some((line) => line.serviceId === serviceId);
}

function appointmentRevenue(appointment: AppointmentWithDetails, serviceId: string): number {
  if (serviceId === 'all') return appointment.totalRub;
  return appointment.services
    .filter((line) => line.serviceId === serviceId)
    .reduce((sum, line) => sum + line.priceRub, 0);
}

function computeMetrics(
  appointments: AppointmentWithDetails[],
  serviceId: string,
): Metrics {
  const active = appointments.filter(
    (appointment) =>
      appointment.status !== 'cancelled' && appointment.status !== 'no_show',
  );
  const completed = active.filter((appointment) => appointment.status === 'completed');
  let revenue = 0;
  let sold = 0;
  let cost = 0;
  let costsKnown = true;
  for (const appointment of completed) {
    if (serviceId === 'all') {
      revenue += appointment.totalRub;
      sold += appointment.services.length;
      for (const line of appointment.services) {
        if (line.costRub == null) costsKnown = false;
        else cost += line.costRub;
      }
    } else {
      for (const line of appointment.services) {
        if (line.serviceId !== serviceId) continue;
        revenue += line.priceRub;
        sold += 1;
        if (line.costRub == null) costsKnown = false;
        else cost += line.costRub;
      }
    }
  }
  return {
    revenue,
    appointments: active.length,
    sold,
    average: completed.length > 0 ? Math.round(revenue / completed.length) : 0,
    profit: completed.length > 0 && costsKnown ? revenue - cost : null,
  };
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function Kpi({
  label,
  value,
  delta: deltaValue,
  hint,
}: {
  label: string;
  value: string;
  delta: number | null;
  hint?: string;
}) {
  const positive = deltaValue != null && deltaValue >= 0;
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="text-[10px] font-semibold text-muted">{label}</div>
      <div className="mt-1.5 text-[20px] font-extrabold leading-6 tracking-[-0.02em] text-ink">{value}</div>
      <div className="mt-1.5 flex items-center gap-1 text-[9px]">
        {deltaValue == null ? (
          <span className="text-[#9AA29D]">{hint ?? 'Нет базы для сравнения'}</span>
        ) : (
          <>
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', positive ? 'text-primary' : 'text-danger')}>
              {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {formatPercent(Math.abs(deltaValue))}
            </span>
            <span className="text-[#9AA29D]">к прошлому периоду</span>
          </>
        )}
      </div>
    </div>
  );
}

function csvCell(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
