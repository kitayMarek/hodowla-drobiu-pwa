import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Order, OrderStatus } from '@/models/order.model';

// Supabase uses different column names than Dexie model:
//   customer_name   → buyerName
//   customer_phone  → phone
//   sale_type       → orderType
//   planned_date    → plannedDate
//   price_per_unit  → pricePerUnit
// estimatedPricePln is not stored in Supabase – derived as quantity * pricePerUnit

function rowToOrder(r: Record<string, unknown>): Order {
  const qty      = (r.quantity as number | undefined) ?? 0;
  const ppu      = (r.price_per_unit as number | undefined) ?? 0;
  return {
    id:               r.id as number,
    batchId:          r.batch_id as number,
    orderType:        r.sale_type as Order['orderType'],
    plannedDate:      r.planned_date as string,
    quantity:         qty || undefined,
    pricePerUnit:     ppu || undefined,
    estimatedPricePln:qty * ppu,
    status:           r.status as OrderStatus,
    buyerName:        (r.customer_name as string | undefined) || undefined,
    phone:            (r.customer_phone as string | undefined) || undefined,
    notes:            (r.notes as string | undefined) || undefined,
    createdAt:        r.created_at as string,
  };
}

export const orderService = {
  async getAll(): Promise<Order[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('orders').select('*')
        .eq('user_id', user.id).order('planned_date');
      return (data ?? []).map(rowToOrder);
    }
    return db.orders.orderBy('plannedDate').toArray();
  },

  async getByBatch(batchId: number): Promise<Order[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('orders').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId).order('planned_date');
      return (data ?? []).map(rowToOrder);
    }
    return db.orders.where('batchId').equals(batchId).toArray();
  },

  async getPending(): Promise<Order[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('orders').select('*')
        .eq('user_id', user.id).eq('status', 'oczekujace').order('planned_date');
      return (data ?? []).map(rowToOrder);
    }
    return db.orders.where('status').equals('oczekujace').toArray();
  },

  async create(data: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<number> {
    const user = await getAuthUser();
    const now  = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('orders').insert({
        user_id:        user.id,
        batch_id:       data.batchId,
        customer_name:  data.buyerName ?? '-',
        customer_phone: data.phone ?? null,
        planned_date:   data.plannedDate,
        sale_type:      data.orderType,
        quantity:       data.quantity ?? 0,
        price_per_unit: data.pricePerUnit ?? null,
        status:         'oczekujace',
        notes:          data.notes ?? null,
        created_at:     now,
        updated_at:     now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.orders.add({ ...data, status: 'oczekujace', createdAt: now });
  },

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('orders').update({
        status, updated_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.orders.update(id, { status });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('orders').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.orders.delete(id);
  },
};
