import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Batch } from '@/models/batch.model';
import type { BatchStatus } from '@/constants/phases';

// ── mappers ──────────────────────────────────────────────────

function rowToBatch(r: Record<string, unknown>): Batch {
  return {
    id:                  r.id as number,
    name:                r.name as string,
    species:             r.species as Batch['species'],
    breed:               r.breed as string | undefined,
    status:              r.status as Batch['status'],
    startDate:           r.start_date as string,
    plannedEndDate:      r.planned_end_date as string | undefined,
    actualEndDate:       r.actual_end_date as string | undefined,
    initialCount:        r.initial_count as number,
    initialWeightGrams:  r.initial_weight_grams as number | undefined,
    sourceType:          r.source_type as Batch['sourceType'],
    chick_cost_per_unit: r.chick_cost_per_unit as number | undefined,
    transport_cost:      r.transport_cost as number | undefined,
    housingId:           r.housing_id as string | undefined,
    notes:               r.notes as string | undefined,
    createdAt:           r.created_at as string,
    updatedAt:           r.updated_at as string,
  };
}

function batchToRow(b: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>, userId: string, now: string) {
  return {
    user_id:             userId,
    name:                b.name,
    species:             b.species,
    breed:               b.breed ?? null,
    status:              b.status,
    start_date:          b.startDate,
    planned_end_date:    b.plannedEndDate ?? null,
    actual_end_date:     b.actualEndDate ?? null,
    initial_count:       b.initialCount,
    initial_weight_grams: b.initialWeightGrams ?? null,
    source_type:         b.sourceType,
    chick_cost_per_unit: b.chick_cost_per_unit ?? null,
    transport_cost:      b.transport_cost ?? null,
    housing_id:          b.housingId ?? null,
    notes:               b.notes ?? null,
    created_at:          now,
    updated_at:          now,
  };
}

// ── service ──────────────────────────────────────────────────

