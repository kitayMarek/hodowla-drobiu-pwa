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
    const entries = await db.dailyEntries.where('batchId').equals(batchId).toArray();
    const totalLost = entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
    return Math.max(0, batch.initialCount - totalLost);
  },
};
