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
  generateBatchNumber, WORKFLOW_STEPS, YIELD_FACTORS, NO_BATCH_TYPES, PRODUCT_LABELS,
} from '@/models/dairy.model';
import { fetchRecipeBySlug, buildStepsFromRecipe } from '@/services/recipeContract.service';
import type { Recipe, UserRecipe } from '@/models/recipe.schema';
import { RECIPE_SCHEMA_VERSION, DEFAULT_USER_RECIPE_STATUS } from '@/models/recipe.schema';
import type { BatchPhoto } from '@/models/batchPhoto.model';
import { compressImage, makeThumbnail } from '@/utils/imageUtils';

/** Zbuduj przepis z faktycznego przebiegu partii (Etap 3 L2 — fork do „mojego przepisu"). */
function buildRecipeFromBatch(batch: ProductionBatch, steps: ProductionStep[]): Recipe {
  const kroki = steps.map((s, i) => ({
    nr: i + 1,
    nazwa: s.label,
    opis: s.description,
    wskazowka: s.hint,
    czasMin: s.actualDurationMin ?? s.durationMinutes ?? null,
    temperaturaC: s.temperatureC ?? null,
    warunekKonca: s.endCondition ?? null,
  }));
  const uwagi = batch.additives?.length
    ? 'Dodatki: ' + batch.additives.map(a => `${a.co}${a.atStep ? ` (${a.atStep})` : ''}`).join(', ')
    : undefined;
  return {
    wersjaSchematu: RECIPE_SCHEMA_VERSION,
    slug: `user-${Date.now()}`,
    nazwa: batch.cheeseName || PRODUCT_LABELS[batch.productType],
    rodzina: PRODUCT_LABELS[batch.productType],
    zrodlo: 'fermly-spolecznosc',
    mleko: { litry: batch.milkLiters, typ: 'krowie' },
    kroki,
    wydajnoscKg: batch.actualYieldKg ?? batch.expectedYieldKg,
    uwagi,
  };
}

type NewStep = Omit<ProductionStep, 'id' | 'batchId'>;

/** Wybierz kroki dla partii: z przepisu serowarni (gdy jest odmiana), inaczej generyczne. */
async function resolveBatchSteps(
  productType: DairyProductType, cheeseVariety: string | undefined, aging: number | undefined,
): Promise<NewStep[]> {
  if (cheeseVariety) {
    try {
      const recipe = await fetchRecipeBySlug(cheeseVariety);
      if (recipe) return buildStepsFromRecipe(recipe);
    } catch { /* offline / brak sieci → fallback do generycznych */ }
  }
  return WORKFLOW_STEPS[productType].map((s, i) => ({
    stepType: s.stepType, label: s.label, sortOrder: i,
    durationMinutes: s.stepType === 'dojrzewalnia' ? (aging ?? 21) * 24 * 60 : s.defaultDurationMinutes,
  }));
}

/** Zapisz kroki partii (Supabase lub Dexie). Nowe kolumny dodawane warunkowo (odporność na brak migracji). */
async function insertSteps(
  user: { id: string } | null, batchId: number, steps: NewStep[],
): Promise<void> {
  for (const s of steps) {
    if (user) {
      await supabase.from('production_steps').insert({
        user_id: user.id, batch_id: batchId, step_type: s.stepType, label: s.label,
        sort_order: s.sortOrder, duration_minutes: s.durationMinutes ?? null,
        temperature_c: s.temperatureC ?? null,
        ...(s.description  ? { description:   s.description }  : {}),
        ...(s.hint         ? { hint:          s.hint }         : {}),
        ...(s.endCondition ? { end_condition: s.endCondition } : {}),
      });
    } else {
      await db.productionSteps.add({ batchId, ...s });
    }
  }
}

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
    cheeseVariety: (r.cheese_variety as string | null) ?? undefined,
    cheeseName: (r.cheese_name as string | null) ?? undefined,
    additives: (r.additives as ProductionBatch['additives']) ?? undefined,
    milkLiters: Number(r.milk_liters), expectedYieldKg: Number(r.expected_yield_kg),
    actualYieldKg: r.actual_yield_kg != null ? Number(r.actual_yield_kg) : undefined,
    status: r.status as ProductionBatch['status'],
    productionDate: r.production_date as string, expiryDate: r.expiry_date as string,
    quantityRemainingKg: Number(r.quantity_remaining_kg),
    agingDays: r.aging_days != null ? Number(r.aging_days) : undefined,
    lastWeighedAt: (r.last_weighed_at as string | null) ?? undefined,
    lastWeighedKg: r.last_weighed_kg != null ? Number(r.last_weighed_kg) : undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string };
}

