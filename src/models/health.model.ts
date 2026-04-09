import type { HealthEventType } from '@/constants/phases';

export interface HealthEvent {
  id?: number;
  batchId: number;
  eventDate: string;         // ISO 'YYYY-MM-DD'
  eventType: HealthEventType;
  diagnosis?: string;
  treatment?: string;
  medicationName?: string;
  dosageMgPerKg?: number;
  durationDays?: number;
  withdrawalPeriodDays?: number; // Karencja – bezpieczeństwo żywności
  affectedCount?: number;
  costPln?: number;
  veterinarianName?: string;
  notes?: string;
  createdAt: string;
}
