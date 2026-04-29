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
import type { BatchPhoto } from '@/models/batchPhoto.model';
import type { AppSettings } from '@/models/settings.model';
import type { EggPurchase, EggHatchTransfer } from '@/models/egg.model';
import type { Order } from '@/models/order.model';
import type { Incubation, IncubationEggGroup } from '@/models/incubation.model';
import type { BirdTransfer } from '@/models/birdTransfer.model';
import type { HatchingEggLot } from '@/models/hatchingEgg.model';

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
  batchPhotos!: Table<BatchPhoto, number>;
  settings!: Table<AppSettings, number>;
  eggPurchases!: Table<EggPurchase, number>;
  eggHatchTransfers!: Table<EggHatchTransfer, number>;
  orders!: Table<Order, number>;
  incubations!: Table<Incubation, number>;
  incubationEggGroups!: Table<IncubationEggGroup, number>;
  birdTransfers!: Table<BirdTransfer, number>;
  hatchingEggLots!: Table<HatchingEggLot, number>;

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

    // v4: dokumentacja fotograficzna stad
    this.version(4).stores({
      batchPhotos: '++id, batchId, photoDate, [batchId+photoDate]',
    });

    // v5: migracja zużycia paszy per-typ z dailyEntries → feedConsumptions
    this.version(5).stores({}).upgrade(async tx => {
      const entries = await tx.table('dailyEntries').toArray();
      for (const e of entries) {
        if (e.feedTypeId != null && e.feedConsumedKg > 0) {
          // Sprawdź czy taki rekord już istnieje (idempotentność)
          const exists = await tx.table('feedConsumptions')
            .where('[batchId+date]').equals([e.batchId, e.date])
            .filter((fc: { feedTypeId: number }) => fc.feedTypeId === e.feedTypeId)
            .count();
          if (exists === 0) {
            await tx.table('feedConsumptions').add({
              batchId:    e.batchId,
              feedTypeId: e.feedTypeId,
              date:       e.date,
              consumedKg: e.feedConsumedKg,
              createdAt:  e.createdAt ?? new Date().toISOString(),
            });
          }
        }
      }
    });

    // v3: usunięcie auto-wydatków pasz (błędna architektura z poprzedniej wersji)
    this.version(3).stores({}).upgrade(async tx => {
      await tx.table('expenses')
        .filter((e: { description?: string }) =>
          typeof e.description === 'string' && e.description.startsWith('Dostawa:')
        )
        .delete();
    });

    // v6: magazyn jaj – zakupy zewnętrzne i przekazania do wylęgu
    this.version(6).stores({
      eggPurchases:     '++id, purchaseDate',
      eggHatchTransfers: '++id, transferDate, sourceBatchId',
    });

    // v7: zamówienia klientów z wyprzedzeniem
    this.version(7).stores({
      orders: '++id, batchId, plannedDate, status, [batchId+status], [status+plannedDate]',
    });

    // v8: moduł wylęgarni – wsady inkubacji, grupy jaj, przesunięcia ptaków
    this.version(8).stores({
      incubations:         '++id, startDate, status',
      incubationEggGroups: '++id, incubationId, [incubationId+species]',
      birdTransfers:       '++id, transferDate, fromBatchId, toBatchId',
    });

    // v9: magazyn jaj wylęgowych
    this.version(9).stores({
      hatchingEggLots: '++id, entryDate, species, sourceType, sourceBatchId',
    });

    // v10: powiązanie transferów z partiami jaj wylęgowych
    this.version(10).stores({
      eggHatchTransfers: '++id, transferDate, sourceBatchId, hatchingEggLotId',
      hatchingEggLots:   '++id, entryDate, species, sourceType, sourceBatchId, eggHatchTransferId',
    });
  }
}

export const db = new FarmDatabase();
