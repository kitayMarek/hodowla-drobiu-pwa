import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { batchSchema, type BatchFormValues } from '@/utils/validation';
import { batchService } from '@/services/batch.service';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ACTIVE_SPECIES, SPECIES_LABELS } from '@/constants/species';
import { BATCH_STATUS_LABELS, SOURCE_TYPE_LABELS } from '@/constants/phases';
import { todayISO } from '@/utils/date';
import { useBatch } from '@/hooks/useBatch';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { pl } from '@/i18n/pl';

export function BatchFormPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const isEdit = batchId != null;
  const existing = useBatch(isEdit ? Number(batchId) : 0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: existing ?? {
      status: 'active',
      species: 'brojler',
      startDate: todayISO(),
      sourceType: 'zakupione',
      initialCount: 1000,
    },
  });

  if (isEdit && existing === undefined) return <PageLoader />;

  const onSubmit = async (data: BatchFormValues) => {
    if (isEdit && existing?.id != null) {
      await batchService.update(existing.id, data);
      navigate(`/stada/${existing.id}`);
    } else {
      const id = await batchService.create(data);
      navigate(`/stada/${id}`);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          ← Wróć
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? pl.batch.edit : pl.batch.new}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card title="Podstawowe informacje">
          <div className="space-y-3">
            <Input
              label={pl.batch.name}
              {...register('name')}
              error={errors.name?.message}
              placeholder="np. Brojler Wiosna 2026 – Kurnik A"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label={pl.batch.species}
                options={ACTIVE_SPECIES.map(s => ({ value: s, label: `${SPECIES_LABELS[s]}` }))}
                {...register('species')}
                error={errors.species?.message}
              />
              <Select
                label={pl.batch.status}
                options={Object.entries(BATCH_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                {...register('status')}
                error={errors.status?.message}
              />
            </div>
            <Input
              label={pl.batch.breed}
              {...register('breed')}
              error={errors.breed?.message}
              placeholder="np. Ross 308, Lohmann Brown"
            />
          </div>
        </Card>

        <Card title="Data i liczebność">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={pl.batch.startDate}
                type="date"
                {...register('startDate')}
                error={errors.startDate?.message}
              />
              <Input
                label={pl.batch.plannedEndDate}
                type="date"
                {...register('plannedEndDate')}
                error={errors.plannedEndDate?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={pl.batch.initialCount}
                type="number"
                suffix="szt."
                {...register('initialCount')}
                error={errors.initialCount?.message}
              />
              <Input
                label={pl.batch.initialWeight}
                type="number"
                suffix="g"
                placeholder="42"
                {...register('initialWeightGrams')}
                error={errors.initialWeightGrams?.message}
              />
            </div>
          </div>
        </Card>

        <Card title="Pochodzenie i koszty">
          <div className="space-y-3">
            <Select
              label={pl.batch.sourceType}
              options={Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              {...register('sourceType')}
              error={errors.sourceType?.message}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={pl.batch.chickCost}
                type="number"
                step="0.01"
                suffix="PLN"
                placeholder="0,00"
                {...register('chick_cost_per_unit')}
                error={errors.chick_cost_per_unit?.message}
              />
              <Input
                label={pl.batch.transportCost}
                type="number"
                step="0.01"
                suffix="PLN"
                placeholder="0,00"
                {...register('transport_cost')}
                error={errors.transport_cost?.message}
              />
            </div>
            <Input
              label={pl.batch.housingId}
              {...register('housingId')}
              placeholder="np. Kurnik A, Sekcja 1"
            />
          </div>
        </Card>

        <Card>
          <Textarea
            label={pl.batch.notes}
            {...register('notes')}
            placeholder="Dodatkowe informacje o stadzie..."
          />
        </Card>

        <div className="flex gap-3">
          <Button type="submit" loading={isSubmitting} className="flex-1">
            {isEdit ? pl.actions.save : 'Utwórz stado'}
          </Button>
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>
            {pl.actions.cancel}
          </Button>
        </div>
      </form>
    </div>
  );
}
