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
import { BATCH_STATUS_LABELS } from '@/constants/phases';
import { formatDate, ageLabel, todayISO } from '@/utils/date';
import { formatPln, formatPercent, formatFCR, formatGrams, formatKg } from '@/utils/format';
import { healthService } from '@/services/health.service';
import { birdTransferService } from '@/services/birdTransfer.service';
import { TRANSFER_REASON_LABELS, type TransferReason } from '@/models/birdTransfer.model';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { addDays, parseISO, isAfter } from 'date-fns';
import { BatchPhotosSection } from './BatchPhotosSection';

const statusBadgeColor: Record<string, 'green' | 'blue' | 'gray' | 'yellow'> = {
  active: 'green',
  completed: 'blue',
  sold: 'gray',
  archived: 'yellow',
};

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
  const [saving, setSaving]     = React.useState(false);

  const otherBatches = allBatches.filter(b => b.id !== batchId);

  async function save() {
    if (!targetBatch || count < 1) return;
    setSaving(true);
    await birdTransferService.create({
      transferDate: date,
      fromBatchId: direction === 'out' ? batchId : Number(targetBatch),
      toBatchId:   direction === 'out' ? Number(targetBatch) : batchId,
      count,
      reason,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    setShowModal(false);
    setNotes('');
    setCount(1);
  }

  async function remove(id: number) {
    if (confirm('Usunąć to przesunięcie?')) await birdTransferService.delete(id);
  }

  return (
    <>
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
                ...otherBatches.map(b => ({ value: String(b.id), label: b.name })),
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
          />
          <KPICard
            label="Upadki"
            value={formatPercent(kpis.mortalityPercent)}
            sub={`${kpis.totalMortality} szt.`}
            icon="📉"
            color={kpis.mortalityPercent > 5 ? 'red' : 'gray'}
          />
          <KPICard
            label="FCR"
            value={formatFCR(kpis.fcr)}
            icon="🌾"
            color={kpis.fcr != null && kpis.fcr < 1.8 ? 'green' : 'orange'}
          />
          {isLayer ? (
            <KPICard
              label="Produkcja jaj"
              value={kpis.totalEggsCollected.toLocaleString('pl-PL')}
              sub="jaj"
              icon="🥚"
              color="orange"
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
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-xs text-green-700 font-medium">Przychód</div>
            <div className="text-lg font-bold text-green-800">{formatPln(kpis.totalRevenuePln)}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <div className="text-xs text-red-700 font-medium">Koszty</div>
            <div className="text-lg font-bold text-red-800">{formatPln(kpis.totalCostPln)}</div>
          </div>
          <div className={`${kpis.grossMarginPln >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-xl p-3 text-center`}>
            <div className={`text-xs font-medium ${kpis.grossMarginPln >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Marża</div>
            <div className={`text-lg font-bold ${kpis.grossMarginPln >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              {formatPln(kpis.grossMarginPln)}
            </div>
          </div>
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
    </div>
  );
}
