import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { cashFlowService } from '@/services/cashFlow.service';
import { dairyService } from '@/services/dairy.service';
import type { Sale } from '@/models/sale.model';
import type { SaleType } from '@/constants/phases';

function rowToSale(r: Record<string, unknown>): Sale {
  return {
    id:               r.id as number,
    batchId:          r.batch_id as number,
    saleDate:         r.sale_date as string,
    saleType:         r.sale_type as SaleType,
    eggsCount:        r.eggs_count as number | undefined,
    eggPricePln:      r.egg_price_pln as number | undefined,
    birdCount:        r.bird_count as number | undefined,
    weightKg:         r.weight_kg as number | undefined,
    pricePerKgPln:    r.price_per_kg_pln as number | undefined,
    totalRevenuePln:  r.total_revenue_pln as number,
    buyerName:        r.buyer_name as string | undefined,
    invoiceNumber:    r.invoice_number as string | undefined,
    notes:            r.notes as string | undefined,
    inRhd:            r.in_rhd !== false,
    rhdNumber:        r.rhd_number != null ? Number(r.rhd_number) : undefined,
    rhdYear:          r.rhd_year   != null ? Number(r.rhd_year)   : undefined,
    saleDocumentId:   r.sale_document_id != null ? Number(r.sale_document_id) : undefined,
    createdAt:        r.created_at as string,
  };
}

