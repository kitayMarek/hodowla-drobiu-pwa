import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Weighing } from '@/models/weighing.model';

function rowToWeighing(r: Record<string, unknown>): Weighing {
  return {
    id:                   r.id as number,
    batchId:              r.batch_id as number,
    weighingDate:         r.weighing_date as string,
    ageAtWeighingDays:    (r.age_at_weighing_days as number) ?? 0,
    method:               (r.method as Weighing['method']) ?? 'sample',
    sampleSize:           r.sample_size as number | undefined,
    averageWeightGrams:   r.average_weight_grams as number,
    minWeightGrams:       r.min_weight_grams as number | undefined,
    maxWeightGrams:       r.max_weight_grams as number | undefined,
    notes:                r.notes as string | undefined,
    createdAt:            r.created_at as string,
  };
}

export const weighingService = {
  async getByBatch(batchId: number): Promise<Weighing[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('weighings').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .order('weighing_date', { ascending: true });
      return (data ?? []).map(rowToWeighing);
    }
    return db.weighings.where('batchId').equals(batchId).sortBy('weighingDate');
  },

  async getAll(): Promise<Weighing[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('weighings').select('*').eq('user_id', user.id);
      return (data ?? []).map(rowToWeighing);
    }
    return db.weighings.toArray();
  },

  async getLatest(batchId: number): Promise<Weighing | undefined> {
    const all = await this.getByBatch(batchId);
    return all[all.length - 1];
  },

  async getById(id: number): Promise<Weighing | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('weighings').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToWeighing(data) : undefined;
    }
    return db.weighings.get(id);
  },

  async create(data: Omit<Weighing, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('weighings').insert({
        user_id: user.id, batch_id: data.batchId, weighing_date: data.weighingDate,
        age_at_weighing_days: data.ageAtWeighingDays, method: data.method,
        sample_size: data.sampleSize ?? null, average_weight_grams: data.averageWeightGrams,
        min_weight_grams: data.minWeightGrams ?? null, max_weight_grams: data.maxWeightGrams ?? null,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.weighings.add({ ...data, createdAt: now });
  },

  async update(id: number, data: Partial<Weighing>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.weighingDate        !== undefined) row.weighing_date         = data.weighingDate;
      if (data.ageAtWeighingDays   !== undefined) row.age_at_weighing_days  = data.ageAtWeighingDays;
      if (data.method              !== undefined) row.method                = data.method;
      if (data.sampleSize          !== undefined) row.sample_size           = data.sampleSize;
      if (data.averageWeightGrams  !== undefined) row.average_weight_grams  = data.averageWeightGrams;
      if (data.minWeightGrams      !== undefined) row.min_weight_grams      = data.minWeightGrams;
      if (data.maxWeightGrams      !== undefined) row.max_weight_grams      = data.maxWeightGrams;
      if (data.notes               !== undefined) row.notes                 = data.notes;
      await supabase.from('weighings').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.weighings.update(id, data);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('weighings').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.weighings.delete(id);
  },
};