function toStep(r: Record<string, unknown>): ProductionStep {
  return { id: r.id as number, batchId: r.batch_id as number, stepType: r.step_type as string,
    label: r.label as string, sortOrder: r.sort_order as number,
    scheduledAt: r.scheduled_at as string | undefined, completedAt: r.completed_at as string | undefined,
    durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : undefined,
    temperatureC: r.temperature_c != null ? Number(r.temperature_c) : undefined,
    notes: r.notes as string | undefined,
    description: (r.description as string | null) ?? undefined,
    hint: (r.hint as string | null) ?? undefined,
    endCondition: (r.end_condition as string | null) ?? undefined,
    startedAt: (r.started_at as string | null) ?? undefined,
    actualDurationMin: r.actual_duration_min != null ? Number(r.actual_duration_min) : undefined };
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
    cashAccountId:  r.cash_account_id  != null ? Number(r.cash_account_id)  : undefined,
    saleDocumentId: r.sale_document_id != null ? Number(r.sale_document_id) : undefined,
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
    lines: Array<{ productType: DairyProductType; litersAllocated: number; agingDays?: number;
      cheeseVariety?: string; cheeseName?: string }>
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
          quantity_remaining_kg: expected, aging_days: aging ?? null,
          ...(line.cheeseVariety ? { cheese_variety: line.cheeseVariety } : {}),
          ...(line.cheeseName ? { cheese_name: line.cheeseName } : {}),
          created_at: now,
        }).select('id').single();
        if (error) throw error;
        batchId = data.id;
      } else {
        batchId = await db.productionBatches.add({
          batchNumber: batchNum, productType: line.productType,
          cheeseVariety: line.cheeseVariety, cheeseName: line.cheeseName,
          milkLiters: line.litersAllocated, expectedYieldKg: expected,
          status: 'w_produkcji', productionDate: reception.date, expiryDate: expiry,
          quantityRemainingKg: expected, agingDays: aging, createdAt: now,
        });
      }
      batchIds.push(batchId);

      // Utwórz kroki — z przepisu serowarni (gdy wybrano odmianę) albo generyczne
      const stepDefs = await resolveBatchSteps(line.productType, line.cheeseVariety, aging);
      await insertSteps(user, batchId, stepDefs);

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

  /**
   * Warzenie sera BEZ przyjęcia mleka (drugie wejście w produkcję).
   * Tworzy partię + kroki workflow. Mleko opcjonalne (do wyliczenia wydajności).
   */
  async createStandaloneBatch(input: {
    productType: DairyProductType;
    cheeseVariety?: string;
    cheeseName?: string;
    milkLiters?: number;
    productionDate: string;
    agingDays?: number;
  }): Promise<number> {
    const user = await getAuthUser();
    const now  = new Date().toISOString();
    const { productType, cheeseVariety, cheeseName } = input;
    const milk     = input.milkLiters ?? 0;
    const date     = input.productionDate;
    const expected = milk > 0 ? calcExpectedYield(milk, productType) : 0;
    const expiry   = calcExpiryDate(date, productType, input.agingDays);
    const aging    = input.agingDays ?? YIELD_FACTORS[productType].agingDays;
    const suffix   = await nextBatchSuffix(date);
    const batchNum = generateBatchNumber(date, suffix);

    let batchId: number;
    if (user) {
      const { data, error } = await supabase.from('production_batches').insert({
        user_id: user.id, batch_number: batchNum, product_type: productType,
        milk_liters: milk, expected_yield_kg: expected,
        status: 'w_produkcji', production_date: date, expiry_date: expiry,
        quantity_remaining_kg: expected, aging_days: aging ?? null,
        ...(cheeseVariety ? { cheese_variety: cheeseVariety } : {}),
        ...(cheeseName ? { cheese_name: cheeseName } : {}),
        created_at: now,
      }).select('id').single();
      if (error) throw error;
      batchId = data.id;
    } else {
      batchId = await db.productionBatches.add({
        batchNumber: batchNum, productType, cheeseVariety, cheeseName,
        milkLiters: milk, expectedYieldKg: expected,
        status: 'w_produkcji', productionDate: date, expiryDate: expiry,
        quantityRemainingKg: expected, agingDays: aging, createdAt: now,
      });
    }

    // Kroki — z przepisu serowarni (gdy wybrano odmianę) albo generyczne
    const stepDefs = await resolveBatchSteps(productType, cheeseVariety, aging);
    await insertSteps(user, batchId, stepDefs);

    return batchId;
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

  /** Aktualizuj nazwę sera i/lub dodatki partii (L1: dodatki + nazywanie wariantu). */
  async updateBatchMeta(id: number, patch: { cheeseName?: string; additives?: ProductionBatch['additives'] }): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (patch.cheeseName !== undefined) row.cheese_name = patch.cheeseName || null;
      if (patch.additives  !== undefined) row.additives   = patch.additives ?? null;
      await supabase.from('production_batches').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.productionBatches.update(id, patch);
  },

  /** Usuń partię (kroki + serwatkę + alokację). Blokada, gdy partia ma sprzedaż. */
  async deleteBatch(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('dairy_sales').select('id').eq('user_id', user.id).eq('batch_id', id).limit(1);
      if (data && data.length) throw new Error('Nie można usunąć — partia ma sprzedaż.');
      await supabase.from('production_steps').delete().eq('batch_id', id).eq('user_id', user.id);
      await supabase.from('whey_byproducts').delete().eq('batch_id', id).eq('user_id', user.id);
      await supabase.from('milk_allocations').delete().eq('batch_id', id).eq('user_id', user.id);
      await supabase.from('production_batches').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    if (await db.dairySales.where('batchId').equals(id).count() > 0) {
      throw new Error('Nie można usunąć — partia ma sprzedaż.');
    }
    await db.productionSteps.where('batchId').equals(id).delete();
    await db.wheyByproducts.where('batchId').equals(id).delete();
    await db.milkAllocations.where('batchId').equals(id).delete();
    await db.productionBatches.delete(id);
  },

  /** Przeważenie partii w dojrzewalni — zmierzona waga staje się nową bazą stanu szacunkowego. */
  async reweighBatch(id: number, kg: number): Promise<void> {
    const user = await getAuthUser();
    const today = new Date().toISOString().slice(0, 10);
    if (user) {
      await supabase.from('production_batches').update({
        quantity_remaining_kg: kg, last_weighed_at: today, last_weighed_kg: kg,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.productionBatches.update(id, { quantityRemainingKg: kg, lastWeighedAt: today, lastWeighedKg: kg });
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

  // ── Własne przepisy (fork z produkcji, Etap 3 L2) ────────────

  /** Zapisz partię jako własny przepis (z faktycznym timingiem + dodatkami). Status: prywatny. */
  async saveUserRecipeFromBatch(batchId: number): Promise<number> {
    const [batch, steps] = await Promise.all([this.getBatchById(batchId), this.getStepsByBatch(batchId)]);
    if (!batch) throw new Error('Partia nie istnieje');
    const recipe = buildRecipeFromBatch(batch, steps);
    const now = new Date().toISOString();
    const user = await getAuthUser();
    if (user) {
      const { data, error } = await supabase.from('user_recipes').insert({
        user_id: user.id, slug: recipe.slug, status: DEFAULT_USER_RECIPE_STATUS,
        recipe, batch_id: batchId, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.userRecipes.add({ slug: recipe.slug, status: DEFAULT_USER_RECIPE_STATUS, recipe, batchId, createdAt: now });
  },

  async getUserRecipes(): Promise<UserRecipe[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('user_recipes').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false });
      return (data ?? []).map(r => ({
        id: r.id, slug: r.slug, status: r.status as UserRecipe['status'],
        recipe: r.recipe as Recipe, batchId: r.batch_id ?? undefined, createdAt: r.created_at,
      }));
    }
    return db.userRecipes.orderBy('createdAt').reverse().toArray();
  },

  /** Zmiana statusu własnego przepisu (PUBLISH: prywatny→zgloszony→zatwierdzony/odrzucony).
   *  Przy „zatwierdzony" stempluje `recipe.dataZatwierdzenia` (serowarnia → datePublished). */
  async updateUserRecipeStatus(id: number, status: UserRecipe['status']): Promise<void> {
    const user = await getAuthUser();
    const stamp = status === 'zatwierdzony' ? new Date().toISOString() : undefined;
    if (user) {
      const row: Record<string, unknown> = { status };
      if (stamp) {
        const { data } = await supabase.from('user_recipes').select('recipe').eq('id', id).eq('user_id', user.id).single();
        if (data?.recipe) row.recipe = { ...(data.recipe as Recipe), dataZatwierdzenia: stamp };
      }
      await supabase.from('user_recipes').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    if (stamp) {
      const ur = await db.userRecipes.get(id);
      if (ur) { await db.userRecipes.update(id, { status, recipe: { ...ur.recipe, dataZatwierdzenia: stamp } }); return; }
    }
    await db.userRecipes.update(id, { status });
  },

  /**
   * Buduje feed „przepisów społeczności" (TYLKO zatwierdzone) do publikacji.
   * Marek eksportuje plik → wgrywa na fermly.pl/przepisy-spolecznosci.json → serowarnia pobiera (BRIEF #4).
   * Uwaga: pod RLS widać tylko własne przepisy — pełna moderacja wielu userów wymaga roli admina (backend).
   */
  async buildCommunityFeed(): Promise<{ wersjaSchematu: number; zrodlo: string; wygenerowano: string; przepisy: Recipe[] }> {
    const all = await this.getUserRecipes();
    return {
      wersjaSchematu: RECIPE_SCHEMA_VERSION,
      zrodlo: 'fermly-spolecznosc',
      wygenerowano: new Date().toISOString(),
      przepisy: all.filter(u => u.status === 'zatwierdzony').map(u => u.recipe),
    };
  },

  // ── Zdjęcia partii (proces + dojrzewanie) ────────────────────

  async getPhotosByBatch(batchId: number): Promise<BatchPhoto[]> {
    return db.dairyPhotos.where('batchId').equals(batchId).sortBy('photoDate');
  },

  /** Dodaj zdjęcie z pliku (kompresja + miniatura, offline w Dexie). */
  async addPhotoFromFile(batchId: number, file: File, photoDate: string, description?: string): Promise<number> {
    const [imageData, thumbData] = await Promise.all([
      compressImage(file, 1920, 0.82),
      makeThumbnail(file, 220),
    ]);
    return db.dairyPhotos.add({
      batchId, photoDate, description: description?.trim() || undefined,
      imageData, thumbData, fileName: file.name, mediaType: 'image',
      createdAt: new Date().toISOString(),
    });
  },

  async deletePhoto(id: number): Promise<void> {
    await db.dairyPhotos.delete(id);
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

  /** Runner: zapisz/uaktualnij notatkę kroku (np. po cofnięciu się), bez zmiany completedAt. */
  async updateStepNote(stepId: number, notes: string): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('production_steps').update({ notes: notes || null }).eq('id', stepId).eq('user_id', user.id);
      return;
    }
    await db.productionSteps.update(stepId, { notes });
  },

  /** Runner: oznacz początek kroku (start timera). */
  async startStep(stepId: number): Promise<void> {
    const user = await getAuthUser();
    const startedAt = new Date().toISOString();
    if (user) {
      await supabase.from('production_steps').update({ started_at: startedAt })
        .eq('id', stepId).eq('user_id', user.id);
      return;
    }
    await db.productionSteps.update(stepId, { startedAt });
  },

  /** Runner: zakończ krok. Zapisuje faktyczny czas (pod późniejszy fork do własnego przepisu). */
  async completeStep(stepId: number, opts?: { temperatureC?: number; notes?: string; actualDurationMin?: number }): Promise<void> {
    const user = await getAuthUser();
    const completedAt = new Date().toISOString();
    if (user) {
      await supabase.from('production_steps').update({
        completed_at: completedAt,
        ...(opts?.temperatureC != null ? { temperature_c: opts.temperatureC } : {}),
        ...(opts?.notes != null ? { notes: opts.notes } : {}),
        ...(opts?.actualDurationMin != null ? { actual_duration_min: opts.actualDurationMin } : {}),
      }).eq('id', stepId).eq('user_id', user.id);
      return;
    }
    await db.productionSteps.update(stepId, {
      completedAt,
      ...(opts?.temperatureC != null ? { temperatureC: opts.temperatureC } : {}),
      ...(opts?.notes != null ? { notes: opts.notes } : {}),
      ...(opts?.actualDurationMin != null ? { actualDurationMin: opts.actualDurationMin } : {}),
    });
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

  async getSalesByDocument(documentId: number): Promise<DairySale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('dairy_sales').select('*')
        .eq('user_id', user.id).eq('sale_document_id', documentId);
      return (data ?? []).map(toDairySale);
    }
    return db.dairySales.where('saleDocumentId').equals(documentId).toArray();
  },

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

  /** Statystyki RHD dla danego roku kalendarzowego.
   *  totalPln / count dotyczą sprzedaży mleczarskich; nextNumber to kolejny
   *  numer WSPÓLNEJ rocznej sekwencji RHD (dairy_sales + sales + sale_documents). */
  async getRhdStats(year: number): Promise<{ totalPln: number; nextNumber: number; count: number }> {
    const user = await getAuthUser();
    let sales: DairySale[];
    let drobMax = 0;
    let docsMax = 0;
    if (user) {
      const { data } = await supabase.from('dairy_sales').select('*')
        .eq('user_id', user.id).eq('in_rhd', true).eq('rhd_year', year);
      sales = (data ?? []).map(toDairySale);
      // sales (drób + inne) — kolumna rhd_number może jeszcze nie istnieć w bazie
      const { data: drobRows, error: drobErr } = await supabase.from('sales')
        .select('rhd_number').eq('user_id', user.id).eq('in_rhd', true).eq('rhd_year', year);
      if (!drobErr) drobMax = (drobRows ?? []).reduce((m, r) => Math.max(m, Number(r.rhd_number ?? 0)), 0);
      const { data: docRows, error: docErr } = await supabase.from('sale_documents')
        .select('rhd_number').eq('user_id', user.id).eq('in_rhd', true).eq('rhd_year', year);
      if (!docErr) docsMax = (docRows ?? []).reduce((m, r) => Math.max(m, Number(r.rhd_number ?? 0)), 0);
    } else {
      sales = await db.dairySales
        .where('rhdYear').equals(year)
        .and(s => s.inRhd === true)
        .toArray();
      const drobSales = await db.sales.filter(s =>
        s.inRhd !== false &&
        (s.rhdYear ?? new Date(s.saleDate).getFullYear()) === year
      ).toArray();
      drobMax = drobSales.reduce((m, r) => Math.max(m, r.rhdNumber ?? 0), 0);
      const docs = await db.saleDocuments.filter(d =>
        d.inRhd !== false &&
        (d.rhdYear ?? new Date(d.docDate).getFullYear()) === year
      ).toArray();
      docsMax = docs.reduce((m, r) => Math.max(m, r.rhdNumber ?? 0), 0);
    }
    const totalPln = sales.reduce((s, r) => s + r.totalValuePln, 0);
    const maxNum   = Math.max(
      sales.reduce((m, r) => Math.max(m, r.rhdNumber ?? 0), 0),
      drobMax,
      docsMax,
    );
    return { totalPln, nextNumber: maxNum + 1, count: sales.length };
  },

  async saveSale(s: Omit<DairySale, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now  = new Date().toISOString();
    const year = s.rhdYear ?? new Date(s.saleDate).getFullYear();

    let rhdNumber = s.rhdNumber;
    if (s.inRhd && !rhdNumber) {
      try {
        const stats = await this.getRhdStats(year);
        rhdNumber = stats.nextNumber;
      } catch {
        rhdNumber = 1; // fallback jeśli kolumna rhd_year jeszcze nie istnieje
      }
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
        buyer_id:      toSave.buyerId      ?? null,
        buyer_name:    toSave.buyerName,
        buyer_address: toSave.buyerAddress  ?? null,
        in_rhd:        toSave.inRhd,
        rhd_number:    toSave.rhdNumber     ?? null,
        rhd_year:      toSave.rhdYear       ?? null,
        batch_id:      toSave.batchId       ?? null,
        // cash_account_id dodawane tylko gdy istnieje — kolumna może jeszcze nie być w bazie
        ...(toSave.cashAccountId != null ? { cash_account_id: toSave.cashAccountId } : {}),
        invoice_number: toSave.invoiceNumber ?? null,
        notes:          toSave.notes         ?? null,
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

  async updateSale(id: number, patch: Partial<Pick<DairySale, 'inRhd' | 'buyerName' | 'buyerAddress' | 'notes'>>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (patch.inRhd        !== undefined) row.in_rhd        = patch.inRhd;
      if (patch.buyerName    !== undefined) row.buyer_name    = patch.buyerName ?? null;
      if (patch.buyerAddress !== undefined) row.buyer_address = patch.buyerAddress ?? null;
      if (patch.notes        !== undefined) row.notes         = patch.notes ?? null;
      await supabase.from('dairy_sales').update(row).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.dairySales.update(id, patch);
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
