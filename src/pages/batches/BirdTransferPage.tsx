import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBatch, useBatches } from '@/hooks/useBatch';
import { useBirdTransfersByBatch } from '@/hooks/useTableData';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { BATCH_STATUS_LABELS } from '@/constants/phases';
import { formatDate, todayISO } from '@/utils/date';
import { birdTransferService } from '@/services/birdTransfer.service';
import { batchService } from '@/services/batch.service';
import { TRANSFER_REASON_LABELS, type TransferReason } from '@/models/birdTransfer.model';

export function BirdTransferPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();

  const transfers  = useBirdTransfersByBatch(id);
  const allBatches = useBatches();

  const [showModal, setShowModal] = React.useState(false);
  const [date, setDate]         = React.useState(todayISO());
  const [direction, setDir]     = React.useState<'out' | 'in'>('out');
  const [targetBatch, setTarget] = React.useState('');
  const [count, setCount]       = React.useState(1);
  const [reason, setReason]     = React.useState<TransferReason>('reorganizacja');
  const [notes, setNotes]       = React.useState('');
  const [saving, setSaving]         = React.useState(false);
  const [autoClosed, setAutoClosed] = React.useState(false);
  const [saveError, setSaveError]   = React.useState<string | null>(null);

  const otherBatches = allBatches.filter(b => b.id !== id);

  if (!batch) return <PageLoader />;

  async function save() {
    if (!targetBatch || count < 1) return;
    setSaving(true);
    setSaveError(null);
    try {
      const fromId = direction === 'out' ? id : Number(targetBatch);
      await birdTransferService.create({
        transferDate: date,
        fromBatchId: fromId,
        toBatchId:   direction === 'out' ? Number(targetBatch) : id,
        count,
        reason,
        notes: notes.trim() || undefined,
      });
      const toId = direction === 'out' ? Number(targetBatch) : id;
      const [didClose] = await Promise.all([
        batchService.checkAndAutoClose(fromId),
        batchService.checkAndAutoReopen(toId),
      ]);
      setShowModal(false);
      setNotes('');
      setCount(1);
      if (didClose && fromId === id) setAutoClosed(true);
    } catch (err: any) {
      console.error('Błąd zapisu przesunięcia ptaków:', err);
      const detail = err?.message || err?.error_description || err?.details || err?.hint || err?.code;
      setSaveError(
        detail
          ? `Nie udało się zapisać przesunięcia: ${detail}`
          : 'Nie udało się zapisać przesunięcia. Sprawdź połączenie i spróbuj ponownie.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(transferId: number) {
    if (confirm('Usunąć to przesunięcie?')) await birdTransferService.delete(transferId);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-900">Przesunięcia ptaków</h1>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} icon={<span>+</span>}>
          Przesuń
        </Button>
      </div>
      <div className="text-sm text-gray-500">{batch.name}</div>

      {autoClosed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800 flex items-center gap-2">
          <span>✅</span>
          <span>Stado zostało automatycznie zamknięte – stan ptaków wynosi 0. Przeniesione do historii.</span>
        </div>
      )}

      <Card padding={transfers.length === 0 ? undefined : 'none'}>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-400">Brak przesunięć dla tego stada.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {transfers.map(t => {
              const isOut = t.fromBatchId === id;
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
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                ⚠️ {saveError}
              </div>
            )}
            <Button className="w-full" onClick={save} disabled={saving || !targetBatch || count < 1}>
              {saving ? 'Zapisywanie…' : 'Zapisz przesunięcie'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
