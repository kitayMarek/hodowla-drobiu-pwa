import type { WeighingMethod } from '@/constants/phases';

export interface Weighing {
  id?: number;
  batchId: number;
  weighingDate: string;       // ISO 'YYYY-MM-DD'
  ageAtWeighingDays: number;
  method: WeighingMethod;
  sampleSize?: number;
  averageWeightGrams: number;
  minWeightGrams?: number;
  maxWeightGrams?: number;
  coefficientOfVariation?: number; // CV% – jednolitość
  totalFlockWeightKg?: number;
  notes?: string;
  createdAt: string;
}
