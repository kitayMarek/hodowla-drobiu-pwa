import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { expenseSchema, type ExpenseFormValues } from '@/utils/validation';
import { financeService } from '@/services/finance.service';
import { financialEventService } from '@/services/financialEvent.service';
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
import { EXPENSE_CATEGORY_LABELS, SALE_TYPE_LABELS } from '@/constants/phases';
import type { Expense } from '@/models/expense.model';

export function FinancePage() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [expPayment,   setExpPayment]   = useState<'pending' | 'immediate'>('pending');
  const [expAccountId, setExpAccountId] = useState('');
  const cashAccounts = useLiveQuery(() => db.cashAccounts.filter(a => a.isActive).toArray(), []) ?? [];
  const [financeModal, setFinanceModal] = useState<'przychody'|'koszty'|'marza'|'rentownosc'|{batchId:number}|null>(null);

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
    const expId = await financeService.createExpense({ ...data, batchId: batchIdVal ? Number(batchIdVal) : undefined }) as number;

    // ── Rozliczenie kasowe ────────────────────────────────────────────────────
    const desc = `${EXPENSE_CATEGORY_LABELS[data.category] ?? data.category}: ${data.description}${data.supplierName ? ` (${data.supplierName})` : ''}`;
    if (expPayment === 'pending') {
      await financialEventService.create({
        date: data.expenseDate, type: 'expense', amountPln: data.amountPln,
        description: desc, sourceType: 'expense', sourceId: expId,
      });
    } else if (expPayment === 'immediate' && expAccountId) {
      await db.cashTransactions.add({
        accountId: Number(expAccountId), date: data.expenseDate, type: 'expense',
        scope: 'drob', category: EXPENSE_CATEGORY_LABELS[data.category] ?? 'Inne',
        description: desc, amountPln: data.amountPln, createdAt: new Date().toISOString(),
      });
    }

    setExpPayment('pending');
    setExpAccountId('');
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
        <KPICard label="Przychody" value={formatPln(totalRevenue)} icon="💹" color="green"
          onClick={() => setFinanceModal('przychody')} />
        <KPICard label="Koszty łącznie" value={formatPln(totalExpenses)} icon="💸" color="red"
          sub={[
            totalChickCost > 0 ? `pisklęta ${formatPln(totalChickCost)}` : null,
            totalFeedCost > 0 ? `pasza ${formatPln(totalFeedCost)}` : null,
          ].filter(Boolean).join(' · ') || undefined}
          onClick={() => setFinanceModal('koszty')}
        />
        <KPICard label="Marża" value={formatPln(totalMargin)} icon="📊" color={totalMargin >= 0 ? 'green' : 'red'}
          onClick={() => setFinanceModal('marza')} />
        <KPICard label="Rentowność" value={formatPercent(marginPct)} icon="%" color={marginPct != null && marginPct >= 0 ? 'blue' : 'red'}
          onClick={() => setFinanceModal('rentownosc')} />
      </div>

      {/* P&L per batch */}
      {allKPIs.length > 0 && (
        <Card title="Wyniki wg partii" padding="none">
          <div className="divide-y divide-gray-50">
            {allKPIs.map(kpi => (
              <div key={kpi.batchId} className="px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
                onClick={() => setFinanceModal({ batchId: kpi.batchId })}>
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

      {/* ═══ MODAL SZCZEGÓŁÓW FINANSOWYCH ═══ */}
      {financeModal != null && (() => {
        const isBatch = typeof financeModal === 'object';
        const batchKpi = isBatch ? allKPIs.find(k => k.batchId === financeModal.batchId) : null;
        const batchObj = isBatch ? allBatches.find(b => b.id === financeModal.batchId) : null;

        if (isBatch) {
          if (!batchKpi || !batchObj) return null;
          const cb = batchKpi.costBreakdown;
          const bSales = sales.filter(s => s.batchId === batchKpi.batchId && s.saleType !== 'jaja_wewn');
          const bySaleType = Object.entries(SALE_TYPE_LABELS).map(([type, label]) => ({
            type, label,
            total: bSales.filter(s => s.saleType === type).reduce((s, x) => s + x.totalRevenuePln, 0),
          })).filter(x => x.total > 0);
          return (
            <Modal open onClose={() => setFinanceModal(null)} title={`Finanse – ${batchKpi.batchName}`} size="lg">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-xs text-green-600">Przychód</div>
                    <div className="font-bold text-green-800">{formatPln(batchKpi.totalRevenuePln)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-xs text-red-600">Koszty stada</div>
                    <div className="font-bold text-red-800">{formatPln(batchKpi.totalCostPln)}</div>
                  </div>
                  <div className={`rounded-lg p-2 ${batchKpi.grossMarginPln >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="text-xs text-gray-500">Marża</div>
                    <div className={`font-bold ${batchKpi.grossMarginPln >= 0 ? 'text-green-800' : 'text-red-800'}`}>{formatPln(batchKpi.grossMarginPln)}</div>
                  </div>
                </div>
                {bySaleType.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Przychody wg produktów</div>
                    <div className="divide-y divide-gray-50">
                      {bySaleType.map(({ type, label, total }) => (
                        <div key={type} className="flex justify-between py-1.5 text-sm">
                          <span className="text-gray-700">{label}</span>
                          <span className="font-medium text-green-700">{formatPln(total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Struktura kosztów stada</div>
                  <div className="divide-y divide-gray-50">
                    {cb.piskleta > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">🐣 Zakup piskląt</span><span className="font-medium text-red-700">{formatPln(cb.piskleta)}</span></div>}
                    {cb.pasza > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">🌾 Pasza</span><span className="font-medium text-red-700">{formatPln(cb.pasza)}</span></div>}
                    {cb.leki > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">💊 Leki</span><span className="font-medium text-red-700">{formatPln(cb.leki)}</span></div>}
                    {cb.weterynarz > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">🩺 Weterynarz</span><span className="font-medium text-red-700">{formatPln(cb.weterynarz)}</span></div>}
                    {cb.energia > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">⚡ Energia</span><span className="font-medium text-red-700">{formatPln(cb.energia)}</span></div>}
                    {cb.praca > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">👷 Praca</span><span className="font-medium text-red-700">{formatPln(cb.praca)}</span></div>}
                    {cb.transport > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">🚛 Transport</span><span className="font-medium text-red-700">{formatPln(cb.transport)}</span></div>}
                    {cb.sciolka > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">🪵 Ściółka</span><span className="font-medium text-red-700">{formatPln(cb.sciolka)}</span></div>}
                    {cb.inne > 0 && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-600">📦 Inne</span><span className="font-medium text-red-700">{formatPln(cb.inne)}</span></div>}
                  </div>
                  <div className="flex justify-between font-bold text-red-800 border-t border-gray-100 pt-2">
                    <span>Łączne koszty stada</span><span>{formatPln(cb.total)}</span>
                  </div>
                </div>
                {batchKpi.costPerKgWeightGainPln != null && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    Koszt na 1 kg przyrostu: <strong>{formatPln(batchKpi.costPerKgWeightGainPln)}</strong>
                    {batchKpi.costPerEggPln != null && <span className="ml-3">Koszt/jajko: <strong>{formatPln(batchKpi.costPerEggPln)}</strong></span>}
                  </div>
                )}
              </div>
            </Modal>
          );
        }

        // ── Modals ogólne ───────────────────────────────────────────────────
        const visibleSales = sales.filter(s => s.saleType !== 'jaja_wewn');

        if (financeModal === 'przychody') {
          const byType = Object.entries(SALE_TYPE_LABELS).map(([type, label]) => {
            const typeSales = visibleSales.filter(s => s.saleType === type);
            return { type, label, total: typeSales.reduce((s, x) => s + x.totalRevenuePln, 0), count: typeSales.length };
          }).filter(x => x.total > 0);
          return (
            <Modal open onClose={() => setFinanceModal(null)} title="Przychody – szczegóły" size="lg">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Wg rodzaju produktu</div>
                  <div className="divide-y divide-gray-50">
                    {byType.map(({ type, label, total, count }) => (
                      <div key={type} className="flex items-center justify-between py-2">
                        <div>
                          <span className="text-sm text-gray-800">{label}</span>
                          <span className="text-xs text-gray-400 ml-2">{count} transakcji</span>
                        </div>
                        <span className="font-semibold text-green-700">{formatPln(total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-green-900 border-t border-gray-100 pt-2">
                    <span>Łączne przychody</span><span>{formatPln(totalRevenue)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Wg stad</div>
                  <div className="divide-y divide-gray-50">
                    {allBatches.map(b => {
                      const bRev = visibleSales.filter(s => s.batchId === b.id).reduce((s, x) => s + x.totalRevenuePln, 0);
                      if (bRev === 0) return null;
                      return (
                        <div key={b.id} className="flex justify-between py-2 text-sm">
                          <span className="text-gray-700">{b.name}</span>
                          <span className="font-medium text-green-700">{formatPln(bRev)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Modal>
          );
        }

        if (financeModal === 'koszty') {
          return (
            <Modal open onClose={() => setFinanceModal(null)} title="Koszty łącznie – szczegóły" size="lg">
              <div className="space-y-2">
                {totalChickCost > 0 && (
                  <div className="flex justify-between py-2 text-sm border-b border-gray-50">
                    <span className="text-gray-700">🐣 Zakup piskląt / transport</span>
                    <span className="font-medium text-red-700">{formatPln(totalChickCost)}</span>
                  </div>
                )}
                {totalFeedCost > 0 && (
                  <div className="flex justify-between py-2 text-sm border-b border-gray-50">
                    <span className="text-gray-700">🌾 Zakupy pasz (dostawy)</span>
                    <span className="font-medium text-red-700">{formatPln(totalFeedCost)}</span>
                  </div>
                )}
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([cat, label]) => {
                  const val = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amountPln, 0);
                  if (val === 0) return null;
                  return (
                    <div key={cat} className="flex justify-between py-2 text-sm border-b border-gray-50">
                      <span className="text-gray-700">{label}</span>
                      <span className="font-medium text-red-700">{formatPln(val)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold text-red-900 border-t border-gray-200 pt-2">
                  <span>Łączne koszty</span><span>{formatPln(totalExpenses)}</span>
                </div>
                <div className="text-xs text-gray-400 pt-1">
                  Koszty pasz obliczane są na podstawie dostaw. Koszty stada (pisklęta) – z ustawień partii.
                </div>
              </div>
            </Modal>
          );
        }

        if (financeModal === 'marza' || financeModal === 'rentownosc') {
          return (
            <Modal open onClose={() => setFinanceModal(null)} title={financeModal === 'marza' ? 'Marża – szczegóły' : 'Rentowność – szczegóły'} size="lg">
              <div className="space-y-3">
                <div className="divide-y divide-gray-50">
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Łączne przychody</span>
                    <span className="font-semibold text-green-700">{formatPln(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Zakup piskląt / transport</span>
                    <span className="font-medium text-red-600">− {formatPln(totalChickCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Koszty pasz</span>
                    <span className="font-medium text-red-600">− {formatPln(totalFeedCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">Pozostałe wydatki</span>
                    <span className="font-medium text-red-600">− {formatPln(totalOtherExpenses)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold">
                    <span>Marża brutto</span>
                    <span className={totalMargin >= 0 ? 'text-green-700' : 'text-red-600'}>{formatPln(totalMargin)}</span>
                  </div>
                </div>
                {financeModal === 'rentownosc' && (
                  <div className={`rounded-xl p-3 ${marginPct != null && marginPct >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="text-xs text-gray-500 mb-1">Rentowność = marża ÷ przychody</div>
                    <div className="text-sm">
                      {formatPln(totalMargin)} ÷ {formatPln(totalRevenue)} = <strong className="text-lg">{formatPercent(marginPct)}</strong>
                    </div>
                    {marginPct != null && (
                      <div className="text-xs mt-1 text-gray-500">
                        {marginPct >= 20 ? '✅ Dobra rentowność' : marginPct >= 10 ? '⚠️ Niska rentowność' : marginPct >= 0 ? '⚠️ Bardzo niska rentowność' : '❌ Działalność przynosi straty'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Modal>
          );
        }

        return null;
      })()}

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

          {/* ── Rozliczenie kasowe ─────────────────────────────────────────── */}
          {cashAccounts.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kasa i bank</div>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button type="button" onClick={() => setExpPayment('pending')}
                  className={`flex-1 py-2 transition-colors ${expPayment === 'pending' ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
                  📅 Do rozliczenia
                </button>
                <button type="button" onClick={() => setExpPayment('immediate')}
                  className={`flex-1 py-2 border-l border-gray-200 transition-colors ${expPayment === 'immediate' ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
                  💸 Zapłacono od razu
                </button>
              </div>
              {expPayment === 'immediate' && (
                <select value={expAccountId} onChange={e => setExpAccountId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">— Wybierz konto —</option>
                  {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {expPayment === 'pending' && (
                <p className="text-xs text-orange-600">Pojawi się w Kasie i Banku → Do rozliczenia. Zatwierdź gdy zapłacisz.</p>
              )}
            </div>
          )}

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
