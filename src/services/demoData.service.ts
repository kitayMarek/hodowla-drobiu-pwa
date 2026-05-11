/**
 * Demo data seed — wypełnia lokalną bazę Dexie przykładowymi danymi
 * aby nowy użytkownik/tester mógł zobaczyć aplikację w działaniu.
 */

import { db } from '@/db/database';

// ── Pomocnicze ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAgoTime(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Główna funkcja seedowania ─────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  // Wyczyść istniejące dane demo
  await clearDemoData();

  const now = new Date().toISOString();

  // ════════════════════════════════════════════════════════════
  // 1. RODZAJE PASZ
  // ════════════════════════════════════════════════════════════
  const starterId   = await db.feedTypes.add({ name: 'Starter Ross Pro',     phase: 'starter',  pricePerKg: 1.85, manufacturer: 'De Heus',  proteinPercent: 22, isActive: true, createdAt: now, updatedAt: now });
  const growerId    = await db.feedTypes.add({ name: 'Grower Mix Premium',    phase: 'grower',   pricePerKg: 1.65, manufacturer: 'Cargill', proteinPercent: 19, isActive: true, createdAt: now, updatedAt: now });
  const finisherId  = await db.feedTypes.add({ name: 'Finisher Standard',     phase: 'finisher', pricePerKg: 1.45, manufacturer: 'De Heus',  proteinPercent: 17, isActive: true, createdAt: now, updatedAt: now });
  const nioskiId    = await db.feedTypes.add({ name: 'Nioska Standard',       phase: 'layer',    pricePerKg: 1.40, manufacturer: 'Farmutil', proteinPercent: 16, isActive: true, createdAt: now, updatedAt: now });

  // ════════════════════════════════════════════════════════════
  // 2. STADA
  // ════════════════════════════════════════════════════════════

  // Stado A: aktywny brojler, 35 dni, 1000 szt.
  const batchAId = await db.batches.add({
    name:               'Brojler Wiosna 2026',
    species:            'brojler',
    breed:              'Ross 308',
    status:             'active',
    startDate:          daysAgo(35),
    plannedEndDate:     daysAgo(-7),   // za 7 dni
    initialCount:       1000,
    initialWeightGrams: 43,
    sourceType:         'zakupione',
    chick_cost_per_unit: 2.80,
    transport_cost:     180,
    housingId:          'Kurnik A',
    createdAt: now, updatedAt: now,
  });

  // Stado B: aktywne nioski, 110 dni, 150 szt.
  const batchBId = await db.batches.add({
    name:               'Nioski Mix',
    species:            'nioska',
    breed:              'Lohmann Brown',
    status:             'active',
    startDate:          daysAgo(110),
    initialCount:       150,
    initialWeightGrams: 45,
    sourceType:         'zakupione',
    chick_cost_per_unit: 18.00,
    transport_cost:     0,
    housingId:          'Kurnik B',
    createdAt: now, updatedAt: now,
  });

  // Stado C: zakończony/sprzedany brojler
  const batchCId = await db.batches.add({
    name:               'Brojler Zima 2025',
    species:            'brojler',
    breed:              'Ross 308',
    status:             'sold',
    startDate:          daysAgo(195),
    actualEndDate:      daysAgo(152),
    initialCount:       800,
    initialWeightGrams: 43,
    sourceType:         'zakupione',
    chick_cost_per_unit: 2.60,
    transport_cost:     140,
    createdAt: now, updatedAt: now,
  });

  // ════════════════════════════════════════════════════════════
  // 3. DOSTAWY PASZY
  // ════════════════════════════════════════════════════════════

  // Stado A
  await db.feedDeliveries.add({ feedTypeId: starterId,  deliveryDate: daysAgo(35), quantityKg: 800,  totalCostPln: 1480, supplierName: 'De Heus Sp. z o.o.', createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: growerId,   deliveryDate: daysAgo(17), quantityKg: 2000, totalCostPln: 3300, supplierName: 'De Heus Sp. z o.o.', createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: finisherId, deliveryDate: daysAgo(7),  quantityKg: 1500, totalCostPln: 2175, supplierName: 'De Heus Sp. z o.o.', createdAt: now });

  // Stado B
  await db.feedDeliveries.add({ feedTypeId: nioskiId, deliveryDate: daysAgo(110), quantityKg: 1000, totalCostPln: 1400, supplierName: 'Farmutil SA', createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: nioskiId, deliveryDate: daysAgo(60),  quantityKg: 1000, totalCostPln: 1400, supplierName: 'Farmutil SA', createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: nioskiId, deliveryDate: daysAgo(10),  quantityKg: 500,  totalCostPln: 710,  supplierName: 'Farmutil SA', createdAt: now });

  // Stado C (archiwum)
  await db.feedDeliveries.add({ feedTypeId: starterId,  deliveryDate: daysAgo(195), quantityKg: 600,  totalCostPln: 1110, createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: growerId,   deliveryDate: daysAgo(177), quantityKg: 1600, totalCostPln: 2640, createdAt: now });
  await db.feedDeliveries.add({ feedTypeId: finisherId, deliveryDate: daysAgo(160), quantityKg: 1200, totalCostPln: 1740, createdAt: now });

  // ════════════════════════════════════════════════════════════
  // 4. WPISY DZIENNE – STADO A (35 dni brojlerów)
  // ════════════════════════════════════════════════════════════

  // Wzrost zużycia paszy: dzień 1=18 kg → dzień 35=85 kg (krzywa S)
  // Upadki: pierwsze tygodnie częstsze
  const deathsA = [2,1,0,1,0,0,1, 0,0,1,0,0,0,0, 0,1,0,0,0,0,0, 0,0,0,0,0,0,0, 0,0,0,0,0,0,0];
  const feedCurve = (day: number) => {
    // Szacunkowe zużycie dla 1000 brojlerów w kg/dzień
    if (day <= 7)  return Math.round((12 + day * 1.2) * 10) / 10;
    if (day <= 14) return Math.round((20 + (day-7) * 2.8) * 10) / 10;
    if (day <= 21) return Math.round((40 + (day-14) * 4.0) * 10) / 10;
    if (day <= 28) return Math.round((68 + (day-21) * 3.0) * 10) / 10;
    return Math.round((89 + (day-28) * 2.0) * 10) / 10;
  };

  let cumulativeDeadA = 0;
  for (let day = 1; day <= 35; day++) {
    const dead = deathsA[day - 1] ?? 0;
    cumulativeDeadA += dead;
    const feedKg = feedCurve(day);
    const feedTypeForDay = day <= 14 ? starterId : day <= 28 ? growerId : finisherId;
    const entryId = await db.dailyEntries.add({
      batchId:        batchAId as number,
      date:           daysAgo(35 - day),
      deadCount:      dead,
      culledCount:    0,
      feedConsumedKg: feedKg,
      feedTypeId:     feedTypeForDay,
      waterLiters:    Math.round(feedKg * 2.2),
      createdAt:      daysAgoTime(35 - day),
    });
    // FeedConsumption per typ
    await db.feedConsumptions.add({
      batchId:    batchAId as number,
      feedTypeId: feedTypeForDay,
      date:       daysAgo(35 - day),
      consumedKg: feedKg,
      createdAt:  daysAgoTime(35 - day),
    });
  }

  // ════════════════════════════════════════════════════════════
  // 5. WPISY DZIENNE – STADO B (110 dni nioski)
  // ════════════════════════════════════════════════════════════

  const eggCurve = (day: number) => {
    // Produkcja jaj: dni 1-20 dojrzewanie (0 jaj), 21-50 wzrost, 51+ plateau
    if (day < 25) return 0;
    if (day < 45) return Math.round(((day - 25) / 20) * 130);
    return Math.round(130 + Math.sin(day * 0.3) * 8); // lekkie wahania
  };

  const deathsB: number[] = Array(110).fill(0);
  // Sporadyczne upadki
  [5, 18, 32, 55, 78, 95].forEach(d => { deathsB[d] = 1; });

  for (let day = 1; day <= 110; day++) {
    const eggs = eggCurve(day);
    const dead = deathsB[day - 1] ?? 0;
    await db.dailyEntries.add({
      batchId:        batchBId as number,
      date:           daysAgo(110 - day),
      deadCount:      dead,
      culledCount:    0,
      feedConsumedKg: 22.5,   // 150 szt. × 150 g/dzień
      feedTypeId:     nioskiId,
      eggsCollected:  eggs > 0 ? eggs : undefined,
      eggsDefective:  eggs > 0 ? Math.round(eggs * 0.02) : undefined,
      createdAt:      daysAgoTime(110 - day),
    });
    if (day > 0) {
      await db.feedConsumptions.add({
        batchId:    batchBId as number,
        feedTypeId: nioskiId,
        date:       daysAgo(110 - day),
        consumedKg: 22.5,
        createdAt:  daysAgoTime(110 - day),
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // 6. WAŻENIA – STADO A
  // ════════════════════════════════════════════════════════════

  const weighingsA = [
    { day: 7,  g: 175,  n: 30 },
    { day: 14, g: 465,  n: 30 },
    { day: 21, g: 900,  n: 30 },
    { day: 28, g: 1420, n: 30 },
    { day: 35, g: 1950, n: 30 },
  ];
  for (const w of weighingsA) {
    await db.weighings.add({
      batchId:            batchAId as number,
      weighingDate:       daysAgo(35 - w.day),
      ageAtWeighingDays:  w.day,
      method:             'sample',
      averageWeightGrams: w.g,
      sampleSize:         w.n,
      notes:              `Ważenie dnia ${w.day}`,
      createdAt:          daysAgoTime(35 - w.day),
    });
  }

  // ════════════════════════════════════════════════════════════
  // 7. WAŻENIA – STADO C (archiwum)
  // ════════════════════════════════════════════════════════════
  const weighingsC = [
    { day: 7, g: 170 }, { day: 14, g: 440 }, { day: 21, g: 880 },
    { day: 28, g: 1380 }, { day: 35, g: 1920 }, { day: 40, g: 2320 },
  ];
  for (const w of weighingsC) {
    await db.weighings.add({
      batchId:            batchCId as number,
      weighingDate:       daysAgo(195 - w.day),
      ageAtWeighingDays:  w.day,
      method:             'sample',
      averageWeightGrams: w.g,
      sampleSize:         30,
      createdAt:          daysAgoTime(195 - w.day),
    });
  }

  // ════════════════════════════════════════════════════════════
  // 8. ZDROWIE – STADO A (szczepienia)
  // ════════════════════════════════════════════════════════════

  await db.healthEvents.add({
    batchId:        batchAId as number,
    eventDate:      daysAgo(28),
    eventType:      'szczepienie',
    diagnosis:      'Szczepienie Gumboro',
    medicationName: 'CEVAC IBDL',
    notes:          '1 dawka/szt. w wodzie. Przeprowadzono zgodnie z zaleceniem lekarza.',
    createdAt:      daysAgoTime(28),
  });

  await db.healthEvents.add({
    batchId:        batchAId as number,
    eventDate:      daysAgo(14),
    eventType:      'szczepienie',
    diagnosis:      'Szczepienie Newcastle',
    medicationName: 'CEVAC BROILER ND K',
    notes:          '1 dawka/szt. w sprayu.',
    createdAt:      daysAgoTime(14),
  });

  // ════════════════════════════════════════════════════════════
  // 9. SPRZEDAŻ JАJ – STADO B
  // ════════════════════════════════════════════════════════════

  await db.sales.add({
    batchId:         batchBId as number,
    saleDate:        daysAgo(60),
    saleType:        'jaja',
    eggsCount:       2160,
    eggPricePln:     0.68,
    totalRevenuePln: 1469,
    buyerName:       'Sklep Spożywczy "Zielony Koszyk"',
    createdAt:       daysAgoTime(60),
  });

  await db.sales.add({
    batchId:         batchBId as number,
    saleDate:        daysAgo(30),
    saleType:        'jaja',
    eggsCount:       3600,
    eggPricePln:     0.70,
    totalRevenuePln: 2520,
    buyerName:       'Restauracja "U Rolnika"',
    createdAt:       daysAgoTime(30),
  });

  await db.sales.add({
    batchId:         batchBId as number,
    saleDate:        daysAgo(5),
    saleType:        'jaja',
    eggsCount:       2880,
    eggPricePln:     0.72,
    totalRevenuePln: 2074,
    buyerName:       'Sklep Spożywczy "Zielony Koszyk"',
    createdAt:       daysAgoTime(5),
  });

  // ════════════════════════════════════════════════════════════
  // 10. UBÓJ + SPRZEDAŻ – STADO C
  // ════════════════════════════════════════════════════════════

  await db.slaughterRecords.add({
    batchId:             batchCId as number,
    slaughterDate:       daysAgo(152),
    birdsSlaughtered:    780,
    liveWeightTotalKg:   1794,
    carcassWeightTotalKg: 1380,
    dressingPercent:     76.9,
    pricePerKgPln:       8.20,
    totalRevenuePln:     11316,
    notes:               'Ubój w ubojni Kowalski, transport własny',
    createdAt:           daysAgoTime(152),
  });

  // ════════════════════════════════════════════════════════════
  // 11. WYDATKI – STADO A
  // ════════════════════════════════════════════════════════════

  await db.expenses.add({
    batchId:     batchAId as number,
    expenseDate: daysAgo(35),
    category:    'piskleta',
    description: 'Zakup 1000 piskląt Ross 308',
    amountPln:   2980,
    supplierName: 'Ferma Reprodukcyjna Nowak',
    createdAt:   daysAgoTime(35),
  });

  await db.expenses.add({
    batchId:     batchAId as number,
    expenseDate: daysAgo(28),
    category:    'leki',
    description: 'Szczepionki Gumboro + Newcastle',
    amountPln:   145,
    supplierName: 'Wet-Med Sp. z o.o.',
    createdAt:   daysAgoTime(28),
  });

  await db.expenses.add({
    batchId:     batchAId as number,
    expenseDate: daysAgo(20),
    category:    'energia',
    description: 'Prąd – ogrzewanie kurnika, 3 tygodnie',
    amountPln:   380,
    createdAt:   daysAgoTime(20),
  });

  // ════════════════════════════════════════════════════════════
  // 12. KASA I BANK
  // ════════════════════════════════════════════════════════════

  const bankId = await db.cashAccounts.add({
    name:           'PKO BP – konto firmowe',
    type:           'bank',
    scope:          'drob',
    openingBalance: 8500,
    isActive:       true,
    createdAt:      now,
  });

  const cashId = await db.cashAccounts.add({
    name:           'Kasa gotówkowa',
    type:           'cash',
    scope:          'drob',
    openingBalance: 800,
    isActive:       true,
    createdAt:      now,
  });

  // Wpływy z jaj
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(60), type: 'income', scope: 'drob', category: 'Sprzedaż jaj', description: 'Sprzedaż jaj – "Zielony Koszyk"', amountPln: 1469, createdAt: daysAgoTime(60) });
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(30), type: 'income', scope: 'drob', category: 'Sprzedaż jaj', description: 'Sprzedaż jaj – Restauracja "U Rolnika"', amountPln: 2520, createdAt: daysAgoTime(30) });
  await db.cashTransactions.add({ accountId: cashId as number, date: daysAgo(5),  type: 'income', scope: 'drob', category: 'Sprzedaż jaj', description: 'Sprzedaż jaj – "Zielony Koszyk"', amountPln: 2074, createdAt: daysAgoTime(5) });

  // Zakup piskląt
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(35), type: 'expense', scope: 'drob', category: 'Zakup piskląt', description: 'Zakup 1000 piskląt Ross 308', amountPln: 2980, createdAt: daysAgoTime(35) });

  // Dostawy pasz (Stado A)
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(35), type: 'expense', scope: 'drob', category: 'Pasza', description: 'Dostawa Starter Ross Pro 800 kg – De Heus', amountPln: 1480, createdAt: daysAgoTime(35) });
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(17), type: 'expense', scope: 'drob', category: 'Pasza', description: 'Dostawa Grower Mix 2000 kg – De Heus', amountPln: 3300, createdAt: daysAgoTime(17) });

  // Dostawy pasz (Stado B)
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(10), type: 'expense', scope: 'drob', category: 'Pasza', description: 'Dostawa Nioska Standard 500 kg – Farmutil', amountPln: 710, createdAt: daysAgoTime(10) });

  // Leki
  await db.cashTransactions.add({ accountId: cashId as number, date: daysAgo(28), type: 'expense', scope: 'drob', category: 'Leki i weterynarz', description: 'Szczepionki Gumboro + Newcastle', amountPln: 145, createdAt: daysAgoTime(28) });

  // Prąd
  await db.cashTransactions.add({ accountId: bankId as number, date: daysAgo(20), type: 'expense', scope: 'drob', category: 'Energia i media', description: 'Prąd – kurnik A + B, kwiecień', amountPln: 620, createdAt: daysAgoTime(20) });

  // ════════════════════════════════════════════════════════════
  // 13. ZAMÓWIENIE KLIENTA
  // ════════════════════════════════════════════════════════════

  await db.orders.add({
    batchId:     batchAId as number,
    orderType:   'ptaki_zywe',
    plannedDate: daysAgo(-5),   // za 5 dni
    quantity:    500,
    pricePerUnit: 16.50,
    estimatedPricePln: 8250,
    status:      'oczekujace',
    buyerName:   'Piotr Malinowski',
    phone:       '601 234 567',
    notes:       'Odbiór własny, rano przed 9:00',
    createdAt:   now,
  });

  localStorage.setItem('demo_seeded', 'true');
}

// ── Czyszczenie danych demo ───────────────────────────────────────────────────

export async function clearDemoData(): Promise<void> {
  await Promise.all([
    db.batches.clear(),
    db.dailyEntries.clear(),
    db.feedTypes.clear(),
    db.feedDeliveries.clear(),
    db.feedConsumptions.clear(),
    db.healthEvents.clear(),
    db.weighings.clear(),
    db.slaughterRecords.clear(),
    db.sales.clear(),
    db.expenses.clear(),
    db.orders.clear(),
    db.cashAccounts.clear(),
    db.cashTransactions.clear(),
    db.birdTransfers.clear(),
  ]);
  localStorage.removeItem('demo_seeded');
}

export function isDemoSeeded(): boolean {
  return localStorage.getItem('demo_seeded') === 'true';
}
