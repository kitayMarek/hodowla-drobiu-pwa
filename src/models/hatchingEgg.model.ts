import type { Species } from '@/constants/species';

export type HatchingEggSourceType = 'przeniesienie' | 'zakup';

export const HATCHING_EGG_SOURCE_LABELS: Record<HatchingEggSourceType, string> = {
  przeniesienie: 'Przeniesienie z własnych niosek',
  zakup:         'Zakup zewnętrzny (stado zarodowe)',
};

export interface HatchingEggLot {
  id?: number;
  entryDate: string;          // YYYY-MM-DD
  species: Species;
  breed?: string;             // rasa – opcjonalna, ręcznie
  count: number;              // ile jaj weszło do magazynu
  sourceType: HatchingEggSourceType;

  // Przy przeniesieniu z własnych niosek
  sourceBatchId?: number;     // ID stada niosek
  eggHatchTransferId?: number; // powiązany transfer w module sprzedaży

  // Przy zakupie zewnętrznym
  supplierName?: string;
  pricePerEgg?: number;
  totalCostPln?: number;
  invoiceNumber?: string;

  notes?: string;
  createdAt: string;
}
