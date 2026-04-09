import type { Species } from '@/constants/species';
import type { BatchStatus, SourceType } from '@/constants/phases';

export interface Batch {
  id?: number;
  name: string;
  species: Species;
  breed?: string;
  status: BatchStatus;
  startDate: string;           // ISO date 'YYYY-MM-DD'
  plannedEndDate?: string;
  actualEndDate?: string;
  initialCount: number;
  initialWeightGrams?: number;
  sourceType: SourceType;
  chick_cost_per_unit?: number; // PLN za sztukę
  transport_cost?: number;      // PLN łącznie
  housingId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
