/**
 * Serwis migracji i backupu danych.
 * - exportToJson()          → pobierz plik JSON ze wszystkimi danymi
 * - importFromLocalDexie()  → jednorazowa migracja Dexie (localhost) → Supabase
 * - importFromJson(file)    → wgraj backup JSON do Supabase
 */

import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';

// ── Helpers ──────────────────────────────────────────────────

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export ───────────────────────────────────────────────────

export async function exportToJson(): Promise<void> {
  const user = await getAuthUser();

  let payload: Record<string, unknown[]>;

  if (user) {
    // Pobierz ze wszystkich tabel Supabase
    const tables = [
      'batches', 'daily_entries', 'feed_types', 'feed_deliveries', 'feed_consumptions',
      'housing', 'health_events', 'weighings', 'slaughter_records', 'sales', 'expenses',
      'investments', 'orders', 'incubations', 'incubation_egg_groups', 'bird_transfers',
      'hatching_egg_lots', 'egg_purchases', 'egg_hatch_transfers',
      'cash_accounts', 'cash_transactions', 'cash_categories', 'financial_events', 'settings',
    ];
    payload = {};
    await Promise.all(tables.map(async t => {
      const { data } = await supabase.from(t).select('*').eq('user_id', user.id);
      payload[t] = (data ?? []).map(row => {
        // Usuń user_id z eksportu – jest per-konto, przy imporcie zostanie nadpisany
        const { user_id: _, ...rest } = row as Record<string, unknown>;
        return rest;
      });
    }));
  } else {
    // Pobierz z Dexie (demo)
    const [
      batches, dailyEntries, feedTypes, feedDeliveries, feedConsumptions,
      housing, healthEvents, weighings, slaughterRecords, sales, expenses,
      investments, orders, incubations, incubationEggGroups, birdTransfers,
      hatchingEggLots, eggPurchases, eggHatchTransfers,
      cashAccounts, cashTransactions, cashCategories, financialEvents, settings,
    ] = await Promise.all([
      db.batches.toArray(),
      db.dailyEntries.toArray(),
      db.feedTypes.toArray(),
      db.feedDeliveries.toArray(),
      db.feedConsumptions.toArray(),
      db.housing.toArray(),
      db.healthEvents.toArray(),
      db.weighings.toArray(),
      db.slaughterRecords.toArray(),
      db.sales.toArray(),
      db.expenses.toArray(),
      db.investments.toArray(),
      db.orders.toArray(),
      db.incubations.toArray(),
      db.incubationEggGroups.toArray(),
      db.birdTransfers.toArray(),
      db.hatchingEggLots.toArray(),
      db.eggPurchases.toArray(),
      db.eggHatchTransfers.toArray(),
      db.cashAccounts.toArray(),
      db.cashTransactions.toArray(),
      db.cashCategories.toArray(),
      db.financialEvents.toArray(),
      db.settings.toArray(),
    ]);
    payload = {
      batches, daily_entries: dailyEntries, feed_types: feedTypes,
      feed_deliveries: feedDeliveries, feed_consumptions: feedConsumptions,
      housing, health_events: healthEvents, weighings, slaughter_records: slaughterRecords,
      sales, expenses, investments, orders, incubations,
      incubation_egg_groups: incubationEggGroups, bird_transfers: birdTransfers,
      hatching_egg_lots: hatchingEggLots, egg_purchases: eggPurchases,
      egg_hatch_transfers: eggHatchTransfers, cash_accounts: cashAccounts,
      cash_transactions: cashTransactions, cash_categories: cashCategories,
      financial_events: financialEvents, settings,
    };
  }

  const json = JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    source: user ? 'supabase' : 'dexie',
    data: payload,
  }, null, 2);

  download(json, `fermly-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

// ── Migrate Dexie → Supabase ─────────────────────────────────

export async function importFromLocalDexie(): Promise<{ imported: number; errors: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('Musisz być zalogowany żeby migrować dane.');

  // Sprawdź czy Supabase jest pusty
  const { count } = await supabase
    .from('batches').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) > 0) {
    throw new Error('Twoje konto zawiera już dane w chmurze. Wyczyść je najpierw lub użyj importu JSON.');
  }

  let imported = 0;
  let errors   = 0;
  const now    = new Date().toISOString();

  const ins = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await supabase.from(table)
      .insert({ user_id: user.id, ...row })
      .select('id').single();
    if (error) { console.error(table, error); errors++; return null as unknown as number; }
    imported++;
    return data.id as number;
  };

  // 1. Stada
  const batches = await db.batches.toArray();
  const batchMap = new Map<number, number>();
  for (const b of batches) {
    const newId = await ins('batches', {
      name: b.name, species: b.species, breed: b.breed ?? null, status: b.status,
      start_date: b.startDate, planned_end_date: b.plannedEndDate ?? null,
      actual_end_date: b.actualEndDate ?? null, initial_count: b.initialCount,
      initial_weight_grams: b.initialWeightGrams ?? null, source_type: b.sourceType,
      chick_cost_per_unit: b.chick_cost_per_unit ?? null, transport_cost: b.transport_cost ?? null,
      housing_id: b.housingId ?? null, notes: b.notes ?? null,
      created_at: b.createdAt, updated_at: b.updatedAt,
    });
    if (newId && b.id) batchMap.set(b.id, newId);
  }

  // 2. Typy pasz
  const feedTypes = await db.feedTypes.toArray();
  const feedTypeMap = new Map<number, number>();
  for (const ft of feedTypes) {
    const newId = await ins('feed_types', {
      name: ft.name, phase: ft.phase, manufacturer: ft.manufacturer ?? null,
      protein_percent: ft.proteinPercent ?? null, energy_mj_kg: ft.energyMjKg ?? null,
      price_per_kg: ft.pricePerKg, is_active: ft.isActive,
      recipe_notes: ft.recipeNotes ?? null, notes: ft.notes ?? null,
      created_at: ft.createdAt, updated_at: ft.updatedAt,
    });
    if (newId && ft.id) feedTypeMap.set(ft.id, newId);
  }

  // 3. Dostawy paszy
  const deliveries = await db.feedDeliveries.toArray();
  for (const d of deliveries) {
    const ftId = d.feedTypeId ? feedTypeMap.get(d.feedTypeId) : null;
    if (!ftId) { errors++; continue; }
    await ins('feed_deliveries', {
      feed_type_id: ftId, delivery_date: d.deliveryDate, quantity_kg: d.quantityKg,
      invoice_number: d.invoiceNumber ?? null, supplier_name: d.supplierName ?? null,
      total_cost_pln: d.totalCostPln, notes: d.notes ?? null, created_at: d.createdAt,
    });
  }

  // 4. Zużycie paszy
  const consumptions = await db.feedConsumptions.toArray();
  for (const c of consumptions) {
    const bId = batchMap.get(c.batchId);
    const ftId = feedTypeMap.get(c.feedTypeId);
    if (!bId || !ftId) { errors++; continue; }
    await ins('feed_consumptions', {
      batch_id: bId, feed_type_id: ftId, date: c.date,
      consumed_kg: c.consumedKg, created_at: c.createdAt,
    });
  }

  // 5. Wpisy dzienne
  const entries = await db.dailyEntries.toArray();
  for (const e of entries) {
    const bId = batchMap.get(e.batchId);
    if (!bId) { errors++; continue; }
    await ins('daily_entries', {
      batch_id: bId, date: e.date, dead_count: e.deadCount, culled_count: e.culledCount,
      feed_consumed_kg: e.feedConsumedKg,
      feed_type_id: e.feedTypeId ? feedTypeMap.get(e.feedTypeId) ?? null : null,
      water_liters: e.waterLiters ?? null, eggs_collected: e.eggsCollected ?? null,
      eggs_defective: e.eggsDefective ?? null, sample_weight_grams: e.sampleWeightGrams ?? null,
      sample_size: e.sampleSize ?? null, temperature_celsius: e.temperatureCelsius ?? null,
      humidity: e.humidity ?? null, notes: e.notes ?? null, created_at: e.createdAt,
    });
  }

  // 6. Ważenia
  const weighings = await db.weighings.toArray();
  for (const w of weighings) {
    const bId = batchMap.get(w.batchId);
    if (!bId) { errors++; continue; }
    await ins('weighings', {
      batch_id: bId, weighing_date: w.weighingDate, age_at_weighing_days: w.ageAtWeighingDays,
      method: w.method, sample_size: w.sampleSize ?? null,
      average_weight_grams: w.averageWeightGrams,
      min_weight_grams: w.minWeightGrams ?? null, max_weight_grams: w.maxWeightGrams ?? null,
      notes: w.notes ?? null, created_at: w.createdAt,
    });
  }

  // 7. Sprzedaż
  const sales = await db.sales.toArray();
  for (const s of sales) {
    const bId = batchMap.get(s.batchId);
    if (!bId) { errors++; continue; }
    await ins('sales', {
      batch_id: bId, sale_date: s.saleDate, sale_type: s.saleType,
      eggs_count: s.eggsCount ?? null, egg_price_pln: s.eggPricePln ?? null,
      bird_count: s.birdCount ?? null, weight_kg: s.weightKg ?? null,
      price_per_kg_pln: s.pricePerKgPln ?? null, total_revenue_pln: s.totalRevenuePln,
      buyer_name: s.buyerName ?? null, invoice_number: s.invoiceNumber ?? null,
      notes: s.notes ?? null, created_at: s.createdAt,
    });
  }

  // 8. Wydatki
  const expenses = await db.expenses.toArray();
  for (const e of expenses) {
    await ins('expenses', {
      batch_id: e.batchId ? batchMap.get(e.batchId) ?? null : null,
      expense_date: e.expenseDate, category: e.category,
      description: e.description, amount_pln: e.amountPln, created_at: e.createdAt,
    });
  }

  // 9. Zdarzenia zdrowotne
  const healthEvents = await db.healthEvents.toArray();
  for (const e of healthEvents) {
    const bId = batchMap.get(e.batchId);
    if (!bId) { errors++; continue; }
    await ins('health_events', {
      batch_id: bId, event_date: e.eventDate, event_type: e.eventType,
      diagnosis: e.diagnosis ?? null, treatment: e.treatment ?? null,
      medication_name: e.medicationName ?? null, dosage_mg_per_kg: e.dosageMgPerKg ?? null,
      duration_days: e.durationDays ?? null, withdrawal_period_days: e.withdrawalPeriodDays ?? null,
      affected_count: e.affectedCount ?? null, cost_pln: e.costPln ?? null,
      veterinarian_name: e.veterinarianName ?? null, notes: e.notes ?? null,
      created_at: e.createdAt,
    });
  }

  // 10. Ubój
  const slaughterRecords = await db.slaughterRecords.toArray();
  for (const s of slaughterRecords) {
    const bId = batchMap.get(s.batchId);
    if (!bId) { errors++; continue; }
    await ins('slaughter_records', {
      batch_id: bId, slaughter_date: s.slaughterDate,
      age_at_slaughter_days: s.ageAtSlaughterDays ?? null,
      birds_slaughtered: s.birdsSlaughtered,
      live_weight_total_kg: s.liveWeightTotalKg ?? null,
      carcass_weight_total_kg: s.carcassWeightTotalKg ?? null,
      dressing_percent: s.dressingPercent ?? null,
      condemned_count: s.condemnedCount ?? null,
      condemned_weight_kg: s.condemnedWeightKg ?? null,
      slaughter_house_id: s.slaughterHouseId ?? null,
      price_per_kg_pln: s.pricePerKgPln ?? null,
      total_revenue_pln: s.totalRevenuePln ?? null,
      notes: s.notes ?? null, created_at: s.createdAt,
    });
  }

  // 11. Przesunięcia ptaków
  const birdTransfers = await db.birdTransfers.toArray();
  for (const t of birdTransfers) {
    await ins('bird_transfers', {
      transfer_date: t.transferDate,
      from_batch_id: t.fromBatchId ? batchMap.get(t.fromBatchId) ?? null : null,
      to_batch_id:   t.toBatchId   ? batchMap.get(t.toBatchId)   ?? null : null,
      count: t.count, reason: t.reason ?? null, notes: t.notes ?? null,
      created_at: t.createdAt,
    });
  }

  // 12a. Konta kasowe
  const accounts = await db.cashAccounts.toArray();
  const accountMap = new Map<number, number>();
  for (const a of accounts) {
    const newId = await ins('cash_accounts', {
      name: a.name, type: a.type, scope: a.scope,
      opening_balance: a.openingBalance, is_active: a.isActive,
      currency: 'PLN', created_at: a.createdAt,
    });
    if (newId && a.id) accountMap.set(a.id, newId);
  }

  // 10. Transakcje kasowe
  const transactions = await db.cashTransactions.toArray();
  const txMap = new Map<number, number>();
  for (const t of transactions) {
    const aId = accountMap.get(t.accountId);
    if (!aId) { errors++; continue; }
    const newId = await ins('cash_transactions', {
      account_id: aId, date: t.date, type: t.type, scope: t.scope,
      category: t.category, description: t.description, amount_pln: t.amountPln,
      to_account_id: t.toAccountId ? accountMap.get(t.toAccountId) ?? null : null,
      created_at: t.createdAt,
    });
    if (newId && t.id) txMap.set(t.id, newId);
  }

  // 11. Kategorie kasowe (pomiń systemowe – będą zaseedowane automatycznie)
  const categories = await db.cashCategories.filter(c => !c.isSystem).toArray();
  for (const c of categories) {
    await ins('cash_categories', {
      name: c.name, scope: c.scope ?? null, type: c.type ?? null,
      is_system: false, created_at: c.createdAt,
    });
  }

  // 12. Zdarzenia finansowe
  const events = await db.financialEvents.toArray();
  for (const e of events) {
    await ins('financial_events', {
      date: e.date, type: e.type, amount_pln: e.amountPln, description: e.description,
      source_type: e.sourceType, source_id: e.sourceId, status: e.status,
      cash_account_id:     e.cashAccountId     ? accountMap.get(e.cashAccountId)     ?? null : null,
      cash_transaction_id: e.cashTransactionId ? txMap.get(e.cashTransactionId)      ?? null : null,
      settled_at: e.settledAt ?? null, notes: e.notes ?? null, created_at: e.createdAt,
    });
  }

  // 13. Inwestycje
  const investments = await db.investments.toArray();
  for (const inv of investments) {
    await ins('investments', {
      name: inv.name, category: inv.category, purchase_date: inv.purchaseDate,
      amount_pln: inv.amountPln, useful_life_years: inv.usefulLifeYears ?? null,
      supplier: inv.supplier ?? null, invoice_number: inv.invoiceNumber ?? null,
      notes: inv.notes ?? null, created_at: inv.createdAt,
    });
  }

  // 14. Zamówienia
  const orders = await db.orders.toArray();
  for (const o of orders) {
    const bId = o.batchId ? batchMap.get(o.batchId) ?? null : null;
    await ins('orders', {
      batch_id:       bId,
      customer_name:  o.buyerName ?? '-',
      customer_phone: o.phone ?? null,
      planned_date:   o.plannedDate,
      sale_type:      o.orderType,
      quantity:       o.quantity ?? 0,
      price_per_unit: o.pricePerUnit ?? null,
      status:         o.status,
      notes:          o.notes ?? null,
      created_at:     o.createdAt,
      updated_at:     o.createdAt,
    });
  }

  // 15. Ustawienia
  const settings = await db.settings.toArray();
  for (const s of settings) {
    const { error } = await supabase.from('settings')
      .upsert({ user_id: user.id, key: s.key, value: String(s.value) },
               { onConflict: 'user_id,key' });
    if (error) errors++;
    else imported++;
  }

  return { imported, errors };
}

// ── Import from JSON ─────────────────────────────────────────

export async function importFromJson(file: File): Promise<{ imported: number; errors: number }> {
  const user = await getAuthUser();
  if (!user) throw new Error('Musisz być zalogowany żeby importować dane.');

  const text = await file.text();
  const backup = JSON.parse(text) as {
    version: number;
    source: string;
    data: Record<string, Record<string, unknown>[]>;
  };

  if (!backup.data) throw new Error('Nieprawidłowy format pliku backup.');

  const { count } = await supabase
    .from('batches').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) > 0) {
    throw new Error('Twoje konto zawiera już dane. Wyczyść je najpierw.');
  }

  let imported = 0;
  let errors   = 0;
  const d      = backup.data;

  const ins = async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await supabase.from(table)
      .insert({ user_id: user.id, ...row })
      .select('id').single();
    if (error) { console.error(table, error.message); errors++; return null; }
    imported++;
    return data.id as number;
  };

  // Helper: pobierz pole zarówno z formatu snake_case jak i camelCase
  const f = (row: Record<string, unknown>, snake: string, camel: string) =>
    row[snake] !== undefined ? row[snake] : row[camel];

  // Wstaw w tej samej kolejności co migracja Dexie
  const batchMap   = new Map<number | string, number>();
  const feedTypeMap = new Map<number | string, number>();
  const accountMap = new Map<number | string, number>();
  const txMap      = new Map<number | string, number>();

  for (const b of d['batches'] ?? []) {
    const oldId = b['id'];
    const newId = await ins('batches', {
      name:                f(b, 'name', 'name'),
      species:             f(b, 'species', 'species'),
      breed:               f(b, 'breed', 'breed') ?? null,
      status:              f(b, 'status', 'status'),
      start_date:          f(b, 'start_date', 'startDate'),
      planned_end_date:    f(b, 'planned_end_date', 'plannedEndDate') ?? null,
      actual_end_date:     f(b, 'actual_end_date', 'actualEndDate') ?? null,
      initial_count:       f(b, 'initial_count', 'initialCount'),
      initial_weight_grams:f(b, 'initial_weight_grams', 'initialWeightGrams') ?? null,
      source_type:         f(b, 'source_type', 'sourceType'),
      chick_cost_per_unit: f(b, 'chick_cost_per_unit', 'chick_cost_per_unit') ?? null,
      transport_cost:      f(b, 'transport_cost', 'transport_cost') ?? null,
      housing_id:          f(b, 'housing_id', 'housingId') ?? null,
      notes:               f(b, 'notes', 'notes') ?? null,
      created_at:          f(b, 'created_at', 'createdAt'),
      updated_at:          f(b, 'updated_at', 'updatedAt'),
    });
    if (newId && oldId != null) batchMap.set(oldId as number, newId);
  }

  for (const ft of d['feed_types'] ?? []) {
    const oldId = ft['id'];
    const newId = await ins('feed_types', {
      name:           f(ft, 'name', 'name'),
      phase:          f(ft, 'phase', 'phase'),
      manufacturer:   f(ft, 'manufacturer', 'manufacturer') ?? null,
      protein_percent:f(ft, 'protein_percent', 'proteinPercent') ?? null,
      energy_mj_kg:   f(ft, 'energy_mj_kg', 'energyMjKg') ?? null,
      price_per_kg:   f(ft, 'price_per_kg', 'pricePerKg'),
      is_active:      f(ft, 'is_active', 'isActive'),
      recipe_notes:   f(ft, 'recipe_notes', 'recipeNotes') ?? null,
      notes:          f(ft, 'notes', 'notes') ?? null,
      created_at:     f(ft, 'created_at', 'createdAt'),
      updated_at:     f(ft, 'updated_at', 'updatedAt'),
    });
    if (newId && oldId != null) feedTypeMap.set(oldId as number, newId);
  }

  // Pozostałe tabele wg tej samej logiki...
  const simpleInsert = async (
    table: string,
    rows: Record<string, unknown>[],
    transform: (r: Record<string, unknown>) => Record<string, unknown>
  ) => {
    const before = { imported, errors };
    for (const r of rows) {
      await ins(table, transform(r));
    }
    const ok  = imported - before.imported;
    const err = errors   - before.errors;
    if (rows.length > 0) console.log(`[import] ${table}: ${ok} ok, ${err} err / ${rows.length} rows`);
  };

  await simpleInsert('feed_deliveries', d['feed_deliveries'] ?? [], r => ({
    feed_type_id:  feedTypeMap.get(f(r, 'feed_type_id', 'feedTypeId') as number) ?? null,
    delivery_date: f(r, 'delivery_date', 'deliveryDate'),
    quantity_kg:   f(r, 'quantity_kg', 'quantityKg'),
    invoice_number:f(r, 'invoice_number', 'invoiceNumber') ?? null,
    supplier_name: f(r, 'supplier_name', 'supplierName') ?? null,
    total_cost_pln:f(r, 'total_cost_pln', 'totalCostPln'),
    notes:         f(r, 'notes', 'notes') ?? null,
    created_at:    f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('feed_consumptions', d['feed_consumptions'] ?? [], r => ({
    batch_id:    batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    feed_type_id:feedTypeMap.get(f(r, 'feed_type_id', 'feedTypeId') as number) ?? null,
    date:        f(r, 'date', 'date'),
    consumed_kg: f(r, 'consumed_kg', 'consumedKg'),
    created_at:  f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('daily_entries', d['daily_entries'] ?? [], r => ({
    batch_id:            batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    date:                f(r, 'date', 'date'),
    dead_count:          f(r, 'dead_count', 'deadCount'),
    culled_count:        f(r, 'culled_count', 'culledCount'),
    feed_consumed_kg:    f(r, 'feed_consumed_kg', 'feedConsumedKg'),
    feed_type_id:        feedTypeMap.get(f(r, 'feed_type_id', 'feedTypeId') as number) ?? null,
    water_liters:        f(r, 'water_liters', 'waterLiters') ?? null,
    eggs_collected:      f(r, 'eggs_collected', 'eggsCollected') ?? null,
    eggs_defective:      f(r, 'eggs_defective', 'eggsDefective') ?? null,
    sample_weight_grams: f(r, 'sample_weight_grams', 'sampleWeightGrams') ?? null,
    sample_size:         f(r, 'sample_size', 'sampleSize') ?? null,
    temperature_celsius: f(r, 'temperature_celsius', 'temperatureCelsius') ?? null,
    humidity:            f(r, 'humidity', 'humidity') ?? null,
    notes:               f(r, 'notes', 'notes') ?? null,
    created_at:          f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('weighings', d['weighings'] ?? [], r => ({
    batch_id:             batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    weighing_date:        f(r, 'weighing_date', 'weighingDate'),
    age_at_weighing_days: f(r, 'age_at_weighing_days', 'ageAtWeighingDays'),
    method:               f(r, 'method', 'method'),
    sample_size:          f(r, 'sample_size', 'sampleSize') ?? null,
    average_weight_grams: f(r, 'average_weight_grams', 'averageWeightGrams'),
    min_weight_grams:     f(r, 'min_weight_grams', 'minWeightGrams') ?? null,
    max_weight_grams:     f(r, 'max_weight_grams', 'maxWeightGrams') ?? null,
    notes:                f(r, 'notes', 'notes') ?? null,
    created_at:           f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('sales', d['sales'] ?? [], r => ({
    batch_id:         batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    sale_date:        f(r, 'sale_date', 'saleDate'),
    sale_type:        f(r, 'sale_type', 'saleType'),
    eggs_count:       f(r, 'eggs_count', 'eggsCount') ?? null,
    egg_price_pln:    f(r, 'egg_price_pln', 'eggPricePln') ?? null,
    bird_count:       f(r, 'bird_count', 'birdCount') ?? null,
    weight_kg:        f(r, 'weight_kg', 'weightKg') ?? null,
    price_per_kg_pln: f(r, 'price_per_kg_pln', 'pricePerKgPln') ?? null,
    total_revenue_pln:f(r, 'total_revenue_pln', 'totalRevenuePln'),
    buyer_name:       f(r, 'buyer_name', 'buyerName') ?? null,
    invoice_number:   f(r, 'invoice_number', 'invoiceNumber') ?? null,
    notes:            f(r, 'notes', 'notes') ?? null,
    created_at:       f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('expenses', d['expenses'] ?? [], r => ({
    batch_id:    batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    expense_date:f(r, 'expense_date', 'expenseDate'),
    category:    f(r, 'category', 'category'),
    description: f(r, 'description', 'description'),
    amount_pln:  f(r, 'amount_pln', 'amountPln'),
    created_at:  f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('health_events', d['health_events'] ?? [], r => ({
    batch_id:               batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    event_date:             f(r, 'event_date', 'eventDate'),
    event_type:             f(r, 'event_type', 'eventType'),
    diagnosis:              f(r, 'diagnosis', 'diagnosis') ?? null,
    treatment:              f(r, 'treatment', 'treatment') ?? null,
    medication_name:        f(r, 'medication_name', 'medicationName') ?? null,
    dosage_mg_per_kg:       f(r, 'dosage_mg_per_kg', 'dosageMgPerKg') ?? null,
    duration_days:          f(r, 'duration_days', 'durationDays') ?? null,
    withdrawal_period_days: f(r, 'withdrawal_period_days', 'withdrawalPeriodDays') ?? null,
    affected_count:         f(r, 'affected_count', 'affectedCount') ?? null,
    cost_pln:               f(r, 'cost_pln', 'costPln') ?? null,
    veterinarian_name:      f(r, 'veterinarian_name', 'veterinarianName') ?? null,
    notes:                  f(r, 'notes', 'notes') ?? null,
    created_at:             f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('slaughter_records', d['slaughter_records'] ?? [], r => ({
    batch_id:                    batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
    slaughter_date:              f(r, 'slaughter_date', 'slaughterDate'),
    age_at_slaughter_days:       f(r, 'age_at_slaughter_days', 'ageAtSlaughterDays') ?? null,
    birds_slaughtered:           f(r, 'birds_slaughtered', 'birdsSlaughtered'),
    live_weight_total_kg:        f(r, 'live_weight_total_kg', 'liveWeightTotalKg') ?? null,
    carcass_weight_total_kg:     f(r, 'carcass_weight_total_kg', 'carcassWeightTotalKg') ?? null,
    dressing_percent:            f(r, 'dressing_percent', 'dressingPercent') ?? null,
    condemned_count:             f(r, 'condemned_count', 'condemnedCount') ?? null,
    condemned_weight_kg:         f(r, 'condemned_weight_kg', 'condemnedWeightKg') ?? null,
    slaughter_house_id:          f(r, 'slaughter_house_id', 'slaughterHouseId') ?? null,
    price_per_kg_pln:            f(r, 'price_per_kg_pln', 'pricePerKgPln') ?? null,
    total_revenue_pln:           f(r, 'total_revenue_pln', 'totalRevenuePln') ?? null,
    notes:                       f(r, 'notes', 'notes') ?? null,
    created_at:                  f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('bird_transfers', d['bird_transfers'] ?? [], r => ({
    transfer_date:  f(r, 'transfer_date', 'transferDate'),
    from_batch_id:  batchMap.get(f(r, 'from_batch_id', 'fromBatchId') as number) ?? null,
    to_batch_id:    batchMap.get(f(r, 'to_batch_id', 'toBatchId') as number) ?? null,
    count:          f(r, 'count', 'count'),
    reason:         f(r, 'reason', 'reason') ?? null,
    notes:          f(r, 'notes', 'notes') ?? null,
    created_at:     f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('investments', d['investments'] ?? [], r => ({
    name:             f(r, 'name', 'name'),
    category:         f(r, 'category', 'category'),
    purchase_date:    f(r, 'purchase_date', 'purchaseDate'),
    amount_pln:       f(r, 'amount_pln', 'amountPln') ?? f(r, 'purchase_price_pln', 'purchasePricePln') ?? 0,
    useful_life_years:f(r, 'useful_life_years', 'usefulLifeYears') ?? null,
    supplier:         f(r, 'supplier', 'supplier') ?? null,
    invoice_number:   f(r, 'invoice_number', 'invoiceNumber') ?? null,
    notes:            f(r, 'notes', 'notes') ?? f(r, 'description', 'description') ?? null,
    created_at:       f(r, 'created_at', 'createdAt'),
  }));

  await simpleInsert('orders', d['orders'] ?? [], r => {
    const createdAt = f(r, 'created_at', 'createdAt') as string;
    return {
      batch_id:       batchMap.get(f(r, 'batch_id', 'batchId') as number) ?? null,
      customer_name:  (f(r, 'customer_name', 'buyerName') as string | undefined) ?? '-',
      customer_phone: f(r, 'customer_phone', 'phone') ?? null,
      planned_date:   f(r, 'planned_date', 'plannedDate'),
      sale_type:      f(r, 'sale_type', 'orderType'),
      quantity:       (f(r, 'quantity', 'quantity') as number | undefined) ?? 0,
      price_per_unit: f(r, 'price_per_unit', 'pricePerUnit') ?? null,
      status:         f(r, 'status', 'status') ?? 'oczekujace',
      notes:          f(r, 'notes', 'notes') ?? null,
      created_at:     createdAt,
      updated_at:     (f(r, 'updated_at', 'updatedAt') as string | undefined) ?? createdAt,
    };
  });

  // Konta kasowe
  for (const a of d['cash_accounts'] ?? []) {
    const oldId = a['id'];
    const newId = await ins('cash_accounts', {
      name:            f(a, 'name', 'name'),
      type:            f(a, 'type', 'type'),
      scope:           f(a, 'scope', 'scope'),
      opening_balance: f(a, 'opening_balance', 'openingBalance'),
      is_active:       f(a, 'is_active', 'isActive') ?? true,
      currency:        'PLN',
      created_at:      f(a, 'created_at', 'createdAt'),
    });
    if (newId && oldId != null) accountMap.set(oldId as number, newId);
  }

  // Transakcje kasowe
  for (const t of d['cash_transactions'] ?? []) {
    const oldId = t['id'];
    const aId = accountMap.get(f(t, 'account_id', 'accountId') as number);
    if (!aId) { errors++; continue; }
    const newId = await ins('cash_transactions', {
      account_id:   aId,
      date:         f(t, 'date', 'date'),
      type:         f(t, 'type', 'type'),
      scope:        f(t, 'scope', 'scope'),
      category:     f(t, 'category', 'category'),
      description:  f(t, 'description', 'description'),
      amount_pln:   f(t, 'amount_pln', 'amountPln'),
      to_account_id:accountMap.get(f(t, 'to_account_id', 'toAccountId') as number) ?? null,
      created_at:   f(t, 'created_at', 'createdAt'),
    });
    if (newId && oldId != null) txMap.set(oldId as number, newId);
  }

  // Kategorie kasowe (tylko niestandardowe)
  await simpleInsert('cash_categories',
    (d['cash_categories'] ?? []).filter(c => !c['is_system'] && !c['isSystem']),
    r => ({
      name:      f(r, 'name', 'name'),
      scope:     f(r, 'scope', 'scope') ?? null,
      type:      f(r, 'type', 'type') ?? null,
      is_system: false,
      created_at:f(r, 'created_at', 'createdAt'),
    })
  );

  // Zdarzenia finansowe
  await simpleInsert('financial_events', d['financial_events'] ?? [], r => ({
    date:               f(r, 'date', 'date'),
    type:               f(r, 'type', 'type'),
    amount_pln:         f(r, 'amount_pln', 'amountPln'),
    description:        f(r, 'description', 'description'),
    source_type:        f(r, 'source_type', 'sourceType'),
    source_id:          f(r, 'source_id', 'sourceId'),
    status:             f(r, 'status', 'status'),
    cash_account_id:    accountMap.get(f(r, 'cash_account_id', 'cashAccountId') as number) ?? null,
    cash_transaction_id:txMap.get(f(r, 'cash_transaction_id', 'cashTransactionId') as number) ?? null,
    settled_at:         f(r, 'settled_at', 'settledAt') ?? null,
    notes:              f(r, 'notes', 'notes') ?? null,
    created_at:         f(r, 'created_at', 'createdAt'),
  }));

  // Ustawienia
  for (const s of d['settings'] ?? []) {
    const { error } = await supabase.from('settings')
      .upsert({ user_id: user.id, key: s['key'], value: String(s['value']) },
               { onConflict: 'user_id,key' });
    if (error) errors++; else imported++;
  }

  return { imported, errors };
}

// ── Clear all Supabase data ───────────────────────────────────

/**
 * Usuwa WSZYSTKIE dane zalogowanego użytkownika z Supabase.
 * Kolejność usuwania jest odwrotnością zależności FK.
 */
export async function clearAllSupabaseData(): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error('Musisz być zalogowany.');

  // Usuwaj w kolejności odwrotnej do zależności (dzieci przed rodzicami)
  const tables = [
    'financial_events', 'cash_transactions', 'cash_categories', 'cash_accounts',
    'egg_hatch_transfers', 'egg_purchases', 'hatching_egg_lots',
    'incubation_egg_groups', 'incubations', 'orders',
    'bird_transfers', 'slaughter_records', 'health_events', 'weighings',
    'feed_consumptions', 'feed_deliveries', 'daily_entries',
    'investments', 'expenses', 'sales',
    'feed_types', 'housing', 'batches',
    'settings',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', user.id);
    if (error) console.warn(`clearAll: ${table}`, error.message);
  }
}
