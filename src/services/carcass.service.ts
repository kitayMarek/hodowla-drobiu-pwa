import { slaughterService } from '@/services/slaughter.service';
import { saleService } from '@/services/sale.service';
import { batchService } from '@/services/batch.service';
import type { Species } from '@/constants/species';

/**
 * Magazyn tuszek — stan liczony (bez osobnej tabeli):
 *   wyprodukowane (ubój) − sprzedane (tuszki/elementy), per stado.
 * Stado niesie gatunek, więc tuszki są naturalnie rozdzielone wg stada i gatunku.
 */
export interface CarcassStock {
  batchId: number;
  batchName: string;
  species: Species;
  producedCount: number;   // ubite − skonfiskowane
  producedKg: number;      // masa poubojowa
  soldCount: number;       // sprzedane tuszki/elementy (szt.)
  soldKg: number;          // sprzedane tuszki/elementy (kg)
  availableCount: number;
  availableKg: number;
}

function build(
  batchId: number,
  batchName: string,
  species: Species,
  slaughter: { birdsSlaughtered: number; carcassWeightTotalKg: number; condemnedCount?: number }[],
  sales: { birdCount?: number; weightKg?: number }[],
): CarcassStock {
  const producedCount = slaughter.reduce((s, r) => s + Math.max(0, r.birdsSlaughtered - (r.condemnedCount ?? 0)), 0);
  const producedKg    = slaughter.reduce((s, r) => s + (r.carcassWeightTotalKg ?? 0), 0);
  const soldCount     = sales.reduce((s, r) => s + (r.birdCount ?? 0), 0);
  const soldKg        = sales.reduce((s, r) => s + (r.weightKg ?? 0), 0);
  return {
    batchId, batchName, species,
    producedCount, producedKg, soldCount, soldKg,
    availableCount: Math.max(0, producedCount - soldCount),
    availableKg:    Math.max(0, producedKg - soldKg),
  };
}

const CARCASS_SALE_TYPES = new Set(['tuszki', 'elementy']);

export const carcassService = {
  /** Stan magazynu tuszek dla jednego stada. */
  async getStockByBatch(batchId: number): Promise<CarcassStock | null> {
    const [batch, slaughter, sales] = await Promise.all([
      batchService.getById(batchId),
      slaughterService.getByBatch(batchId),
      saleService.getByBatch(batchId),
    ]);
    if (!batch) return null;
    const carcassSales = sales.filter(s => CARCASS_SALE_TYPES.has(s.saleType));
    return build(batchId, batch.name, batch.species, slaughter, carcassSales);
  },

  /** Stan magazynu tuszek dla wszystkich stad (tylko te z wyprodukowanymi tuszkami). */
  async getAllStock(): Promise<CarcassStock[]> {
    const [batches, allSlaughter, allSales] = await Promise.all([
      batchService.getAll(),
      slaughterService.getAll(),
      saleService.getAll(),
    ]);
    const byBatch = new Map<number, CarcassStock>();
    for (const b of batches) {
      if (b.id == null) continue;
      const slaughter = allSlaughter.filter(s => s.batchId === b.id);
      const sales     = allSales.filter(s => s.batchId === b.id && CARCASS_SALE_TYPES.has(s.saleType));
      if (slaughter.length === 0) continue; // brak uboju = brak tuszek w magazynie
      byBatch.set(b.id, build(b.id, b.name, b.species, slaughter, sales));
    }
    return [...byBatch.values()].sort((a, b) => b.availableKg - a.availableKg);
  },
};
