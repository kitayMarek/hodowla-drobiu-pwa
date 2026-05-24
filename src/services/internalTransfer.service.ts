import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { InternalTransfer } from '@/models/internalTransfer.model';

function rowToTransfer(r: Record<string, unknown>): InternalTransfer {
  return {
    id:          r.id          as number,
    date:        r.date        as string,
    fromScope:   r.from_scope  as string,
    toScope:     r.to_scope    as string,
    amountPln:   r.amount_pln  as number,
    description: r.description as string,
    notes:       r.notes       as string | undefined,
    createdAt:   r.created_at  as string,
  };
}

export const internalTransferService = {
  async getAll(): Promise<InternalTransfer[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('internal_transfers').select('*')
        .eq('user_id', user.id).order('date', { ascending: false });
      return (data ?? []).map(rowToTransfer);
    }
    return db.internalTransfers.orderBy('date').reverse().toArray();
  },

  async create(data: Omit<InternalTransfer, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('internal_transfers').insert({
        user_id:     user.id,
        date:        data.date,
        from_scope:  data.fromScope,
        to_scope:    data.toScope,
        amount_pln:  data.amountPln,
        description: data.description,
        notes:       data.notes ?? null,
        created_at:  now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.internalTransfers.add({ ...data, createdAt: now });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('internal_transfers').delete()
        .eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.internalTransfers.delete(id);
  },
};
