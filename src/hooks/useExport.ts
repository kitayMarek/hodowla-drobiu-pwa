import { db } from '@/db/database';
import { getAuthUser, supabase } from '@/lib/supabase';
import { exportToExcel, exportToCSV } from '@/utils/export';
import { HEALTH_EVENT_LABELS, SALE_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '@/constants/phases';
import { dailyEntryService } from '@/services/dailyEntry.service';
import { weighingService } from '@/services/weighing.service';
import { healthService } from '@/services/health.service';
import { slaughterService } from '@/services/slaughter.service';
import { saleService } from '@/services/sale.service';
import { financeService } from '@/services/finance.service';
import { batchService } from '@/services/batch.service';

export function useExport() {
  const exportBatchToExcel = async (batchId: number, batchName: string) => {
    const [entries, weighings, health, slaughter, sales, expenses] = await Promise.all([
      dailyEntryService.getByBatch(batchId),
      weighingService.getByBatch(batchId),
      healthService.getByBatch(batchId),
      slaughterService.getByBatch(batchId),
      saleService.getByBatch(batchId),
      financeService.getExpensesByBatch(batchId),
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
    const user = await getAuthUser();
    let entries: Awaited<ReturnType<typeof dailyEntryService.getByBatch>>;
    let batchMap: Map<number, string>;

    if (user) {
      const { data: rows } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .not('eggs_collected', 'is', null)
        .gt('eggs_collected', 0)
        .order('date', { ascending: true });
      const { data: batchRows } = await supabase
        .from('batches').select('id, name').eq('user_id', user.id);
      entries = (rows ?? []).map(r => ({
        id: r.id,
        batchId: r.batch_id,
        date: r.date,
        deadCount: r.dead_count,
        culledCount: r.culled_count,
        feedConsumedKg: r.feed_consumed_kg,
        eggsCollected: r.eggs_collected,
        eggsDefective: r.eggs_defective,
        createdAt: r.created_at,
      })) as typeof entries;
      batchMap = new Map((batchRows ?? []).map((b: { id: number; name: string }) => [b.id, b.name]));
    } else {
      entries = await db.dailyEntries
        .filter(e => e.eggsCollected != null && e.eggsCollected > 0)
        .sortBy('date');
      const batches = await db.batches.toArray();
      batchMap = new Map(batches.map(b => [b.id!, b.name]));
    }

    exportToCSV(entries.map(e => ({
      'Data': e.date,
      'Stado': batchMap.get(e.batchId) ?? String(e.batchId),
      'Jaja zebrane': e.eggsCollected,
      'Jaja wadliwe': e.eggsDefective ?? 0,
    })), 'dzienna_produkcja_jaj');
  };

  const exportWeeklyFeed = async () => {
    const user = await getAuthUser();
    let consumptions: Array<{ batchId: number; date: string; feedTypeId: number; consumedKg: number }>;
    let feedMap: Map<number, string>;
    let batchMap: Map<number, string>;

    if (user) {
      const [{ data: cRows }, { data: ftRows }, { data: bRows }] = await Promise.all([
        supabase.from('feed_consumptions').select('*').eq('user_id', user.id),
        supabase.from('feed_types').select('id, name').eq('user_id', user.id),
        supabase.from('batches').select('id, name').eq('user_id', user.id),
      ]);
      consumptions = (cRows ?? []).map((r: Record<string, unknown>) => ({
        batchId: r.batch_id as number,
        date: r.date as string,
        feedTypeId: r.feed_type_id as number,
        consumedKg: r.consumed_kg as number,
      }));
      feedMap = new Map((ftRows ?? []).map((r: { id: number; name: string }) => [r.id, r.name]));
      batchMap = new Map((bRows ?? []).map((r: { id: number; name: string }) => [r.id, r.name]));
    } else {
      const [raw, feedTypes, batches] = await Promise.all([
        db.feedConsumptions.toArray(),
        db.feedTypes.toArray(),
        db.batches.toArray(),
      ]);
      consumptions = raw.map(c => ({
        batchId: c.batchId,
        date: c.date,
        feedTypeId: c.feedTypeId,
        consumedKg: c.consumedKg,
      }));
      feedMap = new Map(feedTypes.map(ft => [ft.id!, ft.name]));
      batchMap = new Map(batches.map(b => [b.id!, b.name]));
    }

    // Agregacja tygodniowa
    const weekMap = new Map<string, { feedKg: number; feedName: string; batchName: string }>();
    for (const c of consumptions) {
      const d = new Date(c.date);
      const year = d.getFullYear();
      const weekNum = Math.ceil(
        (d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 3600 * 1000)
      );
      const bName = batchMap.get(c.batchId) ?? String(c.batchId);
      const fName = feedMap.get(c.feedTypeId) ?? String(c.feedTypeId);
      const key = `${bName}|${year}-W${String(weekNum).padStart(2, '0')}|${fName}`;
      const existing = weekMap.get(key);
      weekMap.set(key, {
        feedKg: (existing?.feedKg ?? 0) + c.consumedKg,
        feedName: fName,
        batchName: bName,
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
