import React, { useState } from 'react';
import { HelpLink } from '@/components/HelpLink';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInvestments, useActiveCashAccounts, useActivities } from '@/hooks/useTableData';
import { investmentSchema, type InvestmentFormValues } from '@/utils/validation';
import { investmentService } from '@/services/investment.service';
import { financialEventService } from '@/services/financialEvent.service';
import { cashFlowService } from '@/services/cashFlow.service';
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
  const [submitError, setSubmitError] = useState('');

  // Rozliczenie kasowe nowego zakupu
  const [invPayment, setInvPayment]   = useState<'pending' | 'immediate'>('pending');
  const [invAccountId, setInvAccountId] = useState('');
  const [invScope, setInvScope]       = useState('');

  const investments  = useInvestments();
  const cashAccounts = useActiveCashAccounts();
  const activities   = useActivities();

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
    setSubmitError('');
    setInvPayment('pending');
    setInvAccountId('');
    setInvScope('');
    setShowForm(true);
  };

  const openEdit = (inv: Investment) => {
    setSubmitError('');
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

  const errMsg = (e: unknown) =>
    e instanceof Error ? e.message
    : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
    : JSON.stringify(e);

  const onSubmit = async (data: InvestmentFormValues) => {
    setSubmitError('');
    try {
      if (editTarget?.id != null) {
        await investmentService.update(editTarget.id, data);
      } else {
        const invId = await investmentService.create(data);

        // ── Rozliczenie kasowe ──────────────────────────────────────────────
        const desc = `Zakup – ${data.name}${data.supplier ? ` (${data.supplier})` : ''}${data.invoiceNumber ? ` FV: ${data.invoiceNumber}` : ''}`;
        if (invPayment === 'pending') {
          await financialEventService.create({
            date: data.purchaseDate, type: 'expense', amountPln: data.amountPln,
            description: desc, sourceType: 'investment', sourceId: invId,
          });
        } else if (invPayment === 'immediate' && invAccountId) {
          const scope = invScope || activities[0]?.key || 'ferma';
          await cashFlowService.createTransaction({
            accountId:   Number(invAccountId),
            date:        data.purchaseDate,
            type:        'expense',
            scope,
            category:    'Inwestycje',
            description: desc,
            amountPln:   data.amountPln,
            sourceType:  'investment',
            sourceId:    invId,
          });
        }
      }
      reset();
      setInvPayment('pending');
      setInvAccountId('');
      setShowForm(false);
      setEditTarget(null);
    } catch (e) {
      console.error('Błąd zapisu inwestycji:', e);
      setSubmitError(errMsg(e));
    }
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

      <div><HelpLink query="amortyzacja inwestycji w gospodarstwie rolnym kurnik chłodnia" /></div>

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

          {/* ── Rozliczenie kasowe (tylko nowe wpisy) ─────────────────────── */}
          {!editTarget && cashAccounts.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kasa i bank</div>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setInvPayment('pending')}
                  className={`flex-1 py-2 transition-colors ${invPayment === 'pending' ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  📅 Do rozliczenia
                </button>
                <button
                  type="button"
                  onClick={() => setInvPayment('immediate')}
                  className={`flex-1 py-2 border-l border-gray-200 transition-colors ${invPayment === 'immediate' ? 'bg-red-50 text-red-700 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  💸 Zapłacono od razu
                </button>
              </div>

              {invPayment === 'immediate' && (
                <div className="space-y-2">
                  <select
                    value={invAccountId}
                    onChange={e => setInvAccountId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">— Wybierz konto —</option>
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  {activities.length > 0 && (
                    <select
                      value={invScope}
                      onChange={e => setInvScope(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">— Przypisz do działalności —</option>
                      {activities.map(a => (
                        <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {invPayment === 'pending' && (
                <p className="text-xs text-orange-600">
                  Pojawi się w Kasie i Banku → Do rozliczenia. Zatwierdź gdy zapłacisz.
                </p>
              )}
            </div>
          )}

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              ⚠ {submitError}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={invPayment === 'immediate' && !editTarget && !invAccountId}
              className="flex-1"
            >
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
