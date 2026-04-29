import { db } from '@/db/database';
import type { Order, OrderStatus } from '@/models/order.model';

export const orderService = {
  async getAll(): Promise<Order[]> {
    return db.orders.orderBy('plannedDate').toArray();
  },

  async getByBatch(batchId: number): Promise<Order[]> {
    return db.orders.where('batchId').equals(batchId).toArray();
  },

  async getPending(): Promise<Order[]> {
    return db.orders.where('status').equals('oczekujace').toArray();
  },

  async create(data: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<number> {
    return db.orders.add({ ...data, status: 'oczekujace', createdAt: new Date().toISOString() });
  },

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    await db.orders.update(id, { status });
  },

  async delete(id: number): Promise<void> {
    await db.orders.delete(id);
  },
};
