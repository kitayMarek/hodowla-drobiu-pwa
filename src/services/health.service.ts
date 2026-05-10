import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { HealthEvent } from '@/models/health.model';
import type { HealthEventType } from '@/constants/phases';
import { addDays, parseISO, isAfter } from 'date-fns';

function rowToHealth(r: Record<string, unknown>): HealthEvent {
  return {
    id:                   r.id as number,
    batchId:              r.batch_id as number,
    eventDate:            r.event_date as string,
    eventType:            r.event_type as HealthEventType,
    diagnosis:            r.diagnosis as string | undefined,
    treatment:            r.treatment as string | undefined,
    medicationName:       r.medication_name as string | undefined,
    dosageMgPerKg:        r.dosage_mg_per_kg as number | undefined,
    durationDays:         r.duration_days as number | undefined,
    withdrawalPeriodDays: r.withdrawal_period_days as number | undefined,
    affectedCount:        r.affected_count as number | undefined,
    costPln:              r.cost_pln as number | undefined,
    veterinarianName:     r.veterinarian_name as string | undefined,
    notes:                r.notes as string | undefined,
    createdAt:            r.created_at as string,
  };
}

export const healthService = {
  async getByBatch(batchId: number): Promise<HealthEvent[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('health_events').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .order('event_date', { ascending: true });
      return (data ?? []).map(rowToHealth);
    }
    return db.healthEvents.where('batchId').equals(batchId).sortBy('eventDate');
  },

  async getByType(batchId: number, type: HealthEventType): Promise<HealthEvent[]> {
    const all = await this.getByBatch(batchId);
    return all.filter(e => e.eventType === type);
  },

  async getById(id: number): Promise<HealthEvent | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('health_events').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToHealth(data) : undefined;
    }
    return db.healthEvents.get(id);
  },

  async create(data: Omit<HealthEvent, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('health_events').insert({
        user_id: user.id, batch_id: data.batchId, event_date: data.eventDate,
        event_type: data.eventType, diagnosis: data.diagnosis ?? null,
        treatment: data.treatment ?? null, medication_name: data.medicationName ?? null,
        dosage_mg_per_kg: data.dosageMgPerKg ?? null, duration_days: data.durationDays ?? null,
        withdrawal_period_days: data.withdrawalPeriodDays ?? null,
        affected_count: data.affectedCount ?? null, cost_pln: data.costPln ?? null,
        veterinarian_name: data.veterinarianName ?? null,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.healthEvents.add({ ...data, createdAt: now });
  },

  async update(id: number, data: Partial<HealthEvent>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.eventDate           !== undefined) row.event_date            = data.eventDate;
      if (data.eventType           !== undefined) row.event_type            = data.eventType;
      if (data.diagnosis           !== undefined) row.diagnosis             = data.diagnosis;
      if (data.treatment           !== undefined) row.treatment             = data.treatment;
      if (data.medicationName      !== undefined) row.medication_name       = data.medicationName;
      if (data.dosageMgPerKg       !== undefined) row.dosage_mg_per_kg      = data.dosageMgPerKg;
      if (data.durationDays        !== undefined) row.duration_days         = data.durationDays;
      if (data.withdrawalPeriodDays!== undefined) row.withdrawal_period_days= data.withdrawalPeriodDays;
      if (data.affectedCount       !== undefined) row.affected_count        = data.affectedCount;
      if (data.costPln             !== undefined) row.cost_pln              = data.costPln;
      if (data.veterinarianName    !== undefined) row.veterinarian_name     = data.veterinarianName;
      if (data.notes               !== undefined) row.notes                 = data.notes;
      await supabase.from('health_events').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.healthEvents.update(id, data);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('health_events').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.healthEvents.delete(id);
  },

  async getActiveWithdrawals(batchId: number): Promise<HealthEvent[]> {
    const events = await this.getByBatch(batchId);
    const today = new Date();
    return events.filter(e => {
      if (!e.withdrawalPeriodDays || e.withdrawalPeriodDays <= 0) return false;
      const withdrawalEnd = addDays(parseISO(e.eventDate), e.withdrawalPeriodDays);
      return isAfter(withdrawalEnd, today);
    });
  },

  async getTotalHealthCost(batchId: number): Promise<number> {
    const events = await this.getByBatch(batchId);
    return events.reduce((s, e) => s + (e.costPln ?? 0), 0);
  },
};
