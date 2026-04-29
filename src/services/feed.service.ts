import { db } from '@/db/database';
import type { FeedType, FeedDelivery, FeedConsumption } from '@/models/feed.model';

/** Przelicza WAC (Weighted Average Cost) dla danego typu paszy na podstawie wszystkich dostaw */
async function recalcWAC(feedTypeId: number): Promise<void> {
  const deliveries = await db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
  if (deliveries.length === 0) return;
  const totalQty  = deliveries.reduce((s, d) => s + d.quantityKg,   0);
  const totalCost = deliveries.reduce((s, d) => s + d.totalCostPln, 0);
  if (totalQty > 0) {
    await db.feedTypes.update(feedTypeId, {
      pricePerKg: Math.round((totalCost / totalQty) * 100) / 100,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const feedService = {
  // FeedTypes
  async getAllTypes(): Promise<FeedType[]> {
    return db.feedTypes.orderBy('name').toArray();
  },

  async getActiveTypes(): Promise<FeedType[]> {
    return db.feedTypes.filter(ft => ft.isActive).toArray();
  },

  async getTypeById(id: number): Promise<FeedType | undefined> {
    return db.feedTypes.get(id);
  },

  async createType(data: Omit<FeedType, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.feedTypes.add({ ...data, createdAt: now, updatedAt: now });
  },

  async updateType(id: number, data: Partial<FeedType>): Promise<void> {
    await db.feedTypes.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async deleteType(id: number): Promise<void> {
    await db.feedTypes.delete(id);
  },

  // FeedDeliveries
  async getAllDeliveries(): Promise<FeedDelivery[]> {
    return db.feedDeliveries.orderBy('deliveryDate').reverse().toArray();
  },

  async getDeliveriesByType(feedTypeId: number): Promise<FeedDelivery[]> {
    return db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
  },

  async createDelivery(data: Omit<FeedDelivery, 'id' | 'createdAt'>): Promise<number> {
    const now = new Date().toISOString();
    const deliveryId = await db.feedDeliveries.add({ ...data, createdAt: now });
    await recalcWAC(data.feedTypeId);
    return deliveryId;
  },

  async updateDelivery(id: number, data: Partial<FeedDelivery>): Promise<void> {
    await db.feedDeliveries.update(id, data);
    const delivery = await db.feedDeliveries.get(id);
    if (delivery) await recalcWAC(delivery.feedTypeId);
  },

  async deleteDelivery(id: number): Promise<void> {
    const delivery = await db.feedDeliveries.get(id);
    await db.feedDeliveries.delete(id);
    if (delivery) await recalcWAC(delivery.feedTypeId);
  },

  // FeedConsumptions
  async getConsumptionsByBatch(batchId: number): Promise<FeedConsumption[]> {
    return db.feedConsumptions.where('batchId').equals(batchId).toArray();
  },

  async createConsumption(data: Omit<FeedConsumption, 'id' | 'createdAt'>): Promise<number> {
    return db.feedConsumptions.add({ ...data, createdAt: new Date().toISOString() });
  },

  async deleteConsumption(id: number): Promise<void> {
    await db.feedConsumptions.delete(id);
  },

  // Stan magazynowy: dostarczone − zużyte
  async getStockLevel(feedTypeId: number): Promise<number> {
    const deliveries = await db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
    const consumptions = await db.feedConsumptions.where('feedTypeId').equals(feedTypeId).toArray();
    const delivered = deliveries.reduce((s, d) => s + d.quantityKg, 0);
    const consumed = consumptions.reduce((s, c) => s + c.consumedKg, 0);
    return delivered - consumed;
  },
};
