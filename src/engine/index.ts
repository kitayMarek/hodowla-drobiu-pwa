import { differenceInDays, parseISO } from 'date-fns';
import { calcCurrentBirdCount, calcTotalMortality, calcMortalityPercent } from './mortality';
import { calcTotalFeedKg, calcFeedCost, calcFCR } from './fcr';
import { calcDailyWeightGain, calcProjectedFinalWeight } from './growth';
import { calcTotalEggs, calcEggsPerBird, calcHenDayProductionPercent } from './eggs';
import { calcCostBreakdown, calcCostPerKgWeightGain, calcCostPerEgg, calcTotalCarcassKg, calcAvgDressingPercent } from './costs';
import { calcTotalRevenue, calcGrossMargin, calcHealthCost } from './finance';
import type { BatchKPIInput, BatchKPIResult } from './types';

export function calculateAllKPIs(input: BatchKPIInput): BatchKPIResult {
  const { batch, dailyEntries, weighings, feedConsumptions, feedTypes, sales, expenses, slaughterRecords, healthEvents } = input;

  // Wiek partii
  const ageInDays = differenceInDays(new Date(), parseISO(batch.startDate));

  // Populacja – uwzględnij przesunięcia ptaków (netto: wchodzące – wychodzące)
  const { transfers = [] } = input;
  const netTransfer = transfers.reduce((acc, t) => {
    if (t.fromBatchId === batch.id) return acc - t.count;
    if (t.toBatchId   === batch.id) return acc + t.count;
    return acc;
  }, 0);
  const currentBirdCount = calcCurrentBirdCount(batch.initialCount, dailyEntries, sales, slaughterRecords, netTransfer);
  const totalMortality = calcTotalMortality(dailyEntries);
  const mortalityPercent = calcMortalityPercent(batch.initialCount, totalMortality);

  // Pasza – preferuj feedConsumptions (per-typ, dokładniejsze źródło);
  // fallback na dailyEntries.feedConsumedKg gdy brak rekordów per-typ
  const totalFeedKgFromConsumptions = feedConsumptions.reduce((s, fc) => s + fc.consumedKg, 0);
  const totalFeedKg = totalFeedKgFromConsumptions > 0
    ? totalFeedKgFromConsumptions
    : calcTotalFeedKg(dailyEntries);
  const feedCostPln = calcFeedCost(feedConsumptions, feedTypes);

  // Wzrost
  const sortedWeighings = [...weighings].sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays);
  const latestWeighing = sortedWeighings[sortedWeighings.length - 1];
  const currentAvgWeightGrams = latestWeighing?.averageWeightGrams ?? null;
  const dailyWeightGainGrams = calcDailyWeightGain(weighings);
  const projectedFinalWeightGrams = calcProjectedFinalWeight(weighings, 42);

  // Jaja
  const totalEggsCollected = calcTotalEggs(dailyEntries);
  const henDayProductionPercent = calcHenDayProductionPercent(dailyEntries, batch.initialCount);
  const eggsPerBirdLifetime = calcEggsPerBird(totalEggsCollected, currentBirdCount);

  // Koszty
  const costBreakdown = calcCostBreakdown(batch, expenses, feedCostPln);
  const totalCostPln = costBreakdown.total;

  // Przyrost masy żywca – uwzględnia ubój, sprzedaż żywych ptaków i ptaki pozostałe.
  // Nie porównujemy masy initialCount vs currentCount (inne populacje!) lecz sumujemy
  // cały żywiec wyprodukowany przez stado i odejmujemy masę startową.
  const initialWeightKg = ((batch.initialWeightGrams ?? 42) * batch.initialCount) / 1000;

  // Masa ubita (mamy dokładne dane z rekordów uboju)
  const slaughterLiveWeightKg = slaughterRecords.reduce((s, r) => s + r.liveWeightTotalKg, 0);

  // Masa sprzedanych żywych ptaków (weightKg jeśli ważone, inaczej szacunek)
  const liveSalesWeightKg = sales
    .filter(s => s.saleType === 'ptaki_zywe')
    .reduce((s, sale) => {
      if (sale.weightKg) return s + sale.weightKg;
      return s + (sale.birdCount ?? 0) * (currentAvgWeightGrams ?? (batch.initialWeightGrams ?? 42)) / 1000;
    }, 0);

  // Masa ptaków pozostałych w stadzie
  const remainingWeightKg = currentAvgWeightGrams != null
    ? (currentAvgWeightGrams * currentBirdCount) / 1000
    : 0;

  const totalWeightGainKg = slaughterLiveWeightKg + liveSalesWeightKg + remainingWeightKg - initialWeightKg;

  // FCR – używa poprawnego przyrostu obejmującego wszystkie ptaki
  const fcr = calcFCR(totalFeedKg, totalWeightGainKg);

  const costPerKgWeightGainPln = calcCostPerKgWeightGain(totalCostPln, totalWeightGainKg);
  const costPerEggPln = calcCostPerEgg(totalCostPln, totalEggsCollected);

  // Ubój
  const avgDressingPercent = calcAvgDressingPercent(slaughterRecords);
  const totalCarcassKg = calcTotalCarcassKg(slaughterRecords);

  // Przychody
  const totalRevenuePln = calcTotalRevenue(sales);
  const { margin: grossMarginPln, percent: grossMarginPercent } = calcGrossMargin(totalRevenuePln, totalCostPln);

  // Zdrowie
  const totalHealthCostPln = calcHealthCost(healthEvents);

  return {
    batchId: batch.id!,
    costBreakdown,
    batchName: batch.name,
    ageInDays,
    currentBirdCount,
    totalMortality,
    mortalityPercent,
    totalFeedKg,
    feedCostPln,
    fcr,
    currentAvgWeightGrams,
    dailyWeightGainGrams,
    projectedFinalWeightGrams,
    totalEggsCollected,
    henDayProductionPercent,
    eggsPerBirdLifetime,
    totalRevenuePln,
    totalCostPln,
    grossMarginPln,
    grossMarginPercent,
    costPerKgWeightGainPln,
    costPerEggPln,
    avgDressingPercent,
    totalCarcassKg,
    totalHealthCostPln,
  };
}

// Re-exportuj wszystkie kalkulatory dla bezpośredniego użycia
export * from './mortality';
export * from './fcr';
export * from './growth';
export * from './eggs';
export * from './costs';
export * from './finance';
export * from './types';
