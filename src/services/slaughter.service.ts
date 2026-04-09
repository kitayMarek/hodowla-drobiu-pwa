import { db } from '@/db/database';
import type { SlaughterRecord } from '@/models/slaughter.model';

export const slaughterService = {
  async getByBatch(batchId: number): Promise<SlaughterRecord[]> {
    return db.slaughterRecords
      .where('batchId').equals(batchId)
      .sortBy('slaughterDate');
  },

  async getById(id: number): Promise<SlaughterRecord | undefined> {
    return db.slaughterRecords.get(id);
  },

  async create(data: Omit<SlaughterRecord, 'id' | 'createdAt'>): Promise<number> {
    // Auto-oblicz wydajność tuszki
    const dressingPercent =
      data.liveWeightTotalKg > 0
        ? (data.carcassWeightTotalKg / data.liveWeightTotalKg) * 100
        : undefined;
    return db.slaughterRecords.add({
      ...data,
      dressingPercent,
      createdAt: new Date().toISOString(),
    });
  },

  async update(id: number, data: Partial<SlaughterRecord>): Promise<void> {
    // Przelicz wydajność jeśli zmieniono masy
    const updates: Partial<SlaughterRecord> = { ...data };
    if (data.liveWeightTotalKg != null && data.carcassWeightTotalKg != null) {
      updates.dressingPercent =
        data.liveWeightTotalKg > 0
          ? (data.carcassWeightTotalKg / data.liveWeightTotalKg) * 100
          : undefined;
    }
    await db.slaughterRecords.update(id, updates);
  },

  async delete(id: number): Promise<void> {
    await db.slaughterRecords.delete(id);
  },
};
