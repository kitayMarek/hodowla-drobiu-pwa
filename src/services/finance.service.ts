import { db } from '@/db/database';
import type { Expense } from '@/models/expense.model';
import type { ExpenseCategory } from '@/constants/phases';

export const financeService = {
  async getAllExpenses(): Promise<Expense[]> {
    return db.expenses.orderBy('expenseDate').reverse().toArray();
  },

  async getExpensesByBatch(batchId: number): Promise<Expense[]> {
    return db.expenses.where('batchId').equals(batchId).toArray();
  },

  async getExpensesByCategory(category: ExpenseCategory): Promise<Expense[]> {
    return db.expenses.where('category').equals(category).toArray();
  },

  async getById(id: number): Promise<Expense | undefined> {
    return db.expenses.get(id);
  },

  async createExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<number> {
    return db.expenses.add({ ...data, createdAt: new Date().toISOString() });
  },

  async updateExpense(id: number, data: Partial<Expense>): Promise<void> {
    await db.expenses.update(id, data);
  },

  async deleteExpense(id: number): Promise<void> {
    await db.expenses.delete(id);
  },

  async getTotalExpenses(batchId?: number): Promise<number> {
    const expenses = batchId != null
      ? await this.getExpensesByBatch(batchId)
      : await this.getAllExpenses();
    return expenses.reduce((s, e) => s + e.amountPln, 0);
  },

  async getProfitLoss(batchId: number): Promise<{
    revenue: number;
    costs: number;
    margin: number;
    marginPercent: number | null;
  }> {
    const [expenses, sales] = await Promise.all([
      this.getExpensesByBatch(batchId),
      db.sales.where('batchId').equals(batchId).toArray(),
    ]);
    const revenue = sales.reduce((s, x) => s + x.totalRevenuePln, 0);
    const costs = expenses.reduce((s, e) => s + e.amountPln, 0);
    const margin = revenue - costs;
    return {
      revenue,
      costs,
      margin,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : null,
    };
  },
};
