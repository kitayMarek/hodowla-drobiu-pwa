import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { slaughterSchema, type SlaughterFormValues } from '@/utils/validation';
import { slaughterService } from '@/services/slaughter.service';
import { useBatch } from '@/hooks/useBatch';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/charts/KPICard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO, differenceInDays, parseISO } from '@/utils/date';
import { formatKg, formatPln, formatPercent } from '@/utils/format';
import { calcTotalCarcassKg, calcAvgDressingPercent } from '@/engine/costs';
import type { SlaughterRecord } from '@/models/slaughter.model';

export function SlaughterPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SlaughterRecord | null>(null);

  const records = useLiveQuery(
    async () => {
      const r = await db.slaughterRecords.where('batchId').equals(id).sortBy('slaughterDate');
      return r.reverse();
    },
    [id]
  ) ?? [];

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<SlaughterFormValues>({
    resolver: zodResolver(slaughterSchema),
    defaultValues: {
      slaughterDate: todayISO(),
      ageAtSlaughterDays: batch ? differenceInDays(new Date(), parseISO(batch.startDate)) : undefined,
    },
  });

  if (!batch) return <PageLoader />;

  const live = watch('liveWeightTotalKg');
  const carc = watch('carcassWeightTotalKg');
  const previewDressing = live && carc && live > 0 ? ((carc / live) * 100).toFixed(1) : null;

  const totalCarcass = calcTotalCarcassKg(records);
  const avgDressing = calcAvgDressingPercent(records);
  const totalRevenue = records.reduce((s, r) => s + (r.totalRevenuePln ?? 0), 0);

  const onSubmit = async (data: SlaughterFormValues) => {
    await slaughterService.create({ ...data, batchId: id });
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-900">Ubój</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} icon={<span>+</span>}>
          Dodaj ubój
        </Button>
      </div>
      <div className="text-sm text-gray-500">{batch.name}</div>

      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Masa poubojowa" value={formatKg(totalCarcass)} icon="🥩" color="green" />
        <KPICard label="Wyd. tuszki" value={formatPercent(avgDressing)} icon="📊" color="blue" />
        <KPICard label="Przychód" value={formatPln(totalRevenue)} icon="💰" color="green" />
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="Brak rekordów uboju"
          description="Dodaj pierwszy rekord uboju."
          icon="🔪"
          action={{ label: 'Dodaj ubój', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card title="Rekordy uboju" padding="none">
          <div className="divide-y divide-gray-50">
            {records.map(r => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{formatDate(r.slaughterDate)}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 mt-1 text-sm">
                      <div><span className="text-gray-400 text-xs">Liczba</span><br/>{r.birdsSlaughtered} szt.</div>
                      <div><span className="text-gray-400 text-xs">Masa żywa</span><br/>{formatKg(r.liveWeightTotalKg)}</div>
                      <div><span className="text-gray-400 text-xs">Masa tuszek</span><br/>{formatKg(r.carcassWeightTotalKg)}</div>
                      <div><span className={`text-xs ${r.dressingPercent && r.dressingPercent > 0 ? 'text-gray-400' : 'text-gray-400'}`}>Wydajność</span><br/>{r.dressingPercent != null ? `${r.dressingPercent.toFixed(1)}%` : '—'}</div>
                    </div>
                    {r.pricePerKgPln != null && (
                      <div className="text-xs text-gray-500 mt-1">
                        {r.pricePerKgPln} PLN/kg · {r.totalRevenuePln != null ? formatPln(r.totalRevenuePln) : ''}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setDeleteTarget(r)} className="text-gray-300 hover:text-red-400 text-sm">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowy rekord uboju" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data uboju" type="date" {...register('slaughterDate')} error={errors.slaughterDate?.message} />
            <Input label="Wiek (dni)" type="number" {...register('ageAtSlaughterDays')} />
          </div>
          <Input label="Liczba ubitych sztuk" type="number" min={1} {...register('birdsSlaughtered')} error={errors.birdsSlaughtered?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Masa żywa łączna (kg)" type="number" step="0.1" {...register('liveWeightTotalKg')} error={errors.liveWeightTotalKg?.message} />
            <Input label="Masa poubojowa łączna (kg)" type="number" step="0.1" {...register('carcassWeightTotalKg')} error={errors.carcassWeightTotalKg?.message} />
          </div>
          {previewDressing && (
            <div className="text-sm text-brand-700 font-medium">
              Wydajność tuszki: {previewDressing}%
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Skonfiskowane (szt.)" type="number" {...register('condemnedCount')} />
            <Input label="Masa skonfiskowana (kg)" type="number" step="0.1" {...register('condemnedWeightKg')} />
          </div>
          <Input label="Ubojnia" {...register('slaughterHouseId')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cena (PLN/kg)" type="number" step="0.01" {...register('pricePerKgPln')} />
            <Input label="Przychód (PLN)" type="number" step="0.01" {...register('totalRevenuePln')} />
          </div>
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
        onConfirm={async () => { if (deleteTarget?.id) await slaughterService.delete(deleteTarget.id); }}
        message="Usunąć ten rekord uboju?"
        danger
      />
    </div>
  );
}
