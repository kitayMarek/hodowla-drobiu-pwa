import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Expense } from '@/models/expense.model';
import type { ExpenseCategory } from '@/constants/phases';

function rowToExpense(r: Record<string, unknown>): Expense {
  return {
    id:            r.id as number,
    batchId:       r.batch_id as number | undefined,
    expenseDate:   r.expense_date as string,
    category:      r.category as ExpenseCategory,
    description:   r.description as string,
    amountPln:     r.amount_pln as number,
    createdAt:     r.created_at as string,
  };
}

export const financeService = {
  async getAllExpenses(): Promise<Expense[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('expenses').select('*')
        .eq('user_id', user.id).order('expense_date', { ascending: false });
      return (data ?? []).map(rowToExpense);
    }
    return db.expenses.orderBy('expenseDate').reverse().toArray();
  },

  async getExpensesByBatch(batchId: number): Promise<Expense[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('expenses').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId);
      return (data ?? []).map(rowToExpense);
    }
    return db.expenses.where('batchId').equals(batchId).toArray();
  },

  async getExpensesByCategory(category: ExpenseCategory): Promise<Expense[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('expenses').select('*')
        .eq('user_id', user.id).eq('category', category);
      return (data ?? []).map(rowToExpense);
    }
    return db.expenses.where('category').equals(category).toArray();
  },

  async getById(id: number): Promise<Expense | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('expenses').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToExpense(data) : undefined;
    }
    return db.expenses.get(id);
  },

  async createExpense(data: Omit<Expense, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('expenses').insert({
        user_id: user.id, batch_id: data.batchId ?? null,
        expense_date: data.expenseDate, category: data.category,
        description: data.description, amount_pln: data.amountPln, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.expenses.add({ ...data, createdAt: now });
  },

  async updateExpense(id: number, data: Partial<Expense>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.batchId     !== undefined) row.batch_id     = data.batchId;
      if (data.expenseDate !== undefined) row.expense_date = data.expenseDate;
      if (data.category    !== undefined) row.category     = data.category;
      if (data.description !== undefined) row.description  = data.description;
      if (data.amountPln   !== undefined) row.amount_pln   = data.amountPln;
      await supabase.from('expenses').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.expenses.update(id, data);
  },

  async deleteExpense(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('expenses').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.expenses.delete(id);
  },

  async getTotalExpenses(batchId?: number): Promise<number> {
    const expenses = batchId != null ? await this.getExpensesByBatch(batchId) : await this.getAllExpenses();
    return expenses.reduce((s, e) => s + e.amountPln, 0);
  },

  async getProfitLoss(batchId: number) {
    const [expenses, sales] = await Promise.all([
      this.getExpensesByBatch(batchId),
      (async () => {
        const user = await getAuthUser();
        if (user) {
          const { data } = await supabase.from('sales').select('total_revenue_pln')
            .eq('user_id', user.id).eq('batch_id', batchId);
          return data ?? [];
        }
        return db.sales.where('batchId').equals(batchId).toArray();
      })(),
    ]);
    const revenue = (sales as Array<{ totalRevenuePln?: number; total_revenue_pln?: number }>)
      .reduce((s, x) => s + (x.totalRevenuePln ?? x.total_revenue_pln ?? 0), 0);
    const costs   = expenses.reduce((s, e) => s + e.amountPln, 0);
    const margin  = revenue - costs;
    return { revenue, costs, margin, marginPercent: revenue > 0 ? (margin / revenue) * 100 : null };
  },
};
