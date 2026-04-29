import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  saleSchema,           type SaleFormValues,
  eggPurchaseSchema,    type EggPurchaseFormValues,
  eggHatchTransferSchema, type EggHatchTransferFormValues,
  orderSchema,          type OrderFormValues,
} from '@/utils/validation';
import { saleService }  from '@/services/sale.service';
import { orderService } from '@/services/order.service';
import { hatchingEggService } from '@/services/hatchingEgg.service';
import { Button }       from '@/components/ui/Button';
import { Card }         from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Select }       from '@/components/ui/Select';
import { Badge }        from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState }   from '@/components/ui/EmptyState';
import { KPICard }      from '@/components/charts/KPICard';
import { useLiveQuery } from 'dexie-react-hooks';
import { db }           from '@/db/database';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln }    from '@/utils/format';
import {
  SALE_TYPE_LABELS,
  ORDER_TYPE_LABELS,
  ORDER_STATUS_LABELS,
} from '@/constants/phases';
import { isLayerSpecies } from '@/constants/species';
import { useActiveBatches } from '@/hooks/useBatch';
import type { Sale }    from '@/models/sale.model';
import type { Order, OrderStatus } from '@/models/order.model';
import type { EggPurchase, EggHatchTransfer } from '@/models/egg.model';

// ─── Typy zakładek ────────────────────────────────────────────────────────────
type Tab = 'sprzedaz' | 'zamowienia';

// ─── Mapy kolorów ─────────────────────────────────────────────────────────────
const saleTypeBadge: Record<string, 'yellow' | 'green' | 'blue' | 'orange' | 'gray'> = {
  jaja: 'yellow', ptaki_zywe: 'green', tuszki: 'blue', elementy: 'orange', jaja_wewn: 'gray',
};
const orderTypeBadge: Record<string, 'yellow' | 'green' | 'blue'> = {
  jaja: 'yellow', ptaki_zywe: 'green', tuszki: 'blue',
};
const orderStatusBadge: Record<string, 'orange' | 'green' | 'gray'> = {
  oczekujace: 'orange', zrealizowane: 'green', anulowane: 'gray',
};

