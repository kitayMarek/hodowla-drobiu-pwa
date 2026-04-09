import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { saleSchema, type SaleFormValues } from '@/utils/validation';
import { saleService } from '@/services/sale.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/charts/KPICard';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import { useActiveBatches } from '@/hooks/useBatch';
import type { Sale } from '@/models/sale.model';

const saleTypeBadge: Record<string, 'yellow' | 'green' | 'blue' | 'orange'> = {
  jaja: 'yellow', ptaki_zywe: 'green', tuszki: 'blue', elementy: 'orange',
};

export function SalesPage() {
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const sales = useLiveQuery(() => db.sales.orderBy('saleDate').reverse().toArray(), []) ?? [];
  const batches = useActiveBatches();
  const allBatches = useLiveQuery(() => db.batches.toArray(), []) ?? [];

  const totalRevenue = sales.reduce((s, x) => s + x.totalRevenuePln, 0);
  const thisMonthSales = sales.filter(s => s.saleDate >= new Date().toISOString().slice(0, 7));
  const thisMonthRevenue = thisMonthSales.reduce((s, x) => s + x.totalRevenuePln, 0);

  const batchMap = new Map(allBatches.map(b => [b.id!, b.name]));

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: { saleDate: todayISO(), saleType: 'tuszki' },
  });

  const saleType = watch('saleType');

  const onSubmit = async (data: SaleFormValues) => {
    const batchIdVal = (data as Record<string, unknown>)['batchId'];
    await saleService.create({ ...data, batchId: (Number(batchIdVal) || batches[0]?.id) ?? 0 });
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sprzedaż</h1>
        <Button onClick={() => setShowForm(true)} size="sm" icon={<span>+</span>}>
          Nowa sprzedaż
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KPICard label="Łączny przychód" value={formatPln(totalRevenue)} icon="💰" color="green" />
        <KPICard label="Ten miesiąc" value={formatPln(thisMonthRevenue)} icon="📅" color="blue" />
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="Brak sprzedaży"
          description="Dodaj pierwszą transakcję sprzedaży."
          icon="💰"
          action={{ label: 'Dodaj sprzedaż', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card title="Historia sprzedaży" padding="none">
          <div className="divide-y divide-gray-50">
            {sales.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={saleTypeBadge[s.saleType]}>{SALE_TYPE_LABELS[s.saleType]}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(s.saleDate)}</span>
                    {s.buyerName && <span className="text-xs text-gray-500">{s.buyerName}</span>}
                  </div>
                  <div className="text-sm text-gray-800 mt-0.5">
                    {s.saleType === 'jaja' && s.eggsCount != null && `${s.eggsCount.toLocaleString('pl-PL')} jaj`}
                    {s.saleType !== 'jaja' && s.weightKg != null && `${s.weightKg} kg`}
                    {s.birdCount != null && ` · ${s.birdCount} szt.`}
                    {s.pricePerKgPln != null && ` · ${s.pricePerKgPln} PLN/kg`}
                  </div>
                  {s.batchId && <div className="text-xs text-gray-400">{batchMap.get(s.batchId)}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatPln(s.totalRevenuePln)}</div>
                  <button onClick={() => setDeleteTarget(s)} className="text-gray-300 hover:text-red-400 text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nowa sprzedaż" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" {...register('saleDate')} error={errors.saleDate?.message} />
            <Select label="Produkt" options={Object.entries(SALE_TYPE_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('saleType')} />
          </div>
          <Select
            label="Stado"
            options={allBatches.map(b => ({ value: b.id!, label: b.name }))}
            placeholder="— Wybierz stado —"
            {...register('batchId' as keyof SaleFormValues)}
          />
          {saleType === 'jaja' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Liczba jaj" type="number" min={1} {...register('eggsCount')} />
              <Input label="Cena za jajko (PLN)" type="number" step="0.01" {...register('eggPricePln')} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Masa (kg)" type="number" step="0.1" {...register('weightKg')} />
              <Input label="Cena (PLN/kg)" type="number" step="0.01" {...register('pricePerKgPln')} />
            </div>
          )}
          <Input label="Liczba ptaków (szt.)" type="number" min={1} {...register('birdCount')} />
          <Input label="Wartość łączna (PLN)" type="number" step="0.01" {...register('totalRevenuePln')} error={errors.totalRevenuePln?.message} />
          <Input label="Klient" {...register('buyerName')} />
          <Input label="Numer faktury" {...register('invoiceNumber')} />
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
        onConfirm={async () => { if (deleteTarget?.id) await saleService.delete(deleteTarget.id); }}
        message="Usunąć tę transakcję sprzedaży?"
        danger
      />
    </div>
  );
}
