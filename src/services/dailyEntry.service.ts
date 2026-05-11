import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { DailyEntry } from '@/models/dailyEntry.model';

// ── mappers ──────────────────────────────────────────────────

function rowToEntry(r: Record<string, unknown>): DailyEntry {
  return {
    id:                 r.id as number,
    batchId:            r.batch_id as number,
    date:               r.date as string,
    deadCount:          r.dead_count as number,
    culledCount:        r.culled_count as number,
    feedConsumedKg:     r.feed_consumed_kg as number,
    feedTypeId:         r.feed_type_id as number | undefined,
    waterLiters:        r.water_liters as number | undefined,
    eggsCollected:      r.eggs_collected as number | undefined,
    eggsDefective:      r.eggs_defective as number | undefined,
    sampleWeightGrams:  r.sample_weight_grams as number | undefined,
    sampleSize:         r.sample_size as number | undefined,
    temperatureCelsius: r.temperature_celsius as number | undefined,
    humidity:           r.humidity as number | undefined,
    notes:              r.notes as string | undefined,
    createdAt:          r.created_at as string,
  };
}

function entryToRow(e: Omit<DailyEntry, 'id' | 'createdAt'>, userId: string, now: string) {
  return {
    user_id:             userId,
    batch_id:            e.batchId,
    date:                e.date,
    dead_count:          e.deadCount,
    culled_count:        e.culledCount,
    feed_consumed_kg:    e.feedConsumedKg,
    feed_type_id:        e.feedTypeId ?? null,
    water_liters:        e.waterLiters ?? null,
    eggs_collected:      e.eggsCollected ?? null,
    eggs_defective:      e.eggsDefective ?? null,
    sample_weight_grams: e.sampleWeightGrams ?? null,
    sample_size:         e.sampleSize ?? null,
    temperature_celsius: e.temperatureCelsius ?? null,
    humidity:            e.humidity ?? null,
    notes:               e.notes ?? null,
    created_at:          now,
  };
}

// ── service ──────────────────────────────────────────────────

export const dailyEntryService = {
  async getByBatch(batchId: number): Promise<DailyEntry[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('daily_entries').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .order('date', { ascending: true });
      return (data ?? []).map(rowToEntry);
    }
    return db.dailyEntries.where('batchId').equals(batchId).sortBy('date');
  },

  async getByBatchAndDateRange(batchId: number, fromDate: string, toDate: string): Promise<DailyEntry[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('daily_entries').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .gte('date', fromDate).lte('date', toDate)
        .order('date', { ascending: true });
      return (data ?? []).map(rowToEntry);
    }
    return db.dailyEntries
      .where('[batchId+date]')
      .between([batchId, fromDate], [batchId, toDate], true, true)
      .toArray();
  },

  async getByBatchAndDate(batchId: number, date: string): Promise<DailyEntry | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('daily_entries').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId).eq('date', date)
        .maybeSingle();
      return data ? rowToEntry(data) : undefined;
    }
    return db.dailyEntries.where('[batchId+date]').equals([batchId, date]).first();
  },

  async getLastEntry(batchId: number): Promise<DailyEntry | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('daily_entries').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId)
        .order('date', { ascending: false }).limit(1);
      return data?.[0] ? rowToEntry(data[0]) : undefined;
    }
    const entries = await db.dailyEntries.where('batchId').equals(batchId).sortBy('date');
    return entries[entries.length - 1];
  },

  async getById(id: number): Promise<DailyEntry | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('daily_entries').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToEntry(data) : undefined;
    }
    return db.dailyEntries.get(id);
  },

  async create(data: Omit<DailyEntry, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase
        .from('daily_entries').insert(entryToRow(data, user.id, now)).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.dailyEntries.add({ ...data, createdAt: now });
  },

  async update(id: number, data: Partial<DailyEntry>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.deadCount          !== undefined) row.dead_count          = data.deadCount;
      if (data.culledCount        !== undefined) row.culled_count        = data.culledCount;
      if (data.feedConsumedKg     !== undefined) row.feed_consumed_kg    = data.feedConsumedKg;
      if (data.feedTypeId         !== undefined) row.feed_type_id        = data.feedTypeId;
      if (data.waterLiters        !== undefined) row.water_liters        = data.waterLiters;
      if (data.eggsCollected      !== undefined) row.eggs_collected      = data.eggsCollected;
      if (data.eggsDefective      !== undefined) row.eggs_defective      = data.eggsDefective;
      if (data.sampleWeightGrams  !== undefined) row.sample_weight_grams = data.sampleWeightGrams;
      if (data.sampleSize         !== undefined) row.sample_size         = data.sampleSize;
      if (data.temperatureCelsius !== undefined) row.temperature_celsius = data.temperatureCelsius;
      if (data.humidity           !== undefined) row.humidity            = data.humidity;
      if (data.notes              !== undefined) row.notes               = data.notes;
      const { error } = await supabase
        .from('daily_entries').update(row).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      return;
    }
    await db.dailyEntries.update(id, data);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('daily_entries').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dailyEntries.delete(id);
  },

  async deleteWithConsumptions(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const { data: entry } = await supabase
        .from('daily_entries').select('batch_id,date').eq('id', id).eq('user_id', user.id).single();
      if (entry) {
        await supabase.from('feed_consumptions')
          .delete().eq('batch_id', entry.batch_id).eq('date', entry.date).eq('user_id', user.id);
      }
      await supabase.from('daily_entries').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    const entry = await db.dailyEntries.get(id);
    if (entry) {
      await db.feedConsumptions.where('[batchId+date]').equals([entry.batchId, entry.date]).delete();
    }
    await db.dailyEntries.delete(id);
  },

  async getWeeklyAggregates(batchId: number) {
    const entries = await this.getByBatch(batchId);
    const weekMap = new Map<string, typeof entries>();
    for (const e of entries) {
      const d = new Date(e.date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const key = monday.toISOString().slice(0, 10);
      if (!weekMap.has(key)) weekMap.set(key, []);
      weekMap.get(key)!.push(e);
    }
    return Array.from(weekMap.entries()).map(([weekStart, weekEntries]) => {
      const weights = weekEntries.filter(e => e.sampleWeightGrams != null);
      return {
        weekStart,
        totalDead:    weekEntries.reduce((s, e) => s + e.deadCount + e.culledCount, 0),
        totalFeedKg:  weekEntries.reduce((s, e) => s + e.feedConsumedKg, 0),
        totalEggs:    weekEntries.reduce((s, e) => s + (e.eggsCollected ?? 0), 0),
        avgWeight:    weights.length > 0
          ? weights.reduce((s, e) => s + (e.sampleWeightGrams ?? 0), 0) / weights.length
          : null,
      };
    });
  },
};
