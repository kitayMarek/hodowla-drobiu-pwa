// Reprezentuje dokument finansowy (faktura sprzedaży, zakupu) w rozumieniu memoriałowym.
// Oddzielony od CashTransaction – wpływa do kasy dopiero po rozliczeniu (settle).

export type FinEventType   = 'income' | 'expense';
export type FinEventStatus = 'pending' | 'settled';
export type FinEventSource = 'sale' | 'expense' | 'feed_delivery';

export interface FinancialEvent {
  id?: number;
  date:        string;           // YYYY-MM-DD – data zdarzenia gospodarczego
  type:        FinEventType;     // income = należność, expense = zobowiązanie
  amountPln:   number;
  description: string;
  sourceType:  FinEventSource;
  sourceId:    number;           // id rekordu Sale / Expense / FeedDelivery

  status:             FinEventStatus;   // pending → do rozliczenia, settled → rozliczone
  cashAccountId?:     number;           // konto, na które wpłynęło/z którego wyszło
  cashTransactionId?: number;           // powiązana CashTransaction
  settledAt?:         string;

  notes?:    string;
  createdAt: string;
}
