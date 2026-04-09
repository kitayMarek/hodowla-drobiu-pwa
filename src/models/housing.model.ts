import type { LitterCondition } from '@/constants/phases';

export interface Housing {
  id?: number;
  batchId: number;
  recordDate: string;        // ISO 'YYYY-MM-DD'
  recordTime?: string;       // 'HH:MM'
  // Temperatura
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureAvg?: number;
  // Wilgotność
  humidityMin?: number;
  humidityMax?: number;
  humidityAvg?: number;
  // Powietrze
  co2Ppm?: number;
  ammoniaPpm?: number;
  // Oświetlenie i wentylacja
  lightingHours?: number;
  ventilationLevel?: number; // 1-10
  // Powierzchnia i obsada
  surfaceM2?: number;
  densityBirdsPerM2?: number;
  // Ściółka
  litterCondition?: LitterCondition;
  // Wybieg
  hasOutdoorAccess?: boolean;
  outdoorAreaM2?: number;
  // Przejście z odchowalnika
  movedFromBrooderDate?: string;
  notes?: string;
  createdAt: string;
}
