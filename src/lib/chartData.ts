import { getSwapsInRange } from './db.js';

export interface DailyPoint {
  date: string;
  label: string;
  swaps: number;
  revenue: number;
  stationShare: number;
}

export async function dailySwapSeries(
  where: { organizationId?: string; substationId?: string },
  days = 7
): Promise<DailyPoint[]> {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const swaps = await getSwapsInRange({
    organizationId: where.organizationId,
    substationId: where.substationId,
    swappedAtGte: start,
  });

  const points: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const daySwaps = swaps.filter((s) => s.swappedAt.slice(0, 10) === dateKey);
    points.push({
      date: dateKey,
      label: d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }),
      swaps: daySwaps.length,
      revenue: Math.round(daySwaps.reduce((a, s) => a + s.totalCharged, 0) * 100) / 100,
      stationShare:
        Math.round(daySwaps.reduce((a, s) => a + s.stationShare, 0) * 100) / 100,
    });
  }
  return points;
}
