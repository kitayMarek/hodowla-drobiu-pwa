import type { FeedConsumption, FeedType } from '@/models/feed.model';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { Weighing } from '@/models/weighing.model';
import type { TrendPoint } from './types';

/** Całkowite zużycie paszy z wpisów dziennych stada */
export function calcTotalFeedKg(dailyEntries: DailyEntry[]): number {
  return dailyEntries.reduce((s, e) => s + e.feedConsumedKg, 0);
}

/** Koszt paszy stada = zużycie (kg) × cena/kg z katalogu pasz */
export function calcFeedCost(
  feedConsumptions: FeedConsumption[],
  feedTypes: FeedType[]
): number {
  const priceMap = new Map(feedTypes.map(ft => [ft.id!, ft.pricePerKg]));
  return feedConsumptions.reduce((s, fc) => {
    const price = priceMap.get(fc.feedTypeId) ?? 0;
    return s + fc.consumedKg * price;
  }, 0);
}

/** @deprecated – używaj calcTotalFeedKg(dailyEntries) */
export function calcTotalFeedKgFromConsumptions(consumptions: FeedConsumption[]): number {
  return consumptions.reduce((s, c) => s + c.consumedKg, 0);
}

/**
 * FCR = pasza (kg) / przyrost masy żywej (kg).
 * Przyjmuje gotowy przyrost wyliczony z uwzględnieniem uboju, sprzedaży i transferów
 * (patrz calcTotalLiveweightGainKg w engine/index.ts).
 */
export function calcFCR(
  totalFeedKg: number,
  totalWeightGainKg: number,
): number | null {
  if (totalFeedKg <= 0 || totalWeightGainKg <= 0) return null;
  return totalFeedKg / totalWeightGainKg;
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
