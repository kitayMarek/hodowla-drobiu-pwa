import { db } from '@/db/database';
import { exportToExcel, exportToCSV } from '@/utils/export';
import { formatDate } from '@/utils/date';
import { FEED_PHASE_LABELS, HEALTH_EVENT_LABELS, SALE_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '@/constants/phases';
import { SPECIES_LABELS } from '@/constants/species';

export function useExport() {
  const exportBatchToExcel = async (batchId: number, batchName: string) => {
    const [batch, entries, weighings, health, slaughter, sales, expenses] = await Promise.all([
      db.batches.get(batchId),
      db.dailyEntries.where('batchId').equals(batchId).sortBy('date'),
      db.weighings.where('batchId').equals(batchId).sortBy('weighingDate'),
      db.healthEvents.where('batchId').equals(batchId).sortBy('eventDate'),
      db.slaughterRecords.where('batchId').equals(batchId).sortBy('slaughterDate'),
      db.sales.where('batchId').equals(batchId).sortBy('saleDate'),
      db.expenses.where('batchId').equals(batchId).sortBy('expenseDate'),
    ]);

    const sheets = [
      {
        name: 'Dziennik',
        data: entries.map(e => ({
          'Data': e.date,
          'Padnięcia': e.deadCount,
          'Wybrakowane': e.culledCount,
          'Pasza (kg)': e.feedConsumedKg,
          'Woda (l)': e.waterLiters ?? '',
          'Jaja': e.eggsCollected ?? '',
          'Jaja wadliwe': e.eggsDefective ?? '',
          'Masa próby (g)': e.sampleWeightGrams ?? '',
          'Próba (szt.)': e.sampleSize ?? '',
          'Temp (°C)': e.temperatureCelsius ?? '',
          'Uwagi': e.notes ?? '',
        })),
      },
      {
        name: 'Ważenia',
        data: weighings.map(w => ({
          'Data': w.weighingDate,
          'Wiek (dni)': w.ageAtWeighingDays,
          'Masa śr. (g)': w.averageWeightGrams,
          'Masa min (g)': w.minWeightGrams ?? '',
          'Masa max (g)': w.maxWeightGrams ?? '',
          'CV (%)': w.coefficientOfVariation ?? '',
          'Próba (szt.)': w.sampleSize ?? '',
        })),
      },
      {
        name: 'Zdrowie',
        data: health.map(h => ({
          'Data': h.eventDate,
          'Typ': HEALTH_EVENT_LABELS[h.eventType],
          'Diagnoza': h.diagnosis ?? '',
          'Lek': h.medicationName ?? '',
          'Karencja (dni)': h.withdrawalPeriodDays ?? '',
          'Koszt (PLN)': h.costPln ?? '',
          'Uwagi': h.notes ?? '',
        })),
      },
      {
        name: 'Ubój',
        data: slaughter.map(s => ({
          'Data': s.slaughterDate,
          'Liczba': s.birdsSlaughtered,
          'Masa żywa (kg)': s.liveWeightTotalKg,
          'Masa poubojowa (kg)': s.carcassWeightTotalKg,
          'Wydajność (%)': s.dressingPercent?.toFixed(1) ?? '',
          'Cena (PLN/kg)': s.pricePerKgPln ?? '',
          'Przychód (PLN)': s.totalRevenuePln ?? '',
        })),
      },
      {
        name: 'Sprzedaż',
        data: sales.map(s => ({
          'Data': s.saleDate,
          'Produkt': SALE_TYPE_LABELS[s.saleType],
          'Klient': s.buyerName ?? '',
          'Masa (kg)': s.weightKg ?? '',
          'Jaja (szt.)': s.eggsCount ?? '',
          'Cena (PLN/kg)': s.pricePerKgPln ?? '',
          'Wartość (PLN)': s.totalRevenuePln,
        })),
      },
      {
        name: 'Koszty',
        data: expenses.map(e => ({
          'Data': e.expenseDate,
          'Kategoria': EXPENSE_CATEGORY_LABELS[e.category],
          'Opis': e.description,
          'Kwota (PLN)': e.amountPln,
          'Faktura': e.invoiceNumber ?? '',
          'Dostawca': e.supplierName ?? '',
        })),
      },
    ];

    exportToExcel(sheets, batchName);
  };

  const exportDailyEggs = async () => {
    const entries = await db.dailyEntries
      .filter(e => e.eggsCollected != null && e.eggsCollected > 0)
      .sortBy('date');
    const batches = await db.batches.toArray();
    const batchMap = new Map(batches.map(b => [b.id!, b.name]));
    exportToCSV(entries.map(e => ({
      'Data': e.date,
      'Stado': batchMap.get(e.batchId) ?? e.batchId,
      'Jaja zebrane': e.eggsCollected,
      'Jaja wadliwe': e.eggsDefective ?? 0,
    })), 'dzienna_produkcja_jaj');
  };

  const exportWeeklyFeed = async () => {
    const consumptions = await db.feedConsumptions.toArray();
    const feedTypes = await db.feedTypes.toArray();
    const feedMap = new Map(feedTypes.map(ft => [ft.id!, ft.name]));
    const batches = await db.batches.toArray();
    const batchMap = new Map(batches.map(b => [b.id!, b.name]));

    // Agregacja tygodniowa
    const weekMap = new Map<string, { feedKg: number; feedName: string; batchName: string }>();
    for (const c of consumptions) {
      const d = new Date(c.date);
      const year = d.getFullYear();
      const weekNum = Math.ceil(
        (d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 3600 * 1000)
      );
      const key = `${batchMap.get(c.batchId) ?? c.batchId}|${year}-W${String(weekNum).padStart(2, '0')}|${feedMap.get(c.feedTypeId) ?? c.feedTypeId}`;
      const existing = weekMap.get(key);
      weekMap.set(key, {
        feedKg: (existing?.feedKg ?? 0) + c.consumedKg,
        feedName: feedMap.get(c.feedTypeId) ?? String(c.feedTypeId),
        batchName: batchMap.get(c.batchId) ?? String(c.batchId),
      });
    }

    exportToCSV(
      Array.from(weekMap.entries()).map(([key, val]) => {
        const [batchName, week] = key.split('|');
        return {
          'Stado': batchName,
          'Tydzień': week,
          'Pasza': val.feedName,
          'Zużycie (kg)': val.feedKg.toFixed(2),
        };
      }),
      'tygodniowe_zuzycie_paszy'
    );
  };

  return { exportBatchToExcel, exportDailyEggs, exportWeeklyFeed };
}
