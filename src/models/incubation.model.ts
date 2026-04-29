import type { Species } from '@/constants/species';

export type IncubationStatus = 'incubating' | 'lockdown' | 'completed' | 'cancelled';

export interface Incubation {
  id?: number;
  name: string;
  startDate: string;           // YYYY-MM-DD – data nałożenia jaj

  // Parametry etapu 1: inkubacja właściwa
  incubationTempC: number;
  incubationHumidityPct: number;

  // Parametry etapu 2: lockdown / klucie
  lockdownTempC: number;
  lockdownHumidityPct: number;

  // Długość cyklu
  totalDays: number;           // np. 21 dla kur
  lockdownDay: number;         // od którego dnia zaczyna się lockdown, np. 18

  status: IncubationStatus;

  // Wyniki świetlenia (ok. 7. dnia)
  candlingDate?: string;
  candlingFertileCount?: number;
  candlingInfertileCount?: number;
  candlingNotDeveloped?: number;  // zatrzymany rozwój

  // Wyniki wylęgu
  hatchDate?: string;
  totalHatched?: number;
  totalUnhatched?: number;

  // Powiązanie z nowym stadem po zakończeniu wylęgu
  resultBatchId?: number;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncubationEggGroup {
  id?: number;
  incubationId: number;
  species: Species;
  breed?: string;
  count: number;
  hatchingEggLotId?: number; // partia z magazynu jaj wylęgowych (opcjonalna)
  // Wyniki świetlenia per grupa
  candlingFertile?: number;
  candlingInfertile?: number;
  candlingNotDeveloped?: number;
  notes?: string;
  createdAt: string;
}
