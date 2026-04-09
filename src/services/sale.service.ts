import { db } from '@/db/database';
import type { Sale } from '@/models/sale.model';
import type { SaleType } from '@/constants/phases';

export const saleService = {
  async getAll(): Promise<Sale[]> {
    return db.sales.orderBy('saleDate').reverse().toArray();
  },

  async getByBatch(batchId: number): Promise<Sale[]> {
    return db.sales.where('batchId').equals(batchId).sortBy('saleDate');
  },

  async getByType(saleType: SaleType): Promise<Sale[]> {
    return db.sales.where('saleType').equals(saleType).toArray();
  },

  async getById(id: number): Promise<Sale | undefined> {
    return db.sales.get(id);
  },

  async create(data: Omit<Sale, 'id' | 'createdAt'>): Promise<number> {
    return db.sales.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<Sale>): Promise<void> {
    await db.sales.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.sales.delete(id);
  },

  async getTotalRevenue(batchId?: number): Promise<number> {
    const sales = batchId != null
      ? await this.getByBatch(batchId)
      : await this.getAll();
    return sales.reduce((s, x) => s + x.totalRevenuePln, 0);
  },
};
