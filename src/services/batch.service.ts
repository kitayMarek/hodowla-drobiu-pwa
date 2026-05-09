import { db } from '@/db/database';
import type { Batch } from '@/models/batch.model';
import type { BatchStatus } from '@/constants/phases';

export const batchService = {
  async getAll(): Promise<Batch[]> {
    return db.batches.orderBy('startDate').reverse().toArray();
  },

  async getActive(): Promise<Batch[]> {
    return db.batches.where('status').equals('active').toArray();
  },

  async getByStatus(status: BatchStatus): Promise<Batch[]> {
    return db.batches.where('status').equals(status).toArray();
  },

  async getById(id: number): Promise<Batch | undefined> {
    return db.batches.get(id);
  },

  async create(data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.batches.add({ ...data, createdAt: now, updatedAt: now });
  },

  async update(id: number, data: Partial<Omit<Batch, 'id' | 'createdAt'>>): Promise<void> {
    await db.batches.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async delete(id: number): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.batches, db.dailyEntries, db.weighings, db.healthEvents,
        db.housing, db.slaughterRecords, db.sales, db.expenses,
        db.feedConsumptions, db.batchPhotos,
      ],
      async () => {
        await Promise.all([
          db.dailyEntries.where('batchId').equals(id).delete(),
          db.weighings.where('batchId').equals(id).delete(),
          db.healthEvents.where('batchId').equals(id).delete(),
          db.housing.where('batchId').equals(id).delete(),
          db.slaughterRecords.where('batchId').equals(id).delete(),
          db.sales.where('batchId').equals(id).delete(),
          db.expenses.where('batchId').equals(id).delete(),
          db.feedConsumptions.where('batchId').equals(id).delete(),
          db.batchPhotos.where('batchId').equals(id).delete(),
        ]);
        await db.batches.delete(id);
      }
    );
  },

  async getCurrentBirdCount(batchId: number): Promise<number> {
    const batch = await db.batches.get(batchId);
    if (!batch) return 0;
    const [entries, sales, slaughter, outTransfers, inTransfers] = await Promise.all([
      db.dailyEntries.where('batchId').equals(batchId).toArray(),
      db.sales.where('batchId').equals(batchId).toArray(),
      db.slaughterRecords.where('batchId').equals(batchId).toArray(),
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    const dead        = entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
    const soldLive    = sales.filter(s => s.saleType === 'ptaki_zywe').reduce((s, x) => s + (x.birdCount ?? 0), 0);
    const slaughtered = slaughter.reduce((s, r) => s + r.birdsSlaughtered, 0);
    const netTransfer = inTransfers.reduce((s, t) => s + t.count, 0) - outTransfers.reduce((s, t) => s + t.count, 0);
    return Math.max(0, batch.initialCount - dead - soldLive - slaughtered + netTransfer);
  },

  async checkAndAutoClose(batchId: number): Promise<boolean> {
    const batch = await db.batches.get(batchId);
    if (!batch || batch.status !== 'active') return false;
    const current = await this.getCurrentBirdCount(batchId);
    if (current === 0) {
      await db.batches.update(batchId, {
        status: 'completed',
        actualEndDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
    return false;
  },

  // Przywraca stado do aktywnego jeśli ma ptaki i było zamknięte automatycznie (status 'completed').
  // Statusów 'sold' i 'archived' nie rusza – te są ustawiane ręcznie.
  async checkAndAutoReopen(batchId: number): Promise<boolean> {
    const batch = await db.batches.get(batchId);
    if (!batch || batch.status !== 'completed') return false;
    const current = await this.getCurrentBirdCount(batchId);
    if (current > 0) {
      await db.batches.update(batchId, {
        status: 'active',
        actualEndDate: undefined,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
    return false;
  },
};
