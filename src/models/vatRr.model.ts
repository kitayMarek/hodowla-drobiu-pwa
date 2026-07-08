// ── Faktura VAT RR ───────────────────────────────────────────────
// Model domenowy: właściciel gospodarstwa (rolnik ryczałtowy) = DOSTAWCA
// sprzedaje produkty rolne czynnemu podatnikowi VAT (NABYWCA = odbiorca).
// Fermly generuje PROJEKT dokumentu — numer faktury nadaje nabywca.
// Kwoty pieniężne trzymamy w GROSZACH (całkowite). Konwersja PLN dopiero na UI/kasę.

import type { ProductUnit } from './dairy.model';

export type VatRrStatus = 'draft' | 'printed' | 'numbered' | 'paid' | 'void';
export type VatRrPaymentMethod = 'transfer' | 'cash';

export const VAT_RR_STATUS_LABELS: Record<VatRrStatus, string> = {
  draft:    'Projekt',
  printed:  'Wydrukowana',
  numbered: 'Ponumerowana',
  paid:     'Opłacona',
  void:     'Anulowana',
};

export const VAT_RR_STATUS_COLORS: Record<VatRrStatus, string> = {
  draft:    'bg-gray-100 text-gray-600',
  printed:  'bg-blue-100 text-blue-700',
  numbered: 'bg-amber-100 text-amber-700',
  paid:     'bg-green-100 text-green-700',
  void:     'bg-red-100 text-red-600',
};

export interface VatRrLine {
  id?: number;
  invoiceId?: number;
  position: number;
  productId?: number;         // opcjonalny prefill z dairy_products
  productName: string;
  qualityClass?: string;      // opis klasy lub jakości (art. 116 ust. 2)
  unit: ProductUnit;
  quantityMilli: number;      // ilość × 1000 (całkowite)
  unitPriceGr: number;        // cena netto w groszach
  netValueGr: number;
}

export interface VatRrInvoice {
  id?: number;

  buyerId?: number;           // reuse dairy_buyers
  buyerName?: string;         // snapshot
  buyerAddress?: string;
  buyerNip?: string;

  docRef: string;             // wewnętrzna referencja, np. RR/2026/0007
  invoiceNumber?: string;     // numer faktury — nadaje NABYWCA; puste = projekt
  purchaseDate: string;       // 'YYYY-MM-DD' — data dokonania nabycia
  issueDate?: string;         // data wystawienia (nabywca)

  netTotalGr: number;
  flatRatePct: number;        // domyślnie 7
  flatRateGr: number;
  grossTotalGr: number;

  paymentMethod: VatRrPaymentMethod;
  paidAt?: string;
  paymentRef?: string;

  status: VatRrStatus;

  inRhd: boolean;
  rhdNumber?: number;
  rhdYear?: number;
  cashAccountId?: number;

  notes?: string;
  createdAt: string;
  updatedAt?: string;

  lines?: VatRrLine[];        // dołączane przy odczycie szczegółu
}

/** Oświadczenie rolnika ryczałtowego — art. 116 ust. 3 ustawy o VAT. Drukowane DOSŁOWNIE. */
export const OSWIADCZENIE_ROLNIKA =
  'Oświadczam, że jestem rolnikiem ryczałtowym zwolnionym od podatku od towarów i usług ' +
  'na podstawie art. 43 ust. 1 pkt 3 ustawy o podatku od towarów i usług.';
