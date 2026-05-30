/**
 * UnifiedSaleFormPage — wieloliniowy formularz sprzedaży
 * Obsługuje produkty z różnych działalności (Drób + Mleczarnia) w jednej transakcji.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { saleService } from '@/services/sale.service';
import { slaughterService } from '@/services/slaughter.service';
import { batchService } from '@/services/batch.service';
import { cashFlowService } from '@/services/cashFlow.service';
import type { DairyProduct, DairyBuyer } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import type { CashAccount } from '@/models/cashFlow.model';
import type { Batch } from '@/models/batch.model';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import type { SaleType } from '@/constants/phases';
import { Button } from '@/components/ui/Button';
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
  quantity: string;
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

const lineTotal = (l: SaleLine): number => {
  if (l.activity === 'sery') {
    return (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  if (l.drobSaleType === 'jaja') {
    return (parseInt(l.drobEggsCount) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') {
    return (parseFloat(l.drobWeightKg) || 0) * (parseFloat(l.unitPrice) || 0);
  }
  return (parseInt(l.drobBirdCount) || 0) * (parseFloat(l.unitPrice) || 0);
};

// ── Komponent wyboru nabywcy ─────────────────────────────────────

function BuyerSelector({ buyers, value, onChange }: {
  buyers: DairyBuyer[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const selected = buyers.find(b => b.name === value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600">Nabywca</label>
        <div className="flex items-center gap-2">
          <Link to="/mleko/nabywcy" className="text-xs text-brand-600 hover:underline">
            + Zarządzaj nabywcami
          </Link>
          <button
            type="button"
            onClick={() => { setMode(m => m === 'select' ? 'manual' : 'select'); onChange(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {mode === 'select' ? 'wpisz ręcznie' : 'wybierz z listy'}
          </button>
        </div>
      </div>

      {mode === 'select' ? (
        <div className="space-y-1">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— wybierz nabywcę —</option>
            {buyers.map(b => (
              <option key={b.id} value={b.name}>
                {b.isAnonymous ? '🏪' : '👤'} {b.name}
                {b.phone ? ` (${b.phone})` : ''}
              </option>
            ))}
          </select>
          {selected?.phone && (
            <a
              href={`tel:${selected.phone}`}
              className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium"
            >
              <span>📞</span>
              <span>{selected.phone}</span>
              <span className="text-gray-400">— zadzwoń</span>
            </a>
          )}
          {selected?.address && (
            <p className="text-xs text-gray-400">📍 {selected.address}</p>
          )}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Wpisz imię, firmę lub miejsce…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      )}
    </div>
  );
}

// ── Główny formularz ─────────────────────────────────────────────

export function UnifiedSaleFormPage() {
  const navigate = useNavigate();
  const activities = useActivitiesContext();
  const hasDrob = activities.some(a => a.key === 'drob' && a.isActive);
  const hasSery = activities.some(a => a.key === 'sery' && a.isActive);
  const defaultActivity: LineActivity = hasSery ? 'sery' : 'drob';

  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [products,   setProducts]   = useState<DairyProduct[]>([]);
  const [buyers,     setBuyers]     = useState<DairyBuyer[]>([]);
  const [accounts,   setAccounts]   = useState<CashAccount[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [saleDate,      setSaleDate]      = useState(new Date().toISOString().slice(0, 10));
  const [buyerName,     setBuyerName]     = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [notes,         setNotes]         = useState('');
  const [lines,         setLines]         = useState<SaleLine[]>([newLine(defaultActivity)]);
  const [saving,        setSaving]        = useState<'rhd' | 'norhd' | null>(null);
  const [error,         setError]         = useState('');

  useEffect(() => {
    Promise.all([
      batchService.getAll(),
      dairyService.getProducts(),
      dairyService.getBuyers(),
      cashFlowService.getActiveAccounts(),
    ]).then(([b, p, buyerList, a]) => {
      setBatches(b.filter(x => x.status === 'active'));
      setProducts(p.filter(x => x.isActive));
      setBuyers(buyerList);
      setAccounts(a);
      setDataLoaded(true);
    });
  }, []);

  const updateLine = (key: string, patch: Partial<SaleLine>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const removeLine = (key: string) =>
    setLines(prev => prev.filter(l => l.key !== key));

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleSave = async (inRhd: boolean) => {
    if (lines.length === 0) { setError('Dodaj co najmniej jedną pozycję.'); return; }
    for (const l of lines) {
      if (l.activity === 'sery' && !l.dairyProductId) {
        setError('Wybierz produkt mleczarski w każdej pozycji.'); return;
      }
      if (l.activity === 'drob' && l.drobSaleType !== 'jaja' && !l.drobBatchId) {
        setError('Wybierz stado dla każdej pozycji drobiu (poza jajami).'); return;
      }
    }
    setSaving(inRhd ? 'rhd' : 'norhd'); setError('');
    try {
      const savedIds: { type: 'sale' | 'dairy_sale'; id: number }[] = [];
      const effectiveBuyer = buyerName.trim() || 'Nabywca detaliczny';

      for (const l of lines) {
        if (l.activity === 'sery') {
          const prod = products.find(p => p.id === Number(l.dairyProductId));
          if (!prod) continue;
          const qty   = parseFloat(l.quantity) || 0;
          const price = parseFloat(l.unitPrice) || 0;
          if (qty <= 0) continue;
          const buyer = buyers.find(b => b.name === buyerName.trim());
          const id = await dairyService.saveSale({
            saleDate,
            productId:        prod.id!,
            productName:      prod.name,
            productCategory:  prod.category,
            unit:             prod.unit,
            quantity:         qty,
            unitPricePln:     price,
            totalValuePln:    qty * price,
            buyerId:          buyer?.id,
            buyerName:        effectiveBuyer,
            buyerAddress:     buyer?.address,
            inRhd,
            rhdYear: new Date(saleDate).getFullYear(),
          });
          savedIds.push({ type: 'dairy_sale', id });
        }

        if (l.activity === 'drob') {
          const total   = lineTotal(l);
          if (total <= 0) continue;
          const batchId = l.drobBatchId ? Number(l.drobBatchId) : undefined;
          const saleData: Parameters<typeof saleService.create>[0] = {
            batchId:         batchId ?? 0,
            saleDate,
            saleType:        l.drobSaleType,
            totalRevenuePln: total,
            buyerName:       buyerName.trim() || undefined,
            inRhd,
          };
          if (l.drobSaleType === 'jaja') {
            saleData.eggsCount    = parseInt(l.drobEggsCount) || 0;
            saleData.eggPricePln  = parseFloat(l.unitPrice) || 0;
            saleData.batchId      = batchId ?? 0;
          } else if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') {
            saleData.birdCount      = parseInt(l.drobBirdCount) || 0;
            saleData.weightKg       = parseFloat(l.drobWeightKg) || 0;
            saleData.pricePerKgPln  = parseFloat(l.unitPrice) || 0;
          } else {
            saleData.birdCount      = parseInt(l.drobBirdCount) || 0;
            saleData.pricePerKgPln  = parseFloat(l.unitPrice) || 0;
          }
          const id = await saleService.create(saleData);
          savedIds.push({ type: 'sale', id });

          if ((l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') &&
              batchId && (parseInt(l.drobBirdCount) || 0) > 0) {
            const existing = await slaughterService.getByBatch(batchId);
            if (!existing.some(s => s.slaughterDate === saleDate)) {
              await slaughterService.create({
                batchId,
                slaughterDate:        saleDate,
                birdsSlaughtered:     parseInt(l.drobBirdCount) || 0,
                liveWeightTotalKg:    0,
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
        const scope = lines.some(l => l.activity === 'drob') && lines.some(l => l.activity === 'sery')
          ? 'drob'
          : lines[0].activity === 'sery' ? 'sery' : 'drob';
        const desc = [
          ...new Set(lines.map(l =>
            l.activity === 'sery'
              ? (products.find(p => p.id === Number(l.dairyProductId))?.name ?? 'produkt')
              : SALE_TYPE_LABELS[l.drobSaleType]
          ))
        ].join(', ');
        await cashFlowService.createTransaction({
          accountId:   Number(cashAccountId),
          date:        saleDate,
          type:        'income',
          scope,
          category:    scope === 'sery' ? 'Sprzedaż serów' : 'Sprzedaż drobiu',
          description: `${desc}${effectiveBuyer !== 'Nabywca detaliczny' ? ` — ${effectiveBuyer}` : ''}`,
          amountPln:   grandTotal,
          sourceType:  'unified_sale',
          sourceId:    savedIds[0]?.id,
        });
      }

      navigate('/sprzedaz');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(null);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!dataLoaded) {
    return <p className="text-sm text-gray-400 text-center py-12">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Wróć</button>
        <h1 className="text-xl font-bold text-gray-900">Nowa sprzedaż</h1>
      </div>

      {/* Nagłówek transakcji */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
            <input
              type="date"
              value={saleDate}
              onChange={e => setSaleDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konto kasowe / bankowe</label>
            <select
              value={cashAccountId}
              onChange={e => setCashAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— nie księguj —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.type === 'bank' ? '🏦' : '💵'} {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nabywca z listą */}
        <BuyerSelector buyers={buyers} value={buyerName} onChange={setBuyerName} />

      </div>

      {/* Linie produktów */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pozycje</p>
          {hasSery && (
            <Link to="/mleko/produkty" className="text-xs text-brand-600 hover:underline">
              📦 Zarządzaj produktami →
            </Link>
          )}
        </div>

        {lines.map((l, idx) => {
          const total    = lineTotal(l);
          const dairyProd = products.find(p => p.id === Number(l.dairyProductId));
          const unitLbl   = dairyProd ? UNIT_LABELS[dairyProd.unit as keyof typeof UNIT_LABELS] : '';

          return (
            <div key={l.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
              {/* Nagłówek linii */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium w-4">{idx + 1}.</span>

                {/* Przełącznik działalności */}
                {hasDrob && hasSery && (
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => updateLine(l.key, { activity: 'drob' })}
                      className={`px-2 py-1 font-medium transition-colors ${
                        l.activity === 'drob' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >🐔 Drób</button>
                    <button
                      onClick={() => updateLine(l.key, { activity: 'sery' })}
                      className={`px-2 py-1 font-medium transition-colors ${
                        l.activity === 'sery' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-50'
                      }`}
                    >🧀 Mleczarnia</button>
                  </div>
                )}

                <div className="flex-1" />
                {total > 0 && (
                  <span className="text-sm font-bold text-gray-800">{fmt(total)} zł</span>
                )}
                <button
                  onClick={() => removeLine(l.key)}
                  className="text-gray-300 hover:text-red-400 ml-1 text-lg leading-none"
                  title="Usuń pozycję"
                >×</button>
              </div>

              {/* Pola — Drób */}
              {l.activity === 'drob' && (
                <div className="space-y-2">
                  <div className={`grid gap-2 ${l.drobSaleType !== 'jaja' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rodzaj</label>
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
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {l.drobSaleType === 'jaja' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba jaj</label>
                        <input type="number" min="0" step="1" value={l.drobEggsCount}
                          onChange={e => updateLine(l.key, { drobEggsCount: e.target.value })}
                          placeholder="0 szt."
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt)</label>
                        <input type="number" min="0" step="0.01" value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.30"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  )}

                  {(l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Szt.</label>
                        <input type="number" min="0" step="1" value={l.drobBirdCount}
                          onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Waga (kg)</label>
                        <input type="number" min="0" step="0.1" value={l.drobWeightKg}
                          onChange={e => updateLine(l.key, { drobWeightKg: e.target.value })}
                          placeholder="0.0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/kg)</label>
                        <input type="number" min="0" step="0.01" value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  )}

                  {l.drobSaleType === 'ptaki_zywe' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba sztuk</label>
                        <input type="number" min="0" step="1" value={l.drobBirdCount}
                          onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt)</label>
                        <input type="number" min="0" step="0.01" value={l.unitPrice}
                          onChange={e => updateLine(l.key, { unitPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pola — Mleczarnia */}
              {l.activity === 'sery' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Produkt *</label>
                    {dataLoaded && products.length === 0 ? (
                      <p className="text-xs text-amber-600 py-1">
                        Brak produktów w katalogu.{' '}
                        <Link to="/mleko/produkty" className="text-brand-600 underline">Dodaj →</Link>
                      </p>
                    ) : (
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
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Ilość{unitLbl ? ` (${unitLbl})` : ''} *
                      </label>
                      <input type="number" min="0" step="0.001" value={l.quantity}
                        onChange={e => updateLine(l.key, { quantity: e.target.value })}
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Cena{unitLbl ? ` (zł/${unitLbl})` : ' (zł)'} *
                      </label>
                      <input type="number" min="0" step="0.01" value={l.unitPrice}
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

        {/* JEDEN przycisk dodawania */}
        <button
          onClick={() => setLines(p => [...p, newLine(defaultActivity)])}
          className="w-full py-2.5 text-sm text-brand-600 hover:text-brand-800 font-medium border-2 border-dashed border-brand-200 rounded-xl hover:border-brand-400 transition-colors"
        >
          + Dodaj kolejną pozycję
        </button>
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          ⚠ {error}
        </div>
      )}

      <div className="space-y-2 pb-6">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            loading={saving === 'rhd'}
            disabled={!!saving || lines.length === 0 || grandTotal <= 0}
            onClick={() => handleSave(true)}
          >
            📋 Zapisz do RHD
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            loading={saving === 'norhd'}
            disabled={!!saving || lines.length === 0 || grandTotal <= 0}
            onClick={() => handleSave(false)}
          >
            📦 Zapisz bez RHD
          </Button>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
          Anuluj
        </Button>
        <p className="text-xs text-gray-400 text-center">
          RHD — sprzedaż bezpośrednia wliczana do limitu {new Date().getFullYear()} r.
        </p>
      </div>
    </div>
  );
}