export const saleService = {
  async getAll(): Promise<Sale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('sales').select('*')
        .eq('user_id', user.id).order('sale_date', { ascending: false });
      return (data ?? []).map(rowToSale);
    }
    return db.sales.orderBy('saleDate').reverse().toArray();
  },

  async getByDocument(documentId: number): Promise<Sale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('sales').select('*')
        .eq('user_id', user.id).eq('sale_document_id', documentId);
      return (data ?? []).map(rowToSale);
    }
    return db.sales.where('saleDocumentId').equals(documentId).toArray();
  },

  async getByBatch(batchId: number): Promise<Sale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('sales').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId).order('sale_date');
      return (data ?? []).map(rowToSale);
    }
    return db.sales.where('batchId').equals(batchId).sortBy('saleDate');
  },

  async getByType(saleType: SaleType): Promise<Sale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('sales').select('*')
        .eq('user_id', user.id).eq('sale_type', saleType);
      return (data ?? []).map(rowToSale);
    }
    return db.sales.where('saleType').equals(saleType).toArray();
  },

  async getById(id: number): Promise<Sale | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('sales').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToSale(data) : undefined;
    }
    return db.sales.get(id);
  },

  async create(data: Omit<Sale, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    const year = data.rhdYear ?? new Date(data.saleDate).getFullYear();

    // Kolejny numer w rocznej ewidencji RHD — wspólna sekwencja z dairy_sales
    // i sale_documents. Linie dokumentów dostają numer dokumentu z zewnątrz.
    let rhdNumber = data.rhdNumber;
    if (data.inRhd !== false && rhdNumber == null && data.saleType !== 'jaja_wewn') {
      try {
        const stats = await dairyService.getRhdStats(year);
        rhdNumber = stats.nextNumber;
      } catch {
        rhdNumber = 1;
      }
    }

    if (user) {
      const { data: row, error } = await supabase.from('sales').insert({
        user_id: user.id, batch_id: data.batchId, sale_date: data.saleDate,
        sale_type: data.saleType, eggs_count: data.eggsCount ?? null,
        egg_price_pln: data.eggPricePln ?? null, bird_count: data.birdCount ?? null,
        weight_kg: data.weightKg ?? null, price_per_kg_pln: data.pricePerKgPln ?? null,
        total_revenue_pln: data.totalRevenuePln, buyer_name: data.buyerName ?? null,
        invoice_number: data.invoiceNumber ?? null, notes: data.notes ?? null,
        in_rhd: data.inRhd ?? true,
        // rhd_number/rhd_year dodawane tylko gdy nadano numer — kolumny mogą jeszcze nie być w bazie
        ...(rhdNumber != null ? { rhd_number: rhdNumber, rhd_year: year } : {}),
        ...(data.saleDocumentId != null ? { sale_document_id: data.saleDocumentId } : {}),
        created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.sales.add({ ...data, rhdNumber, rhdYear: year, createdAt: now });
  },

  async update(id: number, data: Partial<Sale>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (data.saleDate        !== undefined) row.sale_date         = data.saleDate;
      if (data.saleType        !== undefined) row.sale_type         = data.saleType;
      if (data.eggsCount       !== undefined) row.eggs_count        = data.eggsCount;
      if (data.eggPricePln     !== undefined) row.egg_price_pln     = data.eggPricePln;
      if (data.birdCount       !== undefined) row.bird_count        = data.birdCount;
      if (data.weightKg        !== undefined) row.weight_kg         = data.weightKg;
      if (data.pricePerKgPln   !== undefined) row.price_per_kg_pln  = data.pricePerKgPln;
      if (data.totalRevenuePln !== undefined) row.total_revenue_pln = data.totalRevenuePln;
      if (data.buyerName       !== undefined) row.buyer_name        = data.buyerName;
      if (data.invoiceNumber   !== undefined) row.invoice_number    = data.invoiceNumber;
      if (data.notes           !== undefined) row.notes             = data.notes;
      if (data.inRhd           !== undefined) row.in_rhd            = data.inRhd;
      if (data.rhdNumber       !== undefined) row.rhd_number        = data.rhdNumber ?? null;
      if (data.rhdYear         !== undefined) row.rhd_year          = data.rhdYear   ?? null;
      await supabase.from('sales').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.sales.update(id, data);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();

    // 1. Usuń powiązane financial_events (pending / settled) i ewentualnie ich transakcje kasowe
    if (user) {
      const { data: events } = await supabase
        .from('financial_events').select('id, cash_transaction_id')
        .eq('user_id', user.id).eq('source_type', 'sale').eq('source_id', id);
      for (const ev of events ?? []) {
        if (ev.cash_transaction_id) {
          await supabase.from('cash_transactions')
            .delete().eq('id', ev.cash_transaction_id).eq('user_id', user.id);
        }
        await supabase.from('financial_events').delete().eq('id', ev.id).eq('user_id', user.id);
      }
    } else {
      const events = await db.financialEvents
        .filter(e => e.sourceType === 'sale' && e.sourceId === id).toArray();
      for (const ev of events) {
        if (ev.cashTransactionId) await db.cashTransactions.delete(ev.cashTransactionId);
        await db.financialEvents.delete(ev.id!);
      }
    }

    // 2. Usuń bezpośrednie transakcje kasowe (immediate payment)
    await cashFlowService.deleteBySource('sale', id);

    // 3. Usuń samą sprzedaż
    if (user) {
      await supabase.from('sales').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.sales.delete(id);
  },

  async getTotalRevenue(batchId?: number): Promise<number> {
    const sales = batchId != null ? await this.getByBatch(batchId) : await this.getAll();
    return sales.reduce((s, x) => s + x.totalRevenuePln, 0);
  },

  /** Dostępny stan magazynu jaj (zebrane + kupione − sprzedane − do wylęgu). */
  async getAvailableEggsCount(): Promise<number> {
    const user = await getAuthUser();
    if (user) {
      const [entriesRes, salesRes, purchasesRes, hatchRes] = await Promise.all([
        supabase.from('daily_entries').select('eggs_collected, eggs_defective').eq('user_id', user.id),
        supabase.from('sales').select('eggs_count').eq('user_id', user.id).eq('sale_type', 'jaja'),
        supabase.from('egg_purchases').select('count').eq('user_id', user.id),
        supabase.from('egg_hatch_transfers').select('count').eq('user_id', user.id),
      ]);
      const collected   = (entriesRes.data ?? []).reduce((s, r) => s + ((r.eggs_collected ?? 0) - (r.eggs_defective ?? 0)), 0);
      const sold        = (salesRes.data ?? []).reduce((s, r) => s + (r.eggs_count ?? 0), 0);
      const purchased   = (purchasesRes.data ?? []).reduce((s, r) => s + (r.count ?? 0), 0);
      const transferred = (hatchRes.data ?? []).reduce((s, r) => s + (r.count ?? 0), 0);
      return Math.max(0, collected + purchased - sold - transferred);
    }
    const [entries, jajaS, purchases, hatches] = await Promise.all([
      db.dailyEntries.toArray(),
      db.sales.where('saleType').equals('jaja').toArray(),
      db.eggPurchases.toArray(),
      db.eggHatchTransfers.toArray(),
    ]);
    const collected   = entries.reduce((s, e) => s + ((e.eggsCollected ?? 0) - (e.eggsDefective ?? 0)), 0);
    const sold        = jajaS.reduce((s, x) => s + (x.eggsCount ?? 0), 0);
    const purchased   = purchases.reduce((s, p) => s + p.count, 0);
    const transferred = hatches.reduce((s, t) => s + t.count, 0);
    return Math.max(0, collected + purchased - sold - transferred);
  },
};
