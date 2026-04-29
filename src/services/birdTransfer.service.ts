import { db } from '@/db/database';
import type { BirdTransfer } from '@/models/birdTransfer.model';

export const birdTransferService = {
  async getAll(): Promise<BirdTransfer[]> {
    return db.birdTransfers.orderBy('transferDate').reverse().toArray();
  },

  async getByBatch(batchId: number): Promise<BirdTransfer[]> {
    const [outgoing, incoming] = await Promise.all([
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    return [...outgoing, ...incoming].sort((a, b) =>
      b.transferDate.localeCompare(a.transferDate)
    );
  },

  async create(data: Omit<BirdTransfer, 'id' | 'createdAt'>): Promise<number> {
    return db.birdTransfers.add({ ...data, createdAt: new Date().toISOString() });
  },

  async delete(id: number): Promise<void> {
    await db.birdTransfers.delete(id);
  },

  // Netto zmiana liczebności stada z tytułu przesunięć
  async getNetTransfer(batchId: number): Promise<number> {
    const [outgoing, incoming] = await Promise.all([
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    const out = outgoing.reduce((s, t) => s + t.count, 0);
    const inn = incoming.reduce((s, t) => s + t.count, 0);
    return inn - out;
  },
};
