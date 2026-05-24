/**
 * Nota wewnętrzna – przesunięcie wartości między działalnościami.
 * Nie jest przepływem gotówkowym – nie zmienia salda kont.
 * Wpływa wyłącznie na wynik P&L per działalność:
 *   fromScope → przychód wewnętrzny (odzyskanie kosztu)
 *   toScope   → koszt wewnętrzny    (zużycie surowca)
 */
export interface InternalTransfer {
  id?:         number;
  date:        string;    // YYYY-MM-DD
  fromScope:   string;    // działalność "sprzedająca" surowiec, np. 'sery'
  toScope:     string;    // działalność "kupująca" surowiec, np. 'agroturystyka'
  amountPln:   number;
  description: string;
  notes?:      string;
  createdAt:   string;
}
