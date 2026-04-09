import { db } from '@/db/database';
import type { Weighing } from '@/models/weighing.model';

export const weighingService = {
  async getByBatch(batchId: number): Promise<Weighing[]> {
    return db.weighings
      .where('batchId').equals(batchId)
      .sortBy('weighingDate');
  },

  async getLatest(batchId: number): Promise<Weighing | undefined> {
    const all = await this.getByBatch(batchId);
    return all[all.length - 1];
  },

  async getById(id: number): Promise<Weighing | undefined> {
    return db.weighings.get(id);
  },

  async create(data: Omit<Weighing, 'id' | 'createdAt'>): Promise<number> {
    return db.weighings.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<Weighing>): Promise<void> {
    await db.weighings.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.weighings.delete(id);
  },
};
