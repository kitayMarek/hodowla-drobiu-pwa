/**
 * dairy.service.ts – Przetwórstwo Mleka
 *
 * Supabase SQL (uruchom w dashboardzie Supabase):
 * ─────────────────────────────────────────────────
 * CREATE TABLE milk_suppliers (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT NOT NULL, address TEXT, pesel_or_nip TEXT, phone TEXT, notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE milk_receptions (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   date DATE NOT NULL, source TEXT NOT NULL, quantity_liters NUMERIC NOT NULL,
 *   temperature_c NUMERIC, fat_percent NUMERIC, supplier_id INT REFERENCES milk_suppliers(id),
 *   supplier_name TEXT, price_per_liter NUMERIC, total_price_pln NUMERIC,
 *   invoice_number TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE milk_allocations (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   reception_id INT REFERENCES milk_receptions(id) NOT NULL,
 *   product_type TEXT NOT NULL, liters_allocated NUMERIC NOT NULL,
 *   batch_id INT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE production_batches (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   batch_number TEXT NOT NULL, product_type TEXT NOT NULL,
 *   milk_liters NUMERIC NOT NULL, expected_yield_kg NUMERIC NOT NULL,
 *   actual_yield_kg NUMERIC, status TEXT NOT NULL DEFAULT 'w_produkcji',
 *   production_date DATE NOT NULL, expiry_date DATE NOT NULL,
 *   quantity_remaining_kg NUMERIC NOT NULL, aging_days INT,
 *   notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE production_steps (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   batch_id INT REFERENCES production_batches(id) NOT NULL,
 *   step_type TEXT NOT NULL, label TEXT NOT NULL, sort_order INT NOT NULL,
 *   scheduled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
 *   duration_minutes INT, temperature_c NUMERIC, notes TEXT
 * );
 * CREATE TABLE whey_byproducts (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   batch_id INT REFERENCES production_batches(id) NOT NULL,
 *   quantity_liters NUMERIC NOT NULL, status TEXT NOT NULL DEFAULT 'skarmianie',
 *   ricotta_batch_id INT, date DATE NOT NULL, notes TEXT
 * );
 * CREATE TABLE dairy_sales (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   sale_date DATE NOT NULL,
 *   product_id INT, product_name TEXT, product_category TEXT,
 *   unit TEXT DEFAULT 'kg', quantity NUMERIC, unit_price_pln NUMERIC, total_value_pln NUMERIC,
 *   buyer_id INT, buyer_name TEXT, buyer_address TEXT,
 *   in_rhd BOOLEAN NOT NULL DEFAULT TRUE,
 *   rhd_number INT, rhd_year INT,
 *   batch_id INT, invoice_number TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE dairy_products (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT NOT NULL, category TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg',
 *   default_price_pln NUMERIC NOT NULL DEFAULT 0,
 *   is_active BOOLEAN NOT NULL DEFAULT true, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE TABLE dairy_buyers (
 *   id SERIAL PRIMARY KEY, user_id UUID REFERENCES auth.users NOT NULL,
 *   name TEXT NOT NULL, is_anonymous BOOLEAN NOT NULL DEFAULT false,
 *   address TEXT, phone TEXT, nip TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * -- RLS + polityki dla WSZYSTKICH tabel mleczarskich:
 * ALTER TABLE milk_suppliers ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE milk_receptions ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE milk_allocations ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE production_steps ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE whey_byproducts ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE dairy_sales ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE dairy_products ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE dairy_buyers ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "user_only" ON milk_suppliers    FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON milk_receptions   FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON milk_allocations  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON production_batches FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON production_steps  FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON whey_byproducts   FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON dairy_sales       FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON dairy_products    FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 * CREATE POLICY "user_only" ON dairy_buyers      FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
 */

