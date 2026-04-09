import { db } from '@/db/database';
import type { HealthEvent } from '@/models/health.model';
import type { HealthEventType } from '@/constants/phases';
import { addDays, parseISO, isAfter } from 'date-fns';

export const healthService = {
  async getByBatch(batchId: number): Promise<HealthEvent[]> {
    return db.healthEvents
      .where('batchId').equals(batchId)
      .sortBy('eventDate');
  },

  async getByType(batchId: number, type: HealthEventType): Promise<HealthEvent[]> {
    return db.healthEvents
      .where('[batchId+eventDate]')
      .between([batchId, ''], [batchId, '\uffff'])
      .filter(e => e.eventType === type)
      .toArray();
  },

  async getById(id: number): Promise<HealthEvent | undefined> {
    return db.healthEvents.get(id);
  },

  async create(data: Omit<HealthEvent, 'id' | 'createdAt'>): Promise<number> {
    return db.healthEvents.add({ ...data, createdAt: new Date().toISOString() });
  },

  async update(id: number, data: Partial<HealthEvent>): Promise<void> {
    await db.healthEvents.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await db.healthEvents.delete(id);
  },

  // Aktywne karencje – ważne przed ubojem
  async getActiveWithdrawals(batchId: number): Promise<HealthEvent[]> {
    const events = await this.getByBatch(batchId);
    const today = new Date();
    return events.filter(e => {
      if (!e.withdrawalPeriodDays || e.withdrawalPeriodDays <= 0) return false;
      const withdrawalEnd = addDays(parseISO(e.eventDate), e.withdrawalPeriodDays);
      return isAfter(withdrawalEnd, today);
    });
  },

  async getTotalHealthCost(batchId: number): Promise<number> {
    const events = await this.getByBatch(batchId);
    return events.reduce((s, e) => s + (e.costPln ?? 0), 0);
  },
};
