import { db } from '@/db/database';
import type { DailyEntry } from '@/models/dailyEntry.model';

export const dailyEntryService = {
  async getByBatch(batchId: number): Promise<DailyEntry[]> {
    return db.dailyEntries
      .where('batchId').equals(batchId)
      .sortBy('date');
  },

  async getByBatchAndDateRange(
    batchId: number,
    fromDate: string,
    toDate: string
  ): Promise<DailyEntry[]> {
    return db.dailyEntries
      .where('[batchId+date]')
      .between([batchId, fromDate], [batchId, toDate], true, true)
      .toArray();
  },

  async getLastEntry(batchId: number): Promise<DailyEntry | undefined> {
    const entries = await db.dailyEntries
      .where('batchId').equals(batchId)
      .sortBy('date');
    return entries[entries.length - 1];
  },

  async getById(id: number): Promise<DailyEntry | undefined> {
    return db.dailyEntries.get(id);
  },

  async create(data: Omit<DailyEntry, 'id' | 'createdAt'>): Promise<number> {
    return db.dailyEntries.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<DailyEntry>): Promise<void> {
    await db.dailyEntries.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.dailyEntries.delete(id);
  },

  /** Usuwa wpis dzienny WRAZ z powiązanymi rekordami feedConsumptions */
  async deleteWithConsumptions(id: number): Promise<void> {
    const entry = await db.dailyEntries.get(id);
    if (entry) {
      await db.feedConsumptions
        .where('[batchId+date]').equals([entry.batchId, entry.date])
        .delete();
    }
    await db.dailyEntries.delete(id);
  },

  async getWeeklyAggregates(batchId: number): Promise<Array<{
    weekStart: string;
    totalDead: number;
    totalFeedKg: number;
    totalEggs: number;
    avgWeight: number | null;
  }>> {
    const entries = await db.dailyEntries
      .where('batchId').equals(batchId)
      .sortBy('date');

    const weekMap = new Map<string, typeof entries>();
    for (const e of entries) {
      const d = new Date(e.date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = monday.toISOString().slice(0, 10);
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(e);
    }

    return Array.from(weekMap.entries()).map(([weekStart, weekEntries]) => {
      const weights = weekEntries.filter(e => e.sampleWeightGrams != null);
      return {
        weekStart,
        totalDead: weekEntries.reduce((s, e) => s + e.deadCount + e.culledCount, 0),
        totalFeedKg: weekEntries.reduce((s, e) => s + e.feedConsumedKg, 0),
        totalEggs: weekEntries.reduce((s, e) => s + (e.eggsCollected ?? 0), 0),
        avgWeight: weights.length > 0
          ? weights.reduce((s, e) => s + (e.sampleWeightGrams ?? 0), 0) / weights.length
          : null,
      };
    });
  },
};