// ─── Pomocnicze ────────────────────────────────────────────────────────────────
function StatRow({ label, value, bold, negative }: {
  label: string; value: string | number; bold?: boolean; negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${negative ? 'text-red-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  );
}

/** Zwraca różnicę w dniach między datą zamówienia a dziś (> 0 = w przyszłości). */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function DaysChip({ dateStr }: { dateStr: string }) {
  const days = daysUntil(dateStr);
  if (days === 0) return <span className="text-xs font-medium text-orange-600">Dziś</span>;
  if (days > 0)  return <span className="text-xs text-gray-400">za {days} {days === 1 ? 'dzień' : 'dni'}</span>;
  return <span className="text-xs font-medium text-red-500">Przeterminowane ({Math.abs(days)} dni)</span>;
}

// ─── Główna strona ─────────────────────────────────────────────────────────────
export function SalesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sprzedaz');

  // Stan sprzedaży
  const [showSaleForm,  setShowSaleForm]  = useState(false);
  const [showBuyForm,   setShowBuyForm]   = useState(false);
  const [showHatchForm, setShowHatchForm] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<Sale | null>(null);
  const [deletePurchaseTarget, setDeletePurchaseTarget] = useState<EggPurchase | null>(null);
  const [deleteHatchTarget,    setDeleteHatchTarget]    = useState<EggHatchTransfer | null>(null);

  // Stan zamówień
  const [showOrderForm,     setShowOrderForm]     = useState(false);
  const [fulfillOrderTarget, setFulfillOrderTarget] = useState<Order | null>(null);
  const [cancelOrderTarget,  setCancelOrderTarget]  = useState<Order | null>(null);
  const [deleteOrderTarget,  setDeleteOrderTarget]  = useState<Order | null>(null);

  // ─── Live queries ─────────────────────────────────────────────────────────
  const sales              = useLiveQuery(() => db.sales.orderBy('saleDate').reverse().toArray(), []) ?? [];
  const orders             = useLiveQuery(() => db.orders.orderBy('plannedDate').toArray(), []) ?? [];
  const allBatches         = useLiveQuery(() => db.batches.toArray(), []) ?? [];
  const allDailyEntries    = useLiveQuery(() => db.dailyEntries.toArray(), []) ?? [];
  const allSlaughter       = useLiveQuery(() => db.slaughterRecords.toArray(), []) ?? [];
  const eggPurchases       = useLiveQuery(() => db.eggPurchases.orderBy('purchaseDate').reverse().toArray(), []) ?? [];
  const eggHatchTransfers  = useLiveQuery(() => db.eggHatchTransfers.orderBy('transferDate').reverse().toArray(), []) ?? [];
  const activeBatches      = useActiveBatches();

  // ─── Statystyki magazynu jaj ──────────────────────────────────────────────
  const eggStats = useMemo(() => {
    const layerIds     = new Set(allBatches.filter(b => isLayerSpecies(b.species)).map(b => b.id!));
    const layerEntries = allDailyEntries.filter(e => layerIds.has(e.batchId));
    const collectedGross = layerEntries.reduce((s, e) => s + (e.eggsCollected ?? 0), 0);
    const defective      = layerEntries.reduce((s, e) => s + (e.eggsDefective ?? 0), 0);
    const collected      = collectedGross - defective;
    const purchased      = eggPurchases.reduce((s, p) => s + p.count, 0);
    const sold           = sales.filter(s => s.saleType === 'jaja').reduce((s, x) => s + (x.eggsCount ?? 0), 0);  // jaja_wewn nie liczymy tu – jest w transferred
    const transferred    = eggHatchTransfers.reduce((s, t) => s + t.count, 0);
    const available      = collected + purchased - sold - transferred;
    const hasLayers      = layerIds.size > 0;
    return { collected, purchased, sold, transferred, available, hasLayers };
  }, [allBatches, allDailyEntries, eggPurchases, eggHatchTransfers, sales]);

  // ─── Stan stada (ptaki dostępne do zamówień) ─────────────────────────────
  const birdStockMap = useMemo(() => {
    return new Map(allBatches.map(b => {
      const entries    = allDailyEntries.filter(e => e.batchId === b.id);
      const dead       = entries.reduce((s, e) => s + e.deadCount + e.culledCount, 0);
      const soldLive   = sales
        .filter(s => s.saleType === 'ptaki_zywe' && s.batchId === b.id)
        .reduce((s, x) => s + (x.birdCount ?? 0), 0);
      const slaughtered = allSlaughter
        .filter(r => r.batchId === b.id)
        .reduce((s, r) => s + r.birdsSlaughtered, 0);
      const current = Math.max(0, b.initialCount - dead - soldLive - slaughtered);
      // Zarezerwowane w oczekujących zamówieniach (ptaki_zywe + tuszki)
      const reserved = orders
        .filter(o => o.batchId === b.id && o.status === 'oczekujace' && o.orderType !== 'jaja')
        .reduce((s, o) => s + (o.quantity ?? 0), 0);
      const available = Math.max(0, current - reserved);
      return [b.id!, { current, reserved, available }];
    }));
  }, [allBatches, allDailyEntries, sales, allSlaughter, orders]);

  // ─── KPI sprzedaży ───────────────────────────────────────────────────────
  const totalRevenue     = sales.reduce((s, x) => s + x.totalRevenuePln, 0);
  const thisMonthSales   = sales.filter(s => s.saleDate >= new Date().toISOString().slice(0, 7));
  const thisMonthRevenue = thisMonthSales.reduce((s, x) => s + x.totalRevenuePln, 0);
  const batchMap         = new Map(allBatches.map(b => [b.id!, b.name]));
  const layerBatches     = allBatches.filter(b => isLayerSpecies(b.species));

  // ─── KPI zamówień ─────────────────────────────────────────────────────────
  const pendingOrders = orders.filter(o => o.status === 'oczekujace');
  const pendingValue  = pendingOrders.reduce((s, o) => s + o.estimatedPricePln, 0);
  const nextOrder     = pendingOrders[0] ?? null; // posortowane wg plannedDate ASC

  // ─── Formularz sprzedaży ──────────────────────────────────────────────────
  const {
    register, handleSubmit, reset, watch,
    setValue, getValues, setError,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: { saleDate: todayISO(), saleType: 'tuszki' },
  });
  const saleType = watch('saleType');

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const r4 = (n: number) => Math.round(n * 10000) / 10000;

  const recomputeTotal = (freshQty?: number, freshPrice?: number) => {
    const type = getValues('saleType');
    if (type === 'jaja') {
      const qty   = freshQty   ?? (Number(getValues('eggsCount'))   || 0);
      const price = freshPrice ?? (Number(getValues('eggPricePln')) || 0);
      if (qty > 0 && price > 0) setValue('totalRevenuePln', r2(qty * price));
    } else {
      const kg    = freshQty   ?? (Number(getValues('weightKg'))      || 0);
      const price = freshPrice ?? (Number(getValues('pricePerKgPln')) || 0);
      if (kg > 0 && price > 0) setValue('totalRevenuePln', r2(kg * price));
    }
  };
  const recomputeUnitPrice = (freshTotal: number) => {
    const type = getValues('saleType');
    if (type === 'jaja') {
      const qty = Number(getValues('eggsCount')) || 0;
      if (qty > 0 && freshTotal > 0) setValue('eggPricePln', r4(freshTotal / qty));
    } else {
      const kg = Number(getValues('weightKg')) || 0;
      if (kg > 0 && freshTotal > 0) setValue('pricePerKgPln', r2(freshTotal / kg));
    }
  };

  const onSaleSubmit = async (data: SaleFormValues) => {
    if (data.saleType === 'jaja' && (data.eggsCount ?? 0) > 0) {
      if ((data.eggsCount ?? 0) > eggStats.available) {
        setError('eggsCount', { message: `Niewystarczający stan. Dostępnych: ${eggStats.available.toLocaleString('pl-PL')} jaj` });
        return;
      }
    }
    await saleService.create(data);
    reset();
    setShowSaleForm(false);
  };

  // ─── Formularz zakupu jaj ─────────────────────────────────────────────────
  const {
    register: regBuy, handleSubmit: handleBuy, reset: resetBuy,
    setValue: setBuyVal, getValues: getBuyVal,
    formState: { errors: buyErrors, isSubmitting: buySubmitting },
  } = useForm<EggPurchaseFormValues>({
    resolver: zodResolver(eggPurchaseSchema),
    defaultValues: { purchaseDate: todayISO(), totalCostPln: 0 },
  });

  const recomputeBuyTotal = (freshCount?: number, freshPrice?: number) => {
    const count = freshCount ?? (Number(getBuyVal('count'))       || 0);
    const price = freshPrice ?? (Number(getBuyVal('pricePerEgg')) || 0);
    if (count > 0 && price > 0) setBuyVal('totalCostPln', r2(count * price));
  };
  const recomputeBuyPrice = (freshTotal: number) => {
    const count = Number(getBuyVal('count')) || 0;
    if (count > 0 && freshTotal > 0) setBuyVal('pricePerEgg', r4(freshTotal / count));
  };

  const onBuySubmit = async (data: EggPurchaseFormValues) => {
    await db.eggPurchases.add({ ...data, createdAt: new Date().toISOString() });
    resetBuy();
    setShowBuyForm(false);
  };

  // ─── Formularz przekazania do wylęgu ──────────────────────────────────────
  const {
    register: regHatch, handleSubmit: handleHatch, reset: resetHatch,
    setError: setHatchError, setValue: setHatchVal, getValues: getHatchVal,
    formState: { errors: hatchErrors, isSubmitting: hatchSubmitting },
  } = useForm<EggHatchTransferFormValues>({
    resolver: zodResolver(eggHatchTransferSchema),
    defaultValues: { transferDate: todayISO() },
  });

  const recomputeHatchRevenue = (freshCount?: number, freshPrice?: number) => {
    const cnt   = freshCount ?? (Number(getHatchVal('count'))       || 0);
    const price = freshPrice ?? (Number(getHatchVal('pricePerEgg')) || 0);
    if (cnt > 0 && price > 0) setHatchVal('totalRevenuePln', r2(cnt * price));
  };
  const recomputeHatchPrice = (freshTotal: number) => {
    const cnt = Number(getHatchVal('count')) || 0;
    if (cnt > 0 && freshTotal > 0) setHatchVal('pricePerEgg', r4(freshTotal / cnt));
  };

  const onHatchSubmit = async (data: EggHatchTransferFormValues) => {
    if (data.count > eggStats.available) {
      setHatchError('count', { message: `Niewystarczający stan. Dostępnych: ${eggStats.available.toLocaleString('pl-PL')} jaj` });
      return;
    }

    // Oblicz wartość przychodu jeśli podano cenę
    const revenue = data.totalRevenuePln ?? (data.pricePerEgg ? r2(data.pricePerEgg * data.count) : undefined);

    // Utwórz transfer (odejmuje z magazynu sprzedaży)
    const transferId = await db.eggHatchTransfers.add({
      ...data,
      totalRevenuePln: revenue,
      createdAt: new Date().toISOString(),
    });

    // Utwórz powiązaną partię w magazynie wylęgarni
    const lotId = await hatchingEggService.create({
      entryDate:         data.transferDate,
      species:           'nioska',
      count:             data.count,
      sourceType:        'przeniesienie',
      sourceBatchId:     data.sourceBatchId,
      pricePerEgg:       data.pricePerEgg,
      totalCostPln:      revenue,
      eggHatchTransferId: transferId as number,
      notes:             data.notes,
    });

    // Zaktualizuj transfer z ID partii
    await db.eggHatchTransfers.update(transferId as number, { hatchingEggLotId: lotId as number });

    // Jeśli podano cenę i stado niosek → generuj przychód wewnętrzny
    if (revenue && revenue > 0 && data.sourceBatchId) {
      await db.sales.add({
        batchId:        data.sourceBatchId,
        saleDate:       data.transferDate,
        saleType:       'jaja_wewn',
        eggsCount:      data.count,
        eggPricePln:    data.pricePerEgg,
        totalRevenuePln: revenue,
        buyerName:      'Wylęgarnia (wewn.)',
        notes:          data.notes,
        createdAt:      new Date().toISOString(),
      });
    }

    resetHatch();
    setShowHatchForm(false);
  };

  // ─── Formularz zamówienia ─────────────────────────────────────────────────
  const {
    register: regOrder, handleSubmit: handleOrder, reset: resetOrder,
    watch: watchOrder, setValue: setOrderVal, getValues: getOrderVal,
    formState: { errors: orderErrors, isSubmitting: orderSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { plannedDate: todayISO(), orderType: 'tuszki' },
  });

  const orderType         = watchOrder('orderType');
  const watchedBatchId    = watchOrder('batchId');
  const watchedQuantity   = watchOrder('quantity');

  // Oblicz ile ptaków zostanie po tym zamówieniu (tylko dla ptaki_zywe/tuszki)
  const birdStock = orderType !== 'jaja' && watchedBatchId
    ? birdStockMap.get(Number(watchedBatchId)) ?? null
    : null;
  const orderedQty      = Number(watchedQuantity) || 0;
  const remainingAfter  = birdStock ? birdStock.available - orderedQty : null;
  const isOverbooked    = remainingAfter !== null && remainingAfter < 0;
  const isLow           = remainingAfter !== null && remainingAfter >= 0 && remainingAfter < 10;
  const isNewBatchOrder = isOverbooked || isLow;

  const recomputeOrderTotal = (freshWeight?: number, freshCount?: number, freshPrice?: number) => {
    const type = getOrderVal('orderType');
    if (type === 'jaja') {
      const qty   = freshCount  ?? (Number(getOrderVal('quantity'))     || 0);
      const price = freshPrice  ?? (Number(getOrderVal('pricePerUnit')) || 0);
      if (qty > 0 && price > 0) setOrderVal('estimatedPricePln', r2(qty * price));
    } else {
      // masa 1 ptaka × liczba szt. × cena/kg
      const kg    = freshWeight ?? (Number(getOrderVal('weightKg'))     || 0);
      const count = freshCount  ?? (Number(getOrderVal('quantity'))     || 0);
      const price = freshPrice  ?? (Number(getOrderVal('pricePerUnit')) || 0);
      if (kg > 0 && count > 0 && price > 0) setOrderVal('estimatedPricePln', r2(kg * count * price));
    }
  };
  const recomputeOrderUnitPrice = (freshTotal: number) => {
    const type = getOrderVal('orderType');
    if (type === 'jaja') {
      const qty = Number(getOrderVal('quantity')) || 0;
      if (qty > 0 && freshTotal > 0) setOrderVal('pricePerUnit', r4(freshTotal / qty));
    } else {
      const kg    = Number(getOrderVal('weightKg')) || 0;
      const count = Number(getOrderVal('quantity')) || 0;
      if (kg > 0 && count > 0 && freshTotal > 0) setOrderVal('pricePerUnit', r2(freshTotal / (kg * count)));
    }
  };

  const onOrderSubmit = async (data: OrderFormValues) => {
    let finalData = { ...data };
    // Jeśli zamówienie przekracza dostępne ptaki lub zostanie < 10 szt. → adnotacja
    if (data.orderType !== 'jaja') {
      const stock   = birdStockMap.get(data.batchId);
      const qty     = data.quantity ?? 0;
      const left    = stock ? stock.available - qty : 0;
      if (stock && left < 10) {
        const tag = '[Na nowe stado]';
        finalData.notes = finalData.notes ? `${tag} ${finalData.notes}` : tag;
      }
    }
    await orderService.create(finalData);
    resetOrder();
    setShowOrderForm(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Nagłówek ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sprzedaż</h1>
        {activeTab === 'sprzedaz' ? (
          <Button onClick={() => setShowSaleForm(true)} size="sm" icon={<span>+</span>}>
            Nowa sprzedaż
          </Button>
        ) : (
          <Button onClick={() => setShowOrderForm(true)} size="sm" icon={<span>+</span>}>
            Nowe zamówienie
          </Button>
        )}
      </div>

      {/* ── Zakładki ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { id: 'sprzedaz',   label: '💰 Sprzedaż',   count: null },
          { id: 'zamowienia', label: '📋 Zamówienia',  count: pendingOrders.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SPRZEDAŻ
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sprzedaz' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KPICard label="Łączny przychód" value={formatPln(totalRevenue)}     icon="💰" color="green" />
            <KPICard label="Ten miesiąc"     value={formatPln(thisMonthRevenue)} icon="📅" color="blue"  />
          </div>

          {/* ── Magazyn jaj ─────────────────────────────────────────────── */}
          {(eggStats.hasLayers || eggPurchases.length > 0) && (
            <Card title="🥚 Magazyn jaj">
              <div className="space-y-0.5 mb-3">
                <StatRow label="Zebrane (netto)"    value={`${eggStats.collected.toLocaleString('pl-PL')} szt.`} />
                {eggStats.purchased > 0 && (
                  <StatRow label="Zakupione zewn."  value={`+ ${eggStats.purchased.toLocaleString('pl-PL')} szt.`} />
                )}
                {eggStats.sold > 0 && (
                  <StatRow label="Sprzedane"        value={`− ${eggStats.sold.toLocaleString('pl-PL')} szt.`} negative />
                )}
                {eggStats.transferred > 0 && (
                  <StatRow label="Przekazane do wylęgu" value={`− ${eggStats.transferred.toLocaleString('pl-PL')} szt.`} negative />
                )}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <StatRow label="Dostępne" value={`${eggStats.available.toLocaleString('pl-PL')} szt.`} bold />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowBuyForm(true)}>
                  + Zakup zewnętrzny
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowHatchForm(true)}>
                  🐣 Do wylęgu
                </Button>
              </div>
              {(eggPurchases.length > 0 || eggHatchTransfers.length > 0) && (
                <div className="mt-3 space-y-1">
                  {eggPurchases.slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs text-gray-600 py-0.5">
                      <span>
                        <span className="text-gray-400">{formatDate(p.purchaseDate)}</span>
                        {' '}Zakup: <strong>{p.count.toLocaleString('pl-PL')} szt.</strong>
                        {p.supplierName && <span className="text-gray-400"> · {p.supplierName}</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{formatPln(p.totalCostPln)}</span>
                        <button onClick={() => setDeletePurchaseTarget(p)} className="text-gray-300 hover:text-red-400">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {eggHatchTransfers.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs text-gray-600 py-0.5">
                      <span>
                        <span className="text-gray-400">{formatDate(t.transferDate)}</span>
                        {' '}Wylęg: <strong>{t.count.toLocaleString('pl-PL')} szt.</strong>
                        {t.sourceBatchId && <span className="text-gray-400"> · {batchMap.get(t.sourceBatchId)}</span>}
                      </span>
                      <button onClick={() => setDeleteHatchTarget(t)} className="text-gray-300 hover:text-red-400">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ── Lista sprzedaży ──────────────────────────────────────────── */}
          {sales.filter(s => s.saleType !== 'jaja_wewn').length === 0 ? (
            <EmptyState
              title="Brak sprzedaży"
              description="Dodaj pierwszą transakcję sprzedaży."
              icon="💰"
              action={{ label: 'Dodaj sprzedaż', onClick: () => setShowSaleForm(true) }}
            />
          ) : (
            <Card title="Historia sprzedaży" padding="none">
              <div className="divide-y divide-gray-50">
                {sales.filter(s => s.saleType !== 'jaja_wewn').map(s => (
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ZAMÓWIENIA
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'zamowienia' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KPICard
              label="Oczekujące zamówienia"
              value={pendingOrders.length > 0 ? String(pendingOrders.length) : '—'}
              icon="📋"
              color="orange"
            />
            <KPICard
              label="Szacowana wartość"
              value={pendingValue > 0 ? formatPln(pendingValue) : '—'}
              icon="💰"
              color="green"
            />
          </div>

          {nextOrder && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 text-sm text-orange-800">
              ⏰ Najbliższa realizacja: <strong>{formatDate(nextOrder.plannedDate)}</strong>
              {' '}
              <DaysChip dateStr={nextOrder.plannedDate} />
              {nextOrder.buyerName && <span className="text-orange-600"> · {nextOrder.buyerName}</span>}
            </div>
          )}

          {orders.length === 0 ? (
            <EmptyState
              title="Brak zamówień"
              description="Przyjmij pierwsze zamówienie z wyprzedzeniem."
              icon="📋"
              action={{ label: '+ Nowe zamówienie', onClick: () => setShowOrderForm(true) }}
            />
          ) : (
            <>
              {/* Oczekujące */}
              {pendingOrders.length > 0 && (
                <Card title="Oczekujące" padding="none">
                  <div className="divide-y divide-gray-50">
                    {pendingOrders.map(o => (
                      <div key={o.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge color={orderTypeBadge[o.orderType]}>{ORDER_TYPE_LABELS[o.orderType]}</Badge>
                              <span className="text-xs text-gray-500">{formatDate(o.plannedDate)}</span>
                              <DaysChip dateStr={o.plannedDate} />
                            </div>
                            <div className="text-sm text-gray-800 mt-0.5">
                              {o.orderType === 'jaja' && o.quantity != null && `${o.quantity.toLocaleString('pl-PL')} szt.`}
                              {o.orderType !== 'jaja' && o.weightKg != null && `${o.weightKg} kg`}
                              {o.orderType !== 'jaja' && o.quantity != null && ` · ${o.quantity} szt.`}
                              {o.pricePerUnit != null && (
                                <span className="text-gray-400">
                                  {' '}· {o.pricePerUnit} PLN/{o.orderType === 'jaja' ? 'szt.' : 'kg'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {o.buyerName && <span className="text-xs text-gray-500">{o.buyerName}</span>}
                              {o.phone    && <span className="text-xs text-gray-400">📞 {o.phone}</span>}
                              {batchMap.get(o.batchId) && (
                                <span className="text-xs text-gray-400">{batchMap.get(o.batchId)}</span>
                              )}
                            </div>
                            {o.notes && <div className="text-xs text-gray-400 italic mt-0.5">{o.notes}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-gray-900 text-sm">{formatPln(o.estimatedPricePln)}</div>
                            <div className="text-xs text-gray-400">szacunkowo</div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setFulfillOrderTarget(o)}
                            className="text-xs text-green-700 hover:text-green-800 font-medium border border-green-200 bg-green-50 hover:bg-green-100 rounded-lg px-2.5 py-1 transition-colors"
                          >
                            ✓ Zrealizowane
                          </button>
                          <button
                            onClick={() => setCancelOrderTarget(o)}
                            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1 transition-colors"
                          >
                            ✕ Anuluj
                          </button>
                          <button
                            onClick={() => setDeleteOrderTarget(o)}
                            className="text-xs text-gray-300 hover:text-red-400 ml-auto"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Zakończone / anulowane */}
              {orders.filter(o => o.status !== 'oczekujace').length > 0 && (
                <Card title="Historia zamówień" padding="none">
                  <div className="divide-y divide-gray-50">
                    {orders.filter(o => o.status !== 'oczekujace').slice().reverse().map(o => (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge color={orderStatusBadge[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                            <Badge color={orderTypeBadge[o.orderType]}>{ORDER_TYPE_LABELS[o.orderType]}</Badge>
                            <span className="text-xs text-gray-400">{formatDate(o.plannedDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {o.buyerName && <span className="text-xs text-gray-500">{o.buyerName}</span>}
                            {batchMap.get(o.batchId) && (
                              <span className="text-xs text-gray-400">{batchMap.get(o.batchId)}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-500">{formatPln(o.estimatedPricePln)}</div>
                          <button onClick={() => setDeleteOrderTarget(o)} className="text-gray-300 hover:text-red-400 text-xs">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALE – SPRZEDAŻ
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Nowa sprzedaż */}
      <Modal open={showSaleForm} onClose={() => setShowSaleForm(false)} title="Nowa sprzedaż" size="lg">
        <form onSubmit={handleSubmit(onSaleSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" {...register('saleDate')} error={errors.saleDate?.message} />
            <Select label="Produkt" options={Object.entries(SALE_TYPE_LABELS).map(([v,l]) => ({value:v,label:l}))} {...register('saleType')} />
          </div>
          <Select
            label="Stado *"
            options={allBatches.map(b => ({ value: String(b.id!), label: b.name }))}
            placeholder="— Wybierz stado —"
            {...register('batchId')}
            error={errors.batchId?.message}
          />
          {saleType === 'jaja' ? (
            <>
              {eggStats.hasLayers && (
                <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                  Dostępnych jaj w magazynie: <strong>{eggStats.available.toLocaleString('pl-PL')} szt.</strong>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Liczba jaj" type="number" min={1}
                  {...register('eggsCount', { onChange: e => recomputeTotal(Number(e.target.value) || 0) })}
                  error={errors.eggsCount?.message}
                />
                <Input label="Cena za jajko (PLN)" type="number" step="0.0001"
                  {...register('eggPricePln', { onChange: e => recomputeTotal(undefined, Number(e.target.value) || 0) })}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Masa (kg)" type="number" step="0.1"
                {...register('weightKg', { onChange: e => recomputeTotal(Number(e.target.value) || 0) })}
              />
              <Input label="Cena (PLN/kg)" type="number" step="0.01"
                {...register('pricePerKgPln', { onChange: e => recomputeTotal(undefined, Number(e.target.value) || 0) })}
              />
            </div>
          )}
          <Input label="Liczba ptaków (szt.)" type="number" min={1} {...register('birdCount')} />
          <Input label="Wartość łączna (PLN)" type="number" step="0.01"
            {...register('totalRevenuePln', { onChange: e => recomputeUnitPrice(Number(e.target.value) || 0) })}
            error={errors.totalRevenuePln?.message}
          />
          <Input label="Klient"         {...register('buyerName')} />
          <Input label="Numer faktury"  {...register('invoiceNumber')} />
          <Textarea label="Uwagi"       {...register('notes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={isSubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowSaleForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      {/* Zakup jaj z zewnątrz */}
      <Modal open={showBuyForm} onClose={() => setShowBuyForm(false)} title="Zakup jaj z zewnątrz" size="md">
        <form onSubmit={handleBuy(onBuySubmit)} className="space-y-3">
          <Input label="Data zakupu" type="date" {...regBuy('purchaseDate')} error={buyErrors.purchaseDate?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Liczba jaj (szt.)" type="number" min={1}
              {...regBuy('count', { onChange: e => recomputeBuyTotal(Number(e.target.value) || 0) })}
              error={buyErrors.count?.message}
            />
            <Input label="Cena za jajko (PLN)" type="number" step="0.0001"
              {...regBuy('pricePerEgg', { onChange: e => recomputeBuyTotal(undefined, Number(e.target.value) || 0) })}
            />
          </div>
          <Input label="Łączny koszt (PLN)" type="number" step="0.01"
            {...regBuy('totalCostPln', { onChange: e => recomputeBuyPrice(Number(e.target.value) || 0) })}
            error={buyErrors.totalCostPln?.message}
          />
          <Input label="Dostawca"       {...regBuy('supplierName')} />
          <Input label="Numer faktury"  {...regBuy('invoiceNumber')} />
          <Textarea label="Uwagi"       {...regBuy('notes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={buySubmitting} className="flex-1">Zapisz</Button>
            <Button variant="outline" type="button" onClick={() => setShowBuyForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      {/* Przekazanie do wylęgu */}
      <Modal open={showHatchForm} onClose={() => setShowHatchForm(false)} title="Przekazanie jaj do wylęgu" size="md">
        <form onSubmit={handleHatch(onHatchSubmit)} className="space-y-3">
          {eggStats.available > 0 && (
            <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
              Dostępnych jaj w magazynie: <strong>{eggStats.available.toLocaleString('pl-PL')} szt.</strong>
            </div>
          )}
          <Input label="Data przekazania" type="date" {...regHatch('transferDate')} error={hatchErrors.transferDate?.message} />
          <Input
            label="Liczba jaj (szt.)"
            type="number" min={1}
            {...regHatch('count', { onChange: e => recomputeHatchRevenue(Number(e.target.value) || 0) })}
            error={hatchErrors.count?.message}
          />
          {layerBatches.length > 0 && (
            <Select
              label="Stado niosek (opcjonalne)"
              options={layerBatches.map(b => ({ value: String(b.id!), label: b.name }))}
              placeholder="— Dowolne stado —"
              {...regHatch('sourceBatchId')}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cena za jajko (PLN)"
              type="number" step="0.0001" min={0}
              placeholder="0.00"
              {...regHatch('pricePerEgg', { onChange: e => recomputeHatchRevenue(undefined, Number(e.target.value) || 0) })}
            />
            <Input
              label="Wartość przychodu (PLN)"
              type="number" step="0.01" min={0}
              placeholder="0.00"
              {...regHatch('totalRevenuePln', { onChange: e => recomputeHatchPrice(Number(e.target.value) || 0) })}
            />
          </div>
          {layerBatches.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
              Aby wygenerować przychód, wybierz stado niosek i podaj cenę jaja.
            </p>
          )}
          <Textarea label="Uwagi" {...regHatch('notes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={hatchSubmitting} className="flex-1">Zapisz i przekaż do wylęgarni</Button>
            <Button variant="outline" type="button" onClick={() => setShowHatchForm(false)}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL – NOWE ZAMÓWIENIE
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal open={showOrderForm} onClose={() => { setShowOrderForm(false); resetOrder(); }} title="Nowe zamówienie" size="lg">
        <form onSubmit={handleOrder(onOrderSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data realizacji *"
              type="date"
              {...regOrder('plannedDate')}
              error={orderErrors.plannedDate?.message}
            />
            <Select
              label="Produkt *"
              options={Object.entries(ORDER_TYPE_LABELS).map(([v,l]) => ({ value: v, label: l }))}
              {...regOrder('orderType')}
            />
          </div>

          <Select
            label="Stado *"
            options={allBatches.map(b => ({ value: String(b.id!), label: b.name }))}
            placeholder="— Wybierz stado —"
            {...regOrder('batchId')}
            error={orderErrors.batchId?.message}
          />

          {/* Info o dostępności ptaków */}
          {birdStock && orderType !== 'jaja' && (
            isOverbooked ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-0.5">
                <div className="font-semibold">⚠️ Przekroczona dostępna liczba ptaków</div>
                <div>
                  Dostępne: <strong>{birdStock.available} szt.</strong>
                  {birdStock.reserved > 0 && ` (w tym zarezerwowane: ${birdStock.reserved} szt.)`}
                  {' '}· Zamówiono: <strong>{orderedQty} szt.</strong>
                </div>
                <div className="text-red-600 font-medium">
                  Zamówienie zostanie automatycznie oznaczone jako „Na nowe stado".
                </div>
              </div>
            ) : isLow ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 space-y-0.5">
                <div className="font-semibold">⚠️ Zostanie mniej niż 10 ptaków</div>
                <div>
                  Dostępne: <strong>{birdStock.available} szt.</strong>
                  {birdStock.reserved > 0 && ` (zarezerwowane: ${birdStock.reserved} szt.)`}
                  {orderedQty > 0 && <> · Po zamówieniu: <strong>{remainingAfter} szt.</strong></>}
                </div>
                <div className="text-orange-600 font-medium">
                  Zamówienie zostanie oznaczone jako „Na nowe stado".
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-1.5 text-xs text-green-700">
                Dostępnych ptaków w stadzie: <strong>{birdStock.available} szt.</strong>
                {birdStock.reserved > 0 && <span className="text-green-600"> (zarezerwowane: {birdStock.reserved} szt.)</span>}
                {orderedQty > 0 && remainingAfter !== null && (
                  <> · Po zamówieniu: <strong>{remainingAfter} szt.</strong></>
                )}
              </div>
            )
          )}

          {orderType === 'jaja' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Liczba jaj (szt.)"
                type="number" min={1}
                {...regOrder('quantity', { onChange: e => recomputeOrderTotal(undefined, Number(e.target.value) || 0, undefined) })}
                error={orderErrors.quantity?.message}
              />
              <Input
                label="Cena za jajko (PLN)"
                type="number" step="0.0001"
                {...regOrder('pricePerUnit', { onChange: e => recomputeOrderTotal(undefined, undefined, Number(e.target.value) || 0) })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Masa 1 ptaka (kg)"
                type="number" step="0.1"
                {...regOrder('weightKg', { onChange: e => recomputeOrderTotal(Number(e.target.value) || 0, undefined, undefined) })}
              />
              <Input
                label="Cena (PLN/kg)"
                type="number" step="0.01"
                {...regOrder('pricePerUnit', { onChange: e => recomputeOrderTotal(undefined, undefined, Number(e.target.value) || 0) })}
              />
              <Input
                label="Liczba ptaków (szt.)"
                type="number" min={1}
                {...regOrder('quantity', { onChange: e => recomputeOrderTotal(undefined, Number(e.target.value) || 0, undefined) })}
              />
            </div>
          )}

          <Input
            label="Szacunkowa wartość (PLN) *"
            type="number" step="0.01"
            {...regOrder('estimatedPricePln', { onChange: e => recomputeOrderUnitPrice(Number(e.target.value) || 0) })}
            error={orderErrors.estimatedPricePln?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Klient"    {...regOrder('buyerName')} />
            <Input label="Telefon"   {...regOrder('phone')} />
          </div>

          <Textarea label="Uwagi" {...regOrder('notes')} />

          <div className="flex gap-3">
            <Button type="submit" loading={orderSubmitting} className="flex-1">Zapisz zamówienie</Button>
            <Button variant="outline" type="button" onClick={() => { setShowOrderForm(false); resetOrder(); }}>Anuluj</Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          DIALOGI POTWIERDZENIA
      ══════════════════════════════════════════════════════════════════════ */}
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget?.id) await saleService.delete(deleteTarget.id); }}
        message="Usunąć tę transakcję sprzedaży?"
        danger
      />
      <ConfirmDialog
        open={deletePurchaseTarget != null}
        onClose={() => setDeletePurchaseTarget(null)}
        onConfirm={async () => { if (deletePurchaseTarget?.id) await db.eggPurchases.delete(deletePurchaseTarget.id); }}
        message="Usunąć ten zakup jaj?"
        danger
      />
      <ConfirmDialog
        open={deleteHatchTarget != null}
        onClose={() => setDeleteHatchTarget(null)}
        onConfirm={async () => { if (deleteHatchTarget?.id) await db.eggHatchTransfers.delete(deleteHatchTarget.id); }}
        message="Usunąć to przekazanie do wylęgu?"
        danger
      />
      <ConfirmDialog
        open={fulfillOrderTarget != null}
        onClose={() => setFulfillOrderTarget(null)}
        onConfirm={async () => {
          if (fulfillOrderTarget?.id) await orderService.updateStatus(fulfillOrderTarget.id, 'zrealizowane');
        }}
        message={`Oznaczyć zamówienie ${fulfillOrderTarget?.buyerName ? `klienta "${fulfillOrderTarget.buyerName}"` : ''} jako zrealizowane?`}
      />
      <ConfirmDialog
        open={cancelOrderTarget != null}
        onClose={() => setCancelOrderTarget(null)}
        onConfirm={async () => {
          if (cancelOrderTarget?.id) await orderService.updateStatus(cancelOrderTarget.id, 'anulowane');
        }}
        message="Anulować to zamówienie?"
        danger
      />
      <ConfirmDialog
        open={deleteOrderTarget != null}
        onClose={() => setDeleteOrderTarget(null)}
        onConfirm={async () => { if (deleteOrderTarget?.id) await orderService.delete(deleteOrderTarget.id); }}
        message="Trwale usunąć to zamówienie?"
        danger
      />
    </div>
  );
}
