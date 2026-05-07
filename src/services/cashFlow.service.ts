import { db } from '@/db/database';
import type { CashAccount, CashTransaction, CashCategory, TxScope, TxType } from '@/models/cashFlow.model';

export const cashFlowService = {
  // ── Konta ──────────────────────────────────────────────────────────────────

  async getAccounts(): Promise<CashAccount[]> {
    const all = await db.cashAccounts.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getActiveAccounts(): Promise<CashAccount[]> {
    const all = await db.cashAccounts.filter(a => a.isActive).toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async createAccount(data: Omit<CashAccount, 'id' | 'createdAt'>): Promise<number> {
    return db.cashAccounts.add({ ...data, createdAt: new Date().toISOString() });
  },

  async updateAccount(id: number, data: Partial<CashAccount>): Promise<void> {
    await db.cashAccounts.update(id, data);
  },

  // ── Transakcje ─────────────────────────────────────────────────────────────

  async getTransactions(accountId?: number): Promise<CashTransaction[]> {
    const all = accountId != null
      ? await db.cashTransactions.where('accountId').equals(accountId).toArray()
      : await db.cashTransactions.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async createTransaction(data: Omit<CashTransaction, 'id' | 'createdAt'>): Promise<number> {
    return db.cashTransactions.add({ ...data, createdAt: new Date().toISOString() });
  },

  async createTransfer(
    fromAccountId: number,
    toAccountId: number,
    date: string,
    amountPln: number,
    description: string,
  ): Promise<void> {
    const base = { date, amountPln, description, category: 'transfer', createdAt: new Date().toISOString() };
    await db.cashTransactions.add({ ...base, accountId: fromAccountId, toAccountId, type: 'transfer', scope: 'drob' });
    await db.cashTransactions.add({ ...base, accountId: toAccountId,   toAccountId: fromAccountId, type: 'transfer', scope: 'drob' });
  },

  async deleteTransaction(id: number): Promise<void> {
    await db.cashTransactions.delete(id);
  },

  // ── Kategorie ──────────────────────────────────────────────────────────────

  async getCategories(scope?: TxScope, type?: TxType): Promise<CashCategory[]> {
    const all = await db.cashCategories.toArray();
    return all
      .filter(c => {
        if (scope && c.scope != null && c.scope !== scope) return false;
        if (type  && c.type  != null && c.type  !== type)  return false;
        return true;
      })
      .sort((a, b) => {
        // Najpierw pasujące do zakresu, potem ogólne
        if (a.scope === scope && b.scope !== scope) return -1;
        if (a.scope !== scope && b.scope === scope) return  1;
        return a.name.localeCompare(b.name, 'pl');
      });
  },

  async getAllCategories(): Promise<CashCategory[]> {
    const all = await db.cashCategories.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  },

  async createCategory(name: string, scope?: TxScope, type?: TxType): Promise<number> {
    return db.cashCategories.add({
      name: name.trim(),
      scope,
      type,
      isSystem: false,
      createdAt: new Date().toISOString(),
    });
  },

  async deleteCategory(id: number): Promise<void> {
    await db.cashCategories.delete(id);
  },

  // ── Obliczenia ─────────────────────────────────────────────────────────────

  async getAccountBalance(account: CashAccount, transactions: CashTransaction[]): Promise<number> {
    const txs = transactions.filter(t => t.accountId === account.id);
    const delta = txs.reduce((sum, t) => {
      if (t.type === 'income')   return sum + t.amountPln;
      if (t.type === 'expense')  return sum - t.amountPln;
      // transfer: wypływ z konta lub wpływ (toAccountId wskazuje kierunek)
      if (t.type === 'transfer') {
        const isOutgoing = txs.some(o => o.toAccountId === account.id && o.date === t.date && o.amountPln === t.amountPln && o.id !== t.id);
        return isOutgoing ? sum - t.amountPln : sum + t.amountPln;
      }
      return sum;
    }, 0);
    return account.openingBalance + delta;
  },
};
