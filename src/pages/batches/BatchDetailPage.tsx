import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useBatch } from '@/hooks/useBatch';
import { useKPIs } from '@/hooks/useKPIs';
import { KPICard } from '@/components/charts/KPICard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { SPECIES_LABELS, SPECIES_EMOJI, isLayerSpecies } from '@/constants/species';
import { BATCH_STATUS_LABELS, SALE_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '@/constants/phases';
import { formatDate, ageLabel, todayISO } from '@/utils/date';
import { formatPln, formatPercent, formatFCR, formatGrams, formatKg } from '@/utils/format';
import { healthService } from '@/services/health.service';
import { birdTransferService } from '@/services/birdTransfer.service';
import { batchService } from '@/services/batch.service';
import { TRANSFER_REASON_LABELS, type TransferReason } from '@/models/birdTransfer.model';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { addDays, parseISO, isAfter } from 'date-fns';
import { BatchPhotosSection } from './BatchPhotosSection';
import type { BatchKPIResult } from '@/engine/types';
import type { Batch } from '@/models/batch.model';

const statusBadgeColor: Record<string, 'green' | 'blue' | 'gray' | 'yellow'> = {
  active: 'green',
  completed: 'blue',
  sold: 'gray',
  archived: 'yellow',
};

// ── Pomocnicze UI ────────────────────────────────────────────────────────────

function DetailRow({ label, value, sub, bold, indent }: {
  label: string; value: string; sub?: string; bold?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-3 border-l-2 border-gray-100' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <div className="text-right">
        <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{value}</span>
        {sub && <span className="text-xs text-gray-400 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-1 first:mt-0">
      {children}
    </div>
  );
}

// ── Modalne szczegółów KPI ────────────────────────────────────────────────────

type KPIModalType = 'revenue' | 'costs' | 'margin' | 'mortality' | 'fcr' | 'birds' | 'eggs';

function KPIDetailModal({
  type, kpis, batch, onClose,
}: {
  type: KPIModalType;
  kpis: BatchKPIResult;
  batch: Batch;
  onClose: () => void;
}) {
  const batchId = batch.id!;

  const sales = useLiveQuery(
    () => db.sales.where('batchId').equals(batchId).sortBy('saleDate'),
    [batchId]
  ) ?? [];

  const expenses = useLiveQuery(
    () => db.expenses.where('batchId').equals(batchId).sortBy('expenseDate'),
    [batchId]
  ) ?? [];

  const slaughter = useLiveQuery(
    () => db.slaughterRecords.where('batchId').equals(batchId).sortBy('slaughterDate'),
    [batchId]
  ) ?? [];

  const deaths = useLiveQuery(
    () => db.dailyEntries
      .where('batchId').equals(batchId)
      .filter(e => e.deadCount > 0 || e.culledCount > 0)
      .sortBy('date'),
    [batchId]
  ) ?? [];

  const transfers = useLiveQuery(
    () => birdTransferService.getByBatch(batchId),
    [batchId]
  ) ?? [];

  const allBatches = useLiveQuery(() => db.batches.toArray(), []) ?? [];

  const titles: Record<KPIModalType, string> = {
    revenue:  'Szczegóły przychodów',
    costs:    'Szczegóły kosztów',
    margin:   'Wynik finansowy',
    mortality:'Szczegóły upadków',
    fcr:      'Jak wyliczono FCR',
    birds:    'Stan stada – skład',
    eggs:     'Produkcja jaj',
  };

  function renderRevenue() {
    const soldLive  = sales.filter(s => s.saleType === 'ptaki_zywe');
    const soldEggs  = sales.filter(s => s.saleType === 'jaja' || s.saleType === 'jaja_wewn');
    const soldCarcass = sales.filter(s => s.saleType === 'tuszki' || s.saleType === 'elementy');
    const slaughterRevenue = slaughter.reduce((s, r) => s + (r.totalRevenuePln ?? 0), 0);

    const groups = [
      { label: 'Ptaki żywe', items: soldLive },
      { label: 'Tuszki / elementy', items: soldCarcass },
      { label: 'Jaja', items: soldEggs },
    ].filter(g => g.items.length > 0);

    return (
      <div className="space-y-1">
        {slaughterRevenue > 0 && (
          <>
            <SectionHeader>Przychód z uboju</SectionHeader>
            {slaughter.filter(r => r.totalRevenuePln).map(r => (
              <DetailRow
                key={r.id}
                indent
                label={formatDate(r.slaughterDate)}
                value={formatPln(r.totalRevenuePln ?? 0)}
                sub={`${r.birdsSlaughtered} szt. · ${formatKg(r.carcassWeightTotalKg)}`}
              />
            ))}
          </>
        )}
        {groups.map(g => (
          <React.Fragment key={g.label}>
            <SectionHeader>{g.label}</SectionHeader>
            {g.items.map(s => (
              <DetailRow
                key={s.id}
                indent
                label={`${formatDate(s.saleDate)}${s.buyerName ? ` · ${s.buyerName}` : ''}`}
                value={formatPln(s.totalRevenuePln)}
                sub={
                  s.saleType === 'jaja' || s.saleType === 'jaja_wewn'
                    ? `${s.eggsCount?.toLocaleString('pl-PL') ?? '—'} szt.`
                    : s.weightKg ? formatKg(s.weightKg) : s.birdCount ? `${s.birdCount} szt.` : undefined
                }
              />
            ))}
          </React.Fragment>
        ))}
        {groups.length === 0 && slaughterRevenue === 0 && (
          <p className="text-sm text-gray-400 py-2 text-center">Brak zarejestrowanych sprzedaży.</p>
        )}
        <div className="border-t border-gray-200 mt-3 pt-3">
          <DetailRow label="Łączny przychód" value={formatPln(kpis.totalRevenuePln)} bold />
        </div>
      </div>
    );
  }

  function renderCosts() {
    const cb = kpis.costBreakdown;
    const categoryOrder: Array<keyof typeof EXPENSE_CATEGORY_LABELS> = [
      'piskleta', 'pasza', 'leki', 'weterynarz', 'energia', 'praca', 'transport', 'sciolka', 'inne',
    ];

    const chickCost = (batch.chick_cost_per_unit ?? 0) * batch.initialCount + (batch.transport_cost ?? 0);

    return (
      <div className="space-y-1">
        <SectionHeader>Pisklęta i zakup</SectionHeader>
        {chickCost > 0 && (
          <DetailRow indent label={`${batch.initialCount} szt. × ${formatPln(batch.chick_cost_per_unit ?? 0)}`} value={formatPln((batch.chick_cost_per_unit ?? 0) * batch.initialCount)} />
        )}
        {(batch.transport_cost ?? 0) > 0 && (
          <DetailRow indent label="Transport zakupu" value={formatPln(batch.transport_cost ?? 0)} />
        )}
        {expenses.filter(e => e.category === 'piskleta').map(e => (
          <DetailRow key={e.id} indent label={`${formatDate(e.expenseDate)}${e.description ? ` · ${e.description}` : ''}`} value={formatPln(e.amountPln)} />
        ))}

        <SectionHeader>Pasza</SectionHeader>
        <DetailRow indent label="Koszt pasz (z katalogu)" value={formatPln(cb.pasza)} />
        {expenses.filter(e => e.category === 'pasza').map(e => (
          <DetailRow key={e.id} indent label={`${formatDate(e.expenseDate)}${e.description ? ` · ${e.description}` : ''}`} value={formatPln(e.amountPln)} />
        ))}

        {categoryOrder.slice(2).map(cat => {
          const catExpenses = expenses.filter(e => e.category === cat);
          const catTotal = cb[cat as keyof typeof cb] as number;
          if (catExpenses.length === 0) return null;
          return (
            <React.Fragment key={cat}>
              <SectionHeader>{EXPENSE_CATEGORY_LABELS[cat]}</SectionHeader>
              {catExpenses.map(e => (
                <DetailRow key={e.id} indent label={`${formatDate(e.expenseDate)}${e.description ? ` · ${e.description}` : ''}`} value={formatPln(e.amountPln)} />
              ))}
            </React.Fragment>
          );
        })}

        <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
          {categoryOrder.map(cat => {
            const v = cb[cat as keyof typeof cb] as number;
            if (!v) return null;
            return <DetailRow key={cat} label={EXPENSE_CATEGORY_LABELS[cat]} value={formatPln(v)} />;
          })}
          <DetailRow label="Łączne koszty" value={formatPln(kpis.totalCostPln)} bold />
        </div>
      </div>
    );
  }

  function renderMargin() {
    const marginPct = kpis.grossMarginPercent;
    return (
      <div className="space-y-1">
        <SectionHeader>Wynik</SectionHeader>
        <DetailRow label="Przychód" value={formatPln(kpis.totalRevenuePln)} />
        <DetailRow label="Koszty" value={`−${formatPln(kpis.totalCostPln)}`} />
        <div className="border-t border-gray-200 mt-2 pt-2">
          <DetailRow label="Marża brutto" value={formatPln(kpis.grossMarginPln)} bold />
          {marginPct != null && (
            <DetailRow label="Rentowność" value={formatPercent(marginPct)} />
          )}
        </div>
        {kpis.costPerKgWeightGainPln != null && (
          <>
            <SectionHeader>Efektywność</SectionHeader>
            <DetailRow label="Koszt / kg przyrostu" value={formatPln(kpis.costPerKgWeightGainPln)} />
          </>
        )}
        {kpis.costPerEggPln != null && (
          <DetailRow label="Koszt / jajko" value={formatPln(kpis.costPerEggPln)} />
        )}
        {kpis.avgDressingPercent != null && (
          <DetailRow label="Wydajność tuszki" value={formatPercent(kpis.avgDressingPercent)} />
        )}
      </div>
    );
  }

  function renderMortality() {
    const totalDead   = deaths.reduce((s, e) => s + e.deadCount, 0);
    const totalCulled = deaths.reduce((s, e) => s + e.culledCount, 0);
    return (
      <div className="space-y-1">
        <SectionHeader>Podsumowanie</SectionHeader>
        <DetailRow label="Padnięcia" value={`${totalDead} szt.`} />
        <DetailRow label="Wybrakowane" value={`${totalCulled} szt.`} />
        <DetailRow label="Łącznie strat" value={`${kpis.totalMortality} szt.`} bold />
        <DetailRow label="Upadkowość" value={formatPercent(kpis.mortalityPercent)} />

        {deaths.length > 0 && (
          <>
            <SectionHeader>Wpisy z upadkami</SectionHeader>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {deaths.map(e => (
                <div key={e.id} className="flex justify-between items-center py-1 indent border-l-2 border-gray-100 pl-3">
                  <span className="text-sm text-gray-600">{formatDate(e.date)}</span>
                  <div className="flex gap-3 text-sm font-medium">
                    {e.deadCount > 0 && <span className="text-red-600">💀 {e.deadCount}</span>}
                    {e.culledCount > 0 && <span className="text-orange-500">✂️ {e.culledCount}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderFCR() {
    const initialWeightG  = batch.initialWeightGrams ?? 42;
    const initialWeightKg = (initialWeightG * batch.initialCount) / 1000;
    const slaughterWeight = slaughter.reduce((s, r) => s + r.liveWeightTotalKg, 0);
    const liveSalesWeight = sales
      .filter(s => s.saleType === 'ptaki_zywe')
      .reduce((s, sale) => s + (sale.weightKg ?? 0), 0);
    const remainingWeight = kpis.currentAvgWeightGrams != null
      ? (kpis.currentAvgWeightGrams * kpis.currentBirdCount) / 1000
      : 0;
    const totalProduced = slaughterWeight + liveSalesWeight + remainingWeight;
    const totalGain     = totalProduced - initialWeightKg;

    return (
      <div className="space-y-1">

        {/* Krok 1: pasza */}
        <SectionHeader>Krok 1 – łączne zużycie paszy</SectionHeader>
        <DetailRow label="Pasza" value={`${kpis.totalFeedKg.toFixed(1)} kg`} bold />

        {/* Krok 2: żywiec */}
        <SectionHeader>Krok 2 – łączna masa żywca wyprodukowanego</SectionHeader>
        {slaughter.length > 0 && (
          <DetailRow indent
            label={`Ubój (${slaughter.reduce((s,r)=>s+r.birdsSlaughtered,0)} szt.)`}
            value={`${slaughterWeight.toFixed(1)} kg`}
          />
        )}
        {liveSalesWeight > 0 && (
          <DetailRow indent label="Sprzedane żywe (z wagą)" value={`${liveSalesWeight.toFixed(1)} kg`} />
        )}
        {kpis.currentBirdCount > 0 && (
          <DetailRow indent
            label={`Pozostałe w stadzie (${kpis.currentBirdCount} szt. × ${kpis.currentAvgWeightGrams != null ? `${kpis.currentAvgWeightGrams} g` : 'brak ważenia'})`}
            value={`${remainingWeight.toFixed(1)} kg`}
          />
        )}
        <DetailRow label="Żywiec łącznie" value={`${totalProduced.toFixed(1)} kg`} bold />

        {/* Krok 3: odejmujemy masę wejściową */}
        <SectionHeader>Krok 3 – odejmij masę wejściową piskląt</SectionHeader>
        <div className="bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-800">
          {batch.initialCount} szt. × {initialWeightG} g/szt. = {initialWeightKg.toFixed(1)} kg
          {initialWeightG === 42 && !batch.initialWeightGrams && (
            <span className="ml-2 text-amber-600 font-medium">(wartość domyślna – uzupełnij w edycji stada)</span>
          )}
        </div>

        {/* Krok 4: przyrost netto */}
        <SectionHeader>Krok 4 – przyrost netto masy</SectionHeader>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-700">
          {totalProduced.toFixed(1)} − {initialWeightKg.toFixed(1)} = <span className="font-bold text-gray-900">{totalGain.toFixed(1)} kg</span>
        </div>

        {/* Wynik FCR */}
        <SectionHeader>Wynik FCR</SectionHeader>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 font-mono mb-1">
            {kpis.totalFeedKg.toFixed(1)} kg ÷ {totalGain.toFixed(1)} kg
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatFCR(kpis.fcr)}</div>
          <div className="text-xs text-gray-400 mt-0.5">kg paszy na kg przyrostu masy</div>
        </div>
      </div>
    );
  }

  function renderBirds() {
    const dead       = kpis.totalMortality;
    const slaughtered = slaughter.reduce((s, r) => s + r.birdsSlaughtered, 0);
    const soldLive   = sales.filter(s => s.saleType === 'ptaki_zywe').reduce((s, x) => s + (x.birdCount ?? 0), 0);
    const transOut   = transfers.filter(t => t.fromBatchId === batchId).reduce((s, t) => s + t.count, 0);
    const transIn    = transfers.filter(t => t.toBatchId   === batchId).reduce((s, t) => s + t.count, 0);

    return (
      <div className="space-y-1">
        <DetailRow label="Stan początkowy" value={`${batch.initialCount} szt.`} bold />
        <div className="space-y-0.5 mt-1">
          {dead > 0       && <DetailRow indent label="Padnięcia i wybrakowane" value={`−${dead} szt.`} />}
          {slaughtered > 0 && <DetailRow indent label="Ubój" value={`−${slaughtered} szt.`} />}
          {soldLive > 0   && <DetailRow indent label="Sprzedane żywe" value={`−${soldLive} szt.`} />}
          {transOut > 0   && <DetailRow indent label="Przeniesione do innych stad" value={`−${transOut} szt.`} />}
          {transIn > 0    && <DetailRow indent label="Przyjęte z innych stad" value={`+${transIn} szt.`} />}
        </div>
        <div className="border-t border-gray-200 mt-2 pt-2">
          <DetailRow label="Aktualny stan" value={`${kpis.currentBirdCount} szt.`} bold />
        </div>
        {transfers.length > 0 && (
          <>
            <SectionHeader>Przesunięcia</SectionHeader>
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {transfers.map(t => {
                const isOut = t.fromBatchId === batchId;
                const other = allBatches.find(b => b.id === (isOut ? t.toBatchId : t.fromBatchId));
                return (
                  <div key={t.id} className="flex justify-between items-center py-1 pl-3 border-l-2 border-gray-100">
                    <span className="text-sm text-gray-600">{formatDate(t.transferDate)} · {other?.name ?? '—'}</span>
                    <span className={`text-sm font-medium ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                      {isOut ? '−' : '+'}{t.count} szt.
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderEggs() {
    const total = kpis.totalEggsCollected;
    const perBird = kpis.eggsPerBirdLifetime;
    const henDay = kpis.henDayProductionPercent;
    const eggSales = sales.filter(s => s.saleType === 'jaja' || s.saleType === 'jaja_wewn');
    const totalSold = eggSales.reduce((s, x) => s + (x.eggsCount ?? 0), 0);
    return (
      <div className="space-y-1">
        <SectionHeader>Produkcja</SectionHeader>
        <DetailRow label="Zebrane jaja łącznie" value={`${total.toLocaleString('pl-PL')} szt.`} bold />
        {perBird != null && <DetailRow label="Na nioskę" value={`${perBird.toFixed(1)} szt.`} />}
        {henDay  != null && <DetailRow label="Hen-day %" value={formatPercent(henDay)} />}
        <SectionHeader>Sprzedaż jaj</SectionHeader>
        {eggSales.length === 0
          ? <p className="text-sm text-gray-400 pl-3">Brak wpisów sprzedaży jaj.</p>
          : eggSales.map(s => (
            <DetailRow key={s.id} indent
              label={`${formatDate(s.saleDate)}${s.buyerName ? ` · ${s.buyerName}` : ''}`}
              value={formatPln(s.totalRevenuePln)}
              sub={`${s.eggsCount?.toLocaleString('pl-PL') ?? '—'} szt.`}
            />
          ))
        }
        {totalSold > 0 && (
          <div className="border-t border-gray-100 pt-1">
            <DetailRow label="Sprzedano łącznie" value={`${totalSold.toLocaleString('pl-PL')} szt.`} />
            <DetailRow label="Na stanie (szac.)" value={`${Math.max(0, total - totalSold).toLocaleString('pl-PL')} szt.`} />
          </div>
        )}
      </div>
    );
  }

  const content: Record<KPIModalType, () => React.ReactNode> = {
    revenue:  renderRevenue,
    costs:    renderCosts,
    margin:   renderMargin,
    mortality:renderMortality,
    fcr:      renderFCR,
    birds:    renderBirds,
    eggs:     renderEggs,
  };

  return (
    <Modal open title={titles[type]} onClose={onClose}>
      <div className="divide-y-0">{content[type]()}</div>
    </Modal>
  );
}

// ── Sekcja przesunięć ptaków ─────────────────────────────────────────────────
function BirdTransferSection({ batchId }: { batchId: number }) {
  const transfers = useLiveQuery(
    () => birdTransferService.getByBatch(batchId),
    [batchId]
  ) ?? [];
  const allBatches = useLiveQuery(() => db.batches.toArray(), []) ?? [];

  const [showModal, setShowModal] = React.useState(false);
  const [date, setDate]         = React.useState(todayISO());
  const [direction, setDir]     = React.useState<'out' | 'in'>('out');
  const [targetBatch, setTarget] = React.useState('');
  const [count, setCount]       = React.useState(1);
  const [reason, setReason]     = React.useState<TransferReason>('reorganizacja');
  const [notes, setNotes]       = React.useState('');
  const [saving, setSaving]         = React.useState(false);
  const [autoClosed, setAutoClosed] = React.useState(false);

  const otherBatches = allBatches.filter(b => b.id !== batchId);

  async function save() {
    if (!targetBatch || count < 1) return;
    setSaving(true);
    const fromId = direction === 'out' ? batchId : Number(targetBatch);
    await birdTransferService.create({
      transferDate: date,
      fromBatchId: fromId,
      toBatchId:   direction === 'out' ? Number(targetBatch) : batchId,
      count,
      reason,
      notes: notes.trim() || undefined,
    });
    const toId = direction === 'out' ? Number(targetBatch) : batchId;
    const [didClose] = await Promise.all([
      batchService.checkAndAutoClose(fromId),
      batchService.checkAndAutoReopen(toId),
    ]);
    setSaving(false);
    setShowModal(false);
    setNotes('');
    setCount(1);
    if (didClose && fromId === batchId) setAutoClosed(true);
  }

  async function remove(id: number) {
    if (confirm('Usunąć to przesunięcie?')) await birdTransferService.delete(id);
  }

  return (
    <>
      {autoClosed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-center gap-2">
          <span>✅</span>
          <span>Stado zostało automatycznie zamknięte – stan ptaków wynosi 0. Przeniesione do historii.</span>
        </div>
      )}

      <Card
        title="Przesunięcia ptaków"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="text-sm text-brand-700 hover:underline"
          >
            + Przesuń
          </button>
        }
        padding={transfers.length === 0 ? undefined : 'none'}
      >
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-400">Brak przesunięć dla tego stada.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {transfers.map(t => {
              const isOut = t.fromBatchId === batchId;
              const other = allBatches.find(b => b.id === (isOut ? t.toBatchId : t.fromBatchId));
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-lg ${isOut ? 'text-red-500' : 'text-green-500'}`}>
                    {isOut ? '↗' : '↙'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">
                      {isOut ? 'Do' : 'Z'}: <span className="font-medium">{other?.name ?? `#${isOut ? t.toBatchId : t.fromBatchId}`}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(t.transferDate)} · {TRANSFER_REASON_LABELS[t.reason]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                      {isOut ? '−' : '+'}{t.count} szt.
                    </div>
                  </div>
                  <button
                    onClick={() => remove(t.id!)}
                    className="text-gray-300 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showModal && (
        <Modal open title="Przesunięcie ptaków" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Select
              label="Kierunek"
              value={direction}
              onChange={e => setDir(e.target.value as 'out' | 'in')}
              options={[
                { value: 'out', label: '↗ Wysyłam ptaki do innego stada' },
                { value: 'in',  label: '↙ Przyjmuję ptaki z innego stada' },
              ]}
            />
            <Select
              label={direction === 'out' ? 'Stado docelowe' : 'Stado źródłowe'}
              value={targetBatch}
              onChange={e => setTarget(e.target.value)}
              options={[
                { value: '', label: '— wybierz stado —' },
                ...otherBatches.map(b => ({
                  value: String(b.id),
                  label: b.status !== 'active' ? `${b.name} (${BATCH_STATUS_LABELS[b.status]})` : b.name,
                })),
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Liczba ptaków"
                type="number" min={1} value={count}
                onChange={e => setCount(Number(e.target.value))}
              />
              <Select
                label="Powód"
                value={reason}
                onChange={e => setReason(e.target.value as TransferReason)}
                options={Object.entries(TRANSFER_REASON_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
            <Textarea
              label="Uwagi (opcjonalnie)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
            <Button className="w-full" onClick={save} disabled={saving || !targetBatch || count < 1}>
              {saving ? 'Zapisywanie…' : 'Zapisz przesunięcie'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const kpis = useKPIs(id);
  const navigate = useNavigate();
  const [kpiModal, setKpiModal] = React.useState<KPIModalType | null>(null);

  const withdrawals = useLiveQuery(async () => {
    if (!id) return [];
    return healthService.getActiveWithdrawals(id);
  }, [id]) ?? [];

  if (!batch) return <PageLoader />;

  const isLayer = isLayerSpecies(batch.species);

  const modules = [
    { to: 'dziennik', label: 'Dziennik dzienny', icon: '📅', desc: 'Wpisy dzienne – pasza, jaja, padnięcia' },
    { to: 'wazenia', label: 'Ważenia', icon: '⚖️', desc: 'Historia ważeń i krzywa wzrostu' },
    { to: 'zdrowie', label: 'Zdrowie', icon: '💊', desc: 'Zdarzenia zdrowotne i padnięcia' },
    { to: 'warunki', label: 'Warunki', icon: '🌡️', desc: 'Temperatura, wilgotność, ściółka' },
    { to: 'uboj', label: 'Ubój', icon: '🔪', desc: 'Rekordy uboju i wydajność tuszki' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/stada')} className="text-gray-400 hover:text-gray-600 mt-1">
          ←
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xl">{SPECIES_EMOJI[batch.species]}</span>
            <h1 className="text-xl font-bold text-gray-900">{batch.name}</h1>
            <Badge color={statusBadgeColor[batch.status]}>
              {BATCH_STATUS_LABELS[batch.status]}
            </Badge>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {SPECIES_LABELS[batch.species]} · Wiek: {ageLabel(batch.startDate)} · Wstawiono: {formatDate(batch.startDate)}
            {batch.housingId && ` · ${batch.housingId}`}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/stada/${id}/edytuj`)}>
          Edytuj
        </Button>
      </div>

      {/* Withdrawal alert */}
      {withdrawals.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-red-800">Aktywna karencja lekowa!</div>
              {withdrawals.map(w => (
                <div key={w.id} className="text-xs text-red-700 mt-0.5">
                  {w.medicationName ?? w.diagnosis}: do {addDays(parseISO(w.eventDate), w.withdrawalPeriodDays!).toLocaleDateString('pl-PL')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Aktualnie ptaków"
            value={kpis.currentBirdCount.toLocaleString('pl-PL')}
            sub="szt."
            icon="🐔"
            color="green"
            onClick={() => setKpiModal('birds')}
          />
          <KPICard
            label="Upadki"
            value={formatPercent(kpis.mortalityPercent)}
            sub={`${kpis.totalMortality} szt.`}
            icon="📉"
            color={kpis.mortalityPercent > 5 ? 'red' : 'gray'}
            onClick={kpis.totalMortality > 0 ? () => setKpiModal('mortality') : undefined}
          />
          <KPICard
            label="FCR"
            value={formatFCR(kpis.fcr)}
            icon="🌾"
            color={kpis.fcr != null && kpis.fcr < 1.8 ? 'green' : 'orange'}
            onClick={kpis.fcr != null ? () => setKpiModal('fcr') : undefined}
          />
          {isLayer ? (
            <KPICard
              label="Produkcja jaj"
              value={kpis.totalEggsCollected.toLocaleString('pl-PL')}
              sub="jaj"
              icon="🥚"
              color="orange"
              onClick={kpis.totalEggsCollected > 0 ? () => setKpiModal('eggs') : undefined}
            />
          ) : (
            <KPICard
              label="Masa śr."
              value={kpis.currentAvgWeightGrams != null ? formatGrams(kpis.currentAvgWeightGrams) : '—'}
              icon="⚖️"
              color="blue"
            />
          )}
        </div>
      )}

      {/* Finance summary */}
      {kpis && (
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setKpiModal('revenue')}
            className="bg-green-50 rounded-xl p-3 text-center hover:bg-green-100 transition-colors active:scale-[0.98]"
          >
            <div className="text-xs text-green-700 font-medium">Przychód</div>
            <div className="text-lg font-bold text-green-800">{formatPln(kpis.totalRevenuePln)}</div>
            <div className="text-xs text-green-600 mt-0.5">szczegóły →</div>
          </button>
          <button
            onClick={() => setKpiModal('costs')}
            className="bg-red-50 rounded-xl p-3 text-center hover:bg-red-100 transition-colors active:scale-[0.98]"
          >
            <div className="text-xs text-red-700 font-medium">Koszty</div>
            <div className="text-lg font-bold text-red-800">{formatPln(kpis.totalCostPln)}</div>
            <div className="text-xs text-red-500 mt-0.5">szczegóły →</div>
          </button>
          <button
            onClick={() => setKpiModal('margin')}
            className={`${kpis.grossMarginPln >= 0 ? 'bg-blue-50 hover:bg-blue-100' : 'bg-orange-50 hover:bg-orange-100'} rounded-xl p-3 text-center transition-colors active:scale-[0.98]`}
          >
            <div className={`text-xs font-medium ${kpis.grossMarginPln >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Marża</div>
            <div className={`text-lg font-bold ${kpis.grossMarginPln >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              {formatPln(kpis.grossMarginPln)}
            </div>
            <div className={`text-xs mt-0.5 ${kpis.grossMarginPln >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>szczegóły →</div>
          </button>
        </div>
      )}

      {/* Module navigation */}
      <Card title="Moduły" padding="none">
        <div className="divide-y divide-gray-50">
          {modules.map(m => (
            <Link
              key={m.to}
              to={`/stada/${id}/${m.to}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">{m.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{m.label}</div>
                <div className="text-xs text-gray-500">{m.desc}</div>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </Card>

      {/* Galeria zdjęć */}
      <BatchPhotosSection batchId={id} />

      {/* Przesunięcia ptaków */}
      <BirdTransferSection batchId={id} />

      {/* Quick add daily entry */}
      <div className="flex gap-3">
        <Link
          to={`/stada/${id}/dziennik/nowy`}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-700 text-white rounded-xl font-medium hover:bg-brand-800"
        >
          📝 Dodaj wpis dzienny
        </Link>
      </div>

      {/* Modale szczegółów KPI */}
      {kpiModal && kpis && (
        <KPIDetailModal
          type={kpiModal}
          kpis={kpis}
          batch={batch}
          onClose={() => setKpiModal(null)}
        />
      )}
    </div>
  );
}
