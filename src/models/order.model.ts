export type OrderType   = 'jaja' | 'ptaki_zywe' | 'tuszki';
export type OrderStatus = 'oczekujace' | 'zrealizowane' | 'anulowane';

export interface Order {
  id?: number;
  batchId:            number;
  orderType:          OrderType;
  plannedDate:        string;   // ISO YYYY-MM-DD – planowana data realizacji
  quantity?:          number;   // szt. jaj (jaja) lub szt. ptaków (ptaki/tuszki)
  weightKg?:          number;   // szacowana masa (tuszki / ptaki żywe)
  pricePerUnit?:      number;   // PLN/jajko lub PLN/kg – pomocnicze
  estimatedPricePln:  number;   // łączna szacunkowa wartość
  status:             OrderStatus;
  buyerName?:         string;
  phone?:             string;
  notes?:             string;
  createdAt:          string;
}
