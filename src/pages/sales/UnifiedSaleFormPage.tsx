/**
 * UnifiedSaleFormPage — wieloliniowy formularz sprzedaży
 * Obsługuje produkty z różnych działalności (Drób + Mleczarnia) w jednej transakcji.
 * Każda linia trafia do właściwego serwisu; kasa dostaje jedną zbiorczą transakcję.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { saleService } from '@/services/sale.service';
import { slaughterService } from '@/services/slaughter.service';
import { batchService } from '@/services/batch.service';
import { cashFlowService } from '@/services/cashFlow.service';
import type { DairyProduct } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import type { CashAccount } from '@/models/cashFlow.model';
import type { Batch } from '@/models/batch.model';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import type { SaleType } from '@/constants/phases';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

// ── Typy ────────────────────────────────────────────────────────

type LineActivity = 'drob' | 'sery';

interface SaleLine {
  key: string;
  activity: LineActivity;
  // Drób
  drobSaleType: SaleType;
  drobBatchId: string;
  drobBirdCount: string;
  drobWeightKg: string;
  drobEggsCount: string;
  // Dairy
  dairyProductId: string;
  // Wspólne
  quantity: string;   // dla mleczarni = ilość w jednostkach produktu; dla drobiu = główna miara
  unitPrice: string;
}

const DROB_SALE_TYPES: SaleType[] = ['jaja', 'tuszki', 'ptaki_zywe', 'elementy'];
const DROB_ICONS: Record<SaleType, string> = {
  jaja: '🥚', tuszki: '🍗', ptaki_zywe: '🐔', elementy: '🦵', jaja_wewn: '🥚',
};

const newLine = (activity: LineActivity): SaleLine => ({
  key: Math.random().toString(36).slice(2),
  activity,
  drobSaleType: 'tuszki',
  drobBatchId: '',
  drobBirdCount: '',
  drobWeightKg: '',
  drobEggsCount: '',
  dairyProductId: '',
  quantity: '',
  unitPrice: '',
});

const lineTotal = (l: SaleLine, products: DairyProduct[]): number => {
  if (l.activity === 'sery') {
    return (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  if (l.drobSaleType === 'jaja') {
    return (parseInt(l.drobEggsCount) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') {
    return (parseFloat(l.drobWeightKg) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  // ptaki_zywe
  return (parseInt(l.drobBirdCount) || 0) * (parseFloat(l.unitPrice) || 0);
};

// ── Komponent ────────────────────────────────────────────────────

export function UnifiedSaleFormPage() {
  const navigate = useNavigate();
  const activities = useActivitiesContext();
  const hasDrob = activities.some(a => a.key === 'drob' && a.isActive);
  const hasSery = activities.some(a => a.key === 'sery' && a.isActive);

  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [products,   setProducts]   = useState<DairyProduct[]>([]);
  const [accounts,   setAccounts]   = useState<CashAccount[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [saleDate,      setSaleDate]      = useState(new Date().toISOString().slice(0, 10));
  const [buyerName,     setBuyerName]     = useState('');
  const [cashAccountId, setCashAccountId] = useState<string>('');
  const [inRhd,         setInRhd]         = useState(true);
  const [notes,         setNotes]         = useState('');
  const [lines,         setLines]         = useState<SaleLine[]>([newLine(hasSery ? 'sery' : 'drob')]);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    Promise.all([
      batchService.getAll(),
      dairyService.getProducts(),
      cashFlowService.getActiveAccounts(),
    ]).then(([b, p, a]) => {
      setBatches(b.filter(x => x.status === 'active'));
      setProducts(p.filter(x => x.isActive));
      setAccounts(a);
      setDataLoaded(true);
    });
  }, []);

  const updateLine = (key: string, patch: Partial<SaleLine>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));

  const removeLine = (key: string) =>
    setLines(prev => prev.filter(l => l.key !== key));

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l, products), 0);

  const handleSave = async () => {
    if (lines.length === 0) { setError('Dodaj co najmniej jedną pozycję.'); return; }
    for (const l of lines) {
      if (l.activity === 'sery' && !l.dairyProductId) {
        setError('Wybierz produkt mleczarski w każdej pozycji.'); return;
      }
      if (l.activity === 'drob' && l.drobSaleType !== 'jaja' && !l.drobBatchId) {
        setError('Wybierz stado dla każdej pozycji drobiu (poza jajami).'); return;
      }
    }
    setSaving(true); setError('');
    try {
      const savedIds: { type: 'sale' | 'dairy_sale'; id: number }[] = [];

      for (const l of lines) {
        if (l.activity === 'sery') {
          const prod = products.find(p => p.id === Number(l.dairyProductId));
          if (!prod) continue;
          const qty   = parseFloat(l.quantity) || 0;
          const price = parseFloat(l.unitPrice) || 0;
          if (qty <= 0) continue;
          const id = await dairyService.saveSale({
            saleDate,
            productId: prod.id!,
            productName: prod.name,
            productCategory: prod.category,
            unit: prod.unit,
            quantity: qty,
            unitPricePln: price,
            totalValuePln: qty * price,
            buyerName: buyerName.trim() || 'Nabywca detaliczny',
            inRhd,
            rhdYear: new Date(saleDate).getFullYear(),
          });
          savedIds.push({ type: 'dairy_sale', id });
        }

        if (l.activity === 'drob') {
          const total = lineTotal(l, products);
          if (total <= 0) continue;
          const batchId = l.drobBatchId ? Number(l.drobBatchId) : undefined;

          const saleData: Parameters<typeof saleService.create>[0] = {
            batchId: batchId ?? 0,
            saleDate,
            saleType: l.drobSaleType,
            totalRevenuePln: total,
            buyerName: buyerName.trim() || undefined,
            inRhd,
          };

          if (l.drobSaleType === 'jaja') {
            saleData.eggsCount = parseInt(l.drobEggsCount) || 0;
            saleData.eggPricePln = parseFloat(l.unitPrice) || 0;
            saleData.batchId = batchId ?? 0;
          } else if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') {
            saleData.birdCount  = parseInt(l.drobBirdCount) || 0;
            saleData.weightKg   = parseFloat(l.drobWeightKg) || 0;
            saleData.pricePerKgPln = parseFloat(l.unitPrice) || 0;
          } else if (l.drobSaleType === 'ptaki_zywe') {
            saleData.birdCount  = parseInt(l.drobBirdCount) || 0;
            saleData.pricePerKgPln = parseFloat(l.unitPrice) || 0;
          }

          const id = await saleService.create(saleData);
          savedIds.push({ type: 'sale', id });

          // Side effects — tuszki/elementy auto-ubój
          if ((l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') &&
              batchId && (parseInt(l.drobBirdCount) || 0) > 0) {
            const existing = await slaughterService.getByBatch(batchId);
            if (!existing.some(s => s.slaughterDate === saleDate)) {
              await slaughterService.create({
                batchId,
                slaughterDate: saleDate,
                birdsSlaughtered: parseInt(l.drobBirdCount) || 0,
                liveWeightTotalKg: 0,
                carcassWeightTotalKg: parseFloat(l.drobWeightKg) || 0,
                notes: 'Auto-ubój przy rejestracji sprzedaży.',
              });
            }
          }
          if (batchId && (l.drobSaleType === 'ptaki_zywe' || l.drobSaleType === 'tuszki')) {
            await batchService.checkAndAutoClose(batchId);
          }
        }
      }

      // Jedna transakcja kasowa dla całej kwoty
      if (cashAccountId && grandTotal > 0) {
        const activityScope = lines.some(l => l.activity === 'drob') &&
                              lines.some(l => l.activity === 'sery')
          ? 'drob'   // scope musi być jeden — użyj drob jeśli jest mix
          : lines[0].activity === 'sery' ? 'sery' : 'drob';

        const desc = [
          ...new Set(lines.map(l =>
            l.activity === 'sery'
              ? (products.find(p => p.id === Number(l.dairyProductId))?.name ?? 'produkt')
              : SALE_TYPE_LABELS[l.drobSaleType]
          ))
        ].join(', ');

        await cashFlowService.createTransaction({
          accountId: Number(cashAccountId),
          date: saleDate,
          type: 'income',
          scope: activityScope,
          category: activityScope === 'sery' ? 'Sprzedaż serów' : 'Sprzedaż drobiu',
          description: `${desc}${buyerName ? ` — ${buyerName}` : ''}`,
          amountPln: grandTotal,
          sourceType: 'unified_sale',
          sourceId: savedIds[0]?.id,
        });
      }

      navigate('/sprzedaz');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
        <h1 className="text-xl font-bold text-gray-900">Nowa sprzedaż</h1>
      </div>

      {/* Nagłówek transakcji */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Data *" type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
          <Input
            label="Nabywca"
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            placeholder="Imię, firma lub targ…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konto kasowe / bankowe</label>
            <select
              value={cashAccountId}
              onChange={e => setCashAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— nie księguj w kasie —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.type === 'bank' ? '🏦' : '💵'} {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={inRhd}
                onChange={e => setInRhd(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600"
              />
              <span>Ewidencja RHD</span>
            </label>
          </div>
        </div>
      </div>

      {/* Linie produktów */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Pozycje sprzedaży</p>

        {lines.map((l, idx) => {
          const total = lineTotal(l, products);
          const dairyProd = products.find(p => p.id === Number(l.dairyProductId));

          return (
            <div key={l.key} className={`bg-white rounded-xl border shadow-sm p-3 space-y-2 ${
              l.activity === 'sery' ? 'border-brand-100' : 'border-gray-100'
            }`}>
              {/* Nagłówek linii */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 w-5 text-center">{idx + 1}</span>

                {/* Przełącznik działalności */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {hasDrob && (
                    <button
                      onClick={() => updateLine(l.key, { activity: 'drob' })}
                      className={`px-2 py-1 font-medium transition-colors ${
                        l.activity === 'drob' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      🐔 Drób
                    </button>
                  )}
                  {hasSery && (
                    <button
                      onClick={() => updateLine(l.key, { activity: 'sery' })}
                      className={`px-2 py-1 font-medium transition-colors ${
                        l.activity === 'sery' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      🧀 Mleczarnia
                    </button>
                  )}
                </div>

                <div className="flex-1" />
                {total > 0 && (
                  <span className="text-sm font-bold text-gray-800">{fmt(total)} zł</span>
                )}
                <button
                  onClick={() => removeLine(l.key)}
                  className="text-gray-300 hover:text-red-400 ml-1"
                  title="Usuń pozycję"
                >✕</button>
              </div>

              {/* Pola drób */}
              {l.activity === 'drob' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rodzaj *</label>
                      <select
                        value={l.drobSaleType}
                        onChange={e => updateLine(l.key, { drobSaleType: e.target.value as SaleType })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {DROB_SALE_TYPES.map(t => (
                          <option key={t} value={t}>{DROB_ICONS[t]} {SALE_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    {l.drobSaleType !== 'jaja' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Stado *</label>
                        <select
                          value={l.drobBatchId}
                          onChange={e => updateLine(l.key, { drobBatchId: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">— wybierz —</option>
                          {batches.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.species})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {l.drobSaleType === 'jaja' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba jaj *</label>
                        <input
                          type="number" min="0" step="1"
                          value={l.drobEggsCount}
                          onChange={e => updateLine(l.key, { drobEggsCount: e.target.value })}
                          placeholder="0 szt."
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt) *</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.30"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  ) : (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Szt. *</label>
                        <input
                          type="number" min="0" step="1"
                          value={l.drobBirdCount}
                          onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Waga (kg) *</label>
                        <input
                          type="number" min="0" step="0.1"
                          value={l.drobWeightKg}
                          onChange={e => updateLine(l.key, { drobWeightKg: e.target.value })}
                          placeholder="0.0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/kg) *</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  ) : (
                    /* ptaki_zywe */
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba sztuk *</label>
                        <input
                          type="number" min="0" step="1"
                          value={l.drobBirdCount}
                          onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt) *</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pola mleczarnia */}
              {l.activity === 'sery' && (
                <div className="space-y-2">
                  {dataLoaded && products.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      Brak produktów.{' '}
                      <Link to="/mleko/produkty" className="text-brand-600 underline">Dodaj katalog →</Link>
                    </p>
                  ) : (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Produkt *</label>
                      <select
                        value={l.dairyProductId}
                        onChange={e => {
                          const prod = products.find(p => p.id === Number(e.target.value));
                          updateLine(l.key, {
                            dairyProductId: e.target.value,
                            unitPrice: prod ? String(prod.defaultPricePln) : l.unitPrice,
                          });
                        }}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">— wybierz produkt —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {PRODUCT_ICONS[p.category]} {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Ilość {dairyProd ? `(${UNIT_LABELS[dairyProd.unit as keyof typeof UNIT_LABELS]})` : ''} *
                      </label>
                      <input
                        type="number" min="0" step="0.001"
                        value={l.quantity}
                        onChange={e => updateLine(l.key, { quantity: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Cena {dairyProd ? `(zł/${UNIT_LABELS[dairyProd.unit as keyof typeof UNIT_LABELS]})` : '(zł)'} *
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={l.unitPrice}
                        onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Dodaj pozycję */}
        <div className="flex gap-2">
          {hasSery && (
            <button
              onClick={() => setLines(p => [...p, newLine('sery')])}
              className="flex-1 py-2 text-sm text-brand-600 hover:text-brand-800 font-medium border-2 border-dashed border-brand-200 rounded-xl hover:border-brand-300 transition-colors"
            >
              + Produkt mleczarski
            </button>
          )}
          {hasDrob && (
            <button
              onClick={() => setLines(p => [...p, newLine('drob')])}
              className="flex-1 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
            >
              + Produkt drobiowy
            </button>
          )}
        </div>
      </div>

      {/* Uwagi */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Opcjonalne uwagi do całej sprzedaży…"
        />
      </div>

      {/* Podsumowanie */}
      {grandTotal > 0 && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-brand-700 font-medium">
            Razem ({lines.length} {lines.length === 1 ? 'pozycja' : lines.length < 5 ? 'pozycje' : 'pozycji'})
          </span>
          <span className="text-xl font-bold text-brand-800">{fmt(grandTotal)} zł</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠ {error}</div>
      )}

      <div className="flex gap-3 pb-6">
        <Button className="flex-1" loading={saving} disabled={lines.length === 0 || grandTotal <= 0} onClick={handleSave}>
          Zapisz sprzedaż →
        </Button>
        <Button variant="outline" onClick={() => navigate('/sprzedaz')}>Anuluj</Button>
      </div>
    </div>
  );
}
