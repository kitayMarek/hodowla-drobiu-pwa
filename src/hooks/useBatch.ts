import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Batch } from '@/models/batch.model';

// ── helpers ──────────────────────────────────────────────────
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

async function fetchAll(userId: string): Promise<Batch[]> {
  const { data } = await supabase
    .from('batches').select('*').eq('user_id', userId)
    .order('start_date', { ascending: false });
  return (data ?? []).map(rowToBatch);
}

async function fetchActive(userId: string): Promise<Batch[]> {
  const { data } = await supabase
    .from('batches').select('*').eq('user_id', userId).eq('status', 'active');
  return (data ?? []).map(rowToBatch);
}

async function fetchOne(userId: string, id: number): Promise<Batch | undefined> {
  const { data } = await supabase
    .from('batches').select('*').eq('user_id', userId).eq('id', id).single();
  return data ? rowToBatch(data) : undefined;
}

// ── hooks ────────────────────────────────────────────────────

export function useBatches(): Batch[] {
  const { user } = useAuth();

  // Dexie (demo)
  const dexie = useLiveQuery(
    () => !user ? db.batches.orderBy('startDate').reverse().toArray() : Promise.resolve([] as Batch[]),
    [!!user]
  ) ?? [];

  // Supabase (zalogowany)
  const [sb, setSb] = useState<Batch[]>([]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    fetchAll(user.id).then(setSb);

    const ch = supabase.channel('batches-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' },
        () => fetchAll(user.id).then(setSb))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return user ? sb : dexie;
}

export function useActiveBatches(): Batch[] {
  const { user } = useAuth();

  const dexie = useLiveQuery(
    () => !user ? db.batches.where('status').equals('active').toArray() : Promise.resolve([] as Batch[]),
    [!!user]
  ) ?? [];

  const [sb, setSb] = useState<Batch[]>([]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    fetchActive(user.id).then(setSb);
    const ch = supabase.channel('batches-active-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' },
        () => fetchActive(user.id).then(setSb))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return user ? sb : dexie;
}

export function useBatch(id: number): Batch | undefined {
  const { user } = useAuth();

  const dexie = useLiveQuery(
    () => !user ? db.batches.get(id) : Promise.resolve(undefined as Batch | undefined),
    [!!user, id]
  );

  const [sb, setSb] = useState<Batch | undefined>(undefined);
  useEffect(() => {
    if (!user) { setSb(undefined); return; }
    fetchOne(user.id, id).then(setSb);
    const ch = supabase.channel(`batch-${id}-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches', filter: `id=eq.${id}` },
        () => fetchOne(user.id, id).then(setSb))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, id]);

  return user ? sb : dexie;
}
