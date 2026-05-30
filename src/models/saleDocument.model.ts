import type { DairySale } from '@/models/dairy.model';
import type { Sale } from '@/models/sale.model';

export interface SaleDocument {
  id?: number;
  docDate: string;           // YYYY-MM-DD
  buyerName?: string;        // denormalizacja
  buyerId?: number;          // ref do DairyBuyer
  buyerAddress?: string;
  buyerPhone?: string;
  inRhd: boolean;
  rhdNumber?: number;        // jeden numer na cały dokument
  rhdYear?: number;
  cashAccountId?: number;
  totalValuePln: number;     // suma wszystkich linii
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleDocumentWithLines extends SaleDocument {
  dairyLines: DairySale[];
  drobLines: Sale[];
}

/** Linia sprzedaży w ujednoliconym widoku */
export interface SaleLineDisplay {
  id: number;
  activity: 'drob' | 'sery';
  icon: string;
  label: string;
  detail: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  totalValue: number;
  /** Dane oryginalne do edycji */
  raw: DairySale | Sale;
}
