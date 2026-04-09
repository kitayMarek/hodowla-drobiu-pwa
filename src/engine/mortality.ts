import type { DailyEntry } from '@/models/dailyEntry.model';
import type { TrendPoint } from './types';

export function calcCurrentBirdCount(initialCount: number, entries: DailyEntry[]): number {
  const totalLost = entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
  return Math.max(0, initialCount - totalLost);
}

export function calcTotalMortality(entries: DailyEntry[]): number {
  return entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
}

export function calcMortalityPercent(initialCount: number, totalDead: number): number {
  if (initialCount <= 0) return 0;
  return (totalDead / initialCount) * 100;
}

export function calcDailyMortalityTrend(entries: DailyEntry[]): TrendPoint[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ date: e.date, value: e.deadCount + e.culledCount }));
}

export function calcCumulativeMortalityTrend(
  initialCount: number,
  entries: DailyEntry[]
): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let cumDead = 0;
  return sorted.map(e => {
    cumDead += e.deadCount + e.culledCount;
    return { date: e.date, value: (cumDead / initialCount) * 100 };
  });
}
