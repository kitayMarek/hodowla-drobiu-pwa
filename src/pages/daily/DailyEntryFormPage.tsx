import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dailyEntrySchema, type DailyEntryFormValues } from '@/utils/validation';
import { dailyEntryService } from '@/services/dailyEntry.service';
import { feedService } from '@/services/feed.service';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBatch } from '@/hooks/useBatch';
import { isLayerSpecies } from '@/constants/species';
import { todayISO } from '@/utils/date';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { FeedType } from '@/models/feed.model';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

// ─── Typ wiersza paszowego ────────────────────────────────────────────────────

interface FeedRow {
  uid:        string;   // lokalny klucz UI
  feedTypeId: number | null;
  kg:         number | null;
}

let _uid = 0;
const newRow = (): FeedRow => ({ uid: String(++_uid), feedTypeId: null, kg: null });

// ─── Komponent ────────────────────────────────────────────────────────────────

export function DailyEntryFormPage() {
  const { batchId, entryId } = useParams<{ batchId: string; entryId?: string }>();
  const id      = Number(batchId);
  const batch   = useBatch(id);
  const navigate = useNavigate();
  const isEdit   = entryId != null;

  const existing = useLiveQuery<DailyEntry | undefined>(
    () => isEdit ? db.dailyEntries.get(Number(entryId)) : Promise.resolve(undefined),
    [entryId],
  );

  const feedTypes: FeedType[] = useLiveQuery(() => feedService.getActiveTypes(), []) ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DailyEntryFormValues>({
    resolver: zodResolver(dailyEntrySchema),
    defaultValues: {
      date:           todayISO(),
      deadCount:      0,
      culledCount:    0,
      feedConsumedKg: 0,
    },
  });

  // ─── Stan wierszy paszowych ─────────────────────────────────────────────────
  const [feedRows, setFeedRows] = useState<FeedRow[]>([newRow()]);

  // Przelicz sumę i wpisz do formularza
  const updateTotal = (rows: FeedRow[]) => {
    const total = rows.reduce((s, r) => s + (r.kg ?? 0), 0);
    setValue('feedConsumedKg', Math.round(total * 100) / 100);
  };

  const setRows = (rows: FeedRow[]) => {
    setFeedRows(rows);
    updateTotal(rows);
  };

  const addRow = () => setRows([...feedRows, newRow()]);

  const removeRow = (uid: string) => {
    const next = feedRows.filter(r => r.uid !== uid);
    setRows(next.length > 0 ? next : [newRow()]);
  };

  const updateRow = (uid: string, patch: Partial<Omit<FeedRow, 'uid'>>) => {
    setRows(feedRows.map(r => r.uid === uid ? { ...r, ...patch } : r));
  };

  // ─── Ładowanie istniejącego wpisu ──────────────────────────────────────────
  useEffect(() => {
    if (!existing) return;

    // Najpierw ustaw pola formularza (bez feedConsumedKg – zostanie policzone z rows)
    reset({
      date:        existing.date,
      deadCount:   existing.deadCount,
      culledCount: existing.culledCount,
      feedConsumedKg: existing.feedConsumedKg,
      waterLiters:    existing.waterLiters,
      eggsCollected:  existing.eggsCollected,
      eggsDefective:  existing.eggsDefective,
      sampleWeightGrams: existing.sampleWeightGrams,
      sampleSize:     existing.sampleSize,
      temperatureCelsius: existing.temperatureCelsius,
      humidity:       existing.humidity,
      notes:          existing.notes,
    } as DailyEntryFormValues);

    // Załaduj wiersze paszowe z feedConsumptions
    db.feedConsumptions
      .where('[batchId+date]').equals([id, existing.date])
      .toArray()
      .then(consumptions => {
        if (consumptions.length > 0) {
          const rows: FeedRow[] = consumptions.map(fc => ({
            uid:        String(++_uid),
            feedTypeId: fc.feedTypeId,
            kg:         fc.consumedKg,
          }));
          setRows(rows);
        } else if (existing.feedTypeId) {
          // Wsteczna kompatybilność: stary wpis z jednym feedTypeId
          const rows: FeedRow[] = [{
            uid:        String(++_uid),
            feedTypeId: existing.feedTypeId,
            kg:         existing.feedConsumedKg,
          }];
          setRows(rows);
        } else {
          const rows: FeedRow[] = [{
            uid:        String(++_uid),
            feedTypeId: null,
            kg:         existing.feedConsumedKg > 0 ? existing.feedConsumedKg : null,
          }];
          setRows(rows);
        }
      });
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!batch) return <PageLoader />;
  const isLayer = isLayerSpecies(batch.species);

  // ─── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: DailyEntryFormValues) => {
    const validRows = feedRows.filter(r => r.feedTypeId != null && (r.kg ?? 0) > 0);
    const totalKg   = validRows.reduce((s, r) => s + r.kg!, 0);

    const entryData = {
      ...data,
      batchId:        id,
      feedConsumedKg: Math.round(totalKg * 100) / 100,
      feedTypeId:     undefined,  // przechowujemy w feedConsumptions
    };

    const dateStr = data.date;

    if (isEdit && existing?.id != null) {
      // Usuń stare feedConsumptions pod STARĄ datą (data mogła się zmienić w edycji)
      await db.feedConsumptions.where('[batchId+date]').equals([id, existing.date]).delete();
      await dailyEntryService.update(existing.id, entryData);
    } else {
      // Usuń ewentualne stare feedConsumptions pod tą datą przed dodaniem nowych
      await db.feedConsumptions.where('[batchId+date]').equals([id, dateStr]).delete();
      await dailyEntryService.create(entryData);
    }

    // Zapisz nowe wiersze paszowe
    for (const row of validRows) {
      await db.feedConsumptions.add({
        batchId:    id,
        feedTypeId: row.feedTypeId!,
        date:       dateStr,
        consumedKg: row.kg!,
        createdAt:  new Date().toISOString(),
      });
    }

    navigate(`/stada/${id}/dziennik`);
  };

  // ─── Obliczone suma pasz ───────────────────────────────────────────────────
  const totalFeedKg = feedRows.reduce((s, r) => s + (r.kg ?? 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          ← Wróć
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Edytuj wpis' : 'Nowy wpis dzienny'}
        </h1>
      </div>
      <div className="text-sm text-gray-500">Stado: <strong>{batch.name}</strong></div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Data */}
        <Card>
          <Input label="Data" type="date" {...register('date')} error={errors.date?.message} />
        </Card>

        {/* Padnięcia */}
        <Card title="Padnięcia">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Padnięcia (szt.)" type="number" min={0}
              {...register('deadCount')} error={errors.deadCount?.message} />
            <Input label="Wybrakowane (szt.)" type="number" min={0}
              {...register('culledCount')} error={errors.culledCount?.message} />
          </div>
        </Card>

        {/* Pasza i woda */}
        <Card title="Pasza i woda">
          <div className="space-y-3">

            {/* Wiersze paszowe */}
            <div className="space-y-2">
              {feedRows.map((row, idx) => (
                <div key={row.uid} className="flex gap-2 items-start">
                  {/* Select rodzaju paszy */}
                  <div className="flex-1 min-w-0">
                    <select
                      value={row.feedTypeId ?? ''}
                      onChange={e => updateRow(row.uid, {
                        feedTypeId: e.target.value ? Number(e.target.value) : null,
                      })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">— Rodzaj paszy —</option>
                      {feedTypes.map(ft => (
                        <option key={ft.id} value={ft.id}>{ft.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Ilość kg */}
                  <div className="w-28 shrink-0">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={row.kg ?? ''}
                        placeholder="0.0"
                        onChange={e => updateRow(row.uid, {
                          kg: e.target.value !== '' ? Number(e.target.value) : null,
                        })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">kg</span>
                    </div>
                  </div>

                  {/* Usuń wiersz */}
                  <button
                    type="button"
                    onClick={() => removeRow(row.uid)}
                    className="mt-1.5 p-1.5 text-gray-300 hover:text-red-400 rounded transition-colors shrink-0"
                    title="Usuń"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Dodaj wiersz + suma */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addRow}
                className="text-sm text-brand-700 hover:text-brand-800 font-medium"
              >
                + Dodaj paszę
              </button>
              {totalFeedKg > 0 && (
                <span className="text-sm font-medium text-gray-700">
                  Łącznie: <strong>{totalFeedKg.toFixed(1)} kg</strong>
                </span>
              )}
            </div>

            {/* Ukryte pole dla react-hook-form */}
            <input type="hidden" {...register('feedConsumedKg')} />

            {/* Woda */}
            <Input label="Woda (l)" type="number" step="1" min={0}
              {...register('waterLiters')} error={errors.waterLiters?.message} />
          </div>
        </Card>

        {/* Produkcja jaj (tylko nioska) */}
        {isLayer && (
          <Card title="Produkcja jaj">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Zebrane jaja (szt.)" type="number" min={0}
                {...register('eggsCollected')} error={errors.eggsCollected?.message} />
              <Input label="Jaja wadliwe (szt.)" type="number" min={0}
                {...register('eggsDefective')} error={errors.eggsDefective?.message} />
            </div>
          </Card>
        )}

        {/* Kontrola masy */}
        <Card title="Kontrola masy (opcjonalne)">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Masa próby (g)" type="number" step="1" min={0}
              {...register('sampleWeightGrams')} error={errors.sampleWeightGrams?.message} />
            <Input label="Liczba ważonych" type="number" min={1}
              {...register('sampleSize')} error={errors.sampleSize?.message} />
          </div>
        </Card>

        {/* Warunki */}
        <Card title="Warunki (opcjonalne)">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Temperatura (°C)" type="number" step="0.5"
              {...register('temperatureCelsius')} error={errors.temperatureCelsius?.message} />
            <Input label="Wilgotność (%)" type="number" min={0} max={100}
              {...register('humidity')} error={errors.humidity?.message} />
          </div>
        </Card>

        {/* Uwagi */}
        <Card>
          <Textarea label="Uwagi" {...register('notes')} placeholder="Obserwacje, anomalie..." />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={isSubmitting} className="flex-1">
            {isEdit ? 'Zapisz zmiany' : 'Dodaj wpis'}
          </Button>
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            Anuluj
          </Button>
        </div>
      </form>
    </div>
  );
}
