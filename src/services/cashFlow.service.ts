import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { CashAccount, CashTransaction, CashCategory, TxScope, TxType } from '@/models/cashFlow.model';

// ── mappers ──────────────────────────────────────────────────

function rowToAccount(r: Record<string, unknown>): CashAccount {
  return {
    id:             r.id as number,
    name:           r.name as string,
    type:           r.type as CashAccount['type'],
    scope:          r.scope as CashAccount['scope'],
    openingBalance: r.opening_balance as number,
    isActive:       r.is_active as boolean,
    createdAt:      r.created_at as string,
  };
}

function rowToTransaction(r: Record<string, unknown>): CashTransaction {
  return {
    id:          r.id as number,
    accountId:   r.account_id as number,
    date:        r.date as string,
    type:        r.type as CashTransaction['type'],
    scope:       r.scope as CashTransaction['scope'],
    category:    r.category as string,
    description: r.description as string,
    amountPln:   r.amount_pln as number,
    toAccountId: r.to_account_id as number | undefined,
    createdAt:   r.created_at as string,
  };
}

function rowToCategory(r: Record<string, unknown>): CashCategory {
  return {
    id:        r.id as number,
    name:      r.name as string,
    scope:     r.scope as TxScope | undefined,
    type:      r.type as TxType | undefined,
    isSystem:  r.is_system as boolean,
    createdAt: r.created_at as string,
  };
}

const DEFAULT_CATEGORIES = [
  { name: 'Sprzedaż drobiu',         scope: 'drob',          type: 'income',  isSystem: true },
  { name: 'Sprzedaż jaj',            scope: 'drob',          type: 'income',  isSystem: true },
  { name: 'Zakup piskląt',           scope: 'drob',          type: 'expense', isSystem: true },
  { name: 'Pasza',                   scope: 'drob',          type: 'expense', isSystem: true },
  { name: 'Leki i weterynarz',       scope: 'drob',          type: 'expense', isSystem: true },
  { name: 'Szczepienia',             scope: 'drob',          type: 'expense', isSystem: true },
  { name: 'Sprzedaż serów',          scope: 'sery',          type: 'income',  isSystem: true },
  { name: 'Zakup mleka',             scope: 'sery',          type: 'expense', isSystem: true },
  { name: 'Podpuszczka i kultury',   scope: 'sery',          type: 'expense', isSystem: true },
  { name: 'Noclegi',                 scope: 'agroturystyka', type: 'income',  isSystem: true },
  { name: 'Wyżywienie gości',        scope: 'agroturystyka', type: 'income',  isSystem: true },
  { name: 'Wynajem sali',            scope: 'agroturystyka', type: 'income',  isSystem: true },
  { name: 'Wyposażenie i remonty',   scope: 'agroturystyka', type: 'expense', isSystem: true },
  { name: 'Reklama i marketing',     scope: 'agroturystyka', type: 'expense', isSystem: true },
  { name: 'Wynagrodzenie właściciela', scope: 'osobiste',    type: 'income',  isSystem: true },
  { name: 'Zakupy osobiste',         scope: 'osobiste',      type: 'expense', isSystem: true },
  { name: 'Dom i mieszkanie',        scope: 'osobiste',      type: 'expense', isSystem: true },
  { name: 'Energia i media',         scope: null,            type: null,      isSystem: true },
  { name: 'Pracownicy',              scope: null,            type: null,      isSystem: true },
  { name: 'Transport',               scope: null,            type: null,      isSystem: true },
  { name: 'Naprawy i konserwacja',   scope: null,            type: null,      isSystem: true },
  { name: 'Podatki i ubezpieczenia', scope: null,            type: null,      isSystem: true },
  { name: 'Inne',                    scope: null,            type: null,      isSystem: true },
];

// ── service ──────────────────────────────────────────────────

