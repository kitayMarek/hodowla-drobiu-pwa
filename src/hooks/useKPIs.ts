import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateAllKPIs } from '@/engine';
import type { BatchKPIResult } from '@/engine/types';
import type { Batch } from '@/models/batch.model';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { Weighing } from '@/models/weighing.model';
import type { FeedConsumption, FeedType } from '@/models/feed.model';
import type { Sale } from '@/models/sale.model';
import type { Expense } from '@/models/expense.model';
import type { SlaughterRecord } from '@/models/slaughter.model';
import type { HealthEvent } from '@/models/health.model';
import type { BirdTransfer } from '@/models/birdTransfer.model';

// ── Supabase fetchers ────────────────────────────────────────

async function fetchKPIData(userId: string, batchId: number) {
  const [batch, de, w, fc, ft, sales, exp, sr, he, outT, inT] = await Promise.all([
    supabase.from('batches').select('*').eq('user_id', userId).eq('id', batchId).single(),
    supabase.from('daily_entries').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('weighings').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('feed_consumptions').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('feed_types').select('*').eq('user_id', userId),
    supabase.from('sales').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('slaughter_records').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('health_events').select('*').eq('user_id', userId).eq('batch_id', batchId),
    supabase.from('bird_transfers').select('*').eq('user_id', userId).eq('from_batch_id', batchId),
    supabase.from('bird_transfers').select('*').eq('user_id', userId).eq('to_batch_id', batchId),
  ]);
  if (!batch.data) return undefined;

  const mapBatch = (r: Record<string, unknown>): Batch => ({
    id: r.id as number, name: r.name as string, species: r.species as Batch['species'],
    breed: r.breed as string | undefined, status: r.status as Batch['status'],
    startDate: r.start_date as string, plannedEndDate: r.planned_end_date as string | undefined,
    actualEndDate: r.actual_end_date as string | undefined, initialCount: r.initial_count as number,
    initialWeightGrams: r.initial_weight_grams as number | undefined,
    sourceType: r.source_type as Batch['sourceType'],
    chick_cost_per_unit: r.chick_cost_per_unit as number | undefined,
    transport_cost: r.transport_cost as number | undefined,
    housingId: r.housing_id as string | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  });
  const mapDE = (r: Record<string, unknown>): DailyEntry => ({
    id: r.id as number, batchId: r.batch_id as number, date: r.date as string,
    deadCount: r.dead_count as number, culledCount: r.culled_count as number,
    feedConsumedKg: r.feed_consumed_kg as number, feedTypeId: r.feed_type_id as number | undefined,
    waterLiters: r.water_liters as number | undefined, eggsCollected: r.eggs_collected as number | undefined,
    eggsDefective: r.eggs_defective as number | undefined,
    sampleWeightGrams: r.sample_weight_grams as number | undefined, sampleSize: r.sample_size as number | undefined,
    temperatureCelsius: r.temperature_celsius as number | undefined, humidity: r.humidity as number | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string,
  });
  const mapW = (r: Record<string, unknown>): Weighing => ({
    id: r.id as number, batchId: r.batch_id as number, weighingDate: r.weighing_date as string,
    ageAtWeighingDays: (r.age_at_weighing_days as number) ?? 0,
    method: (r.method as Weighing['method']) ?? 'sample',
    sampleSize: r.sample_size as number | undefined, averageWeightGrams: r.average_weight_grams as number,
    minWeightGrams: r.min_weight_grams as number | undefined, maxWeightGrams: r.max_weight_grams as number | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string,
  });
  const mapFC = (r: Record<string, unknown>): FeedConsumption => ({
    id: r.id as number, batchId: r.batch_id as number, feedTypeId: r.feed_type_id as number,
    date: r.date as string, consumedKg: r.consumed_kg as number, createdAt: r.created_at as string,
  });
  const mapFT = (r: Record<string, unknown>): FeedType => ({
    id: r.id as number, name: r.name as string, phase: r.phase as FeedType['phase'],
    manufacturer: r.manufacturer as string | undefined, proteinPercent: r.protein_percent as number | undefined,
    energyMjKg: r.energy_mj_kg as number | undefined, pricePerKg: r.price_per_kg as number,
    isActive: r.is_active as boolean, recipeNotes: r.recipe_notes as string | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  });
  const mapSale = (r: Record<string, unknown>): Sale => ({
    id: r.id as number, batchId: r.batch_id as number, saleDate: r.sale_date as string,
    saleType: r.sale_type as Sale['saleType'], eggsCount: r.eggs_count as number | undefined,
    eggPricePln: r.egg_price_pln as number | undefined, birdCount: r.bird_count as number | undefined,
    weightKg: r.weight_kg as number | undefined, pricePerKgPln: r.price_per_kg_pln as number | undefined,
    totalRevenuePln: r.total_revenue_pln as number, buyerName: r.buyer_name as string | undefined,
    invoiceNumber: r.invoice_number as string | undefined, notes: r.notes as string | undefined,
    createdAt: r.created_at as string,
  });
  const mapExp = (r: Record<string, unknown>): Expense => ({
    id: r.id as number, batchId: r.batch_id as number | undefined, expenseDate: r.expense_date as string,
    category: r.category as Expense['category'], description: r.description as string,
    amountPln: r.amount_pln as number, createdAt: r.created_at as string,
  });
  const mapSR = (r: Record<string, unknown>): SlaughterRecord => ({
    id: r.id as number, batchId: r.batch_id as number, slaughterDate: r.slaughter_date as string,
    birdsSlaughtered: r.birds_slaughtered as number,
    liveWeightTotalKg: (r.live_weight_total_kg as number) ?? 0,
    carcassWeightTotalKg: (r.carcass_weight_total_kg as number) ?? 0,
    dressingPercent: r.dressing_percent as number | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string,
  });
  const mapHE = (r: Record<string, unknown>): HealthEvent => ({
    id: r.id as number, batchId: r.batch_id as number, eventDate: r.event_date as string,
    eventType: r.event_type as HealthEvent['eventType'],
    diagnosis: r.diagnosis as string | undefined,
    treatment: r.treatment as string | undefined,
    affectedCount: r.affected_count as number | undefined,
    costPln: r.cost_pln as number | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string,
  });
  const mapBT = (r: Record<string, unknown>): BirdTransfer => ({
    id: r.id as number, transferDate: r.transfer_date as string,
    fromBatchId: (r.from_batch_id as number) ?? 0,
    toBatchId: (r.to_batch_id as number) ?? 0,
    count: r.count as number,
    reason: (r.reason as BirdTransfer['reason']) ?? 'inne',
    notes: r.notes as string | undefined, createdAt: r.created_at as string,
  });

  return calculateAllKPIs({
    batch:           mapBatch(batch.data),
    dailyEntries:    (de.data ?? []).map(mapDE),
    weighings:       (w.data ?? []).map(mapW),
    feedConsumptions:(fc.data ?? []).map(mapFC),
    feedTypes:       (ft.data ?? []).map(mapFT),
    sales:           (sales.data ?? []).map(mapSale),
    expenses:        (exp.data ?? []).map(mapExp),
    slaughterRecords:(sr.data ?? []).map(mapSR),
    healthEvents:    (he.data ?? []).map(mapHE),
    transfers:       [...(outT.data ?? []), ...(inT.data ?? [])].map(mapBT),
  });
}

