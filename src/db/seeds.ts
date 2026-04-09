import { db } from './database';

export async function seedDemoData(): Promise<void> {
  const count = await db.batches.count();
  if (count > 0) return; // Już zasiany

  const now = new Date().toISOString();
  const today = new Date();

  // Batch 1: Aktywne stado brojlerów
  const startDate1 = new Date(today);
  startDate1.setDate(today.getDate() - 28);
  const batchId1 = await db.batches.add({
    name: 'Brojler Wiosna 2026 – Kurnik A',
    species: 'brojler',
    breed: 'Ross 308',
    status: 'active',
    startDate: startDate1.toISOString().slice(0, 10),
    initialCount: 2000,
    initialWeightGrams: 42,
    sourceType: 'zakupione',
    chick_cost_per_unit: 2.80,
    transport_cost: 150,
    housingId: 'Kurnik A',
    createdAt: now,
    updatedAt: now,
  });

  // Batch 2: Nioski
  const startDate2 = new Date(today);
  startDate2.setDate(today.getDate() - 60);
  const batchId2 = await db.batches.add({
    name: 'Nioski Lohmann – Sekcja B',
    species: 'nioska',
    breed: 'Lohmann Brown',
    status: 'active',
    startDate: startDate2.toISOString().slice(0, 10),
    initialCount: 500,
    initialWeightGrams: 40,
    sourceType: 'zakupione',
    chick_cost_per_unit: 5.50,
    housingId: 'Sekcja B',
    createdAt: now,
    updatedAt: now,
  });

  // Feed types
  const feedStarterId = await db.feedTypes.add({
    name: 'Starter Ross Pro',
    phase: 'starter',
    manufacturer: 'Śrutex',
    proteinPercent: 23,
    energyMjKg: 12.8,
    pricePerKg: 1.85,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const feedGrowerId = await db.feedTypes.add({
    name: 'Grower Standard',
    phase: 'grower',
    manufacturer: 'Śrutex',
    proteinPercent: 20,
    energyMjKg: 13.0,
    pricePerKg: 1.65,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const feedLayerId = await db.feedTypes.add({
    name: 'Mieszanka nioska',
    phase: 'layer',
    proteinPercent: 17,
    pricePerKg: 1.55,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Daily entries for batch 1 (last 7 days)
  for (let i = 27; i >= 0; i--) {
    const entryDate = new Date(startDate1);
    entryDate.setDate(startDate1.getDate() + (27 - i));
    const dateStr = entryDate.toISOString().slice(0, 10);
    const feedTypeId = i < 14 ? feedStarterId : feedGrowerId;
    const dead = i < 3 ? 2 : i < 7 ? 1 : 0;

    await db.dailyEntries.add({
      batchId: batchId1,
      date: dateStr,
      deadCount: dead,
      culledCount: 0,
      feedConsumedKg: 120 + Math.floor((27 - i) * 3.5),
      feedTypeId,
      waterLiters: 250 + (27 - i) * 5,
      createdAt: now,
    });
  }

  // Daily entries for batch 2 (nioski, last 7 days)
  for (let i = 6; i >= 0; i--) {
    const entryDate = new Date(today);
    entryDate.setDate(today.getDate() - i);
    const dateStr = entryDate.toISOString().slice(0, 10);

    await db.dailyEntries.add({
      batchId: batchId2,
      date: dateStr,
      deadCount: 0,
      culledCount: 0,
      feedConsumedKg: 35,
      feedTypeId: feedLayerId,
      waterLiters: 80,
      eggsCollected: 380 + Math.floor(Math.random() * 30),
      eggsDefective: Math.floor(Math.random() * 5),
      createdAt: now,
    });
  }

  // Weighings for batch 1
  const weighingDays = [7, 14, 21, 28];
  const weights = [150, 420, 900, 1650];
  for (let i = 0; i < weighingDays.length; i++) {
    const wd = new Date(startDate1);
    wd.setDate(startDate1.getDate() + weighingDays[i]);
    if (wd <= today) {
      await db.weighings.add({
        batchId: batchId1,
        weighingDate: wd.toISOString().slice(0, 10),
        ageAtWeighingDays: weighingDays[i],
        method: 'sample',
        sampleSize: 50,
        averageWeightGrams: weights[i],
        minWeightGrams: weights[i] - 80,
        maxWeightGrams: weights[i] + 80,
        createdAt: now,
      });
    }
  }

  // Feed consumptions (linked)
  for (let i = 0; i < 14; i++) {
    const d = new Date(startDate1);
    d.setDate(startDate1.getDate() + i);
    await db.feedConsumptions.add({
      batchId: batchId1,
      feedTypeId: feedStarterId,
      date: d.toISOString().slice(0, 10),
      consumedKg: 120 + i * 3,
      createdAt: now,
    });
  }
  for (let i = 14; i < 28; i++) {
    const d = new Date(startDate1);
    d.setDate(startDate1.getDate() + i);
    await db.feedConsumptions.add({
      batchId: batchId1,
      feedTypeId: feedGrowerId,
      date: d.toISOString().slice(0, 10),
      consumedKg: 160 + (i - 14) * 4,
      createdAt: now,
    });
  }

  // Expenses for batch 1
  await db.expenses.add({
    batchId: batchId1,
    expenseDate: startDate1.toISOString().slice(0, 10),
    category: 'piskleta',
    description: 'Zakup piskląt Ross 308',
    amountPln: 2000 * 2.80 + 150,
    createdAt: now,
  });

  await db.expenses.add({
    batchId: batchId1,
    expenseDate: startDate1.toISOString().slice(0, 10),
    category: 'pasza',
    description: 'Dostawa paszy Starter',
    amountPln: 3000 * 1.85,
    createdAt: now,
  });

  console.log('[Seeds] Demo data inserted successfully.');
}
