import type { ProductionBatch, DairyProductType } from '@/models/dairy.model';

/**
 * Stan szacunkowy wagi sera w dojrzewalni (Etap 4).
 * Waga spada w czasie leżakowania (utrata wilgoci). Krzywa wg rekomendacji serowarni
 * (BRIEF #5): ubytek „mocno z przodu" → współczynnik f(t) = 1 − u/100 × √(t/T).
 *
 * Stan szacowany = `quantityRemainingKg` (nominał, uwzględnia sprzedaż) × wilgotnościowy
 * współczynnik liczony od BAZY (ostatnie przeważenie albo start produkcji).
 */

/** Domyślny % ubytku wagi per kategoria, gdy partia nie ma przepisu z `ubytekWagiProc`. */
const DEFAULT_UBYTEK: Record<DairyProductType, number> = {
  ser_dojrzewajacy: 15, twarog: 0, jogurt: 0, kefir: 0, smietana: 0,
  maslo: 0, rikotta: 0, mleko_surowe: 0, zwierzeta: 0,
};

export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00').getTime();
  const b = new Date(to + 'T12:00:00').getTime();
  return Math.max(0, Math.floor((b - a) / 86400000));
}

export function daysSince(dateStr: string): number {
  return daysBetween(dateStr, new Date().toISOString().slice(0, 10));
}

/**
 * Szacowana bieżąca waga partii w kg.
 * @param ubytekWagiProc całkowity % ubytku z przepisu (lub null → domyślny per rodzina)
 */
export function estimateBatchWeightKg(batch: ProductionBatch, ubytekWagiProc?: number | null): number {
  const total = batch.agingDays ?? 0;
  const u = ubytekWagiProc ?? DEFAULT_UBYTEK[batch.productType] ?? 0;
  if (!u || total <= 0) return batch.quantityRemainingKg;

  const f = (t: number) => 1 - (u / 100) * Math.sqrt(Math.min(1, Math.max(0, t / total)));
  const baselineDate = batch.lastWeighedAt ?? batch.productionDate;
  const dBase = daysBetween(batch.productionDate, baselineDate);
  const dNow = daysSince(batch.productionDate);
  const fBase = f(dBase);
  const factor = fBase > 0 ? f(dNow) / fBase : 1;
  return Math.max(0, batch.quantityRemainingKg * factor);
}
