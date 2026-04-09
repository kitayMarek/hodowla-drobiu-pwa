import { db } from '@/db/database';
import type { Housing } from '@/models/housing.model';

export const housingService = {
  async getByBatch(batchId: number): Promise<Housing[]> {
    return db.housing
      .where('batchId').equals(batchId)
      .sortBy('recordDate');
  },

  async getLatest(batchId: number): Promise<Housing | undefined> {
    const records = await db.housing
      .where('batchId').equals(batchId)
      .sortBy('recordDate');
    return records[records.length - 1];
  },

  async getById(id: number): Promise<Housing | undefined> {
    return db.housing.get(id);
  },

  async create(data: Omit<Housing, 'id' | 'createdAt'>): Promise<number> {
    return db.housing.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<Housing>): Promise<void> {
    await db.housing.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.housing.delete(id);
  },

  async getAlerts(batchId: number): Promise<string[]> {
    const latest = await this.getLatest(batchId);
    if (!latest) return [];
    const alerts: string[] = [];
    if (latest.ammoniaPpm != null && latest.ammoniaPpm > 20) {
      alerts.push(`Wysoki poziom amoniaku: ${latest.ammoniaPpm} ppm`);
    }
    if (latest.temperatureAvg != null && latest.temperatureAvg > 35) {
      alerts.push(`Wysoka temperatura: ${latest.temperatureAvg}°C`);
    }
    if (latest.litterCondition === 'zla') {
      alerts.push('Zły stan ściółki – wymaga uwagi');
    }
    return alerts;
  },
};
