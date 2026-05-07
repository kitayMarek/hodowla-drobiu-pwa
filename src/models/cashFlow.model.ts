export type AccountType  = 'bank' | 'cash';
export type AccountScope = 'drob' | 'sery' | 'agroturystyka' | 'osobiste' | 'shared';
export type TxType       = 'income' | 'expense' | 'transfer';
export type TxScope      = 'drob' | 'sery' | 'agroturystyka' | 'osobiste';

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

export interface CashCategory {
  id?: number;
  name:      string;
  scope?:    TxScope;   // undefined = dostępna dla wszystkich działalności
  type?:     TxType;    // undefined = dla wpływu i wydatku
  isSystem:  boolean;
  createdAt: string;
}
