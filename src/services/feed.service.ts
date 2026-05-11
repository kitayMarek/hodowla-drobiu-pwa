import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { cashFlowService } from '@/services/cashFlow.service';
import type { FeedType, FeedDelivery, FeedConsumption } from '@/models/feed.model';

// ── mappers ──────────────────────────────────────────────────

function rowToFeedType(r: Record<string, unknown>): FeedType {
  return {
    id:             r.id as number,
    name:           r.name as string,
    phase:          r.phase as FeedType['phase'],
    manufacturer:   r.manufacturer as string | undefined,
    proteinPercent: r.protein_percent as number | undefined,
    energyMjKg:     r.energy_mj_kg as number | undefined,
    pricePerKg:     r.price_per_kg as number,
    isActive:       r.is_active as boolean,
    recipeNotes:    r.recipe_notes as string | undefined,
    notes:          r.notes as string | undefined,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  };
}

function rowToDelivery(r: Record<string, unknown>): FeedDelivery {
  return {
    id:             r.id as number,
    feedTypeId:     r.feed_type_id as number,
    deliveryDate:   r.delivery_date as string,
    quantityKg:     r.quantity_kg as number,
    invoiceNumber:  r.invoice_number as string | undefined,
    supplierName:   r.supplier_name as string | undefined,
    totalCostPln:   r.total_cost_pln as number,
    notes:          r.notes as string | undefined,
    createdAt:      r.created_at as string,
  };
}

function rowToConsumption(r: Record<string, unknown>): FeedConsumption {
  return {
    id:          r.id as number,
    batchId:     r.batch_id as number,
    feedTypeId:  r.feed_type_id as number,
    date:        r.date as string,
    consumedKg:  r.consumed_kg as number,
    createdAt:   r.created_at as string,
  };
}

/** Przelicza WAC dla Supabase */
async function recalcWACSupabase(feedTypeId: number, userId: string): Promise<void> {
  const { data } = await supabase.from('feed_deliveries').select('quantity_kg,total_cost_pln')
    .eq('feed_type_id', feedTypeId).eq('user_id', userId);
  if (!data || data.length === 0) return;
  const totalQty  = data.reduce((s, d) => s + d.quantity_kg,  0);
  const totalCost = data.reduce((s, d) => s + d.total_cost_pln, 0);
  if (totalQty > 0) {
    await supabase.from('feed_types')
      .update({ price_per_kg: Math.round((totalCost / totalQty) * 100) / 100, updated_at: new Date().toISOString() })
      .eq('id', feedTypeId).eq('user_id', userId);
  }
}

/** Przelicza WAC dla Dexie */
async function recalcWAC(feedTypeId: number): Promise<void> {
  const deliveries = await db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
  if (deliveries.length === 0) return;
  const totalQty  = deliveries.reduce((s, d) => s + d.quantityKg,   0);
  const totalCost = deliveries.reduce((s, d) => s + d.totalCostPln, 0);
  if (totalQty > 0) {
    await db.feedTypes.update(feedTypeId, {
      pricePerKg: Math.round((totalCost / totalQty) * 100) / 100,
      updatedAt: new Date().toISOString(),
    });
  }
}

// ── service ──────────────────────────────────────────────────