import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { cashFlowService } from '@/services/cashFlow.service';
import type {
  MilkSupplier, MilkReception, MilkAllocation,
  ProductionBatch, ProductionStep, WheyByproduct, DairySale,
  DairyProductType, DairyProduct, DairyBuyer,
} from '@/models/dairy.model';
import {
  calcExpectedYield, calcExpectedWhey, calcExpiryDate,
  generateBatchNumber, WORKFLOW_STEPS, YIELD_FACTORS, NO_BATCH_TYPES,
} from '@/models/dairy.model';

// ── Helpers ──────────────────────────────────────────────────────

function toSupplier(r: Record<string, unknown>): MilkSupplier {
  return { id: r.id as number, name: r.name as string, address: r.address as string | undefined,
    peselOrNip: r.pesel_or_nip as string | undefined, phone: r.phone as string | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string };
}

function toReception(r: Record<string, unknown>): MilkReception {
  return { id: r.id as number, date: r.date as string, source: r.source as 'own' | 'purchase',
    quantityLiters: Number(r.quantity_liters), temperatureC: r.temperature_c != null ? Number(r.temperature_c) : undefined,
    fatPercent: r.fat_percent != null ? Number(r.fat_percent) : undefined,
    supplierId: r.supplier_id as number | undefined, supplierName: r.supplier_name as string | undefined,
    pricePerLiter: r.price_per_liter != null ? Number(r.price_per_liter) : undefined,
    totalPricePln: r.total_price_pln != null ? Number(r.total_price_pln) : undefined,
    invoiceNumber: r.invoice_number as string | undefined, notes: r.notes as string | undefined,
    createdAt: r.created_at as string };
}

function toBatch(r: Record<string, unknown>): ProductionBatch {
  return { id: r.id as number, batchNumber: r.batch_number as string,
    productType: r.product_type as DairyProductType,
    milkLiters: Number(r.milk_liters), expectedYieldKg: Number(r.expected_yield_kg),
    actualYieldKg: r.actual_yield_kg != null ? Number(r.actual_yield_kg) : undefined,
    status: r.status as ProductionBatch['status'],
    productionDate: r.production_date as string, expiryDate: r.expiry_date as string,
    quantityRemainingKg: Number(r.quantity_remaining_kg),
    agingDays: r.aging_days != null ? Number(r.aging_days) : undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string };
}

function toStep(r: Record<string, unknown>): ProductionStep {
  return { id: r.id as number, batchId: r.batch_id as number, stepType: r.step_type as string,
    label: r.label as string, sortOrder: r.sort_order as number,
    scheduledAt: r.scheduled_at as string | undefined, completedAt: r.completed_at as string | undefined,
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : undefined,
    temperatureC: r.temperature_c != null ? Number(r.temperature_c) : undefined,
    notes: r.notes as string | undefined };
}

function toWhey(r: Record<string, unknown>): WheyByproduct {
  return { id: r.id as number, batchId: r.batch_id as number,
    quantityLiters: Number(r.quantity_liters), status: r.status as WheyByproduct['status'],
    ricottaBatchId: r.ricotta_batch_id as number | undefined, date: r.date as string,
    notes: r.notes as string | undefined };
}

function toDairySale(r: Record<string, unknown>): DairySale {
  return {
    id: r.id as number,
    saleDate: r.sale_date as string,
    productId: Number(r.product_id ?? 0),
    productName: (r.product_name ?? '') as string,
    productCategory: (r.product_category ?? r.product_type ?? 'ser_dojrzewajacy') as DairyProductType,
    unit: (r.unit ?? 'kg') as string,
    quantity: Number(r.quantity ?? r.quantity_kg ?? 0),
    unitPricePln: Number(r.unit_price_pln ?? r.price_per_kg_pln ?? 0),
    totalValuePln: Number(r.total_value_pln ?? r.total_revenue_pln ?? 0),
    buyerId: r.buyer_id != null ? Number(r.buyer_id) : undefined,
    buyerName: (r.buyer_name ?? '') as string,
    buyerAddress: r.buyer_address as string | undefined,
    inRhd: r.in_rhd !== false,
    rhdNumber: r.rhd_number != null ? Number(r.rhd_number) : undefined,
    rhdYear: r.rhd_year != null ? Number(r.rhd_year) : undefined,
    batchId: r.batch_id != null ? Number(r.batch_id) : undefined,
    cashAccountId: r.cash_account_id != null ? Number(r.cash_account_id) : undefined,
    invoiceNumber: r.invoice_number as string | undefined,
    notes: r.notes as string | undefined,
    createdAt: r.created_at as string,
  };
}

