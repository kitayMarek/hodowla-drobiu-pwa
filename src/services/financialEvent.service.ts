import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { FinancialEvent, FinEventSource, FinEventType } from '@/models/financialEvent.model';

function rowToEvent(r: Record<string, unknown>): FinancialEvent {
  return {
    id:                 r.id as number,
    date:               r.date as string,
    type:               r.type as FinEventType,
    amountPln:          r.amount_pln as number,
    description:        r.description as string,
    sourceType:         r.source_type as FinEventSource,
    sourceId:           r.source_id as number,
    status:             r.status as FinancialEvent['status'],
    cashAccountId:      r.cash_account_id as number | undefined,
    cashTransactionId:  r.cash_transaction_id as number | undefined,
    settledAt:          r.settled_at as string | undefined,
    notes:              r.notes as string | undefined,
    createdAt:          r.created_at as string,
  };
}

export const financialEventService = {
  async getPending(): Promise<FinancialEvent[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('financial_events').select('*')
        .eq('user_id', user.id).eq('status', 'pending').order('date', { ascending: false });
      return (data ?? []).map(rowToEvent);
    }
    const all = await db.financialEvents.where('status').equals('pending').toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async getAll(): Promise<FinancialEvent[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('financial_events').select('*')
        .eq('user_id', user.id).order('date', { ascending: false });
      return (data ?? []).map(rowToEvent);
    }
    const all = await db.financialEvents.toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async create(data: {
    date:        string;
    type:        FinEventType;
    amountPln:   number;
    description: string;
    sourceType:  FinEventSource;
    sourceId:    number;
    notes?:      string;
  }): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('financial_events').insert({
        user_id: user.id, date: data.date, type: data.type, amount_pln: data.amountPln,
        description: data.description, source_type: data.sourceType, source_id: data.sourceId,
        status: 'pending', notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) {
        console.error('financial_events insert error:', JSON.stringify(error));
        throw new Error(error.message ?? JSON.stringify(error));
      }
      if (!row) throw new Error('financial_events: brak odpowiedzi z Supabase po zapisie');
      return row.id;
    }
    // tryb offline – Dexie
    return db.financialEvents.add({ ...data, status: 'pending', createdAt: now });
  },

  async settle(eventId: number, cashAccountId: number, date: string): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const { data: event } = await supabase.from('financial_events').select('*')
        .eq('id', eventId).eq('user_id', user.id).single();
      if (!event || event.status === 'settled') return;
      const now = new Date().toISOString();
      const { data: tx, error } = await supabase.from('cash_transactions').insert({
        user_id: user.id, account_id: cashAccountId, date,
        type: event.type === 'income' ? 'income' : 'expense',
        scope: 'drob',
        category: event.type === 'income' ? 'Sprzedaż drobiu' : 'Zakup piskląt',
        description: event.description, amount_pln: event.amount_pln,
        to_account_id: null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      await supabase.from('financial_events').update({
        status: 'settled', cash_account_id: cashAccountId,
        cash_transaction_id: tx.id, settled_at: now,
      }).eq('id', eventId).eq('user_id', user.id);
      return;
    }

    const event = await db.financialEvents.get(eventId);
    if (!event || event.status === 'settled') return;
    const txId = await db.cashTransactions.add({
      accountId: cashAccountId, date,
      type: event.type === 'income' ? 'income' : 'expense',
      scope: 'drob',
      category: event.type === 'income' ? 'Sprzedaż drobiu' : 'Zakup piskląt',
      description: event.description, amountPln: event.amountPln,
      createdAt: new Date().toISOString(),
    });
    await db.financialEvents.update(eventId, {
      status: 'settled', cashAccountId,
      cashTransactionId: txId as number, settledAt: new Date().toISOString(),
    });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const { data: event } = await supabase.from('financial_events').select('cash_transaction_id')
        .eq('id', id).eq('user_id', user.id).single();
      if (event?.cash_transaction_id) {
        await supabase.from('cash_transactions')
          .delete().eq('id', event.cash_transaction_id).eq('user_id', user.id);
      }
      await supabase.from('financial_events').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    const event = await db.financialEvents.get(id);
    if (event?.cashTransactionId) await db.cashTransactions.delete(event.cashTransactionId);
    await db.financialEvents.delete(id);
  },
};
