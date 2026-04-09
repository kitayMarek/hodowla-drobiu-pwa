import type { Weighing } from '@/models/weighing.model';
import type { GrowthCurve, TrendPoint } from './types';

export function calcDailyWeightGain(weighings: Weighing[]): number | null {
  if (weighings.length < 2) return null;
  const sorted = [...weighings].sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysDiff = last.ageAtWeighingDays - first.ageAtWeighingDays;
  if (daysDiff <= 0) return null;
  return (last.averageWeightGrams - first.averageWeightGrams) / daysDiff;
}

export function buildGrowthCurve(weighings: Weighing[]): GrowthCurve {
  const points = [...weighings]
    .sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays)
    .map(w => ({ ageDay: w.ageAtWeighingDays, weightGrams: w.averageWeightGrams }));
  return { points };
}

export function calcProjectedFinalWeight(
  weighings: Weighing[],
  targetAgeDay: number
): number | null {
  const gain = calcDailyWeightGain(weighings);
  if (!gain || weighings.length === 0) return null;
  const sorted = [...weighings].sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays);
  const latest = sorted[sorted.length - 1];
  const remainingDays = targetAgeDay - latest.ageAtWeighingDays;
  if (remainingDays <= 0) return latest.averageWeightGrams;
  return latest.averageWeightGrams + gain * remainingDays;
}

export function calcWeightGainTrend(weighings: Weighing[]): TrendPoint[] {
  return [...weighings]
    .sort((a, b) => a.weighingDate.localeCompare(b.weighingDate))
    .map(w => ({ date: w.weighingDate, value: w.averageWeightGrams }));
}