export const feedService = {
  // FeedTypes
  async getAllTypes(): Promise<FeedType[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_types').select('*').eq('user_id', user.id).order('name');
      return (data ?? []).map(rowToFeedType);
    }
    return db.feedTypes.orderBy('name').toArray();
  },

  async getActiveTypes(): Promise<FeedType[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_types').select('*')
        .eq('user_id', user.id).eq('is_active', true).order('name');
      return (data ?? []).map(rowToFeedType);
    }
    return db.feedTypes.filter(ft => ft.isActive).toArray();
  },

  async getTypeById(id: number): Promise<FeedType | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_types').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToFeedType(data) : undefined;
    }
    return db.feedTypes.get(id);
  },

  async createType(data: Omit<FeedType, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('feed_types').insert({
        user_id: user.id, name: data.name, phase: data.phase,
        manufacturer: data.manufacturer ?? null, protein_percent: data.proteinPercent ?? null,
        energy_mj_kg: data.energyMjKg ?? null, price_per_kg: data.pricePerKg,
        is_active: data.isActive, recipe_notes: data.recipeNotes ?? null,
        notes: data.notes ?? null, created_at: now, updated_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.feedTypes.add({ ...data, createdAt: now, updatedAt: now });
  },

  async updateType(id: number, data: Partial<FeedType>): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const row: Record<string, unknown> = { updated_at: now };
      if (data.name           !== undefined) row.name            = data.name;
      if (data.phase          !== undefined) row.phase           = data.phase;
      if (data.manufacturer   !== undefined) row.manufacturer    = data.manufacturer;
      if (data.proteinPercent !== undefined) row.protein_percent = data.proteinPercent;
      if (data.energyMjKg    !== undefined) row.energy_mj_kg    = data.energyMjKg;
      if (data.pricePerKg    !== undefined) row.price_per_kg    = data.pricePerKg;
      if (data.isActive       !== undefined) row.is_active       = data.isActive;
      if (data.recipeNotes   !== undefined) row.recipe_notes    = data.recipeNotes;
      if (data.notes          !== undefined) row.notes           = data.notes;
      await supabase.from('feed_types').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.feedTypes.update(id, { ...data, updatedAt: now });
  },

  async deleteType(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('feed_types').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.feedTypes.delete(id);
  },

  // FeedDeliveries
  async getAllDeliveries(): Promise<FeedDelivery[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_deliveries').select('*')
        .eq('user_id', user.id).order('delivery_date', { ascending: false });
      return (data ?? []).map(rowToDelivery);
    }
    return db.feedDeliveries.orderBy('deliveryDate').reverse().toArray();
  },

  async getDeliveriesByType(feedTypeId: number): Promise<FeedDelivery[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_deliveries').select('*')
        .eq('user_id', user.id).eq('feed_type_id', feedTypeId);
      return (data ?? []).map(rowToDelivery);
    }
    return db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
  },

  async createDelivery(data: Omit<FeedDelivery, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('feed_deliveries').insert({
        user_id: user.id, feed_type_id: data.feedTypeId, delivery_date: data.deliveryDate,
        quantity_kg: data.quantityKg, invoice_number: data.invoiceNumber ?? null,
        supplier_name: data.supplierName ?? null, total_cost_pln: data.totalCostPln,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      await recalcWACSupabase(data.feedTypeId, user.id);
      return row.id;
    }
    const deliveryId = await db.feedDeliveries.add({ ...data, createdAt: now });
    await recalcWAC(data.feedTypeId);
    return deliveryId;
  },

  async updateDelivery(id: number, data: Partial<FeedDelivery>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.deliveryDate  !== undefined) row.delivery_date  = data.deliveryDate;
      if (data.quantityKg    !== undefined) row.quantity_kg    = data.quantityKg;
      if (data.invoiceNumber !== undefined) row.invoice_number = data.invoiceNumber;
      if (data.supplierName  !== undefined) row.supplier_name  = data.supplierName;
      if (data.totalCostPln  !== undefined) row.total_cost_pln = data.totalCostPln;
      if (data.notes         !== undefined) row.notes          = data.notes;
      await supabase.from('feed_deliveries').update(row).eq('id', id).eq('user_id', user.id);
      const { data: delivery } = await supabase.from('feed_deliveries').select('feed_type_id')
        .eq('id', id).eq('user_id', user.id).single();
      if (delivery) await recalcWACSupabase(delivery.feed_type_id, user.id);
      return;
    }
    await db.feedDeliveries.update(id, data);
    const delivery = await db.feedDeliveries.get(id);
    if (delivery) await recalcWAC(delivery.feedTypeId);
  },

  async deleteDelivery(id: number): Promise<void> {
    const user = await getAuthUser();

    // 1. Usuń powiązane financial_events (pending / settled) i ich transakcje kasowe
    if (user) {
      const { data: events } = await supabase
        .from('financial_events').select('id, cash_transaction_id')
        .eq('user_id', user.id).eq('source_type', 'feed_delivery').eq('source_id', id);
      for (const ev of events ?? []) {
        if (ev.cash_transaction_id) {
          await supabase.from('cash_transactions')
            .delete().eq('id', ev.cash_transaction_id).eq('user_id', user.id);
        }
        await supabase.from('financial_events').delete().eq('id', ev.id).eq('user_id', user.id);
      }
    } else {
      const events = await db.financialEvents
        .filter(e => e.sourceType === 'feed_delivery' && e.sourceId === id).toArray();
      for (const ev of events) {
        if (ev.cashTransactionId) await db.cashTransactions.delete(ev.cashTransactionId);
        await db.financialEvents.delete(ev.id!);
      }
    }

    // 2. Usuń bezpośrednie transakcje kasowe (immediate payment)
    await cashFlowService.deleteBySource('feed_delivery', id);

    // 3. Usuń samą dostawę i przelicz WAC
    if (user) {
      const { data: delivery } = await supabase.from('feed_deliveries').select('feed_type_id')
        .eq('id', id).eq('user_id', user.id).single();
      await supabase.from('feed_deliveries').delete().eq('id', id).eq('user_id', user.id);
      if (delivery) await recalcWACSupabase(delivery.feed_type_id, user.id);
      return;
    }
    const delivery = await db.feedDeliveries.get(id);
    await db.feedDeliveries.delete(id);
    if (delivery) await recalcWAC(delivery.feedTypeId);
  },

  // FeedConsumptions
  async getConsumptionsByBatch(batchId: number): Promise<FeedConsumption[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_consumptions').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId);
      return (data ?? []).map(rowToConsumption);
    }
    return db.feedConsumptions.where('batchId').equals(batchId).toArray();
  },

  async createConsumption(data: Omit<FeedConsumption, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('feed_consumptions').insert({
        user_id: user.id, batch_id: data.batchId, feed_type_id: data.feedTypeId,
        date: data.date, consumed_kg: data.consumedKg, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.feedConsumptions.add({ ...data, createdAt: now });
  },

  async getConsumptionsByBatchAndDate(batchId: number, date: string): Promise<FeedConsumption[]> {
    const all = await this.getConsumptionsByBatch(batchId);
    return all.filter(c => c.date === date);
  },

  async deleteConsumptionsByBatchAndDate(batchId: number, date: string): Promise<void> {
    const items = await this.getConsumptionsByBatchAndDate(batchId, date);
    await Promise.all(items.map(c => this.deleteConsumption(c.id!)));
  },

  async deleteConsumption(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('feed_consumptions').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.feedConsumptions.delete(id);
  },

  async getAllConsumptions(): Promise<FeedConsumption[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('feed_consumptions').select('*').eq('user_id', user.id);
      return (data ?? []).map(rowToConsumption);
    }
    return db.feedConsumptions.toArray();
  },

  async getStockLevel(feedTypeId: number): Promise<number> {
    const user = await getAuthUser();
    if (user) {
      const [deliveries, consumptions] = await Promise.all([
        supabase.from('feed_deliveries').select('quantity_kg').eq('feed_type_id', feedTypeId).eq('user_id', user.id),
        supabase.from('feed_consumptions').select('consumed_kg').eq('feed_type_id', feedTypeId).eq('user_id', user.id),
      ]);
      const delivered = (deliveries.data ?? []).reduce((s, d) => s + d.quantity_kg, 0);
      const consumed  = (consumptions.data ?? []).reduce((s, c) => s + c.consumed_kg, 0);
      return delivered - consumed;
    }
    const deliveries   = await db.feedDeliveries.where('feedTypeId').equals(feedTypeId).toArray();
    const consumptions = await db.feedConsumptions.where('feedTypeId').equals(feedTypeId).toArray();
    return deliveries.reduce((s, d) => s + d.quantityKg, 0)
         - consumptions.reduce((s, c) => s + c.consumedKg, 0);
  },
};
