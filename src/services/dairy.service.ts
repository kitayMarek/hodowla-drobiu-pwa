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
 *   batch_id INT REFERENCES production_batches(id) NOT NULL,
 *   sale_date DATE NOT NULL, product_type TEXT NOT NULL,
 *   quantity_kg NUMERIC NOT NULL, price_per_kg_pln NUMERIC NOT NULL,
 *   total_revenue_pln NUMERIC NOT NULL, buyer_type TEXT NOT NULL,
 *   buyer_name TEXT, in_rhd BOOLEAN NOT NULL DEFAULT TRUE,
 *   invoice_number TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
 * );
 * -- RLS (włącz dla każdej tabeli)
 * ALTER TABLE milk_suppliers ENABLE ROW LEVEL SECURITY;
 * -- (powtórz dla pozostałych tabel)
 * CREATE POLICY "user_only" ON milk_suppliers USING (auth.uid() = user_id);
 * -- (powtórz dla pozostałych tabel)
 */

import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type {
  MilkSupplier, MilkReception, MilkAllocation,
  ProductionBatch, ProductionStep, WheyByproduct, DairySale,
  DairyProductType,
} from '@/models/dairy.model';
import {
  calcExpectedYield, calcExpectedWhey, calcExpiryDate,
  generateBatchNumber, WORKFLOW_STEPS, YIELD_FACTORS,
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
  return { id: r.id as number, batchId: r.batch_id as number, saleDate: r.sale_date as string,
    productType: r.product_type as DairyProductType, quantityKg: Number(r.quantity_kg),
    pricePerKgPln: Number(r.price_per_kg_pln), totalRevenuePln: Number(r.total_revenue_pln),
    buyerType: r.buyer_type as DairySale['buyerType'], buyerName: r.buyer_name as string | undefined,
    inRhd: r.in_rhd !== false, invoiceNumber: r.invoice_number as string | undefined,
    notes: r.notes as string | undefined, createdAt: r.created_at as string };
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

  // ── Sprzedaż mleczarska ──────────────────────────────────────

  async getDairySales(): Promise<DairySale[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('dairy_sales').select('*')
        .eq('user_id', user.id).order('sale_date', { ascending: false });
      return (data ?? []).map(toDairySale);
    }
    return db.dairySales.orderBy('saleDate').reverse().toArray();
  },

  async saveDairySale(s: Omit<DairySale, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('dairy_sales').insert({
        user_id: user.id, batch_id: s.batchId, sale_date: s.saleDate,
        product_type: s.productType, quantity_kg: s.quantityKg,
        price_per_kg_pln: s.pricePerKgPln, total_revenue_pln: s.totalRevenuePln,
        buyer_type: s.buyerType, buyer_name: s.buyerName ?? null,
        in_rhd: s.inRhd, invoice_number: s.invoiceNumber ?? null,
        notes: s.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      // Zmniejsz stan partii
      const batch = await this.getBatchById(s.batchId);
      if (batch) {
        const remaining = Math.max(0, batch.quantityRemainingKg - s.quantityKg);
        await supabase.from('production_batches').update({ quantity_remaining_kg: remaining })
          .eq('id', s.batchId).eq('user_id', user.id);
      }
      return data.id;
    }
    const id = await db.dairySales.add({ ...s, createdAt: now });
    const batch = await db.productionBatches.get(s.batchId);
    if (batch) {
      await db.productionBatches.update(s.batchId, {
        quantityRemainingKg: Math.max(0, batch.quantityRemainingKg - s.quantityKg),
      });
    }
    return id;
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
