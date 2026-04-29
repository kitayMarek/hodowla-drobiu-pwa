import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema, type ExpenseFormValues } from '@/utils/validation';
import { financeService } from '@/services/finance.service';
import { useAllBatchKPIs } from '@/hooks/useKPIs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { KPICard } from '@/components/charts/KPICard';
import { SimpleBar } from '@/components/charts/TrendChart';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln, formatPercent } from '@/utils/format';
import { EXPENSE_CATEGORY_LABELS } from '@/constants/phases';
import type { Expense } from '@/models/expense.model';

export function FinancePage() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const allKPIs = useAllBatchKPIs();
  const expenses = useLiveQuery(() => db.expenses.orderBy('expenseDate').reverse().toArray(), []) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const deliveries = useLiveQuery(() => db.feedDeliveries.orderBy('deliveryDate').reverse().toArray(), []) ?? [];
  const feedTypes = useLiveQuery(() => db.feedTypes.toArray(), []) ?? [];
  const allBatches = useLiveQuery(() => db.batches.toArray(), []) ?? [];
  const batchMap = new Map(allBatches.map(b => [b.id!, b.name]));
  const feedTypeMap = new Map(feedTypes.map(ft => [ft.id!, ft.name]));

  const totalRevenue = sales.reduce((s, x) => s + x.totalRevenuePln, 0);
  const totalFeedCost = deliveries.reduce((s, d) => s + d.totalCostPln, 0);
  const totalOtherExpenses = expenses.reduce((s, e) => s + e.amountPln, 0);
  // Koszty piskląt z każdego stada (chick_cost_per_unit × initialCount + transport_cost)
  const totalChickCost = allBatches.reduce(
    (s, b) => s + (b.chick_cost_per_unit ?? 0) * b.initialCount + (b.transport_cost ?? 0),
    0
  );
  const totalExpenses = totalFeedCost + totalOtherExpenses + totalChickCost;
  const totalMargin = totalRevenue - totalExpenses;
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : null;

  // Struktura kosztów: pisklęta z partii + pasza z dostaw + pozostałe z wydatków
  type BarItem = { date: string; value: number };
  const costBars: BarItem[] = [];
  if (totalChickCost > 0) {
    costBars.push({ date: '🐣 Zakup piskląt', value: totalChickCost });
  }
  if (totalFeedCost > 0) {
    costBars.push({ date: '🌾 Zakupy pasz', value: totalFeedCost });
  }
  Object.entries(EXPENSE_CATEGORY_LABELS).forEach(([cat, label]) => {
    const val = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amountPln, 0);
    if (val > 0) costBars.push({ date: label, value: val });
  });
  costBars.sort((a, b) => b.value - a.value);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { expenseDate: todayISO(), category: 'energia' },
  });

  const onSubmit = async (data: ExpenseFormValues) => {
    const batchIdVal = (data as Record<string, unknown>)['batchId'];
    await financeService.createExpense({ ...data, batchId: batchIdVal ? Number(batchIdVal) : undefined });
    reset();
    setShowExpenseForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Finanse</h1>
        <Button onClick={() => setShowExpenseForm(true)} size="sm" icon={<span>+</span>}>
          Dodaj wydatek
        </Button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Przychody" value={formatPln(totalRevenue)} icon="💹" color="green" />
        <KPICard label="Koszty łącznie" value={formatPln(totalExpenses)} icon="💸" color="red"
          sub={[
            totalChickCost > 0 ? `pisklęta ${formatPln(totalChickCost)}` : null,
            totalFeedCost > 0 ? `pasza ${formatPln(totalFeedCost)}` : null,
          ].filter(Boolean).join(' · ') || undefined}
        />
        <KPICard label="Marża" value={formatPln(totalMargin)} icon="📊" color={totalMargin >= 0 ? 'green' : 'red'} />
        <KPICard label="Rentowność" value={formatPercent(marginPct)} icon="%" color={marginPct != null && marginPct >= 0 ? 'blue' : 'red'} />
      </div>

      {/* P&L per batch */}
      {allKPIs.length > 0 && (
        <Card title="Wyniki wg partii" padding="none">
          <div className="divide-y divide-gray-50">
            {allKPIs.map(kpi => (
              <div key={kpi.batchId} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{kpi.batchName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Przychód: {formatPln(kpi.totalRevenuePln)} · Koszty stada: {formatPln(kpi.totalCostPln)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${kpi.grossMarginPln >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatPln(kpi.grossMarginPln)}
                    </div>
                    <div className="text-xs text-gray-500">{formatPercent(kpi.grossMarginPercent)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400">Zużycie pasz</div>
                    <div className="text-xs font-medium">{formatPln(kpi.feedCostPln)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400">Zdrowie</div>
                    <div className="text-xs font-medium">{formatPln(kpi.totalHealthCostPln)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400">Koszt/kg</div>
                    <div className="text-xs font-medium">{kpi.costPerKgWeightGainPln != null ? formatPln(kpi.costPerKgWeightGainPln) : '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Cost breakdown chart */}
      {costBars.length > 0 && (
        <Card title="Struktura kosztów">
          <SimpleBar
            data={costBars}
            label="PLN"
            color="#ef4444"
            height={200}
            formatValue={v => `${v.toFixed(0)} zł`}
            xFormatter={x => x}
          />
        </Card>
      )}

      {/* Feed deliveries list */}
      {deliveries.length > 0 && (
        <Card title={`Dostawy pasz – koszty zakupu (${deliveries.length})`} padding="none">
          <div className="divide-y divide-gray-50">
            {deliveries.slice(0, 10).map(d => {
              const pricePerKg = d.quantityKg > 0 ? d.totalCostPln / d.quantityKg : null;
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">🌾 {feedTypeMap.get(d.feedTypeId) ?? `Pasza #${d.feedTypeId}`}</span>
                      <span className="text-xs text-gray-400">{formatDate(d.deliveryDate)}</span>
                      <Badge color="blue">{d.quantityKg} kg</Badge>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {pricePerKg && `${pricePerKg.toFixed(2)} zł/kg`}
                      {d.supplierName && ` · ${d.supplierName}`}
                      {d.invoiceNumber && ` · FV: ${d.invoiceNumber}`}
                    </div>
                  </div>
                  <div className="font-semibold text-red-600 text-sm">{formatPln(d.totalCostPln)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Other expenses list */}
      <Card title={`Pozostałe wydatki${expenses.length > 0 ? ` (${expenses.length})` : ''}`} padding="none">
        {expenses.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Brak ręcznych wydatków. Pasze rejestruj jako dostawy w sekcji Pasza.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {expenses.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                    <span className="text-xs text-gray-400">{formatDate(e.expenseDate)}</span>
                  </div>
                  <div className="text-sm text-gray-800">{e.description}</div>
                  {e.batchId && <div className="text-xs text-gray-400">{batchMap.get(e.batchId)}</div>}
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-600">{formatPln(e.amountPln)}</div>
                  <button onClick={() => setDeleteTarget(e)} className="text-gray-300 hover:text-red-400 text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showExpenseForm} onClose={() => setShowExpenseForm(false)} title="Nowy wydatek" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            💡 Koszty paszy rejestruj jako dostawy w sekcji <strong>Pasza</strong>. Tu wpisuj pozostałe koszty: energia, praca, weterynarz itp.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" {...register('expenseDate')} error={errors.expenseDate?.message} />
            <Select label="Kategoria" options={Object.entries(EXPENSE_CATEGORY_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('category')} />
          </div>
          <Input label="Opis" {...register('description')} error={errors.description?.message} />
          <Input label="Kwota (PLN)" type="number" step="0.01" {...register('amountPln')} error={errors.amountPln?.message} />
          <Select
            label="Stado (opcjonalne)"
            options={allBatches.map(b => ({ value: b.id!, label: b.name }))}
            placeholder="— Koszt fermowy —"
            {...register('batchId' as keyof ExpenseFormValues)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Faktura" {...register('invoiceNumber')} />
            <Input label="Dostawca" {...register('supplierName')} />
          </div>
          <Textarea label="Uwagi" {...register('notes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowExpenseForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget?.id) await financeService.deleteExpense(deleteTarget.id); setDeleteTarget(null); }}
        message="Usunąć ten wydatek?"
        danger
      />
    </div>
  );
}
