import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { investmentSchema, type InvestmentFormValues } from '@/utils/validation';
import { investmentService } from '@/services/investment.service';
import {
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_CATEGORY_ICONS,
  type InvestmentCategory,
} from '@/constants/phases';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { KPICard } from '@/components/charts/KPICard';
import { SimpleBar } from '@/components/charts/TrendChart';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';
import type { Investment } from '@/models/investment.model';

const CATEGORY_OPTIONS = Object.entries(INVESTMENT_CATEGORY_LABELS).map(([v, l]) => ({
  value: v,
  label: `${INVESTMENT_CATEGORY_ICONS[v as InvestmentCategory]} ${l}`,
}));

export function InvestmentPage() {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const investments = useLiveQuery(
    () => db.investments.orderBy('purchaseDate').reverse().toArray(),
    []
  ) ?? [];

  // KPI
  const totalValue = investments.reduce((s, i) => s + i.amountPln, 0);
  const annualDepreciation = investments
    .filter(i => i.usefulLifeYears)
    .reduce((s, i) => s + i.amountPln / i.usefulLifeYears!, 0);
  const monthlyDepreciation = annualDepreciation / 12;

  // Breakdown by category
  const categoryBreakdown = Object.entries(INVESTMENT_CATEGORY_LABELS)
    .map(([cat, label]) => ({
      date: `${INVESTMENT_CATEGORY_ICONS[cat as InvestmentCategory]} ${label}`,
      value: investments.filter(i => i.category === cat).reduce((s, i) => s + i.amountPln, 0),
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: { purchaseDate: todayISO(), category: 'maszyna' },
  });

  const openAdd = () => {
    reset({ purchaseDate: todayISO(), category: 'maszyna' });
    setEditTarget(null);
    setShowForm(true);
  };

  const openEdit = (inv: Investment) => {
    reset({
      purchaseDate: inv.purchaseDate,
      category: inv.category,
      name: inv.name,
      amountPln: inv.amountPln,
      usefulLifeYears: inv.usefulLifeYears ?? ('' as unknown as undefined),
      supplier: inv.supplier ?? '',
      invoiceNumber: inv.invoiceNumber ?? '',
      notes: inv.notes ?? '',
    });
    setEditTarget(inv);
    setShowForm(true);
  };

  const onSubmit = async (data: InvestmentFormValues) => {
    if (editTarget?.id != null) {
      await investmentService.update(editTarget.id, data);
    } else {
      await investmentService.create(data);
    }
    reset();
    setShowForm(false);
    setEditTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inwestycje</h1>
          <p className="text-xs text-gray-500 mt-0.5">Środki trwałe i wyposażenie fermy</p>
        </div>
        <Button onClick={openAdd} size="sm" icon={<span>+</span>}>
          Dodaj inwestycję
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Wartość łączna"
          value={formatPln(totalValue)}
          icon="🏗️"
          color="blue"
        />
        <KPICard
          label="Liczba pozycji"
          value={String(investments.length)}
          icon="📦"
          color="gray"
        />
        <KPICard
          label="Amortyzacja / rok"
          value={annualDepreciation > 0 ? formatPln(annualDepreciation) : '—'}
          icon="📉"
          color="orange"
          sub="liniowa"
        />
        <KPICard
          label="Amortyzacja / mies."
          value={monthlyDepreciation > 0 ? formatPln(monthlyDepreciation) : '—'}
          icon="🗓️"
          color="orange"
        />
      </div>

      {/* Chart */}
      {categoryBreakdown.length > 0 && (
        <Card title="Wartość wg kategorii">
          <SimpleBar
            data={categoryBreakdown}
            label="PLN"
            color="#3b82f6"
            height={200}
            formatValue={v => `${v.toFixed(0)} zł`}
            xFormatter={x => x}
          />
        </Card>
      )}

      {/* List */}
      <Card title={`Rejestr środków trwałych (${investments.length})`} padding="none">
        {investments.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-4xl mb-3">🏗️</div>
            <p className="text-sm text-gray-500">Brak wpisów. Dodaj pierwszą inwestycję.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {investments.map(inv => {
              const annualAmort = inv.usefulLifeYears ? inv.amountPln / inv.usefulLifeYears : null;
              return (
                <div key={inv.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="text-2xl pt-0.5 select-none">
                    {INVESTMENT_CATEGORY_ICONS[inv.category]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{inv.name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-500">
                        {INVESTMENT_CATEGORY_LABELS[inv.category]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(inv.purchaseDate)}</span>
                      {inv.supplier && (
                        <span className="text-xs text-gray-400">{inv.supplier}</span>
                      )}
                      {inv.invoiceNumber && (
                        <span className="text-xs text-gray-400">FV: {inv.invoiceNumber}</span>
                      )}
                    </div>
                    {inv.usefulLifeYears && (
                      <div className="text-xs text-blue-600 mt-0.5">
                        Amortyzacja: {inv.usefulLifeYears} lat · {formatPln(inv.amountPln / inv.usefulLifeYears)}/rok
                      </div>
                    )}
                    {inv.notes && (
                      <div className="text-xs text-gray-400 mt-0.5 italic">{inv.notes}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-blue-700 text-sm">{formatPln(inv.amountPln)}</div>
                    <div className="flex gap-2 mt-1 justify-end">
                      <button
                        onClick={() => openEdit(inv)}
                        className="text-xs text-gray-400 hover:text-brand-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteTarget(inv)}
                        className="text-xs text-gray-300 hover:text-red-400"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        title={editTarget ? 'Edytuj inwestycję' : 'Nowa inwestycja'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input
            label="Nazwa środka trwałego *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="np. Wentylator tunelowy Skov 55kW, Kurtyna"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data zakupu *"
              type="date"
              {...register('purchaseDate')}
              error={errors.purchaseDate?.message}
            />
            <Select
              label="Kategoria *"
              options={CATEGORY_OPTIONS}
              {...register('category')}
              error={errors.category?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Wartość zakupu (PLN) *"
              type="number"
              step="0.01"
              suffix="zł"
              {...register('amountPln')}
              error={errors.amountPln?.message}
              placeholder="0,00"
            />
            <Input
              label="Okres amortyzacji"
              type="number"
              suffix="lat"
              {...register('usefulLifeYears')}
              error={errors.usefulLifeYears?.message}
              placeholder="np. 10"
              hint="Zostaw puste jeśli nie dotyczy"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dostawca / sklep"
              {...register('supplier')}
              placeholder="np. Hendrix Genetics"
            />
            <Input
              label="Numer faktury"
              {...register('invoiceNumber')}
              placeholder="FV/2026/001"
            />
          </div>
          <Textarea
            label="Uwagi"
            {...register('notes')}
            placeholder="Dodatkowe informacje, parametry techniczne..."
          />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={isSubmitting} className="flex-1">
              {editTarget ? 'Zapisz zmiany' : 'Dodaj inwestycję'}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => { setShowForm(false); setEditTarget(null); }}
            >
              Anuluj
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.id) await investmentService.delete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        message={`Usunąć „${deleteTarget?.name}"?`}
        danger
      />
    </div>
  );
}
