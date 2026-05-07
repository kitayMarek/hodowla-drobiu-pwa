export type AccountType  = 'bank' | 'cash';
export type AccountScope = 'business' | 'personal' | 'shared';
export type TxType       = 'income' | 'expense' | 'transfer';
export type TxScope      = 'business' | 'personal';

export interface CashAccount {
  id?: number;
  name:           string;
  type:           AccountType;
  scope:          AccountScope;
  openingBalance: number;    // PLN, stan na dzień otwarcia
  isActive:       boolean;
  createdAt:      string;
}

export interface CashTransaction {
  id?: number;
  accountId:   number;
  date:        string;     // ISO 'YYYY-MM-DD'
  type:        TxType;
  scope:       TxScope;
  category:    string;
  description: string;
  amountPln:   number;     // zawsze > 0; kierunek wyznacza type
  toAccountId?: number;    // tylko przy type === 'transfer'
  notes?:      string;
  createdAt:   string;
}
