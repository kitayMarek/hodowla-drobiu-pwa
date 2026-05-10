import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { BirdTransfer } from '@/models/birdTransfer.model';

function rowToTransfer(r: Record<string, unknown>): BirdTransfer {
  return {
    id:           r.id as number,
    transferDate: r.transfer_date as string,
    fromBatchId:  (r.from_batch_id as number) ?? 0,
    toBatchId:    (r.to_batch_id as number) ?? 0,
    count:        r.count as number,
    reason:       (r.reason as BirdTransfer['reason']) ?? 'inne',
    notes:        r.notes as string | undefined,
    createdAt:    r.created_at as string,
  };
}

export const birdTransferService = {
  async getAll(): Promise<BirdTransfer[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('bird_transfers').select('*')
        .eq('user_id', user.id).order('transfer_date', { ascending: false });
      return (data ?? []).map(rowToTransfer);
    }
    return db.birdTransfers.orderBy('transferDate').reverse().toArray();
  },

  async getByBatch(batchId: number): Promise<BirdTransfer[]> {
    const user = await getAuthUser();
    if (user) {
      const [outT, inT] = await Promise.all([
        supabase.from('bird_transfers').select('*').eq('user_id', user.id).eq('from_batch_id', batchId),
        supabase.from('bird_transfers').select('*').eq('user_id', user.id).eq('to_batch_id', batchId),
      ]);
      return [...(outT.data ?? []), ...(inT.data ?? [])]
        .map(rowToTransfer)
        .sort((a, b) => b.transferDate.localeCompare(a.transferDate));
    }
    const [outgoing, incoming] = await Promise.all([
      db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
      db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
    ]);
    return [...outgoing, ...incoming].sort((a, b) =>
      b.transferDate.localeCompare(a.transferDate)
    );
  },

  async create(data: Omit<BirdTransfer, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('bird_transfers').insert({
        user_id: user.id, transfer_date: data.transferDate,
        from_batch_id: data.fromBatchId, to_batch_id: data.toBatchId,
        count: data.count, reason: data.reason,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.birdTransfers.add({ ...data, createdAt: now });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('bird_transfers').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.birdTransfers.delete(id);
  },

  async getNetTransfer(batchId: number): Promise<number> {
    const all = await this.getByBatch(batchId);
    const out = all.filter(t => t.fromBatchId === batchId).reduce((s, t) => s + t.count, 0);
    const inn = all.filter(t => t.toBatchId   === batchId).reduce((s, t) => s + t.count, 0);
    return inn - out;
  },
};
