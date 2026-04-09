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

  // Populacja
  const currentBirdCount = calcCurrentBirdCount(batch.initialCount, dailyEntries);
  const totalMortality = calcTotalMortality(dailyEntries);
  const mortalityPercent = calcMortalityPercent(batch.initialCount, totalMortality);

  // Pasza
  const totalFeedKg = calcTotalFeedKg(feedConsumptions);
  const feedCostPln = calcFeedCost(feedConsumptions, feedTypes);

  // Wzrost
  const sortedWeighings = [...weighings].sort((a, b) => a.ageAtWeighingDays - b.ageAtWeighingDays);
  const latestWeighing = sortedWeighings[sortedWeighings.length - 1];
  const currentAvgWeightGrams = latestWeighing?.averageWeightGrams ?? null;
  const dailyWeightGainGrams = calcDailyWeightGain(weighings);
  const projectedFinalWeightGrams = calcProjectedFinalWeight(weighings, 42);

  // FCR
  const fcr = calcFCR(
    totalFeedKg,
    batch.initialCount,
    batch.initialWeightGrams ?? 42,
    currentBirdCount,
    currentAvgWeightGrams ?? 0
  );

  // Jaja
  const totalEggsCollected = calcTotalEggs(dailyEntries);
  const henDayProductionPercent = calcHenDayProductionPercent(dailyEntries, batch.initialCount);
  const eggsPerBirdLifetime = calcEggsPerBird(totalEggsCollected, currentBirdCount);

  // Koszty
  const costBreakdown = calcCostBreakdown(batch, expenses, feedCostPln);
  const totalCostPln = costBreakdown.total;

  // Wzrost masa (dla kosztu na kg)
  const initialWeightKg = ((batch.initialWeightGrams ?? 42) * batch.initialCount) / 1000;
  const currentWeightKg = currentAvgWeightGrams != null
    ? (currentAvgWeightGrams * currentBirdCount) / 1000
    : 0;
  const totalWeightGainKg = currentWeightKg - initialWeightKg;

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