function toDairyProduct(r: Record<string, unknown>): DairyProduct {
  return {
    id: r.id as number,
    name: r.name as string,
    category: r.category as DairyProductType,
    unit: r.unit as DairyProduct['unit'],
    defaultPricePln: Number(r.default_price_pln),
    isActive: r.is_active !== false,
    notes: r.notes as string | undefined,
    createdAt: r.created_at as string,
  };
}

function toDairyBuyer(r: Record<string, unknown>): DairyBuyer {
  return {
    id: r.id as number,
    name: r.name as string,
    isAnonymous: r.is_anonymous === true,
    address: r.address as string | undefined,
    phone: r.phone as string | undefined,
    nip: r.nip as string | undefined,
    notes: r.notes as string | undefined,
    createdAt: r.created_at as string,
  };
}

/** Generuj unikalny suffix dla numeru partii (A, B, C...) */
async function nextBatchSuffix(date: string): Promise<string> {
  const user = await getAuthUser();
  const prefix = `PARTIA-${date.replace(/-/g, '')}-`;
  let existing: ProductionBatch[];
  if (user) {
    const { data } = await supabase.from('production_batches')
      .select('batch_number').eq('user_id', user.id)
      .like('batch_number', `${prefix}%`);
    existing = (data ?? []).map(r => ({ batchNumber: r.batch_number } as ProductionBatch));
  } else {
    existing = await db.productionBatches.where('batchNumber').startsWith(prefix).toArray();
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let idx = 0;
  while (existing.some(b => b.batchNumber === `${prefix}${letters[idx]}`)) idx++;
  return letters[idx] ?? `${existing.length + 1}`;
}

// ── Service ──────────────────────────────────────────────────────

export const dairyService = {

  // ── Dostawcy ─────────────────────────────────────────────────

  async getSuppliers(): Promise<MilkSupplier[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('milk_suppliers').select('*')
        .eq('user_id', user.id).order('name');
      return (data ?? []).map(toSupplier);
    }
    return db.milkSuppliers.orderBy('name').toArray();
  },

  async updateSupplier(id: number, s: Omit<MilkSupplier, 'id' | 'createdAt'>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('milk_suppliers').update({
        name: s.name, address: s.address ?? null, pesel_or_nip: s.peselOrNip ?? null,
        phone: s.phone ?? null, notes: s.notes ?? null,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.milkSuppliers.update(id, s);
  },

  async deleteSupplier(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('milk_suppliers').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.milkSuppliers.delete(id);
  },

  async saveSupplier(s: Omit<MilkSupplier, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('milk_suppliers').insert({
        user_id: user.id, name: s.name, address: s.address ?? null,
        pesel_or_nip: s.peselOrNip ?? null, phone: s.phone ?? null,
        notes: s.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.milkSuppliers.add({ ...s, createdAt: now });
  },

  // ── Przyjęcia mleka ──────────────────────────────────────────

  async getReceptions(): Promise<MilkReception[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('milk_receptions').select('*')
        .eq('user_id', user.id).order('date', { ascending: false });
      return (data ?? []).map(toReception);
    }
    return db.milkReceptions.orderBy('date').reverse().toArray();
  },

  async getReceptionById(id: number): Promise<MilkReception | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('milk_receptions').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? toReception(data) : undefined;
    }
    return db.milkReceptions.get(id);
  },

  async saveReception(r: Omit<MilkReception, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('milk_receptions').insert({
        user_id: user.id, date: r.date, source: r.source,
        quantity_liters: r.quantityLiters, temperature_c: r.temperatureC ?? null,
        fat_percent: r.fatPercent ?? null, supplier_id: r.supplierId ?? null,
        supplier_name: r.supplierName ?? null, price_per_liter: r.pricePerLiter ?? null,
        total_price_pln: r.totalPricePln ?? null, invoice_number: r.invoiceNumber ?? null,
        notes: r.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.milkReceptions.add({ ...r, createdAt: now });
  },

  async deleteReception(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('milk_receptions').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.milkReceptions.delete(id);
  },

  // ── Rozlew (alokacje) ─────────────────────────────────────────

  /** Suma rozlanych litrów dla danego przyjęcia */
  async getAllocatedLiters(receptionId: number): Promise<number> {
    const allocs = await this.getAllocationsByReception(receptionId);
    return allocs.reduce((s, a) => s + a.litersAllocated, 0);
  },

  /**
   * Podsumowania alokacji dla wielu przyjęć naraz.
   * Zwraca mapę receptionId → { allocatedL, hasSales }
   */
  async getAllocationSummaries(receptionIds: number[]): Promise<
    Map<number, { allocatedL: number; hasSales: boolean }>
  > {
    const result = new Map<number, { allocatedL: number; hasSales: boolean }>();
    if (receptionIds.length === 0) return result;

    const user = await getAuthUser();
    let allAllocs: MilkAllocation[];

    if (user) {
      const { data } = await supabase.from('milk_allocations').select('*')
        .eq('user_id', user.id).in('reception_id', receptionIds);
      allAllocs = (data ?? []).map(r => ({
        id: r.id, receptionId: r.reception_id, productType: r.product_type as DairyProductType,
        litersAllocated: Number(r.liters_allocated), batchId: r.batch_id ?? undefined,
        createdAt: r.created_at,
      }));
    } else {
      allAllocs = await db.milkAllocations
        .where('receptionId').anyOf(receptionIds).toArray();
    }

    // Zbierz batchIds
    const batchIds = allAllocs.map(a => a.batchId).filter((b): b is number => b != null);

    // Sprawdź sprzedaże dla tych partii
    let batchesWithSales = new Set<number>();
    if (batchIds.length > 0) {
      if (user) {
        const { data } = await supabase.from('dairy_sales').select('batch_id')
          .eq('user_id', user.id).in('batch_id', batchIds);
        (data ?? []).forEach(r => { if (r.batch_id) batchesWithSales.add(r.batch_id); });
      } else {
        const sales = await db.dairySales.where('batchId').anyOf(batchIds).toArray();
        sales.forEach(s => { if (s.batchId) batchesWithSales.add(s.batchId); });
      }
    }

    // Grupuj per przyjęcie
    for (const id of receptionIds) {
      const forThis = allAllocs.filter(a => a.receptionId === id);
      const allocatedL = forThis.reduce((s, a) => s + a.litersAllocated, 0);
      const hasSales   = forThis.some(a => a.batchId != null && batchesWithSales.has(a.batchId));
      result.set(id, { allocatedL, hasSales });
    }
    return result;
  },

  /**
   * Usuwa wszystkie alokacje i powiązane partie dla danego przyjęcia.
   * Rzuca błąd jeśli którakolwiek partia ma sprzedaż.
   */
  async deleteReceptionAllocations(receptionId: number): Promise<void> {
    const allocs = await this.getAllocationsByReception(receptionId);
    const batchIds = allocs.map(a => a.batchId).filter((b): b is number => b != null);

    // Sprawdź czy są sprzedaże
    if (batchIds.length > 0) {
      const user = await getAuthUser();
      if (user) {
        const { data } = await supabase.from('dairy_sales').select('id')
          .eq('user_id', user.id).in('batch_id', batchIds).limit(1);
        if (data && data.length > 0) throw new Error('Nie można usunąć — dla tej partii istnieje sprzedaż.');
      } else {
        const count = await db.dairySales.where('batchId').anyOf(batchIds).count();
        if (count > 0) throw new Error('Nie można usunąć — dla tej partii istnieje sprzedaż.');
      }
    }

    const user = await getAuthUser();
    // Usuń kroki, serwatkę, partie, alokacje
    for (const batchId of batchIds) {
      if (user) {
        await supabase.from('production_steps').delete().eq('batch_id', batchId).eq('user_id', user.id);
        await supabase.from('whey_byproducts').delete().eq('batch_id', batchId).eq('user_id', user.id);
        await supabase.from('production_batches').delete().eq('id', batchId).eq('user_id', user.id);
      } else {
        await db.productionSteps.where('batchId').equals(batchId).delete();
        await db.wheyByproducts.where('batchId').equals(batchId).delete();
        await db.productionBatches.delete(batchId);
      }
    }
    if (user) {
      await supabase.from('milk_allocations').delete().eq('reception_id', receptionId).eq('user_id', user.id);
    } else {
      await db.milkAllocations.where('receptionId').equals(receptionId).delete();
    }
  },

  async getAllocationsByReception(receptionId: number): Promise<MilkAllocation[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('milk_allocations').select('*')
        .eq('user_id', user.id).eq('reception_id', receptionId);
      return (data ?? []).map(r => ({
        id: r.id, receptionId: r.reception_id, productType: r.product_type as DairyProductType,
        litersAllocated: Number(r.liters_allocated), batchId: r.batch_id ?? undefined,
        createdAt: r.created_at,
      }));
    }
    return db.milkAllocations.where('receptionId').equals(receptionId).toArray();
  },

  /**
   * Zapisuje alokacje i automatycznie tworzy partie produkcyjne.
   * Zwraca listę ID utworzonych partii.
   */
  async saveAllocations(
    receptionId: number,
    lines: Array<{ productType: DairyProductType; litersAllocated: number; agingDays?: number }>
  ): Promise<number[]> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    const reception = await this.getReceptionById(receptionId);
    if (!reception) throw new Error('Przyjęcie nie istnieje');

    const batchIds: number[] = [];

    for (const line of lines) {
      if (line.litersAllocated <= 0) continue;

      // Typy bez partii (mleko surowe, skarmianie) — tylko zapisz alokację
      if (NO_BATCH_TYPES.has(line.productType)) {
        if (user) {
          await supabase.from('milk_allocations').insert({
            user_id: user.id, reception_id: receptionId,
            product_type: line.productType,
            liters_allocated: line.litersAllocated,
            batch_id: null, created_at: now,
          });
        } else {
          await db.milkAllocations.add({
            receptionId, productType: line.productType,
            litersAllocated: line.litersAllocated, createdAt: now,
          });
        }
        continue;
      }

      const suffix     = await nextBatchSuffix(reception.date);
      const batchNum   = generateBatchNumber(reception.date, suffix);
      const expected   = calcExpectedYield(line.litersAllocated, line.productType);
      const expiry     = calcExpiryDate(reception.date, line.productType, line.agingDays);
      const aging      = line.agingDays ?? YIELD_FACTORS[line.productType].agingDays;

      // Utwórz partię
      let batchId: number;
      if (user) {
        const { data, error } = await supabase.from('production_batches').insert({
          user_id: user.id, batch_number: batchNum, product_type: line.productType,
          milk_liters: line.litersAllocated, expected_yield_kg: expected,
          status: 'w_produkcji', production_date: reception.date, expiry_date: expiry,
          quantity_remaining_kg: expected, aging_days: aging ?? null, created_at: now,
        }).select('id').single();
        if (error) throw error;
        batchId = data.id;
      } else {
        batchId = await db.productionBatches.add({
          batchNumber: batchNum, productType: line.productType,
          milkLiters: line.litersAllocated, expectedYieldKg: expected,
          status: 'w_produkcji', productionDate: reception.date, expiryDate: expiry,
          quantityRemainingKg: expected, agingDays: aging, createdAt: now,
        });
      }
      batchIds.push(batchId);

      // Utwórz kroki workflow
      const steps = WORKFLOW_STEPS[line.productType];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const dur = s.stepType === 'dojrzewalnia'
          ? (aging ?? 21) * 24 * 60
          : s.defaultDurationMinutes;
        if (user) {
          await supabase.from('production_steps').insert({
            user_id: user.id, batch_id: batchId, step_type: s.stepType,
            label: s.label, sort_order: i, duration_minutes: dur ?? null,
          });
        } else {
          await db.productionSteps.add({
            batchId, stepType: s.stepType, label: s.label,
            sortOrder: i, durationMinutes: dur,
          });
        }
      }

      // Utwórz wpis serwatki (jeśli dotyczy)
      const wheyL = calcExpectedWhey(line.litersAllocated, line.productType);
      if (wheyL > 0) {
        if (user) {
          await supabase.from('whey_byproducts').insert({
            user_id: user.id, batch_id: batchId, quantity_liters: wheyL,
            status: 'skarmianie', date: reception.date,
          });
        } else {
          await db.wheyByproducts.add({
            batchId, quantityLiters: wheyL, status: 'skarmianie', date: reception.date,
          });
        }
      }

      // Zapisz alokację z powiązanym batchId
      if (user) {
        await supabase.from('milk_allocations').insert({
          user_id: user.id, reception_id: receptionId, product_type: line.productType,
          liters_allocated: line.litersAllocated, batch_id: batchId, created_at: now,
        });
      } else {
        await db.milkAllocations.add({
          receptionId, productType: line.productType,
          litersAllocated: line.litersAllocated, batchId, createdAt: now,
        });
      }
    }

    return batchIds;
  },

  // ── Partie produkcyjne ───────────────────────────────────────

  async getBatches(statusFilter?: ProductionBatch['status'][]): Promise<ProductionBatch[]> {
    const user = await getAuthUser();
    if (user) {
      let q = supabase.from('production_batches').select('*').eq('user_id', user.id);
      if (statusFilter?.length) q = q.in('status', statusFilter);
      const { data } = await q.order('production_date', { ascending: false });
      return (data ?? []).map(toBatch);
    }
    let col = db.productionBatches.orderBy('productionDate').reverse();
    if (statusFilter?.length) {
      const set = new Set(statusFilter);
      return (await col.toArray()).filter(b => set.has(b.status));
    }
    return col.toArray();
  },

  async getBatchById(id: number): Promise<ProductionBatch | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('production_batches').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? toBatch(data) : undefined;
    }
    return db.productionBatches.get(id);
  },

  async updateBatchStatus(id: number, status: ProductionBatch['status']): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('production_batches').update({ status }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.productionBatches.update(id, { status });
  },

  async updateBatchYield(id: number, actualYieldKg: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('production_batches').update({
        actual_yield_kg: actualYieldKg, quantity_remaining_kg: actualYieldKg,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.productionBatches.update(id, { actualYieldKg, quantityRemainingKg: actualYieldKg });
  },

  // ── Kroki workflow ────────────────────────────────────────────

  async getStepsByBatch(batchId: number): Promise<ProductionStep[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('production_steps').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId).order('sort_order');
      return (data ?? []).map(toStep);
    }
    return db.productionSteps.where('batchId').equals(batchId).sortBy('sortOrder');
  },

  async completeStep(stepId: number, opts?: { temperatureC?: number; notes?: string }): Promise<void> {
    const user = await getAuthUser();
    const completedAt = new Date().toISOString();
    if (user) {
      await supabase.from('production_steps').update({
        completed_at: completedAt, temperature_c: opts?.temperatureC ?? null, notes: opts?.notes ?? null,
      }).eq('id', stepId).eq('user_id', user.id);
      return;
    }
    await db.productionSteps.update(stepId, { completedAt, ...opts });
  },

  // ── Serwatka ──────────────────────────────────────────────────

  async getWheyByBatch(batchId: number): Promise<WheyByproduct | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('whey_byproducts').select('*')
        .eq('user_id', user.id).eq('batch_id', batchId).maybeSingle();
      return data ? toWhey(data) : undefined;
    }
    return (await db.wheyByproducts.where('batchId').equals(batchId).first());
  },

  async updateWheyStatus(id: number, status: WheyByproduct['status']): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('whey_byproducts').update({ status }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.wheyByproducts.update(id, { status });
  },

  // ── Katalog produktów ────────────────────────────────────────────

  async getProducts(): Promise<DairyProduct[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('dairy_products').select('*')
        .eq('user_id', user.id).order('name');
      return (data ?? []).map(toDairyProduct);
    }
    return db.dairyProducts.orderBy('name').toArray();
  },

  async saveProduct(p: Omit<DairyProduct, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('dairy_products').insert({
        user_id: user.id, name: p.name, category: p.category, unit: p.unit,
        default_price_pln: p.defaultPricePln, is_active: p.isActive,
        notes: p.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.dairyProducts.add({ ...p, createdAt: now });
  },

  async updateProduct(id: number, p: Omit<DairyProduct, 'id' | 'createdAt'>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('dairy_products').update({
        name: p.name, category: p.category, unit: p.unit,
        default_price_pln: p.defaultPricePln, is_active: p.isActive, notes: p.notes ?? null,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairyProducts.update(id, p);
  },

  async deleteProduct(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('dairy_products').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairyProducts.delete(id);
  },

  // ── Nabywcy ──────────────────────────────────────────────────────

  async getBuyers(): Promise<DairyBuyer[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('dairy_buyers').select('*')
        .eq('user_id', user.id).order('name');
      return (data ?? []).map(toDairyBuyer);
    }
    return db.dairyBuyers.orderBy('name').toArray();
  },

  async saveBuyer(b: Omit<DairyBuyer, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('dairy_buyers').insert({
        user_id: user.id, name: b.name, is_anonymous: b.isAnonymous,
        address: b.address ?? null, phone: b.phone ?? null,
        nip: b.nip ?? null, notes: b.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.dairyBuyers.add({ ...b, createdAt: now });
  },

  async updateBuyer(id: number, b: Omit<DairyBuyer, 'id' | 'createdAt'>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('dairy_buyers').update({
        name: b.name, is_anonymous: b.isAnonymous, address: b.address ?? null,
        phone: b.phone ?? null, nip: b.nip ?? null, notes: b.notes ?? null,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairyBuyers.update(id, b);
  },

  async deleteBuyer(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('dairy_buyers').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairyBuyers.delete(id);
  },

  // ── Sprzedaż mleczarska ──────────────────────────────────────────

  async getSales(year?: number): Promise<DairySale[]> {
    const user = await getAuthUser();
    if (user) {
      let q = supabase.from('dairy_sales').select('*').eq('user_id', user.id);
      if (year) q = q.eq('rhd_year', year);
      const { data } = await q.order('sale_date', { ascending: false });
      return (data ?? []).map(toDairySale);
    }
    let col = db.dairySales.orderBy('saleDate').reverse();
    if (year) {
      return (await col.toArray()).filter(s =>
        s.rhdYear === year || (!s.rhdYear && new Date(s.saleDate).getFullYear() === year)
      );
    }
    return col.toArray();
  },

  /** Statystyki RHD dla danego roku kalendarzowego */
  async getRhdStats(year: number): Promise<{ totalPln: number; nextNumber: number; count: number }> {
    const user = await getAuthUser();
    let sales: DairySale[];
    if (user) {
      const { data } = await supabase.from('dairy_sales').select('*')
        .eq('user_id', user.id).eq('in_rhd', true).eq('rhd_year', year);
      sales = (data ?? []).map(toDairySale);
    } else {
      sales = await db.dairySales
        .where('rhdYear').equals(year)
        .and(s => s.inRhd === true)
        .toArray();
    }
    const totalPln = sales.reduce((s, r) => s + r.totalValuePln, 0);
    const maxNum   = sales.reduce((m, r) => Math.max(m, r.rhdNumber ?? 0), 0);
    return { totalPln, nextNumber: maxNum + 1, count: sales.length };
  },

  async saveSale(s: Omit<DairySale, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now  = new Date().toISOString();
    const year = s.rhdYear ?? new Date(s.saleDate).getFullYear();

    let rhdNumber = s.rhdNumber;
    if (s.inRhd && !rhdNumber) {
      const stats = await this.getRhdStats(year);
      rhdNumber = stats.nextNumber;
    }

    const toSave = { ...s, rhdNumber, rhdYear: year };

    if (user) {
      const { data, error } = await supabase.from('dairy_sales').insert({
        user_id: user.id,
        sale_date: toSave.saleDate,
        product_id: toSave.productId,
        product_name: toSave.productName,
        product_category: toSave.productCategory,
        unit: toSave.unit,
        quantity: toSave.quantity,
        unit_price_pln: toSave.unitPricePln,
        total_value_pln: toSave.totalValuePln,
        buyer_id: toSave.buyerId ?? null,
        buyer_name: toSave.buyerName,
        buyer_address: toSave.buyerAddress ?? null,
        in_rhd: toSave.inRhd,
        rhd_number: toSave.rhdNumber ?? null,
        rhd_year: toSave.rhdYear ?? null,
        batch_id: toSave.batchId ?? null,
        cash_account_id: toSave.cashAccountId ?? null,
        invoice_number: toSave.invoiceNumber ?? null,
        notes: toSave.notes ?? null,
        created_at: now,
      }).select('id').single();
      if (error) throw error;
      if (toSave.cashAccountId) {
        await cashFlowService.createTransaction({
          accountId: toSave.cashAccountId,
          date: toSave.saleDate,
          type: 'income',
          scope: 'sery',
          category: 'Sprzedaż serów',
          description: `${toSave.productName} — ${toSave.buyerName}`,
          amountPln: toSave.totalValuePln,
          sourceType: 'dairy_sale',
          sourceId: data.id,
        });
      }
      return data.id;
    }
    const saleId = await db.dairySales.add({ ...toSave, createdAt: now });
    if (toSave.cashAccountId) {
      await cashFlowService.createTransaction({
        accountId: toSave.cashAccountId,
        date: toSave.saleDate,
        type: 'income',
        scope: 'sery',
        category: 'Sprzedaż serów',
        description: `${toSave.productName} — ${toSave.buyerName}`,
        amountPln: toSave.totalValuePln,
        sourceType: 'dairy_sale',
        sourceId: saleId,
      });
    }
    return saleId;
  },

  async deleteSale(id: number): Promise<void> {
    await cashFlowService.deleteBySource('dairy_sale', id);
    const user = await getAuthUser();
    if (user) {
      await supabase.from('dairy_sales').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairySales.delete(id);
  },

  // ── Statystyki dla dashboardu ─────────────────────────────────

  async getDashboardStats(): Promise<{
    activeBatches: number;
    expiringIn7Days: ProductionBatch[];
    totalStockKg: number;
    todayReception: number;
    monthlyWheyL: number;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7str = in7.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const [batches, receptions, wheys] = await Promise.all([
      this.getBatches(['w_produkcji', 'dojrzewa', 'gotowy']),
      this.getReceptions(),
      (async () => {
        const user = await getAuthUser();
        if (user) {
          const { data } = await supabase.from('whey_byproducts').select('quantity_liters, date')
            .eq('user_id', user.id).gte('date', monthStart);
          return (data ?? []).map(r => ({ quantityLiters: Number(r.quantity_liters) }));
        }
        return db.wheyByproducts.where('date').aboveOrEqual(monthStart).toArray();
      })(),
    ]);

    const todayL = receptions
      .filter(r => r.date === today)
      .reduce((s, r) => s + r.quantityLiters, 0);

    const expiringIn7Days = batches.filter(
      b => b.status === 'gotowy' && b.expiryDate >= today && b.expiryDate <= in7str
    );

    return {
      activeBatches: batches.length,
      expiringIn7Days,
      totalStockKg: batches.reduce((s, b) => s + b.quantityRemainingKg, 0),
      todayReception: todayL,
      monthlyWheyL: wheys.reduce((s, w) => s + w.quantityLiters, 0),
    };
  },
};
