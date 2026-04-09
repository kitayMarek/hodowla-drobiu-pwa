export interface DailyEntry {
  id?: number;
  batchId: number;
  date: string;              // ISO 'YYYY-MM-DD'
  // Padnięcia
  deadCount: number;
  culledCount: number;
  // Pasza
  feedConsumedKg: number;
  feedTypeId?: number;
  // Woda
  waterLiters?: number;
  // Jaja (nioski)
  eggsCollected?: number;
  eggsDefective?: number;
  // Ważenie wyrywkowe
  sampleWeightGrams?: number;
  sampleSize?: number;
  // Warunki
  temperatureCelsius?: number;
  humidity?: number;
  notes?: string;
  createdAt: string;
}
