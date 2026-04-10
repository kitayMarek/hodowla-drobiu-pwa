import Dexie, { type Table } from 'dexie';
import type { Batch } from '@/models/batch.model';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { FeedType, FeedDelivery, FeedConsumption } from '@/models/feed.model';
import type { Housing } from '@/models/housing.model';
import type { HealthEvent } from '@/models/health.model';
import type { Weighing } from '@/models/weighing.model';
import type { SlaughterRecord } from '@/models/slaughter.model';
import type { Sale } from '@/models/sale.model';
import type { Expense } from '@/models/expense.model';
import type { Investment } from '@/models/investment.model';
import type { AppSettings } from '@/models/settings.model';

export class FarmDatabase extends Dexie {
  batches!: Table<Batch, number>;
  dailyEntries!: Table<DailyEntry, number>;
  feedTypes!: Table<FeedType, number>;
  feedDeliveries!: Table<FeedDelivery, number>;
  feedConsumptions!: Table<FeedConsumption, number>;
  housing!: Table<Housing, number>;
  healthEvents!: Table<HealthEvent, number>;
  weighings!: Table<Weighing, number>;
  slaughterRecords!: Table<SlaughterRecord, number>;
  sales!: Table<Sale, number>;
  expenses!: Table<Expense, number>;
  investments!: Table<Investment, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('FarmManagerPL');

    this.version(1).stores({
      batches: '++id, species, status, startDate, [species+status]',
      dailyEntries: '++id, batchId, date, [batchId+date]',
      feedTypes: '++id, phase, &name',
      feedDeliveries: '++id, feedTypeId, deliveryDate, [feedTypeId+deliveryDate]',
      feedConsumptions: '++id, batchId, feedTypeId, date, [batchId+date], [batchId+feedTypeId]',
      housing: '++id, batchId, recordDate, [batchId+recordDate]',
      healthEvents: '++id, batchId, eventDate, eventType, [batchId+eventDate]',
      weighings: '++id, batchId, weighingDate, [batchId+weighingDate]',
      slaughterRecords: '++id, batchId, slaughterDate, [batchId+slaughterDate]',
      sales: '++id, batchId, saleDate, saleType, [batchId+saleDate], [saleType+saleDate]',
      expenses: '++id, batchId, expenseDate, category, [batchId+expenseDate], [batchId+category]',
      settings: '++id, &key',
    });

    // v2: moduł Inwestycji i środków trwałych
    this.version(2).stores({
      investments: '++id, purchaseDate, category',
    });
  }
}

export const db = new FarmDatabase();
