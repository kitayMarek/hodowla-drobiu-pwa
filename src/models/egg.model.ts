export interface EggPurchase {
  id?: number;
  purchaseDate: string;      // YYYY-MM-DD
  count: number;
  pricePerEgg?: number;
  totalCostPln: number;
  supplierName?: string;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface EggHatchTransfer {
  id?: number;
  transferDate: string;      // YYYY-MM-DD
  count: number;
  sourceBatchId?: number;    // które stado niosek (opcjonalne)
  pricePerEgg?: number;
  totalRevenuePln?: number;
  hatchingEggLotId?: number; // powiązana partia w magazynie wylęgarni
  notes?: string;
  createdAt: string;
}
