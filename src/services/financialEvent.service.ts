import { db } from '@/db/database';
import type { FinancialEvent, FinEventSource, FinEventType } from '@/models/financialEvent.model';

export const financialEventService = {

  async getPending(): Promise<FinancialEvent[]> {
    const all = await db.financialEvents.where('status').equals('pending').toArray();
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },

  async getAll(): Promise<FinancialEvent[]> {
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
    return db.financialEvents.add({
      ...data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  },

  /** Rozlicza dokument: tworzy CashTransaction i oznacza event jako settled. */
  async settle(eventId: number, cashAccountId: number, date: string): Promise<void> {
    const event = await db.financialEvents.get(eventId);
    if (!event || event.status === 'settled') return;

    const txId = await db.cashTransactions.add({
      accountId:   cashAccountId,
      date,
      type:        event.type === 'income' ? 'income' : 'expense',
      scope:       'business',
      category:    event.type === 'income' ? 'Sprzedaż' : 'Zakupy',
      description: event.description,
      amountPln:   event.amountPln,
      notes:       event.notes,
      createdAt:   new Date().toISOString(),
    });

    await db.financialEvents.update(eventId, {
      status:           'settled',
      cashAccountId,
      cashTransactionId: txId as number,
      settledAt:         new Date().toISOString(),
    });
  },

  /** Usuwa dokument i powiązaną CashTransaction (jeśli już rozliczona). */
  async delete(id: number): Promise<void> {
    const event = await db.financialEvents.get(id);
    if (event?.cashTransactionId) {
      await db.cashTransactions.delete(event.cashTransactionId);
    }
    await db.financialEvents.delete(id);
  },
};
