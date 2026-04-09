import type { FeedPhase } from '@/constants/phases';

export interface FeedType {
  id?: number;
  name: string;
  phase: FeedPhase;
  manufacturer?: string;
  proteinPercent?: number;
  energyMjKg?: number;
  pricePerKg: number;        // PLN
  isActive: boolean;
  recipeNotes?: string;      // Receptura własnej mieszanki
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedDelivery {
  id?: number;
  feedTypeId: number;
  deliveryDate: string;
  quantityKg: number;
  invoiceNumber?: string;
  supplierName?: string;
  totalCostPln: number;
  notes?: string;
  createdAt: string;
}

export interface FeedConsumption {
  id?: number;
  batchId: number;
  feedTypeId: number;
  date: string;
  consumedKg: number;
  createdAt: string;
}
