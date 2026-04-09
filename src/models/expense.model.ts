import type { ExpenseCategory } from '@/constants/phases';

export interface Expense {
  id?: number;
  batchId?: number;          // undefined = koszt fermowy (nieprzypisany do partii)
  expenseDate: string;       // ISO 'YYYY-MM-DD'
  category: ExpenseCategory;
  description: string;
  amountPln: number;
  invoiceNumber?: string;
  supplierName?: string;
  notes?: string;
  createdAt: string;
}
