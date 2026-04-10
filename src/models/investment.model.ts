import type { InvestmentCategory } from '@/constants/phases';

export interface Investment {
  id?: number;
  purchaseDate: string;          // ISO 'YYYY-MM-DD'
  category: InvestmentCategory;
  name: string;                  // np. "Wentylator tunelowy Skov 55kW"
  supplier?: string;
  invoiceNumber?: string;
  amountPln: number;             // wartość zakupu
  usefulLifeYears?: number;      // okres amortyzacji w latach (opcjonalny)
  notes?: string;
  createdAt: string;
}
