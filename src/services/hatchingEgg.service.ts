import { db } from '@/db/database';
import type { HatchingEggLot } from '@/models/hatchingEgg.model';

export const hatchingEggService = {
  async getAll(): Promise<HatchingEggLot[]> {
    return db.hatchingEggLots.orderBy('entryDate').reverse().toArray();
  },

  async getById(id: number): Promise<HatchingEggLot | undefined> {
    return db.hatchingEggLots.get(id);
  },

  async create(data: Omit<HatchingEggLot, 'id' | 'createdAt'>): Promise<number> {
    return db.hatchingEggLots.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<Omit<HatchingEggLot, 'id' | 'createdAt'>>): Promise<void> {
    await db.hatchingEggLots.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.hatchingEggLots.delete(id);
  },

  // Ile jaj z danej partii zostało już przypisanych do wsadów inkubacji
  async getUsedCount(lotId: number): Promise<number> {
    const groups = await db.incubationEggGroups
      .where('hatchingEggLotId' as any)
      .equals(lotId)
      .toArray();
    return groups.reduce((s, g) => s + g.count, 0);
  },

  // Dostępne sztuki = count - used
  async getAvailable(lotId: number): Promise<number> {
    const lot = await db.hatchingEggLots.get(lotId);
    if (!lot) return 0;
    const used = await this.getUsedCount(lotId);
    return Math.max(0, lot.count - used);
  },

  // Wszystkie partie z wyliczonymi stanami dostępności
  async getAllWithAvailability(): Promise<(HatchingEggLot & { usedCount: number; availableCount: number })[]> {
    const lots = await this.getAll();
    const allGroups = await db.incubationEggGroups.toArray();

    return lots.map(lot => {
      const used = allGroups
        .filter(g => (g as any).hatchingEggLotId === lot.id)
        .reduce((s, g) => s + g.count, 0);
      return { ...lot, usedCount: used, availableCount: Math.max(0, lot.count - used) };
    });
  },
};
