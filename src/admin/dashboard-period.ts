export type DashboardPeriod = 'today' | '7d' | '30d' | 'month';

const VALID_PERIODS: DashboardPeriod[] = ['today', '7d', '30d', 'month'];

export function parseDashboardPeriod(value?: string): DashboardPeriod {
  return VALID_PERIODS.includes(value as DashboardPeriod)
    ? (value as DashboardPeriod)
    : '7d';
}

export function getDashboardPeriodConfig(period: DashboardPeriod, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return {
        start: startOfToday,
        bucketCount: 1,
        label: "Aujourd'hui",
      };
    case '7d': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      return { start, bucketCount: 7, label: '7 derniers jours' };
    }
    case '30d': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 29);
      return { start, bucketCount: 30, label: '30 derniers jours' };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, bucketCount: now.getDate(), label: 'Ce mois' };
    }
  }
}

export function buildTimelineBuckets(
  start: Date,
  bucketCount: number,
): { date: string; revenue: number; orders: number }[] {
  const buckets: { date: string; revenue: number; orders: number }[] = [];

  for (let index = 0; index < bucketCount; index += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    buckets.push({
      date: day.toISOString().slice(0, 10),
      revenue: 0,
      orders: 0,
    });
  }

  return buckets;
}
