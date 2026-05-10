import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { SlaughterRecord } from '@/models/slaughter.model';

function rowToSlaughter(r: Record<string, unknown>): SlaughterRecord {
  return {
    id:                   r.id as number,
    batchId:              r.batch_id as number,
    slaughterDate:        r.slaughter_date as string,
    ageAtSlaughterDays:   r.age_at_slaughter_days as number | undefined,
    birdsSlaughtered:     r.birds_slaughtered as number,
    liveWeightTotalKg:    (r.live_weight_total_kg as number) ?? 0,
    carcassWeightTotalKg: (r.carcass_weight_total_kg as number) ?? 0,
    dressingPercent:      r.dressing_percent as number | undefined,
    condemnedCount:       r.condemned_count as number | undefined,
    condemnedWeightKg:    r.condemned_weight_kg as number | undefined,
    slaughterHouseId:     r.slaughter_house_id as string | undefined,
    pricePerKgPln:        r.price_per_kg_pln as number | undefined,
    totalRevenuePln:      r.total_revenue_pln as number | undefined,
    notes:                r.notes as string | undefined,
    createdAt:            r.created_at as string,
  };
}

export const slaughterService = {
  async getByBatch(batchId: number): Promise<SlaughterRecord[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('slaughter_records').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .order('slaughter_date', { ascending: true });
      return (data ?? []).map(rowToSlaughter);
    }
    return db.slaughterRecords.where('batchId').equals(batchId).sortBy('slaughterDate');
  },

  async getAll(): Promise<SlaughterRecord[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('slaughter_records').select('*')
        .eq('user_id', user.id).order('slaughter_date', { ascending: false });
      return (data ?? []).map(rowToSlaughter);
    }
    return db.slaughterRecords.toArray();
  },

  async getById(id: number): Promise<SlaughterRecord | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('slaughter_records').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToSlaughter(data) : undefined;
    }
    return db.slaughterRecords.get(id);
  },

  async create(data: Omit<SlaughterRecord, 'id' | 'createdAt'>): Promise<number> {
    const dressingPercent = data.liveWeightTotalKg > 0
      ? (data.carcassWeightTotalKg / data.liveWeightTotalKg) * 100
      : undefined;
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('slaughter_records').insert({
        user_id: user.id, batch_id: data.batchId, slaughter_date: data.slaughterDate,
        age_at_slaughter_days: data.ageAtSlaughterDays ?? null,
        birds_slaughtered: data.birdsSlaughtered,
        live_weight_total_kg: data.liveWeightTotalKg,
        carcass_weight_total_kg: data.carcassWeightTotalKg,
        dressing_percent: dressingPercent ?? null,
        condemned_count: data.condemnedCount ?? null,
        condemned_weight_kg: data.condemnedWeightKg ?? null,
        slaughter_house_id: data.slaughterHouseId ?? null,
        price_per_kg_pln: data.pricePerKgPln ?? null,
        total_revenue_pln: data.totalRevenuePln ?? null,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.slaughterRecords.add({ ...data, dressingPercent, createdAt: now });
  },

  async update(id: number, data: Partial<SlaughterRecord>): Promise<void> {
    const user = await getAuthUser();
    const updates: Partial<SlaughterRecord> = { ...data };
    if (data.liveWeightTotalKg != null && data.carcassWeightTotalKg != null) {
      updates.dressingPercent = data.liveWeightTotalKg > 0
        ? (data.carcassWeightTotalKg / data.liveWeightTotalKg) * 100
        : undefined;
    }
    if (user) {
      const row: Record<string, unknown> = {};
      if (updates.slaughterDate       !== undefined) row.slaughter_date         = updates.slaughterDate;
      if (updates.ageAtSlaughterDays  !== undefined) row.age_at_slaughter_days  = updates.ageAtSlaughterDays;
      if (updates.birdsSlaughtered    !== undefined) row.birds_slaughtered       = updates.birdsSlaughtered;
      if (updates.liveWeightTotalKg   !== undefined) row.live_weight_total_kg    = updates.liveWeightTotalKg;
      if (updates.carcassWeightTotalKg!== undefined) row.carcass_weight_total_kg = updates.carcassWeightTotalKg;
      if (updates.dressingPercent     !== undefined) row.dressing_percent        = updates.dressingPercent;
      if (updates.condemnedCount      !== undefined) row.condemned_count         = updates.condemnedCount;
      if (updates.condemnedWeightKg   !== undefined) row.condemned_weight_kg     = updates.condemnedWeightKg;
      if (updates.pricePerKgPln       !== undefined) row.price_per_kg_pln        = updates.pricePerKgPln;
      if (updates.totalRevenuePln     !== undefined) row.total_revenue_pln       = updates.totalRevenuePln;
      if (updates.notes               !== undefined) row.notes                   = updates.notes;
      await supabase.from('slaughter_records').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.slaughterRecords.update(id, updates);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('slaughter_records').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.slaughterRecords.delete(id);
  },
};