export const batchService = {
  async getAll(): Promise<Batch[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('batches').select('*').eq('user_id', user.id)
        .order('start_date', { ascending: false });
      return (data ?? []).map(rowToBatch);
    }
    return db.batches.orderBy('startDate').reverse().toArray();
  },

  async getActive(): Promise<Batch[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('batches').select('*').eq('user_id', user.id).eq('status', 'active');
      return (data ?? []).map(rowToBatch);
    }
    return db.batches.where('status').equals('active').toArray();
  },

  async getByStatus(status: BatchStatus): Promise<Batch[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('batches').select('*').eq('user_id', user.id).eq('status', status);
      return (data ?? []).map(rowToBatch);
    }
    return db.batches.where('status').equals(status).toArray();
  },

  async getById(id: number): Promise<Batch | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('batches').select('*').eq('user_id', user.id).eq('id', id).single();
      return data ? rowToBatch(data) : undefined;
    }
    return db.batches.get(id);
  },

  async create(data: Omit<Batch, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase
        .from('batches').insert(batchToRow(data, user.id, now)).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.batches.add({ ...data, createdAt: now, updatedAt: now });
  },

  async update(id: number, data: Partial<Omit<Batch, 'id' | 'createdAt'>>): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const row: Record<string, unknown> = { updated_at: now };
      if (data.name            !== undefined) row.name                = data.name;
      if (data.species         !== undefined) row.species             = data.species;
      if (data.breed           !== undefined) row.breed               = data.breed;
      if (data.status          !== undefined) row.status              = data.status;
      if (data.startDate       !== undefined) row.start_date          = data.startDate;
      if (data.plannedEndDate  !== undefined) row.planned_end_date    = data.plannedEndDate;
      if (data.actualEndDate   !== undefined) row.actual_end_date     = data.actualEndDate;
      if (data.initialCount    !== undefined) row.initial_count       = data.initialCount;
      if (data.initialWeightGrams !== undefined) row.initial_weight_grams = data.initialWeightGrams;
      if (data.sourceType      !== undefined) row.source_type         = data.sourceType;
      if (data.chick_cost_per_unit !== undefined) row.chick_cost_per_unit = data.chick_cost_per_unit;
      if (data.transport_cost  !== undefined) row.transport_cost      = data.transport_cost;
      if (data.housingId       !== undefined) row.housing_id          = data.housingId;
      if (data.notes           !== undefined) row.notes               = data.notes;
      const { error } = await supabase
        .from('batches').update(row).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      return;
    }
    await db.batches.update(id, { ...data, updatedAt: now });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      // Kaskadowe usunięcie powiązanych rekordów
      await Promise.all([
        supabase.from('daily_entries').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('weighings').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('health_events').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('housing').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('slaughter_records').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('sales').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('expenses').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('feed_consumptions').delete().eq('batch_id', id).eq('user_id', user.id),
        supabase.from('batch_photos').delete().eq('batch_id', id).eq('user_id', user.id),
      ]);
      await supabase.from('batches').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.transaction(
      'rw',
      [db.batches, db.dailyEntries, db.weighings, db.healthEvents,
       db.housing, db.slaughterRecords, db.sales, db.expenses,
       db.feedConsumptions, db.batchPhotos],
      async () => {
        await Promise.all([
          db.dailyEntries.where('batchId').equals(id).delete(),
          db.weighings.where('batchId').equals(id).delete(),
          db.healthEvents.where('batchId').equals(id).delete(),
          db.housing.where('batchId').equals(id).delete(),
          db.slaughterRecords.where('batchId').equals(id).delete(),
          db.sales.where('batchId').equals(id).delete(),
          db.expenses.where('batchId').equals(id).delete(),
          db.feedConsumptions.where('batchId').equals(id).delete(),
          db.batchPhotos.where('batchId').equals(id).delete(),
        ]);
        await db.batches.delete(id);
      }
    );
  },

  async getCurrentBirdCount(batchId: number): Promise<number> {
    const batch = await this.getById(batchId);
    if (!batch) return 0;

    const user = await getAuthUser();
    if (user) {
      const [entries, salesData, slaughter, outTransfers, inTransfers] = await Promise.all([
        supabase.from('daily_entries').select('dead_count,culled_count').eq('batch_id', batchId).eq('user_id', user.id),
        supabase.from('sales').select('sale_type,bird_count').eq('batch_id', batchId).eq('user_id', user.id),
        supabase.from('slaughter_records').select('birds_slaughtered').eq('batch_id', batchId).eq('user_id', user.id),
        supabase.from('bird_transfers').select('count').eq('from_batch_id', batchId).eq('user_id', user.id),
        supabase.from('bird_transfers').select('count').eq('to_batch_id', batchId).eq('user_id', user.id),
      ]);
      const dead = (entries.data ?? []).reduce((s, e) => s + (e.dead_count ?? 0) + (e.culled_count ?? 0), 0);
      const soldLive = (salesData.data ?? []).filter(s => s.sale_type === 'ptaki_zywe').reduce((s, x) => s + (x.bird_count ?? 0), 0);
      const slaughtered = (slaughter.data ?? []).reduce((s, r) => s + (r.birds_slaughtered ?? 0), 0);
      const netTransfer = (inTransfers.data ?? []).reduce((s, t) => s + (t.count ?? 0), 0)
                        - (outTransfers.data ?? []).reduce((s, t) => s + (t.count ?? 0), 0);
      return Math.max(0, batch.initialCount - dead - soldLive - slaughtered + netTransfer);
    }

    const [entries, salesData, slaughter, outTransfers, inTransfers] = await Promise.all([
      db.dailyEntries.where('batchId').equals(batchId).toArray(),
      db.sales.where('batchId').equals(batchId).toArray(),
      db.slaughterRecords.where('batchId').equals(batchId).toArray(),
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    const dead        = entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
    const soldLive    = salesData.filter(s => s.saleType === 'ptaki_zywe').reduce((s, x) => s + (x.birdCount ?? 0), 0);
    const slaughtered = slaughter.reduce((s, r) => s + r.birdsSlaughtered, 0);
    const netTransfer = inTransfers.reduce((s, t) => s + t.count, 0) - outTransfers.reduce((s, t) => s + t.count, 0);
    return Math.max(0, batch.initialCount - dead - soldLive - slaughtered + netTransfer);
  },

  async checkAndAutoClose(batchId: number): Promise<boolean> {
    const batch = await this.getById(batchId);
    if (!batch || batch.status !== 'active') return false;
    const current = await this.getCurrentBirdCount(batchId);
    if (current === 0) {
      await this.update(batchId, {
        status: 'completed',
        actualEndDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    }
    return false;
  },

  async checkAndAutoReopen(batchId: number): Promise<boolean> {
    const batch = await this.getById(batchId);
    if (!batch || batch.status !== 'completed') return false;
    const current = await this.getCurrentBirdCount(batchId);
    if (current > 0) {
      await this.update(batchId, { status: 'active', actualEndDate: undefined });
      return true;
    }
    return false;
  },
};
