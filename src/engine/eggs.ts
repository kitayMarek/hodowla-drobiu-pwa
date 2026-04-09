import type { DailyEntry } from '@/models/dailyEntry.model';
import type { TrendPoint } from './types';

export function calcTotalEggs(entries: DailyEntry[]): number {
  return entries.reduce((s, e) => s + (e.eggsCollected ?? 0), 0);
}

export function calcEggsPerBird(
  totalEggs: number,
  currentBirds: number
): number | null {
  if (currentBirds <= 0) return null;
  return totalEggs / currentBirds;
}

export function calcHenDayProductionPercent(
  entries: DailyEntry[],
  initialCount: number
): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return null;

  let totalRate = 0;
  let currentHens = initialCount;
  let days = 0;

  for (const e of sorted) {
    currentHens = Math.max(1, currentHens - e.deadCount - e.culledCount);
    const eggs = e.eggsCollected ?? 0;
    if (eggs > 0) {
      totalRate += (eggs / currentHens) * 100;
      days++;
    }
  }
  return days > 0 ? totalRate / days : null;
}

export function calcHenDayTrend(
  entries: DailyEntry[],
  initialCount: number
): TrendPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let currentHens = initialCount;
  return sorted
    .filter(e => e.eggsCollected !== undefined)
    .map(e => {
      currentHens = Math.max(1, currentHens - e.deadCount - e.culledCount);
      const rate = ((e.eggsCollected ?? 0) / currentHens) * 100;
      return { date: e.date, value: Math.min(rate, 100) };
    });
}

export function calcDailyEggTrend(entries: DailyEntry[]): TrendPoint[] {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(e => e.eggsCollected !== undefined)
    .map(e => ({ date: e.date, value: e.eggsCollected ?? 0 }));
}
