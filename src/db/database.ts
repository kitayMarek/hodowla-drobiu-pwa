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
import type { CashAccount, CashTransaction, CashCategory } from '@/models/cashFlow.model';
import type { FinancialEvent } from '@/models/financialEvent.model';

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
  cashAccounts!: Table<CashAccount, number>;
  cashTransactions!: Table<CashTransaction, number>;
  cashCategories!: Table<CashCategory, number>;
  financialEvents!: Table<FinancialEvent, number>;

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

    // v11: Dziennik Kasowy – konta i transakcje
    this.version(11).stores({
      cashAccounts:     '++id, type, scope',
      cashTransactions: '++id, accountId, date, type, scope, category, [accountId+date], [scope+date]',
    });

    // v12: Dokumenty finansowe – powiązanie sprzedaży/zakupów z kasą (memoriał vs kasa)
    this.version(12).stores({
      financialEvents: '++id, date, type, status, sourceType, sourceId, [status+type]',
    });

    // v13: Kategorie transakcji z podziałem na działalności; migracja zakresów
    this.version(13).stores({
      cashCategories: '++id, name, scope, type',
    }).upgrade(async tx => {
      // Migruj zakresy: business → drob, personal → osobiste
      await tx.table('cashAccounts').toCollection().modify((acc: { scope: string }) => {
        if (acc.scope === 'business') acc.scope = 'drob';
        else if (acc.scope === 'personal') acc.scope = 'osobiste';
      });
      await tx.table('cashTransactions').toCollection().modify((t: { scope: string }) => {
        if (t.scope === 'business') t.scope = 'drob';
        else if (t.scope === 'personal') t.scope = 'osobiste';
      });

      // Wstaw domyślne kategorie
      const now = new Date().toISOString();
      const cats = [
        // Drób
        { name: 'Sprzedaż drobiu',        scope: 'drob',          type: 'income',  isSystem: true, createdAt: now },
        { name: 'Sprzedaż jaj',           scope: 'drob',          type: 'income',  isSystem: true, createdAt: now },
        { name: 'Zakup piskląt',          scope: 'drob',          type: 'expense', isSystem: true, createdAt: now },
        { name: 'Pasza',                  scope: 'drob',          type: 'expense', isSystem: true, createdAt: now },
        { name: 'Leki i weterynarz',      scope: 'drob',          type: 'expense', isSystem: true, createdAt: now },
        { name: 'Szczepienia',            scope: 'drob',          type: 'expense', isSystem: true, createdAt: now },
        // Sery
        { name: 'Sprzedaż serów',         scope: 'sery',          type: 'income',  isSystem: true, createdAt: now },
        { name: 'Zakup mleka',            scope: 'sery',          type: 'expense', isSystem: true, createdAt: now },
        { name: 'Podpuszczka i kultury',  scope: 'sery',          type: 'expense', isSystem: true, createdAt: now },
        // Agroturystyka
        { name: 'Noclegi',                scope: 'agroturystyka', type: 'income',  isSystem: true, createdAt: now },
        { name: 'Wyżywienie gości',       scope: 'agroturystyka', type: 'income',  isSystem: true, createdAt: now },
        { name: 'Wynajem sali',           scope: 'agroturystyka', type: 'income',  isSystem: true, createdAt: now },
        { name: 'Wyposażenie i remonty',  scope: 'agroturystyka', type: 'expense', isSystem: true, createdAt: now },
        { name: 'Reklama i marketing',    scope: 'agroturystyka', type: 'expense', isSystem: true, createdAt: now },
        // Osobiste
        { name: 'Wynagrodzenie właściciela', scope: 'osobiste',   type: 'income',  isSystem: true, createdAt: now },
        { name: 'Zakupy osobiste',        scope: 'osobiste',      type: 'expense', isSystem: true, createdAt: now },
        { name: 'Dom i mieszkanie',       scope: 'osobiste',      type: 'expense', isSystem: true, createdAt: now },
        // Wspólne (scope = null = dla wszystkich)
        { name: 'Energia i media',        scope: null,            type: null,      isSystem: true, createdAt: now },
        { name: 'Pracownicy',             scope: null,            type: null,      isSystem: true, createdAt: now },
        { name: 'Transport',              scope: null,            type: null,      isSystem: true, createdAt: now },
        { name: 'Naprawy i konserwacja',  scope: null,            type: null,      isSystem: true, createdAt: now },
        { name: 'Podatki i ubezpieczenia', scope: null,           type: null,      isSystem: true, createdAt: now },
        { name: 'Inne',                   scope: null,            type: null,      isSystem: true, createdAt: now },
      ];
      await tx.table('cashCategories').bulkAdd(cats);
    });

    // v14: Naprawa przelewów – usunięcie zduplikowanych rekordów "mirror" z cashTransactions.
    // Poprzednia wersja createTransfer tworzyła dwa rekordy (jeden per konto).
    // Teraz przelew = jeden rekord z accountId=źródło, toAccountId=cel.
    this.version(14).stores({}).upgrade(async tx => {
      const transfers = await tx.table('cashTransactions')
        .where('type').equals('transfer')
        .toArray();

      // Znajdź pary (T1,T2) gdzie T1.accountId=T2.toAccountId i T2.accountId=T1.toAccountId
      const toDelete = new Set<number>();
      for (let i = 0; i < transfers.length; i++) {
        if (toDelete.has(transfers[i].id)) continue;
        const t1 = transfers[i];
        // Szukaj lustra: t2.accountId = t1.toAccountId I t2.toAccountId = t1.accountId
        const mirror = transfers.find(t2 =>
          t2.id !== t1.id &&
          !toDelete.has(t2.id) &&
          t2.accountId   === t1.toAccountId &&
          t2.toAccountId === t1.accountId   &&
          t2.date        === t1.date         &&
          t2.amountPln   === t1.amountPln
        );
        if (mirror) {
          // Usuń rekord z wyższym ID (mirror – drugi z pary)
          toDelete.add(Math.max(t1.id, mirror.id));
        }
      }
      if (toDelete.size > 0) {
        await tx.table('cashTransactions').bulkDelete([...toDelete]);
      }
    });
  }
}

export const db = new FarmDatabase();
