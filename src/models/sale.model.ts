import type { SaleType } from '@/constants/phases';

export interface Sale {
  id?: number;
  batchId: number;
  saleDate: string;           // ISO 'YYYY-MM-DD'
  saleType: SaleType;
  // Jaja
  eggsCount?: number;
  eggPricePln?: number;       // Za sztukę
  // Ptaki / tuszki
  birdCount?: number;
  weightKg?: number;
  pricePerKgPln?: number;
  // Wspólne
  totalRevenuePln: number;
  buyerName?: string;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
}
