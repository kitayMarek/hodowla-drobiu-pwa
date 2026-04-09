import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { dailyEntrySchema, type DailyEntryFormValues } from '@/utils/validation';
import { dailyEntryService } from '@/services/dailyEntry.service';
import { feedService } from '@/services/feed.service';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useBatch } from '@/hooks/useBatch';
import { isLayerSpecies } from '@/constants/species';
import { todayISO } from '@/utils/date';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { DailyEntry } from '@/models/dailyEntry.model';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';

export function DailyEntryFormPage() {
  const { batchId, entryId } = useParams<{ batchId: string; entryId?: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();
  const isEdit = entryId != null;

  const existing = useLiveQuery<DailyEntry | undefined>(
    () => isEdit ? db.dailyEntries.get(Number(entryId)) : Promise.resolve(undefined),
    [entryId]
  );

  const feedTypes = useLiveQuery(() => feedService.getActiveTypes(), []) ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DailyEntryFormValues>({
    resolver: zodResolver(dailyEntrySchema),
    defaultValues: {
      date: todayISO(),
      deadCount: 0,
      culledCount: 0,
      feedConsumedKg: 0,
    },
  });

  useEffect(() => {
    if (existing) reset(existing as DailyEntryFormValues);
  }, [existing, reset]);

  if (!batch) return <PageLoader />;

  const isLayer = isLayerSpecies(batch.species);

  const onSubmit = async (data: DailyEntryFormValues) => {
    if (isEdit && existing?.id != null) {
      await dailyEntryService.update(existing.id, { ...data, batchId: id });
    } else {
      await dailyEntryService.create({ ...data, batchId: id });
    }
    navigate(`/stada/${id}/dziennik`);
  };

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
        <Card>
          <Input
            label="Data"
            type="date"
            {...register('date')}
            error={errors.date?.message}
          />
        </Card>

        <Card title="Padnięcia">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Padnięcia (szt.)"
              type="number"
              min={0}
              {...register('deadCount')}
              error={errors.deadCount?.message}
            />
            <Input
              label="Wybrakowane (szt.)"
              type="number"
              min={0}
              {...register('culledCount')}
              error={errors.culledCount?.message}
            />
          </div>
        </Card>

        <Card title="Pasza i woda">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Pasza (kg)"
                type="number"
                step="0.1"
                min={0}
                {...register('feedConsumedKg')}
                error={errors.feedConsumedKg?.message}
              />
              <Input
                label="Woda (l)"
                type="number"
                step="1"
                min={0}
                {...register('waterLiters')}
                error={errors.waterLiters?.message}
              />
            </div>
            {feedTypes.length > 0 && (
              <Select
                label="Rodzaj paszy"
                options={feedTypes.map(ft => ({ value: ft.id!, label: ft.name }))}
                placeholder="— Wybierz paszę —"
                {...register('feedTypeId')}
                error={errors.feedTypeId?.message}
              />
            )}
          </div>
        </Card>

        {isLayer && (
          <Card title="Produkcja jaj">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Zebrane jaja (szt.)"
                type="number"
                min={0}
                {...register('eggsCollected')}
                error={errors.eggsCollected?.message}
              />
              <Input
                label="Jaja wadliwe (szt.)"
                type="number"
                min={0}
                {...register('eggsDefective')}
                error={errors.eggsDefective?.message}
              />
            </div>
          </Card>
        )}

        <Card title="Kontrola masy (opcjonalne)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Masa próby (g)"
              type="number"
              step="1"
              min={0}
              {...register('sampleWeightGrams')}
              error={errors.sampleWeightGrams?.message}
            />
            <Input
              label="Liczba ważonych"
              type="number"
              min={1}
              {...register('sampleSize')}
              error={errors.sampleSize?.message}
            />
          </div>
        </Card>

        <Card title="Warunki (opcjonalne)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Temperatura (°C)"
              type="number"
              step="0.5"
              {...register('temperatureCelsius')}
              error={errors.temperatureCelsius?.message}
            />
            <Input
              label="Wilgotność (%)"
              type="number"
              min={0} max={100}
              {...register('humidity')}
              error={errors.humidity?.message}
            />
          </div>
        </Card>

        <Card>
          <Textarea
            label="Uwagi"
            {...register('notes')}
            placeholder="Obserwacje, anomalie..."
          />
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
