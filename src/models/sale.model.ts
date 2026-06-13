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
  /** Czy ujmować w ewidencji RHD i liczniku 100 tys. zł (domyślnie: true) */
  inRhd?: boolean;
  /** Kolejny numer w rocznej ewidencji RHD (wspólna sekwencja z dairy_sales) */
  rhdNumber?: number;
  /** Rok ewidencji RHD */
  rhdYear?: number;
  /** Dokument sprzedaży (nagłówek grupujący) */
  saleDocumentId?: number;
  createdAt: string;
}