export const cashFlowService = {
  // ── Konta ──────────────────────────────────────────────────

  async getAccounts(): Promise<CashAccount[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('cash_accounts').select('*').eq('user_id', user.id).order('name');
      return (data ?? []).map(rowToAccount);
    }
    const all = await db.cashAccounts.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getActiveAccounts(): Promise<CashAccount[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('cash_accounts').select('*')
        .eq('user_id', user.id).eq('is_active', true).order('name');
      return (data ?? []).map(rowToAccount);
    }
    const all = await db.cashAccounts.filter(a => a.isActive).toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async createAccount(data: Omit<CashAccount, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('cash_accounts').insert({
        user_id: user.id, name: data.name, type: data.type, scope: data.scope,
        opening_balance: data.openingBalance, is_active: data.isActive,
        currency: 'PLN', created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.cashAccounts.add({ ...data, createdAt: now });
  },

  async updateAccount(id: number, data: Partial<CashAccount>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.name           !== undefined) row.name            = data.name;
      if (data.type           !== undefined) row.type            = data.type;
      if (data.scope          !== undefined) row.scope           = data.scope;
      if (data.openingBalance !== undefined) row.opening_balance = data.openingBalance;
      if (data.isActive       !== undefined) row.is_active       = data.isActive;
      await supabase.from('cash_accounts').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.cashAccounts.update(id, data);
  },

  // ── Transakcje ─────────────────────────────────────────────

  async getTransactions(accountId?: number): Promise<CashTransaction[]> {
    const user = await getAuthUser();
    if (user) {
      let q = supabase.from('cash_transactions').select('*').eq('user_id', user.id);
      if (accountId != null) q = q.eq('account_id', accountId);
      const { data } = await q.order('date', { ascending: false });
      return (data ?? []).map(rowToTransaction);
    }
    const all = accountId != null
      ? await db.cashTransactions.where('accountId').equals(accountId).toArray()
      : await db.cashTransactions.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async createTransaction(data: Omit<CashTransaction, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('cash_transactions').insert({
        user_id: user.id, account_id: data.accountId, date: data.date,
        type: data.type, scope: data.scope, category: data.category,
        description: data.description, amount_pln: data.amountPln,
        to_account_id: data.toAccountId ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.cashTransactions.add({ ...data, createdAt: now });
  },

  async createTransfer(
    fromAccountId: number,
    toAccountId: number,
    date: string,
    amountPln: number,
    description: string,
  ): Promise<void> {
    await this.createTransaction({
      accountId: fromAccountId, toAccountId,
      date, amountPln, description,
      category: 'transfer', type: 'transfer', scope: 'drob',
    });
  },

  async deleteTransaction(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('cash_transactions').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.cashTransactions.delete(id);
  },

  // ── Kategorie ──────────────────────────────────────────────

  async getCategories(scope?: TxScope, type?: TxType): Promise<CashCategory[]> {
    const all = await this.getAllCategories();
    return all
      .filter(c => {
        if (scope && c.scope != null && c.scope !== scope) return false;
        if (type  && c.type  != null && c.type  !== type)  return false;
        return true;
      })
      .sort((a, b) => {
        if (a.scope === scope && b.scope !== scope) return -1;
        if (a.scope !== scope && b.scope === scope) return  1;
        return a.name.localeCompare(b.name, 'pl');
      });
  },

  async getAllCategories(): Promise<CashCategory[]> {
    const user = await getAuthUser();
    if (user) {
      // Seed domyślnych kategorii dla nowego użytkownika
      const { count } = await supabase.from('cash_categories')
        .select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      if ((count ?? 0) === 0) {
        const now = new Date().toISOString();
        await supabase.from('cash_categories').insert(
          DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id, created_at: now }))
        );
      }
      const { data } = await supabase.from('cash_categories').select('*').eq('user_id', user.id);
      return (data ?? []).map(rowToCategory)
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    }
    const all = await db.cashCategories.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  },

  async createCategory(name: string, scope?: TxScope, type?: TxType): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('cash_categories').insert({
        user_id: user.id, name: name.trim(), scope: scope ?? null,
        type: type ?? null, is_system: false, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.cashCategories.add({ name: name.trim(), scope, type, isSystem: false, createdAt: now });
  },

  async deleteCategory(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('cash_categories').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.cashCategories.delete(id);
  },

  async getAccountBalance(account: CashAccount, transactions: CashTransaction[]): Promise<number> {
    const txs = transactions.filter(t => t.accountId === account.id);
    const delta = txs.reduce((sum, t) => {
      if (t.type === 'income')  return sum + t.amountPln;
      if (t.type === 'expense') return sum - t.amountPln;
      if (t.type === 'transfer') {
        const isOutgoing = txs.some(o =>
          o.toAccountId === account.id && o.date === t.date && o.amountPln === t.amountPln && o.id !== t.id
        );
        return isOutgoing ? sum - t.amountPln : sum + t.amountPln;
      }
      return sum;
    }, 0);
    return account.openingBalance + delta;
  },
};
