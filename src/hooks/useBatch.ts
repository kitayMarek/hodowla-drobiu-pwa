import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Batch } from '@/models/batch.model';

export function useBatches(): Batch[] {
  return useLiveQuery(
    () => db.batches.orderBy('startDate').reverse().toArray(),
    []
  ) ?? [];
}

export function useActiveBatches(): Batch[] {
  return useLiveQuery(
    () => db.batches.where('status').equals('active').toArray(),
    []
  ) ?? [];
}

export function useBatch(id: number): Batch | undefined {
  return useLiveQuery(
    () => db.batches.get(id),
    [id]
  );
}
