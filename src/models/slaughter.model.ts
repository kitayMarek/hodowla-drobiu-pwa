export interface SlaughterRecord {
  id?: number;
  batchId: number;
  slaughterDate: string;      // ISO 'YYYY-MM-DD'
  ageAtSlaughterDays?: number;
  birdsSlaughtered: number;
  liveWeightTotalKg: number;
  carcassWeightTotalKg: number;
  dressingPercent?: number;   // Auto-licz: carcass/live*100
  condemnedCount?: number;
  condemnedWeightKg?: number;
  slaughterHouseId?: string;
  pricePerKgPln?: number;
  totalRevenuePln?: number;
  notes?: string;
  createdAt: string;
}
