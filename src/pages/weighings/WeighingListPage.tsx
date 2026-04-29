import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { weighingSchema, type WeighingFormValues } from '@/utils/validation';
import { weighingService } from '@/services/weighing.service';
import { useBatch } from '@/hooks/useBatch';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/charts/KPICard';
import { SimpleArea } from '@/components/charts/TrendChart';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO, differenceInDays, parseISO } from '@/utils/date';
import { formatGrams } from '@/utils/format';
import { buildGrowthCurve, calcDailyWeightGain } from '@/engine/growth';
import { WEIGHING_METHOD_LABELS } from '@/constants/phases';
import type { Weighing } from '@/models/weighing.model';

export function WeighingListPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Weighing | null>(null);

  const weighings = useLiveQuery(
    () => db.weighings.where('batchId').equals(id).sortBy('weighingDate'),
    [id]
  ) ?? [];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<WeighingFormValues>({
    resolver: zodResolver(weighingSchema),
    defaultValues: {
      weighingDate: todayISO(),
      method: 'sample',
      ageAtWeighingDays: batch ? differenceInDays(new Date(), parseISO(batch.startDate)) : 0,
    },
  });

  if (!batch) return <PageLoader />;

  const growthCurve = buildGrowthCurve(weighings);
  const dailyGain = calcDailyWeightGain(weighings);
  const latestWeighing = weighings[weighings.length - 1];

  const onSubmit = async (data: WeighingFormValues) => {
    await weighingService.create({ ...data, batchId: id });
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-900">Ważenia</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} icon={<span>+</span>}>
          Dodaj ważenie
        </Button>
      </div>
      <div className="text-sm text-gray-500">{batch.name}</div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          label="Aktualna masa śr."
          value={latestWeighing ? formatGrams(latestWeighing.averageWeightGrams) : '—'}
          icon="⚖️"
          color="green"
        />
        <KPICard
          label="Dzienny przyrost"
          value={dailyGain != null ? `${dailyGain.toFixed(1)}g/dzień` : '—'}
          icon="📈"
          color="blue"
        />
      </div>

      {/* Growth curve chart */}
      {growthCurve.points.length > 1 && (
        <Card title="Krzywa wzrostu">
          <SimpleArea
            data={growthCurve.points.map(p => ({ date: String(p.ageDay), value: p.weightGrams }))}
            label="Masa (g)"
            color="#15803d"
            height={200}
            formatValue={v => `${v}g`}
            xFormatter={x => `${x}d`}
          />
          <p className="text-xs text-gray-400 text-center mt-1">Oś X: wiek w dniach</p>
        </Card>
      )}

      {/* Weighings list */}
      {weighings.length === 0 ? (
        <EmptyState
          title="Brak ważeń"
          description="Dodaj pierwsze ważenie."
          icon="⚖️"
          action={{ label: 'Dodaj ważenie', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card title="Historia ważeń" padding="none">
          <div className="divide-y divide-gray-50">
            {[...weighings].reverse().map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <div className="text-center w-12">
                  <div className="text-xs text-gray-400">dzień</div>
                  <div className="text-lg font-bold text-gray-900">{w.ageAtWeighingDays}</div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{formatGrams(w.averageWeightGrams)}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(w.weighingDate)} · {WEIGHING_METHOD_LABELS[w.method]}
                    {w.sampleSize != null && ` · próba: ${w.sampleSize} szt.`}
                    {w.minWeightGrams != null && ` · min: ${w.minWeightGrams}g`}
                    {w.maxWeightGrams != null && ` · max: ${w.maxWeightGrams}g`}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(w)}
                  className="text-gray-300 hover:text-red-400 p-1"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add weighing modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowe ważenie">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data ważenia" type="date" {...register('weighingDate')} error={errors.weighingDate?.message} />
            <Input label="Wiek (dni)" type="number" min={0} {...register('ageAtWeighingDays')} error={errors.ageAtWeighingDays?.message} />
          </div>
          <Select label="Metoda" options={Object.entries(WEIGHING_METHOD_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('method')} />
          <Input label="Masa śr. (g)" type="number" step="1" min={1} {...register('averageWeightGrams')} error={errors.averageWeightGrams?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Masa min (g)" type="number" step="1" {...register('minWeightGrams')} />
            <Input label="Masa max (g)" type="number" step="1" {...register('maxWeightGrams')} />
          </div>
          <Input label="Próba (szt.)" type="number" min={1} {...register('sampleSize')} />
          <Input label="CV (%)" type="number" step="0.1" min={0} {...register('coefficientOfVariation')} hint="Jednolitość stada" />
          <Textarea label="Uwagi" {...register('notes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget?.id) await weighingService.delete(deleteTarget.id); }}
        message="Usunąć to ważenie?"
        danger
      />
    </div>
  );
}
