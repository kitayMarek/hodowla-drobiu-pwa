import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyEntry } from '@/models/dailyEntry.model';

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

async function fetchByBatch(userId: string, batchId: number): Promise<DailyEntry[]> {
  const { data } = await supabase.from('daily_entries').select('*')
    .eq('user_id', userId).eq('batch_id', batchId)
    .order('date', { ascending: false });
  return (data ?? []).map(rowToEntry);
}

async function fetchAll(userId: string): Promise<DailyEntry[]> {
  const { data } = await supabase.from('daily_entries').select('*')
    .eq('user_id', userId).order('date', { ascending: false });
  return (data ?? []).map(rowToEntry);
}

export function useAllDailyEntries(): DailyEntry[] {
  const { user } = useAuth();

  const dexie = useLiveQuery(
    () => !user
      ? db.dailyEntries.toArray()
          .then(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))
      : Promise.resolve([] as DailyEntry[]),
    [!!user]
  ) ?? [];

  const [sb, setSb] = useState<DailyEntry[]>([]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    fetchAll(user.id).then(setSb);
    const ch = supabase.channel(`daily-all-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' },
        () => fetchAll(user.id).then(setSb))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return user ? sb : dexie;
}

export function useDailyEntries(batchId: number): DailyEntry[] {
  const { user } = useAuth();

  const dexie = useLiveQuery(
    () => !user
      ? db.dailyEntries.where('batchId').equals(batchId).toArray()
          .then(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))
      : Promise.resolve([] as DailyEntry[]),
    [!!user, batchId]
  ) ?? [];

  const [sb, setSb] = useState<DailyEntry[]>([]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    fetchByBatch(user.id, batchId).then(setSb);
    const ch = supabase.channel(`daily-${batchId}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' },
        () => fetchByBatch(user.id, batchId).then(setSb))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);

  return user ? sb : dexie;
}
