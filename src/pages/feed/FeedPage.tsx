import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  feedTypeSchema, type FeedTypeFormValues,
  feedDeliverySchema, type FeedDeliveryFormValues,
} from '@/utils/validation';
import { feedService } from '@/services/feed.service';
import { useAllBatchKPIs } from '@/hooks/useKPIs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { KPICard } from '@/components/charts/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { formatPln, formatKg, formatFCR } from '@/utils/format';
import { formatDate, todayISO } from '@/utils/date';
import { FEED_PHASE_LABELS } from '@/constants/phases';
import { SPECIES_EMOJI } from '@/constants/species';
import type { FeedType, FeedDelivery } from '@/models/feed.model';
import { FeedConsumptionChart } from './FeedConsumptionChart';

// ─── Zakładki ────────────────────────────────────────────────────────────────
type Tab = 'magazyn' | 'zuzycie' | 'dostawy' | 'pasze';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'magazyn',  label: 'Magazyn',  icon: '📦' },
  { id: 'zuzycie',  label: 'Zużycie',  icon: '📊' },
  { id: 'dostawy',  label: 'Dostawy',  icon: '🚛' },
  { id: 'pasze',    label: 'Pasze',    icon: '🌾' },
];

// ─── Komponent pomocniczy: pasek postępu ─────────────────────────────────────
function StockBar({ consumed, delivered }: { consumed: number; delivered: number }) {
  const pct = delivered > 0 ? Math.min(100, (consumed / delivered) * 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function FeedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('magazyn');

  // Feed type state
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editType, setEditType] = useState<FeedType | null>(null);
  const [deleteType, setDeleteType] = useState<FeedType | null>(null);

  // Delivery state
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [editDelivery, setEditDelivery] = useState<FeedDelivery | null>(null);
  const [deleteDelivery, setDeleteDelivery] = useState<FeedDelivery | null>(null);

  // Dane
  const feedTypes          = useLiveQuery(() => db.feedTypes.orderBy('name').toArray(), []) ?? [];
  const deliveries         = useLiveQuery(() => db.feedDeliveries.orderBy('deliveryDate').reverse().toArray(), []) ?? [];
  const allDailyEntries    = useLiveQuery(() => db.dailyEntries.toArray(), []) ?? [];
  const allFeedConsumptions = useLiveQuery(() => db.feedConsumptions.toArray(), []) ?? [];
  const allWeighings       = useLiveQuery(() => db.weighings.toArray(), []) ?? [];
  const allBatches         = useLiveQuery(() => db.batches.toArray(), []) ?? [];
  const batchKPIs          = useAllBatchKPIs();

  // ─── Obliczenia magazynowe ──────────────────────────────────────────────────
  const today = todayISO();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const d7 = sevenDaysAgo.toISOString().slice(0, 10);

  const stockData = feedTypes.map(ft => {
    const ftDeliveries = deliveries.filter(d => d.feedTypeId === ft.id);
    const delivered    = ftDeliveries.reduce((s, d) => s + d.quantityKg, 0);
    // Per-typ zużycie pochodzi z feedConsumptions (nowe wpisy) + legacy dailyEntries z feedTypeId
    const consumed =
      allFeedConsumptions.filter(fc => fc.feedTypeId === ft.id).reduce((s, fc) => s + fc.consumedKg, 0);
    const stock      = Math.max(0, delivered - consumed);
    const stockValue = stock * ft.pricePerKg;

    // Średnie dzienne zużycie (ostatnie 7 dni) – z feedConsumptions
    const recent7 = allFeedConsumptions
      .filter(fc => fc.feedTypeId === ft.id && fc.date >= d7 && fc.date <= today)
      .reduce((s, fc) => s + fc.consumedKg, 0);
    const avgDailyKg   = recent7 / 7;
    const daysOfSupply = avgDailyKg > 0.01 ? stock / avgDailyKg : null;

    // Zużycie per stado
    const perBatch = allBatches
      .map(b => ({
        batchId:   b.id!,
        batchName: b.name,
        species:   b.species,
        consumed:  allFeedConsumptions
          .filter(fc => fc.batchId === b.id && fc.feedTypeId === ft.id)
          .reduce((s, fc) => s + fc.consumedKg, 0),
      }))
      .filter(x => x.consumed > 0);

    return { ft, delivered, consumed, stock, stockValue, avgDailyKg, daysOfSupply, perBatch };
  });

  const totalDelivered  = stockData.reduce((s, x) => s + x.delivered, 0);
  const totalConsumed   = stockData.reduce((s, x) => s + x.consumed, 0);
  const totalStock      = stockData.reduce((s, x) => s + x.stock, 0);
  const totalStockValue = stockData.reduce((s, x) => s + x.stockValue, 0);
  const lowStockCount   = stockData.filter(x => x.daysOfSupply !== null && x.daysOfSupply < 4).length;

  // ─── Formularze ────────────────────────────────────────────────────────────
  const {
    register: regType, handleSubmit: hType, reset: resetType, setValue: setTypeVal,
    formState: { errors: typeErr, isSubmitting: typeSubmitting },
  } = useForm<FeedTypeFormValues>({
    resolver: zodResolver(feedTypeSchema),
    defaultValues: { isActive: true, phase: 'grower', pricePerKg: 0 },
  });

  const {
    register: regDel, handleSubmit: hDel, reset: resetDel,
    setValue: setDelVal, getValues: getDelVal,
    formState: { errors: delErr, isSubmitting: delSubmitting },
  } = useForm<FeedDeliveryFormValues>({
    resolver: zodResolver(feedDeliverySchema),
    defaultValues: { deliveryDate: todayISO() },
  });

  // Stan pomocniczy cena/kg (nie jest częścią schematu – przeliczana pomocniczo)
  const [delPricePerKg, setDelPricePerKg] = useState('');

  const openEditType = (ft: FeedType) => {
    setEditType(ft);
    Object.entries(ft).forEach(([k, v]) => setTypeVal(k as keyof FeedTypeFormValues, v as never));
    setShowTypeForm(true);
  };

  const openAddDelivery = () => {
    resetDel({ deliveryDate: todayISO() });
    setDelPricePerKg('');
    setEditDelivery(null);
    setShowDeliveryForm(true);
  };

  const openEditDelivery = (d: FeedDelivery) => {
    resetDel({
      deliveryDate: d.deliveryDate, feedTypeId: d.feedTypeId,
      quantityKg: d.quantityKg, totalCostPln: d.totalCostPln,
      supplierName: d.supplierName ?? '', invoiceNumber: d.invoiceNumber ?? '',
      notes: d.notes ?? '',
    });
    // Wylicz cenę/kg przy edycji
    const price = d.quantityKg > 0 ? d.totalCostPln / d.quantityKg : 0;
    setDelPricePerKg(price > 0 ? String(Math.round(price * 100) / 100) : '');
    setEditDelivery(d);
    setShowDeliveryForm(true);
  };

  // Dwukierunkowe przeliczanie w formularzu dostawy
  const r2del = (n: number) => Math.round(n * 100) / 100;

  const onDelQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const qty = Number(e.target.value) || 0;
    const price = Number(delPricePerKg) || 0;
    if (qty > 0 && price > 0) setDelVal('totalCostPln', r2del(qty * price));
    else {
      const total = Number(getDelVal('totalCostPln')) || 0;
      if (qty > 0 && total > 0) setDelPricePerKg(String(r2del(total / qty)));
    }
  };

  const onDelPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const price = Number(e.target.value) || 0;
    const qty = Number(getDelVal('quantityKg')) || 0;
    setDelPricePerKg(e.target.value);
    if (qty > 0 && price > 0) setDelVal('totalCostPln', r2del(qty * price));
  };

  const onDelTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const total = Number(e.target.value) || 0;
    const qty = Number(getDelVal('quantityKg')) || 0;
    if (qty > 0 && total > 0) setDelPricePerKg(String(r2del(total / qty)));
  };

  const onTypeSubmit = async (data: FeedTypeFormValues) => {
    if (editType?.id != null) await feedService.updateType(editType.id, data);
    else await feedService.createType(data);
    resetType(); setEditType(null); setShowTypeForm(false);
  };

  const onDeliverySubmit = async (data: FeedDeliveryFormValues) => {
    if (editDelivery?.id != null) await feedService.updateDelivery(editDelivery.id, data);
    else await feedService.createDelivery(data);
    resetDel(); setEditDelivery(null); setShowDeliveryForm(false);
  };

  const phaseBadge: Record<string, 'blue' | 'green' | 'orange' | 'gray' | 'red'> = {
    starter: 'blue', grower: 'green', finisher: 'orange', layer: 'red', own_mix: 'gray',
  };

  const feedTypeMap = Object.fromEntries(feedTypes.map(ft => [ft.id!, ft]));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pasza</h1>
        <div className="flex gap-2">
          <Button onClick={openAddDelivery} size="sm" variant="outline" icon={<span>+</span>}>
            Dostawa
          </Button>
          <Button onClick={() => { resetType(); setEditType(null); setShowTypeForm(true); }} size="sm" icon={<span>+</span>}>
            Nowy rodzaj
          </Button>
        </div>
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ═══ TAB: MAGAZYN ═══ */}
      {activeTab === 'magazyn' && (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Stan magazynu" value={`${totalStock.toFixed(0)} kg`} icon="📦"
              color={lowStockCount > 0 ? 'red' : 'green'}
              sub={lowStockCount > 0 ? `⚠️ ${lowStockCount} pasze poniżej 4 dni zapasu` : 'Stan prawidłowy'} />
            <KPICard label="Wartość zapasów" value={formatPln(totalStockValue)} icon="💰" color="blue" />
            <KPICard label="Zakupiono łącznie" value={`${totalDelivered.toFixed(0)} kg`} icon="🚛" color="blue" />
            <KPICard label="Zużyto łącznie" value={`${totalConsumed.toFixed(0)} kg`} icon="📉" color="gray" />
          </div>

          {/* Per rodzaj paszy */}
          {stockData.length === 0 ? (
            <EmptyState
              title="Brak zdefiniowanych pasz"
              description="Dodaj rodzaj paszy, a następnie dodaj dostawy."
              icon="🌾"
              action={{ label: 'Dodaj paszę', onClick: () => { setActiveTab('pasze'); setShowTypeForm(true); } }}
            />
          ) : (
            stockData.map(({ ft, delivered, consumed, stock, stockValue, avgDailyKg, daysOfSupply, perBatch }) => {
              const isLow  = daysOfSupply !== null && daysOfSupply < 4;
              const isWarn = daysOfSupply !== null && daysOfSupply >= 4 && daysOfSupply < 10;
              return (
                <Card key={ft.id} className={isLow ? 'border-red-200' : isWarn ? 'border-orange-200' : ''}>
                  {/* Nagłówek paszy */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{ft.name}</span>
                        <Badge color={phaseBadge[ft.phase]}>{FEED_PHASE_LABELS[ft.phase]}</Badge>
                        {!ft.isActive && <Badge color="gray">Nieaktywna</Badge>}
                        {isLow  && <Badge color="red">⚠️ Niski stan</Badge>}
                        {isWarn && <Badge color="orange">Uzupełnić wkrótce</Badge>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatPln(ft.pricePerKg)}/kg
                        {ft.manufacturer && ` · ${ft.manufacturer}`}
                        {ft.proteinPercent != null && ` · Białko ${ft.proteinPercent}%`}
                      </div>
                    </div>
                    {/* Stan magazynowy – główna liczba */}
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-bold ${isLow ? 'text-red-600' : isWarn ? 'text-orange-600' : 'text-green-700'}`}>
                        {stock.toFixed(0)} kg
                      </div>
                      <div className="text-xs text-gray-400">w magazynie</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatPln(stockValue)}</div>
                    </div>
                  </div>

                  {/* Pasek postępu zużycia */}
                  {delivered > 0 && (
                    <>
                      <StockBar consumed={consumed} delivered={delivered} />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Zużyto: {consumed.toFixed(0)} kg</span>
                        <span>Zakupiono: {delivered.toFixed(0)} kg</span>
                      </div>
                    </>
                  )}

                  {/* Dni zapasu + dzienne zużycie */}
                  {avgDailyKg > 0.01 && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs flex gap-4 ${
                      isLow ? 'bg-red-50 text-red-700' : isWarn ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'
                    }`}>
                      <span>⏱ Zapas na: <strong>{daysOfSupply != null ? `${daysOfSupply.toFixed(0)} dni` : '—'}</strong></span>
                      <span>📅 Śr. zużycie: <strong>{avgDailyKg.toFixed(1)} kg/dzień</strong></span>
                    </div>
                  )}
                  {delivered === 0 && (
                    <div className="mt-2 text-xs text-gray-400 italic">Brak dostaw – dodaj dostawę aby śledzić stan magazynowy</div>
                  )}

                  {/* Zużycie per stado */}
                  {perBatch.length > 0 && (
                    <div className="mt-3 border-t border-gray-50 pt-3">
                      <div className="text-xs font-medium text-gray-500 mb-1.5">Zużycie wg stad</div>
                      <div className="space-y-1">
                        {perBatch.map(pb => (
                          <div key={pb.batchId} className="flex items-center gap-2">
                            <span className="text-base leading-none">{SPECIES_EMOJI[pb.species]}</span>
                            <span className="text-xs text-gray-700 flex-1 truncate">{pb.batchName}</span>
                            <span className="text-xs font-medium text-gray-900">{pb.consumed.toFixed(1)} kg</span>
                            <span className="text-xs text-gray-400">{formatPln(pb.consumed * ft.pricePerKg)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: ZUŻYCIE ═══ */}
      {activeTab === 'zuzycie' && (
        <div className="space-y-4">
          {batchKPIs.length === 0 ? (
            <EmptyState title="Brak aktywnych stad" description="Dodaj stado i wpisy dzienne aby zobaczyć zużycie." icon="🐓" />
          ) : (
            batchKPIs.map(kpi => {
              const batch   = allBatches.find(b => b.id === kpi.batchId);
              const feedPerBird = kpi.currentBirdCount > 0
                ? kpi.totalFeedKg / kpi.currentBirdCount : null;

              // Zużycie per rodzaj paszy dla tego stada
              const perType = feedTypes.map(ft => {
                const kg = allFeedConsumptions
                  .filter(fc => fc.batchId === kpi.batchId && fc.feedTypeId === ft.id)
                  .reduce((s, fc) => s + fc.consumedKg, 0);
                return { ft, kg };
              }).filter(x => x.kg > 0);

              return (
                <Card key={kpi.batchId}>
                  {/* Nagłówek stada */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{batch ? SPECIES_EMOJI[batch.species] : '🐓'}</span>
                    <div>
                      <div className="font-semibold text-gray-900">{kpi.batchName}</div>
                      <div className="text-xs text-gray-500">{kpi.ageInDays} dni · {kpi.currentBirdCount.toLocaleString('pl-PL')} szt.</div>
                    </div>
                  </div>

                  {/* KPI zużycia */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600">Zużycie łącznie</div>
                      <div className="font-bold text-blue-800 text-sm">{kpi.totalFeedKg.toFixed(1)} kg</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-600">Koszt paszy</div>
                      <div className="font-bold text-green-800 text-sm">{formatPln(kpi.feedCostPln)}</div>
                    </div>
                    <div className={`rounded-lg p-2 text-center ${
                      kpi.fcr != null && kpi.fcr > 2.5 ? 'bg-orange-50' : 'bg-gray-50'
                    }`}>
                      <div className="text-xs text-gray-500">FCR</div>
                      <div className="font-bold text-gray-800 text-sm">{formatFCR(kpi.fcr)}</div>
                      <div className="text-xs text-gray-400">kg paszy/kg przyrostu</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Pasza/ptak</div>
                      <div className="font-bold text-gray-800 text-sm">
                        {feedPerBird != null ? `${feedPerBird.toFixed(2)} kg` : '—'}
                      </div>
                      <div className="text-xs text-gray-400">łącznie/szt.</div>
                    </div>
                  </div>

                  {/* Wyjaśnienie FCR */}
                  {kpi.fcr != null && (
                    <div className={`text-xs rounded-lg px-3 py-1.5 mb-3 ${
                      kpi.fcr <= 1.8 ? 'bg-green-50 text-green-700'
                      : kpi.fcr <= 2.2 ? 'bg-blue-50 text-blue-700'
                      : kpi.fcr <= 2.6 ? 'bg-orange-50 text-orange-700'
                      : 'bg-red-50 text-red-700'
                    }`}>
                      FCR {formatFCR(kpi.fcr)} — na każdy 1 kg przyrostu masy ptaków zużyto{' '}
                      <strong>{formatFCR(kpi.fcr)} kg</strong> paszy
                      {kpi.fcr <= 1.8 ? ' (doskonały wynik)' : kpi.fcr <= 2.2 ? ' (dobry wynik)' : kpi.fcr <= 2.6 ? ' (wynik przeciętny)' : ' (wynik wymaga poprawy)'}
                    </div>
                  )}

                  {/* Breakdown per rodzaj paszy */}
                  {perType.length > 0 && (
                    <div className="border-t border-gray-50 pt-3">
                      <div className="text-xs font-medium text-gray-500 mb-1.5">Zużycie wg rodzajów pasz</div>
                      <div className="space-y-1.5">
                        {perType.map(({ ft, kg }) => {
                          const total = perType.reduce((s, x) => s + x.kg, 0);
                          const pct   = total > 0 ? (kg / total) * 100 : 0;
                          return (
                            <div key={ft.id} className="flex items-center gap-2">
                              <Badge color={phaseBadge[ft.phase]}>{FEED_PHASE_LABELS[ft.phase]}</Badge>
                              <span className="text-xs text-gray-700 flex-1 truncate">{ft.name}</span>
                              <span className="text-xs font-medium">{kg.toFixed(1)} kg</span>
                              <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {kpi.totalFeedKg > 0 && (
                    <FeedConsumptionChart
                      feedTypes={perType.map(x => x.ft)}
                      dailyEntries={allDailyEntries.filter(e => e.batchId === kpi.batchId)}
                      feedConsumptions={allFeedConsumptions.filter(fc => fc.batchId === kpi.batchId)}
                      weighings={allWeighings.filter(w => w.batchId === kpi.batchId)}
                      birdCount={kpi.currentBirdCount}
                    />
                  )}

                  {kpi.totalFeedKg === 0 && (
                    <div className="text-xs text-gray-400 italic text-center py-2">
                      Brak wpisów dziennych z zużyciem paszy.
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TAB: DOSTAWY ═══ */}
      {activeTab === 'dostawy' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openAddDelivery} size="sm" icon={<span>+</span>}>Nowa dostawa</Button>
          </div>
          {deliveries.length === 0 ? (
            <EmptyState
              title="Brak dostaw"
              description="Dodaj pierwszą dostawę paszy."
              icon="🚛"
              action={{ label: 'Dodaj dostawę', onClick: openAddDelivery }}
            />
          ) : (
            <Card padding="none">
              <div className="divide-y divide-gray-50">
                {deliveries.map(d => {
                  const ft = feedTypeMap[d.feedTypeId];
                  const pricePerKg = d.quantityKg > 0 ? d.totalCostPln / d.quantityKg : null;
                  return (
                    <div key={d.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="text-xl pt-0.5">🚛</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">
                          {ft?.name ?? `Pasza #${d.feedTypeId}`}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span className="text-xs text-gray-500">{formatDate(d.deliveryDate)}</span>
                          <span className="text-xs font-semibold text-blue-700">{d.quantityKg} kg</span>
                          {pricePerKg && <span className="text-xs text-gray-400">{pricePerKg.toFixed(2)} zł/kg</span>}
                          {d.supplierName && <span className="text-xs text-gray-400">{d.supplierName}</span>}
                          {d.invoiceNumber && <span className="text-xs text-gray-400">FV: {d.invoiceNumber}</span>}
                        </div>
                        {d.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{d.notes}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-blue-700 text-sm">{formatPln(d.totalCostPln)}</div>
                        <div className="flex gap-2 mt-1 justify-end">
                          <button onClick={() => openEditDelivery(d)} className="text-xs text-gray-400 hover:text-brand-600">✏️</button>
                          <button onClick={() => setDeleteDelivery(d)} className="text-xs text-gray-300 hover:text-red-400">🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ TAB: PASZE ═══ */}
      {activeTab === 'pasze' && (
        <div className="space-y-3">
          {/* Placeholder v2 */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🧪</span>
            <div>
              <div className="text-sm font-semibold text-brand-800">Kalkulator receptur (v2)</div>
              <div className="text-xs text-brand-600">Obliczanie własnych mieszanek – dostępne w wersji 2</div>
            </div>
            <Badge color="blue">Wkrótce</Badge>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { resetType(); setEditType(null); setShowTypeForm(true); }} size="sm" icon={<span>+</span>}>
              Nowy rodzaj paszy
            </Button>
          </div>

          {feedTypes.length === 0 ? (
            <EmptyState
              title="Brak zdefiniowanych pasz"
              description="Dodaj rodzaje pasz używanych w hodowli."
              icon="🌾"
              action={{ label: 'Dodaj paszę', onClick: () => setShowTypeForm(true) }}
            />
          ) : (
            <Card padding="none">
              <div className="divide-y divide-gray-50">
                {feedTypes.map(ft => {
                  const sd = stockData.find(x => x.ft.id === ft.id);
                  return (
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
                        {sd && sd.stock > 0 && (
                          <div className="text-xs text-green-700 mt-0.5">📦 Stan: {sd.stock.toFixed(0)} kg w magazynie</div>
                        )}
                        {ft.recipeNotes && <div className="text-xs text-gray-400 mt-0.5">{ft.recipeNotes}</div>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditType(ft)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">✏️</button>
                        <button onClick={() => setDeleteType(ft)} className="p-1.5 text-gray-300 hover:text-red-400 rounded">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      <Modal open={showTypeForm} onClose={() => { setShowTypeForm(false); setEditType(null); resetType(); }}
        title={editType ? 'Edytuj paszę' : 'Nowy rodzaj paszy'} size="lg">
        <form onSubmit={hType(onTypeSubmit)} className="space-y-3">
          <Input label="Nazwa paszy" {...regType('name')} error={typeErr.name?.message} placeholder="np. Starter Ross Pro" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Faza żywienia"
              options={Object.entries(FEED_PHASE_LABELS).map(([v,l]) => ({ value: v, label: l }))}
              {...regType('phase')} />
            <Input label="Cena (PLN/kg)" type="number" step="0.01" min={0.01}
              {...regType('pricePerKg')} error={typeErr.pricePerKg?.message} />
          </div>
          <Input label="Producent" {...regType('manufacturer')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Białko (%)" type="number" step="0.1" {...regType('proteinPercent')} />
            <Input label="Energia (MJ/kg)" type="number" step="0.01" {...regType('energyMjKg')} />
          </div>
          <Textarea label="Receptura / skład" {...regType('recipeNotes')} placeholder="Skład własnej mieszanki..." />
          <Textarea label="Uwagi" {...regType('notes')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...regType('isActive')} className="rounded" />
            Aktywna pasza
          </label>
          <div className="flex gap-3">
            <Button type="submit" loading={typeSubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowTypeForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showDeliveryForm}
        onClose={() => { setShowDeliveryForm(false); setEditDelivery(null); resetDel(); }}
        title={editDelivery ? 'Edytuj dostawę' : 'Nowa dostawa paszy'} size="lg">
        <form onSubmit={hDel(onDeliverySubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data dostawy *" type="date" {...regDel('deliveryDate')} error={delErr.deliveryDate?.message} />
            <Select label="Rodzaj paszy *"
              options={feedTypes.map(ft => ({ value: String(ft.id), label: ft.name }))}
              placeholder="Wybierz paszę..."
              {...regDel('feedTypeId')} error={delErr.feedTypeId?.message} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Ilość *" type="number" step="0.1" min={0.1} suffix="kg"
              placeholder="np. 1000"
              {...regDel('quantityKg', { onChange: onDelQtyChange })}
              error={delErr.quantityKg?.message}
            />
            <Input
              label="Cena/kg" type="number" step="0.01" min={0} suffix="zł"
              placeholder="np. 1,50"
              value={delPricePerKg}
              onChange={onDelPriceChange}
            />
            <Input
              label="Wartość faktury *" type="number" step="0.01" min={0} suffix="zł"
              placeholder="0,00"
              {...regDel('totalCostPln', { onChange: onDelTotalChange })}
              error={delErr.totalCostPln?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Dostawca" {...regDel('supplierName')} placeholder="np. De Heus, Cargill" />
            <Input label="Numer faktury" {...regDel('invoiceNumber')} placeholder="FV/2026/001" />
          </div>
          <Textarea label="Uwagi" {...regDel('notes')} />
          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={delSubmitting} className="flex-1">
              {editDelivery ? 'Zapisz zmiany' : 'Dodaj dostawę'}
            </Button>
            <Button variant="outline" type="button" onClick={() => setShowDeliveryForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={deleteType != null} onClose={() => setDeleteType(null)}
        onConfirm={async () => { if (deleteType?.id) await feedService.deleteType(deleteType.id); setDeleteType(null); }}
        message={`Usunąć paszę "${deleteType?.name}"?`} danger />

      <ConfirmDialog open={deleteDelivery != null} onClose={() => setDeleteDelivery(null)}
        onConfirm={async () => { if (deleteDelivery?.id) await feedService.deleteDelivery(deleteDelivery.id); setDeleteDelivery(null); }}
        message={`Usunąć dostawę z dnia ${deleteDelivery ? formatDate(deleteDelivery.deliveryDate) : ''}?`} danger />
    </div>
  );
}
