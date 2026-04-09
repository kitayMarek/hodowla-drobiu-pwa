import type { Expense } from '@/models/expense.model';
import type { SlaughterRecord } from '@/models/slaughter.model';
import type { Batch } from '@/models/batch.model';
import type { CostBreakdown } from './types';

export function calcCostBreakdown(
  batch: Batch,
  expenses: Expense[],
  feedCostPln: number
): CostBreakdown {
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountPln;
  }

  const chickCost =
    (batch.chick_cost_per_unit ?? 0) * batch.initialCount +
    (batch.transport_cost ?? 0);

  return {
    piskleta: chickCost + (byCategory['piskleta'] ?? 0),
    pasza: feedCostPln + (byCategory['pasza'] ?? 0),
    leki: byCategory['leki'] ?? 0,
    weterynarz: byCategory['weterynarz'] ?? 0,
    energia: byCategory['energia'] ?? 0,
    praca: byCategory['praca'] ?? 0,
    transport: byCategory['transport'] ?? 0,
    sciolka: byCategory['sciolka'] ?? 0,
    inne: byCategory['inne'] ?? 0,
    total:
      chickCost +
      feedCostPln +
      Object.values(byCategory).reduce((s, v) => s + v, 0),
  };
}

export function calcCostPerKgWeightGain(
  totalCostPln: number,
  totalWeightGainKg: number
): number | null {
  if (totalWeightGainKg <= 0) return null;
  return totalCostPln / totalWeightGainKg;
}

export function calcCostPerEgg(
  totalCostPln: number,
  totalEggs: number
): number | null {
  if (totalEggs <= 0) return null;
  return totalCostPln / totalEggs;
}

export function calcCostPerKgCarcass(
  totalCostPln: number,
  slaughterRecords: SlaughterRecord[]
): number | null {
  const totalCarcassKg = slaughterRecords.reduce(
    (s, r) => s + r.carcassWeightTotalKg,
    0
  );
  if (totalCarcassKg <= 0) return null;
  return totalCostPln / totalCarcassKg;
}

export function calcTotalCarcassKg(slaughterRecords: SlaughterRecord[]): number {
  return slaughterRecords.reduce((s, r) => s + r.carcassWeightTotalKg, 0);
}

export function calcAvgDressingPercent(slaughterRecords: SlaughterRecord[]): number | null {
  const valid = slaughterRecords.filter(
    r => r.liveWeightTotalKg > 0 && r.carcassWeightTotalKg > 0
  );
  if (valid.length === 0) return null;
  const totalLive = valid.reduce((s, r) => s + r.liveWeightTotalKg, 0);
  const totalCarcass = valid.reduce((s, r) => s + r.carcassWeightTotalKg, 0);
  return (totalCarcass / totalLive) * 100;
}
