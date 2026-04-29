import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { hatchingEggService } from '@/services/hatchingEgg.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import {
  HATCHING_EGG_SOURCE_LABELS,
  type HatchingEggSourceType,
} from '@/models/hatchingEgg.model';
import { ACTIVE_SPECIES, SPECIES_LABELS, SPECIES_EMOJI, isLayerSpecies } from '@/constants/species';
import type { Species } from '@/constants/species';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';

export function HatchingEggPage() {
  const lotsRaw    = useLiveQuery(() => db.hatchingEggLots.orderBy('entryDate').reverse().toArray(), []) ?? [];
  const allGroups  = useLiveQuery(() => db.incubationEggGroups.toArray(), []) ?? [];
  const allBatches = useLiveQuery(() => db.batches.where('status').equals('active').toArray(), []) ?? [];

  // Statystyki magazynu sprzedażowego (do walidacji przy przeniesienie)
  const allDailyEntries  = useLiveQuery(() => db.dailyEntries.toArray(), []) ?? [];
  const allSalesBatches  = useLiveQuery(() => db.batches.toArray(), []) ?? [];
  const eggPurchases     = useLiveQuery(() => db.eggPurchases.toArray(), []) ?? [];
  const eggHatchTransfers = useLiveQuery(() => db.eggHatchTransfers.toArray(), []) ?? [];
  const sales            = useLiveQuery(() => db.sales.toArray(), []) ?? [];

  const mainEggStats = React.useMemo(() => {
    const layerIds      = new Set(allSalesBatches.filter(b => isLayerSpecies(b.species)).map(b => b.id!));
    const layerEntries  = allDailyEntries.filter(e => layerIds.has(e.batchId));
    const collected     = layerEntries.reduce((s, e) => s + (e.eggsCollected ?? 0) - (e.eggsDefective ?? 0), 0);
    const purchased     = eggPurchases.reduce((s, p) => s + p.count, 0);
    const sold          = sales.filter(s => s.saleType === 'jaja').reduce((s, x) => s + (x.eggsCount ?? 0), 0);
    const transferred   = eggHatchTransfers.reduce((s, t) => s + t.count, 0);
    return Math.max(0, collected + purchased - sold - transferred);
  }, [allSalesBatches, allDailyEntries, eggPurchases, eggHatchTransfers, sales]);

  // Oblicz dostępność per partia
  const lots = lotsRaw.map(lot => {
    const used = allGroups
      .filter(g => (g as any).hatchingEggLotId === lot.id)
      .reduce((s, g) => s + g.count, 0);
    return { ...lot, usedCount: used, availableCount: Math.max(0, lot.count - used) };
  });

  const totalAvailable = lots.reduce((s, l) => s + l.availableCount, 0);
  const totalInStock   = lots.reduce((s, l) => s + l.count, 0);

  // Modal state
  const [showModal, setShowModal] = React.useState(false);
  const [editId, setEditId]       = React.useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<typeof lots[0] | null>(null);

  // Form fields
  const [entryDate, setEntryDate]     = React.useState(todayISO());
  const [species, setSpecies]         = React.useState<Species>('nioska');
  const [breed, setBreed]             = React.useState('');
  const [count, setCount]             = React.useState(12);
  const [sourceType, setSourceType]   = React.useState<HatchingEggSourceType>('przeniesienie');
  const [sourceBatchId, setSourceBatchId] = React.useState('');
  const [supplierName, setSupplierName]   = React.useState('');
  const [pricePerEgg, setPricePerEgg]     = React.useState('');
  const [totalCostPln, setTotalCostPln]   = React.useState('');
  const [invoiceNumber, setInvoiceNumber] = React.useState('');
  const [notes, setNotes]             = React.useState('');
  const [saving, setSaving]           = React.useState(false);
  const [saveError, setSaveError]     = React.useState('');

  function resetForm() {
    setEntryDate(todayISO());
    setSpecies('nioska');
    setBreed('');
    setCount(12);
    setSourceType('przeniesienie');
    setSourceBatchId('');
    setSupplierName('');
    setPricePerEgg('');
    setTotalCostPln('');
    setInvoiceNumber('');
    setNotes('');
    setEditId(null);
    setSaveError('');
  }

  function openEdit(lot: typeof lots[0]) {
    setEditId(lot.id!);
    setEntryDate(lot.entryDate);
    setSpecies(lot.species);
    setBreed(lot.breed ?? '');
    setCount(lot.count);
    setSourceType(lot.sourceType);
    setSourceBatchId(lot.sourceBatchId != null ? String(lot.sourceBatchId) : '');
    setSupplierName(lot.supplierName ?? '');
    setPricePerEgg(lot.pricePerEgg != null ? String(lot.pricePerEgg) : '');
    setTotalCostPln(lot.totalCostPln != null ? String(lot.totalCostPln) : '');
    setInvoiceNumber(lot.invoiceNumber ?? '');
    setNotes(lot.notes ?? '');
    setShowModal(true);
  }

  async function save() {
    if (count < 1) return;
    setSaveError('');

    // Przy nowym wpisie z własnych niosek – sprawdź stan głównego magazynu
    if (editId == null && sourceType === 'przeniesienie') {
      if (count > mainEggStats) {
        setSaveError(`Niewystarczający stan. W magazynie głównym dostępnych: ${mainEggStats} szt.`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      entryDate,
      species,
      breed: breed.trim() || undefined,
      count,
      sourceType,
      sourceBatchId: sourceType === 'przeniesienie' && sourceBatchId ? Number(sourceBatchId) : undefined,
      supplierName:  sourceType === 'zakup' && supplierName.trim() ? supplierName.trim() : undefined,
      pricePerEgg:   pricePerEgg ? Number(pricePerEgg) : undefined,
      totalCostPln:  totalCostPln ? Number(totalCostPln) : undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes:         notes.trim() || undefined,
    };

    if (editId != null) {
      await hatchingEggService.update(editId, payload);
    } else {
      const lotId = await hatchingEggService.create(payload);

      // Przy przeniesieniu z własnych niosek → stwórz transfer w module sprzedaży
      if (sourceType === 'przeniesienie') {
        const transferId = await db.eggHatchTransfers.add({
          transferDate:      entryDate,
          count,
          sourceBatchId:     sourceBatchId ? Number(sourceBatchId) : undefined,
          pricePerEgg:       pricePerEgg ? Number(pricePerEgg) : undefined,
          totalRevenuePln:   totalCostPln ? Number(totalCostPln) : undefined,
          hatchingEggLotId:  lotId as number,
          notes:             notes.trim() || undefined,
          createdAt:         new Date().toISOString(),
        });
        // Zaktualizuj lot o ID transferu
        await hatchingEggService.update(lotId as number, { eggHatchTransferId: transferId as number });
      }
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
  }

  async function confirmDelete(lot: typeof lots[0]) {
    if (lot.usedCount > 0) {
      // Ten przypadek obsługuje guard w ConfirmDialog – nie powinno tu dojść
      return;
    }
    // Usuń powiązany transfer w sprzedaży (jeśli istnieje)
    if ((lot as any).eggHatchTransferId) {
      await db.eggHatchTransfers.delete((lot as any).eggHatchTransferId);
    }
    await hatchingEggService.delete(lot.id!);
    setDeleteTarget(null);
  }

  // Kalkulacja ceny całkowitej przy wpisie ceny za szt.
  React.useEffect(() => {
    if (pricePerEgg && count) {
      setTotalCostPln((Number(pricePerEgg) * count).toFixed(2));
    }
  }, [pricePerEgg, count]);

  return (
    <div className="space-y-4">
      {/* Nagłówek z KPI */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Magazyn jaj wylęgowych</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Dostępne: <span className="font-semibold text-green-700">{totalAvailable} szt.</span>
            {' '}· Łącznie przyjęte: {totalInStock} szt.
          </p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowModal(true); }}>
          + Przyjmij
        </Button>
      </div>

      {lots.length === 0 ? (
        <EmptyState
          title="Magazyn pusty"
          description="Przyjmij jaja ze stada lub z zakupu zewnętrznego."
          icon="🥚"
          action={{ label: '+ Przyjmij partię', onClick: () => { resetForm(); setShowModal(true); } }}
        />
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-50">
            {lots.map(lot => {
              const srcBatch = lot.sourceBatchId
                ? allBatches.find(b => b.id === lot.sourceBatchId)
                : null;
              const availPct = lot.count > 0 ? Math.round((lot.availableCount / lot.count) * 100) : 0;

              return (
                <div key={lot.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{SPECIES_EMOJI[lot.species]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {lot.breed ?? SPECIES_LABELS[lot.species]}
                        </span>
                        {lot.breed && (
                          <span className="text-xs text-gray-400">{SPECIES_LABELS[lot.species]}</span>
                        )}
                        <Badge color={lot.sourceType === 'zakup' ? 'blue' : 'green'}>
                          {lot.sourceType === 'zakup' ? 'Zakup' : 'Własne'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDate(lot.entryDate)}
                        {srcBatch ? ` · ${srcBatch.name}` : ''}
                        {lot.supplierName ? ` · ${lot.supplierName}` : ''}
                      </div>
                      {/* Pasek dostępności */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${availPct > 30 ? 'bg-green-400' : availPct > 0 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                            style={{ width: `${availPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${lot.availableCount > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {lot.availableCount} / {lot.count}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {lot.totalCostPln != null && (
                        <span className="text-xs text-gray-500">{formatPln(lot.totalCostPln)}</span>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(lot)} className="text-xs text-brand-700 hover:underline">
                          Edytuj
                        </button>
                        <button
                          onClick={() => {
                            if (lot.usedCount > 0) {
                              alert(`Nie można usunąć – ${lot.usedCount} jaj z tej partii jest użytych w wsadach inkubacji.`);
                              return;
                            }
                            setDeleteTarget(lot);
                          }}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  </div>
                  {lot.notes && (
                    <p className="text-xs text-gray-400 mt-1 ml-9">{lot.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Potwierdzenie usunięcia */}
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && confirmDelete(deleteTarget)}
        message={
          (deleteTarget as any)?.eggHatchTransferId
            ? 'Usunąć tę partię? Powiązany wpis w magazynie głównym też zostanie usunięty.'
            : 'Usunąć tę partię jaj wylęgowych?'
        }
        danger
      />

      {/* Modal dodawania / edycji */}
      <Modal
        open={showModal}
        title={editId != null ? 'Edytuj partię' : 'Przyjmij jaja wylęgowe'}
        onClose={() => { setShowModal(false); resetForm(); }}
      >
        <div className="space-y-3">
          {/* Źródło */}
          <Select
            label="Źródło"
            value={sourceType}
            onChange={e => setSourceType(e.target.value as HatchingEggSourceType)}
            options={Object.entries(HATCHING_EGG_SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          />

          {sourceType === 'przeniesienie' && editId == null && (
            <div className="text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 text-blue-700">
              Dostępne w magazynie głównym: <strong>{mainEggStats} szt.</strong>
              <br />Jaja zostaną automatycznie odjęte z magazynu sprzedażowego.
            </div>
          )}

          {sourceType === 'przeniesienie' && (
            <Select
              label="Stado niosek (opcjonalnie)"
              value={sourceBatchId}
              onChange={e => setSourceBatchId(e.target.value)}
              options={[
                { value: '', label: '— nie przypisuj —' },
                ...allBatches.map(b => ({ value: String(b.id!), label: b.name })),
              ]}
            />
          )}

          {sourceType === 'zakup' && (
            <>
              <Input
                label="Dostawca / hodowla"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="np. Hodowla Zielononóżki Kowalski"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nr faktury"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
                <Input
                  label="Cena za jajo (PLN)"
                  type="number" step="0.01" min={0}
                  value={pricePerEgg}
                  onChange={e => setPricePerEgg(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Przy przeniesieniu – pole ceny (informacyjne, bez kosztu) */}
          {sourceType === 'przeniesienie' && (
            <Input
              label="Cena za jajo (PLN) — informacyjna"
              type="number" step="0.01" min={0}
              value={pricePerEgg}
              onChange={e => setPricePerEgg(e.target.value)}
              placeholder="0.00"
            />
          )}

          {/* Gatunek i rasa */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Gatunek"
              value={species}
              onChange={e => setSpecies(e.target.value as Species)}
              options={ACTIVE_SPECIES.map(s => ({ value: s, label: SPECIES_LABELS[s] }))}
            />
            <Input
              label="Rasa (opcjonalnie)"
              value={breed}
              onChange={e => setBreed(e.target.value)}
              placeholder="np. Zielononóżka"
            />
          </div>

          {/* Data i liczba */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data przyjęcia"
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
            />
            <Input
              label="Liczba jaj"
              type="number" min={1} max={500}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
            />
          </div>

          {/* Koszt całkowity */}
          <Input
            label={sourceType === 'przeniesienie' ? 'Wartość (PLN) — informacyjna' : 'Koszt całkowity (PLN)'}
            type="number" step="0.01" min={0}
            value={totalCostPln}
            onChange={e => setTotalCostPln(e.target.value)}
            placeholder="0.00"
          />

          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{saveError}</p>
          )}

          <Textarea
            label="Uwagi"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />

          <Button className="w-full" onClick={save} disabled={saving || count < 1}>
            {saving ? 'Zapisywanie…' : editId != null ? 'Zapisz zmiany' : 'Przyjmij do magazynu'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
