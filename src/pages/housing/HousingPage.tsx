import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { housingService } from '@/services/housing.service';
import { useBatch } from '@/hooks/useBatch';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO } from '@/utils/date';
import { LITTER_CONDITION_LABELS } from '@/constants/phases';
import type { Housing } from '@/models/housing.model';

export function HousingPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Housing | null>(null);

  const records = useLiveQuery(
    async () => {
      const r = await db.housing.where('batchId').equals(id).sortBy('recordDate');
      return r.reverse();
    },
    [id]
  ) ?? [];

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Omit<Housing, 'id' | 'batchId' | 'createdAt'>>({
    defaultValues: { recordDate: todayISO() },
  });

  if (!batch) return <PageLoader />;

  const onSubmit = async (data: Omit<Housing, 'id' | 'batchId' | 'createdAt'>) => {
    await housingService.create({ ...data, batchId: id });
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-900">Warunki utrzymania</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} icon={<span>+</span>}>
          Dodaj wpis
        </Button>
      </div>
      <div className="text-sm text-gray-500">{batch.name}</div>

      {records.length === 0 ? (
        <EmptyState
          title="Brak wpisów warunków"
          description="Dodaj pomiar warunków w kurniku."
          icon="🌡️"
          action={{ label: 'Dodaj wpis', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <Card key={r.id} className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{formatDate(r.recordDate)}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-2 text-sm">
                    {r.temperatureAvg != null && <div><span className="text-gray-400 text-xs">Temp śr.</span><br/>{r.temperatureAvg}°C</div>}
                    {r.humidityAvg != null && <div><span className="text-gray-400 text-xs">Wilgotność</span><br/>{r.humidityAvg}%</div>}
                    {r.ammoniaPpm != null && <div><span className={`text-xs ${r.ammoniaPpm > 20 ? 'text-red-500' : 'text-gray-400'}`}>Amoniak</span><br/>{r.ammoniaPpm} ppm</div>}
                    {r.co2Ppm != null && <div><span className="text-gray-400 text-xs">CO₂</span><br/>{r.co2Ppm} ppm</div>}
                    {r.lightingHours != null && <div><span className="text-gray-400 text-xs">Oświetlenie</span><br/>{r.lightingHours}h</div>}
                    {r.litterCondition != null && <div><span className="text-gray-400 text-xs">Ściółka</span><br/>{LITTER_CONDITION_LABELS[r.litterCondition]}</div>}
                    {r.densityBirdsPerM2 != null && <div><span className="text-gray-400 text-xs">Obsada</span><br/>{r.densityBirdsPerM2} szt/m²</div>}
                  </div>
                </div>
                <button onClick={() => setDeleteTarget(r)} className="text-gray-300 hover:text-red-400 text-sm">🗑️</button>
              </div>
              {r.notes && <div className="text-xs text-gray-400 mt-2 italic">{r.notes}</div>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowy wpis warunków" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" {...register('recordDate')} />
            <Input label="Godzina" type="time" {...register('recordTime')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Temp min (°C)" type="number" step="0.5" {...register('temperatureMin')} />
            <Input label="Temp śr. (°C)" type="number" step="0.5" {...register('temperatureAvg')} />
            <Input label="Temp max (°C)" type="number" step="0.5" {...register('temperatureMax')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Wilg. min (%)" type="number" {...register('humidityMin')} />
            <Input label="Wilg. śr. (%)" type="number" {...register('humidityAvg')} />
            <Input label="Wilg. max (%)" type="number" {...register('humidityMax')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CO₂ (ppm)" type="number" {...register('co2Ppm')} />
            <Input label="Amoniak (ppm)" type="number" {...register('ammoniaPpm')} hint="Alert >20 ppm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Oświetlenie (h)" type="number" step="0.5" {...register('lightingHours')} />
            <Input label="Wentylacja (1-10)" type="number" min={1} max={10} {...register('ventilationLevel')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Powierzchnia (m²)" type="number" step="0.1" {...register('surfaceM2')} />
            <Input label="Obsada (szt./m²)" type="number" step="0.1" {...register('densityBirdsPerM2')} />
          </div>
          <Select label="Stan ściółki" options={Object.entries(LITTER_CONDITION_LABELS).map(([v,l]) => ({value:v,label:l}))} placeholder="— Wybierz —" {...register('litterCondition')} />
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
        onConfirm={async () => { if (deleteTarget?.id) await housingService.delete(deleteTarget.id); }}
        message="Usunąć ten wpis warunków?"
        danger
      />
    </div>
  );
}
