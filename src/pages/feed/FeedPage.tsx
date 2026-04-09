import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { feedTypeSchema, type FeedTypeFormValues } from '@/utils/validation';
import { feedService } from '@/services/feed.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatPln } from '@/utils/format';
import { FEED_PHASE_LABELS } from '@/constants/phases';
import type { FeedType } from '@/models/feed.model';

export function FeedPage() {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<FeedType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedType | null>(null);

  const feedTypes = useLiveQuery(() => db.feedTypes.orderBy('name').toArray(), []) ?? [];

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FeedTypeFormValues>({
    resolver: zodResolver(feedTypeSchema),
    defaultValues: { isActive: true, phase: 'grower', pricePerKg: 0 },
  });

  const openEdit = (ft: FeedType) => {
    setEditTarget(ft);
    Object.entries(ft).forEach(([k, v]) => setValue(k as keyof FeedTypeFormValues, v as never));
    setShowForm(true);
  };

  const onSubmit = async (data: FeedTypeFormValues) => {
    if (editTarget?.id != null) {
      await feedService.updateType(editTarget.id, data);
    } else {
      await feedService.createType(data);
    }
    reset();
    setEditTarget(null);
    setShowForm(false);
  };

  const phaseBadge: Record<string, 'blue' | 'green' | 'orange' | 'gray' | 'red'> = {
    starter: 'blue', grower: 'green', finisher: 'orange', layer: 'red', own_mix: 'gray',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pasza</h1>
        <Button onClick={() => { reset(); setEditTarget(null); setShowForm(true); }} size="sm" icon={<span>+</span>}>
          Nowa pasza
        </Button>
      </div>

      {/* Future module placeholder */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🧪</span>
        <div>
          <div className="text-sm font-semibold text-brand-800">Kalkulator receptur (v2)</div>
          <div className="text-xs text-brand-600">Obliczanie własnych mieszanek – dostępne w wersji 2</div>
        </div>
        <Badge color="blue">Wkrótce</Badge>
      </div>

      {feedTypes.length === 0 ? (
        <EmptyState
          title="Brak zdefiniowanych pasz"
          description="Dodaj rodzaje pasz używanych w hodowli."
          icon="🌾"
          action={{ label: 'Dodaj paszę', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card title="Zdefiniowane pasze" padding="none">
          <div className="divide-y divide-gray-50">
            {feedTypes.map(ft => (
              <div key={ft.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{ft.name}</span>
                    <Badge color={phaseBadge[ft.phase]}>{FEED_PHASE_LABELS[ft.phase]}</Badge>
                    {!ft.isActive && <Badge color="gray">Nieaktywna</Badge>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {formatPln(ft.pricePerKg)}/kg
                    {ft.manufacturer && ` · ${ft.manufacturer}`}
                    {ft.proteinPercent != null && ` · Białko: ${ft.proteinPercent}%`}
                  </div>
                  {ft.recipeNotes && <div className="text-xs text-gray-400 mt-0.5">{ft.recipeNotes}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(ft)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">✏️</button>
                  <button onClick={() => setDeleteTarget(ft)} className="p-1.5 text-gray-300 hover:text-red-400 rounded">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditTarget(null); reset(); }} title={editTarget ? 'Edytuj paszę' : 'Nowa pasza'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input label="Nazwa paszy" {...register('name')} error={errors.name?.message} placeholder="np. Starter Ross Pro, Własna mieszanka grower" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Faza żywienia" options={Object.entries(FEED_PHASE_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('phase')} />
            <Input label="Cena (PLN/kg)" type="number" step="0.01" min={0.01} {...register('pricePerKg')} error={errors.pricePerKg?.message} />
          </div>
          <Input label="Producent" {...register('manufacturer')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Białko (%)" type="number" step="0.1" {...register('proteinPercent')} />
            <Input label="Energia (MJ/kg)" type="number" step="0.01" {...register('energyMjKg')} />
          </div>
          <Textarea label="Receptura / skład" {...register('recipeNotes')} placeholder="Skład własnej mieszanki..." />
          <Textarea label="Uwagi" {...register('notes')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('isActive')} className="rounded" />
            Aktywna pasza
          </label>
          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget?.id) await feedService.deleteType(deleteTarget.id); }}
        message={`Usunąć paszę "${deleteTarget?.name}"?`}
        danger
      />
    </div>
  );
}
