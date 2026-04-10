import { db } from '@/db/database';
import { todayISO } from '@/utils/date';
import type { InvestmentFormValues } from '@/utils/validation';

export const investmentService = {
  async create(data: InvestmentFormValues): Promise<number> {
    return db.investments.add({
      ...data,
      usefulLifeYears: data.usefulLifeYears ?? undefined,
      createdAt: todayISO(),
    });
  },

  async update(id: number, data: InvestmentFormValues): Promise<void> {
    await db.investments.update(id, {
      ...data,
      usefulLifeYears: data.usefulLifeYears ?? undefined,
    });
  },

  async delete(id: number): Promise<void> {
    await db.investments.delete(id);
  },
};
