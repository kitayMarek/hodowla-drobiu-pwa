import type { Batch } from '@/models/batch.model';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { FeedType, FeedConsumption } from '@/models/feed.model';
import type { Weighing } from '@/models/weighing.model';
import type { SlaughterRecord } from '@/models/slaughter.model';
import type { Sale } from '@/models/sale.model';
import type { Expense } from '@/models/expense.model';
import type { HealthEvent } from '@/models/health.model';
import type { BirdTransfer } from '@/models/birdTransfer.model';

export interface BatchKPIInput {
  batch: Batch;
  dailyEntries: DailyEntry[];
  weighings: Weighing[];
  feedConsumptions: FeedConsumption[];
  feedTypes: FeedType[];
  sales: Sale[];
  expenses: Expense[];
  slaughterRecords: SlaughterRecord[];
  healthEvents: HealthEvent[];
  transfers?: BirdTransfer[];
}

export interface BatchKPIResult {
  batchId: number;
  batchName: string;
  ageInDays: number;
  // Populacja
  currentBirdCount: number;
  totalMortality: number;
  mortalityPercent: number;
  // Pasza
  totalFeedKg: number;
  feedCostPln: number;
  fcr: number | null;
  // Wzrost
  currentAvgWeightGrams: number | null;
  dailyWeightGainGrams: number | null;
  projectedFinalWeightGrams: number | null;
  // Jaja (nioski)
  totalEggsCollected: number;
  henDayProductionPercent: number | null;
  eggsPerBirdLifetime: number | null;
  // Ekonomika
  costBreakdown: CostBreakdown;
  totalRevenuePln: number;
  totalCostPln: number;
  grossMarginPln: number;
  grossMarginPercent: number | null;
  costPerKgWeightGainPln: number | null;
  costPerEggPln: number | null;
  // Ubój
  avgDressingPercent: number | null;
  totalCarcassKg: number;
  // Zdrowie
  totalHealthCostPln: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface GrowthCurve {
  points: Array<{ ageDay: number; weightGrams: number }>;
}

export interface CostBreakdown {
  piskleta: number;
  pasza: number;
  leki: number;
  weterynarz: number;
  energia: number;
  praca: number;
  transport: number;
  sciolka: number;
  inne: number;
  total: number;
}