// ── hooks ────────────────────────────────────────────────────

export function useKPIs(batchId: number): BatchKPIResult | undefined {
  const { user } = useAuth();

  const dexie = useLiveQuery(async () => {
    if (user) return undefined;
    const [batch, dailyEntries, weighings, feedConsumptions, feedTypes, sales,
      expenses, slaughterRecords, healthEvents, outTransfers, inTransfers] = await Promise.all([
      db.batches.get(batchId),
      db.dailyEntries.where('batchId').equals(batchId).toArray(),
      db.weighings.where('batchId').equals(batchId).toArray(),
      db.feedConsumptions.where('batchId').equals(batchId).toArray(),
      db.feedTypes.toArray(),
      db.sales.where('batchId').equals(batchId).toArray(),
      db.expenses.where('batchId').equals(batchId).toArray(),
      db.slaughterRecords.where('batchId').equals(batchId).toArray(),
      db.healthEvents.where('batchId').equals(batchId).toArray(),
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    if (!batch?.id) return undefined;
    return calculateAllKPIs({ batch, dailyEntries, weighings, feedConsumptions, feedTypes,
      sales, expenses, slaughterRecords, healthEvents, transfers: [...outTransfers, ...inTransfers] });
  }, [!!user, batchId]);

  const [sb, setSb] = useState<BatchKPIResult | undefined>(undefined);
  useEffect(() => {
    if (!user) { setSb(undefined); return; }
    fetchKPIData(user.id, batchId).then(setSb);
    const tables = ['batches', 'daily_entries', 'weighings', 'feed_consumptions', 'feed_types',
                    'sales', 'expenses', 'slaughter_records', 'health_events', 'bird_transfers'];
    const channels = tables.map(t =>
      supabase.channel(`kpi-${t}-${batchId}-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t },
          () => fetchKPIData(user.id, batchId).then(setSb))
        .subscribe()
    );
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [user?.id, batchId]);

  return user ? sb : dexie;
}

export function useAllBatchKPIs(): BatchKPIResult[] {
  const { user } = useAuth();

  const dexie = useLiveQuery(async () => {
    if (user) return [];
    const batches = await db.batches.where('status').equals('active').toArray();
    const [feedTypes, allTransfers] = await Promise.all([db.feedTypes.toArray(), db.birdTransfers.toArray()]);
    const results = await Promise.all(
      batches.filter(b => b.id != null).map(async batch => {
        const [dailyEntries, weighings, feedConsumptions, sales, expenses, slaughterRecords, healthEvents] =
          await Promise.all([
            db.dailyEntries.where('batchId').equals(batch.id!).toArray(),
            db.weighings.where('batchId').equals(batch.id!).toArray(),
            db.feedConsumptions.where('batchId').equals(batch.id!).toArray(),
            db.sales.where('batchId').equals(batch.id!).toArray(),
            db.expenses.where('batchId').equals(batch.id!).toArray(),
            db.slaughterRecords.where('batchId').equals(batch.id!).toArray(),
            db.healthEvents.where('batchId').equals(batch.id!).toArray(),
          ]);
        const transfers = allTransfers.filter(t => t.fromBatchId === batch.id || t.toBatchId === batch.id);
        return calculateAllKPIs({ batch, dailyEntries, weighings, feedConsumptions, feedTypes,
          sales, expenses, slaughterRecords, healthEvents, transfers });
      })
    );
    return results;
  }, [!!user]) ?? [];

  const [sb, setSb] = useState<BatchKPIResult[]>([]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    (async () => {
      const { data: batches } = await supabase.from('batches').select('id')
        .eq('user_id', user.id).eq('status', 'active');
      const results = await Promise.all((batches ?? []).map(b => fetchKPIData(user.id, b.id)));
      setSb(results.filter(Boolean) as BatchKPIResult[]);
    })();
  }, [user?.id]);

  return user ? sb : dexie;
}
