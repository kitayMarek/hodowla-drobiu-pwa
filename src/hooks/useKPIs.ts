import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { calculateAllKPIs } from '@/engine';
import type { BatchKPIResult } from '@/engine/types';

export function useKPIs(batchId: number): BatchKPIResult | undefined {
  return useLiveQuery(async () => {
    const [
      batch,
      dailyEntries,
      weighings,
      feedConsumptions,
      feedTypes,
      sales,
      expenses,
      slaughterRecords,
      healthEvents,
    ] = await Promise.all([
      db.batches.get(batchId),
      db.dailyEntries.where('batchId').equals(batchId).toArray(),
      db.weighings.where('batchId').equals(batchId).toArray(),
      db.feedConsumptions.where('batchId').equals(batchId).toArray(),
      db.feedTypes.toArray(),
      db.sales.where('batchId').equals(batchId).toArray(),
      db.expenses.where('batchId').equals(batchId).toArray(),
      db.slaughterRecords.where('batchId').equals(batchId).toArray(),
      db.healthEvents.where('batchId').equals(batchId).toArray(),
    ]);
    if (!batch?.id) return undefined;
    return calculateAllKPIs({
      batch,
      dailyEntries,
      weighings,
      feedConsumptions,
      feedTypes,
      sales,
      expenses,
      slaughterRecords,
      healthEvents,
    });
  }, [batchId]);
}

export function useAllBatchKPIs(): BatchKPIResult[] {
  return useLiveQuery(async () => {
    const batches = await db.batches.where('status').equals('active').toArray();
    const feedTypes = await db.feedTypes.toArray();

    const results = await Promise.all(
      batches
        .filter(b => b.id != null)
        .map(async batch => {
          const [
            dailyEntries,
            weighings,
            feedConsumptions,
            sales,
            expenses,
            slaughterRecords,
            healthEvents,
          ] = await Promise.all([
            db.dailyEntries.where('batchId').equals(batch.id!).toArray(),
            db.weighings.where('batchId').equals(batch.id!).toArray(),
            db.feedConsumptions.where('batchId').equals(batch.id!).toArray(),
            db.sales.where('batchId').equals(batch.id!).toArray(),
            db.expenses.where('batchId').equals(batch.id!).toArray(),
            db.slaughterRecords.where('batchId').equals(batch.id!).toArray(),
            db.healthEvents.where('batchId').equals(batch.id!).toArray(),
          ]);
          return calculateAllKPIs({
            batch,
            dailyEntries,
            weighings,
            feedConsumptions,
            feedTypes,
            sales,
            expenses,
            slaughterRecords,
            healthEvents,
          });
        })
    );
    return results;
  }, []) ?? [];
}
