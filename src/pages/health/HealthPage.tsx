import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { healthEventSchema, type HealthEventFormValues } from '@/utils/validation';
import { healthService } from '@/services/health.service';
import { useBatch } from '@/hooks/useBatch';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/charts/KPICard';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln, formatPercent } from '@/utils/format';
import { HEALTH_EVENT_LABELS } from '@/constants/phases';
import type { HealthEvent } from '@/models/health.model';

const eventBadgeColor: Record<string, 'red' | 'blue' | 'green' | 'orange' | 'gray'> = {
  choroba: 'red',
  szczepienie: 'blue',
  leczenie: 'orange',
  obserwacja: 'gray',
  profilaktyka: 'green',
};

export function HealthPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HealthEvent | null>(null);

  const events = useLiveQuery(
    async () => {
      const evts = await db.healthEvents.where('batchId').equals(id).sortBy('eventDate');
      return evts.reverse();
    },
    [id]
  ) ?? [];

  const batch2 = useLiveQuery(() => db.batches.get(id), [id]);
  const dailyEntries = useLiveQuery(() => db.dailyEntries.where('batchId').equals(id).toArray(), [id]) ?? [];
  const totalDead = dailyEntries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
  const mortalityPct = batch2 ? (totalDead / batch2.initialCount) * 100 : 0;
  const totalHealthCost = events.reduce((s, e) => s + (e.costPln ?? 0), 0);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<HealthEventFormValues>({
    resolver: zodResolver(healthEventSchema),
    defaultValues: { eventDate: todayISO(), eventType: 'obserwacja' },
  });

  if (!batch) return <PageLoader />;

  const onSubmit = async (data: HealthEventFormValues) => {
    await healthService.create({ ...data, batchId: id });
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-900">Zdrowie</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} icon={<span>+</span>}>
          Dodaj zdarzenie
        </Button>
      </div>
      <div className="text-sm text-gray-500">{batch.name}</div>

      <div className="grid grid-cols-2 gap-3">
        <KPICard
          label="Łączne upadki"
          value={`${totalDead} szt.`}
          sub={formatPercent(mortalityPct)}
          icon="📉"
          color={mortalityPct > 5 ? 'red' : 'gray'}
        />
        <KPICard
          label="Koszt zdrowotny"
          value={formatPln(totalHealthCost)}
          icon="💊"
          color="orange"
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Brak zdarzeń zdrowotnych"
          description="Dodaj pierwsze zdarzenie zdrowotne."
          icon="💊"
          action={{ label: 'Dodaj zdarzenie', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card title="Zdarzenia zdrowotne" padding="none">
          <div className="divide-y divide-gray-50">
            {events.map(ev => (
              <div key={ev.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge color={eventBadgeColor[ev.eventType]}>
                      {HEALTH_EVENT_LABELS[ev.eventType]}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatDate(ev.eventDate)}</span>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(ev)}
                    className="text-gray-300 hover:text-red-400 text-sm"
                  >
                    🗑️
                  </button>
                </div>
                {ev.diagnosis && <div className="text-sm text-gray-800 mt-1">{ev.diagnosis}</div>}
                {ev.medicationName && <div className="text-xs text-gray-600 mt-0.5">💊 {ev.medicationName}</div>}
                {ev.withdrawalPeriodDays != null && ev.withdrawalPeriodDays > 0 && (
                  <div className="text-xs text-red-600 mt-0.5">
                    ⚠️ Karencja: {ev.withdrawalPeriodDays} dni
                  </div>
                )}
                {ev.costPln != null && ev.costPln > 0 && (
                  <div className="text-xs text-gray-500 mt-0.5">Koszt: {formatPln(ev.costPln)}</div>
                )}
                {ev.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{ev.notes}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowe zdarzenie zdrowotne" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" {...register('eventDate')} error={errors.eventDate?.message} />
            <Select label="Typ zdarzenia" options={Object.entries(HEALTH_EVENT_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('eventType')} />
          </div>
          <Input label="Diagnoza" {...register('diagnosis')} />
          <Input label="Leczenie" {...register('treatment')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Lek" {...register('medicationName')} />
            <Input label="Dawka (mg/kg)" type="number" step="0.1" {...register('dosageMgPerKg')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Czas leczenia (dni)" type="number" {...register('durationDays')} />
            <Input label="Karencja (dni)" type="number" {...register('withdrawalPeriodDays')} hint="⚠️ Ważne przed ubojem" />
            <Input label="Liczba ptaków" type="number" {...register('affectedCount')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Koszt (PLN)" type="number" step="0.01" {...register('costPln')} error={errors.costPln?.message} />
            <Input label="Weterynarz" {...register('veterinarianName')} />
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
        onConfirm={async () => { if (deleteTarget?.id) await healthService.delete(deleteTarget.id); }}
        message="Usunąć to zdarzenie zdrowotne?"
        danger
      />
    </div>
  );
}
