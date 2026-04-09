import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { DailyEntry } from '@/models/dailyEntry.model';

export function useDailyEntries(batchId: number): DailyEntry[] {
  return useLiveQuery(
    async () => {
      const entries = await db.dailyEntries
        .where('batchId').equals(batchId)
        .toArray();
      return entries.sort((a, b) => b.date.localeCompare(a.date));
    },
    [batchId]
  ) ?? [];
}
