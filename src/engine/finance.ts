import type { Sale } from '@/models/sale.model';
import type { HealthEvent } from '@/models/health.model';
import type { TrendPoint } from './types';

export function calcTotalRevenue(sales: Sale[]): number {
  return sales.reduce((s, x) => s + x.totalRevenuePln, 0);
}

export function calcGrossMargin(
  revenue: number,
  totalCost: number
): { margin: number; percent: number | null } {
  const margin = revenue - totalCost;
  return {
    margin,
    percent: revenue > 0 ? (margin / revenue) * 100 : null,
  };
}

export function calcHealthCost(healthEvents: HealthEvent[]): number {
  return healthEvents.reduce((s, h) => s + (h.costPln ?? 0), 0);
}

export function calcRevenueTrend(sales: Sale[]): TrendPoint[] {
  const dayMap = new Map<string, number>();
  for (const s of sales) {
    dayMap.set(s.saleDate, (dayMap.get(s.saleDate) ?? 0) + s.totalRevenuePln);
  }
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function calcProfitLossTimeline(
  sales: Sale[],
  expenses: Array<{ expenseDate: string; amountPln: number }>
): TrendPoint[] {
  const dayMap = new Map<string, number>();
  for (const s of sales) {
    dayMap.set(s.saleDate, (dayMap.get(s.saleDate) ?? 0) + s.totalRevenuePln);
  }
  for (const e of expenses) {
    dayMap.set(e.expenseDate, (dayMap.get(e.expenseDate) ?? 0) - e.amountPln);
  }
  let cumulative = 0;
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => {
      cumulative += value;
      return { date, value: cumulative };
    });
}
