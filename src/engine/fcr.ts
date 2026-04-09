import type { FeedConsumption, FeedType } from '@/models/feed.model';
import type { Weighing } from '@/models/weighing.model';
import type { TrendPoint } from './types';

export function calcTotalFeedKg(consumptions: FeedConsumption[]): number {
  return consumptions.reduce((s, c) => s + c.consumedKg, 0);
}

export function calcFeedCost(
  consumptions: FeedConsumption[],
  feedTypes: FeedType[]
): number {
  const priceMap = new Map(feedTypes.map(ft => [ft.id!, ft.pricePerKg]));
  return consumptions.reduce((s, c) => {
    const price = priceMap.get(c.feedTypeId) ?? 0;
    return s + c.consumedKg * price;
  }, 0);
}

export function calcFCR(
  totalFeedKg: number,
  initialBirds: number,
  initialWeightGrams: number,
  currentBirds: number,
  currentAvgWeightGrams: number
): number | null {
  if (totalFeedKg <= 0 || currentAvgWeightGrams <= 0) return null;
  const initialTotalKg = (initialBirds * (initialWeightGrams || 0)) / 1000;
  const currentTotalKg = (currentBirds * currentAvgWeightGrams) / 1000;
  const weightGainKg = currentTotalKg - initialTotalKg;
  if (weightGainKg <= 0) return null;
  return totalFeedKg / weightGainKg;
}

export function calcWeeklyFeedTrend(
  consumptions: FeedConsumption[]
): TrendPoint[] {
  const weekMap = new Map<string, number>();
  for (const c of consumptions) {
    const d = new Date(c.date);
    // ISO week key: YYYY-Www
    const year = d.getFullYear();
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(year, 0, 0).getTime()) / 86400000
    );
    const weekNum = Math.ceil(dayOfYear / 7);
    const key = `${year}-W${String(weekNum).padStart(2, '0')}`;
    weekMap.set(key, (weekMap.get(key) ?? 0) + c.consumedKg);
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function calcFCRWithWeighings(
  totalFeedKg: number,
  weighings: Weighing[]
): number | null {
  if (weighings.length < 2 || totalFeedKg <= 0) return null;
  const sorted = [...weighings].sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  // Przybliżenie: FCR = pasza / (masa_końcowa_stado - masa_pocz_stado)
  // Zakłada tę samą liczebność stada (uproszczenie)
  const gainKg = (last.averageWeightGrams - first.averageWeightGrams) / 1000;
  if (gainKg <= 0) return null;
  // Użyj liczby ważonych sztuk do skalowania
  const sampleSize = last.sampleSize ?? 1;
  const estimatedGainKg = gainKg * sampleSize;
  return totalFeedKg / estimatedGainKg;
}
