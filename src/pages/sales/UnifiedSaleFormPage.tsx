/**
 * UnifiedSaleFormPage — tworzy dokument sprzedaży z wieloma pozycjami.
 */
import React, { useEffect, useState } from 'react';
import { AskLLM } from '@/components/AskLLM';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { saleDocumentService, lineTotal } from '@/services/saleDocument.service';
import type { FormLine } from '@/services/saleDocument.service';
import { dairyService } from '@/services/dairy.service';
import { cashFlowService } from '@/services/cashFlow.service';
import { batchService } from '@/services/batch.service';
import { saleService } from '@/services/sale.service';
import type { DairyProduct, DairyBuyer } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import type { CashAccount } from '@/models/cashFlow.model';
import type { Batch } from '@/models/batch.model';
import type { SaleType } from '@/constants/phases';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import { Button } from '@/components/ui/Button';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

type LineActivity = 'drob' | 'sery' | 'inne';

const DROB_SALE_TYPES: SaleType[] = ['jaja', 'tuszki', 'ptaki_zywe', 'elementy'];
const DROB_ICONS: Record<SaleType, string> = {
  jaja: '🥚', tuszki: '🍗', ptaki_zywe: '🐔', elementy: '🦵', jaja_wewn: '🥚', inne: '🍯',
};

const newLine = (activity: LineActivity): FormLine => ({
  key: Math.random().toString(36).slice(2),
  activity,
  drobSaleType: 'tuszki',
  drobBatchId: '', drobBirdCount: '', drobWeightKg: '', drobEggsCount: '',
  dairyProductId: '',
  inneName: '', inneUnit: 'szt.', inneQuantity: '',
  quantity: '', unitPrice: '',
});

// ── Nabywca selector z inline dodawaniem ────────────────────────

function BuyerSelector({ buyers, value, onChange, onBuyerAdded }: {
  buyers: DairyBuyer[];
  value: string;
  onChange: (name: string) => void;
  onBuyerAdded: (updated: DairyBuyer[]) => void;
}) {
  const [showNew,    setShowNew]    = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newAnon,    setNewAnon]    = useState(false);
  const [newPhone,   setNewPhone]   = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newSaving,  setNewSaving]  = useState(false);
  const [newError,   setNewError]   = useState('');

  const selected = buyers.find(b => b.name === value);

  const handleSaveNew = async () => {
    if (!newName.trim()) { setNewError('Podaj nazwę.'); return; }
    setNewSaving(true); setNewError('');
    try {
      await dairyService.saveBuyer({
        name: newName.trim(), isAnonymous: newAnon,
        phone: newPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
      });
      const updated = await dairyService.getBuyers();
      onBuyerAdded(updated);
      onChange(newName.trim());
      setShowNew(false);
      setNewName(''); setNewPhone(''); setNewAddress(''); setNewAnon(false);
    } catch (e) {
      setNewError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setNewSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-600">Nabywca</label>
        <button type="button" onClick={() => setShowNew(v => !v)}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium">
          {showNew ? '← Wróć do listy' : '+ Nowy nabywca'}
        </button>
      </div>

      {!showNew ? (
        <div className="space-y-1">
          <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">— wybierz nabywcę —</option>
            {buyers.map(b => (
              <option key={b.id} value={b.name}>
                {b.isAnonymous ? '🏪' : '👤'} {b.name}{b.phone ? ` (${b.phone})` : ''}
              </option>
            ))}
          </select>
          {selected?.phone && (
            <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium">
              <span>📞</span><span>{selected.phone}</span><span className="text-gray-400">— zadzwoń</span>
            </a>
          )}
          {selected?.address && <p className="text-xs text-gray-400">📍 {selected.address}</p>}
        </div>
      ) : (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-blue-700">Nowy nabywca</p>

          {/* Typ nabywcy */}
          <div className="flex gap-2">
            <button onClick={() => setNewAnon(false)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                !newAnon ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-gray-200 text-gray-500'
              }`}>👤 Osoba / Firma</button>
            <button onClick={() => setNewAnon(true)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                newAnon ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500'
              }`}>🏪 Targ / Wystawa</button>
          </div>

          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={newAnon ? 'Nazwa miejsca / wydarzenia' : 'Imię i nazwisko / Firma'}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

          <div className="grid grid-cols-2 gap-2">
            <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
              placeholder="Telefon (opcjonalnie)"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <input type="text" value={newAddress} onChange={e => setNewAddress(e.target.value)}
              placeholder="Adres (opcjonalnie)"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {newError && <p className="text-xs text-red-600">⚠ {newError}</p>}
          <Button size="sm" loading={newSaving} disabled={!newName.trim()} onClick={handleSaveNew}>
            Zapisz i wybierz
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Główny formularz ─────────────────────────────────────────────

export function UnifiedSaleFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const activities = useActivitiesContext();
  const hasDrob = activities.some(a => a.key === 'drob' && a.isActive);
  const hasSery = activities.some(a => a.key === 'sery' && a.isActive);
  const defaultActivity: LineActivity = hasDrob ? 'drob' : hasSery ? 'sery' : 'inne';

  const [batches,       setBatches]       = useState<Batch[]>([]);
  const [products,      setProducts]      = useState<DairyProduct[]>([]);
  const [buyers,        setBuyers]        = useState<DairyBuyer[]>([]);
  const [accounts,      setAccounts]      = useState<CashAccount[]>([]);
  const [availableEggs, setAvailableEggs] = useState<number | null>(null);
  const [dataLoaded,    setDataLoaded]    = useState(false);

  const [saleDate,      setSaleDate]      = useState(new Date().toISOString().slice(0, 10));
  const [buyerName,     setBuyerName]     = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [notes,         setNotes]         = useState('');
  const [lines,         setLines]         = useState<FormLine[]>([newLine(defaultActivity)]);
  const [saving,        setSaving]        = useState<'rhd' | 'norhd' | null>(null);
  const [error,         setError]         = useState('');

  useEffect(() => {
    Promise.all([
      batchService.getAll(),
      dairyService.getProducts(),
      dairyService.getBuyers(),
      cashFlowService.getActiveAccounts(),
      saleService.getAvailableEggsCount(),
    ]).then(([b, p, buyerList, a, eggs]) => {
      setBatches(b.filter(x => x.status === 'active'));
      setProducts(p.filter(x => x.isActive));
      setBuyers(buyerList);
      setAccounts(a);
      setAvailableEggs(eggs);
      setDataLoaded(true);
    });
  }, []);

  const updateLine = (key: string, patch: Partial<FormLine>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const removeLine = (key: string) =>
    setLines(prev => prev.filter(l => l.key !== key));

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleSave = async (inRhd: boolean) => {
    if (lines.length === 0) { setError('Dodaj co najmniej jedną pozycję.'); return; }
    for (const l of lines) {
      if (l.activity === 'sery' && !l.dairyProductId) { setError('Wybierz produkt mleczarski.'); return; }
      if (l.activity === 'drob' && l.drobSaleType !== 'jaja' && !l.drobBatchId) { setError('Wybierz stado dla pozycji drobiu.'); return; }
      if (l.activity === 'inne' && !l.inneName.trim()) { setError('Podaj nazwę produktu w pozycji „Inne".'); return; }
    }
    setSaving(inRhd ? 'rhd' : 'norhd'); setError('');
    try {
      const buyer = buyers.find(b => b.name === buyerName.trim());
      const docId = await saleDocumentService.createDocument(
        {
          docDate:       saleDate,
          buyerName:     buyerName.trim() || undefined,
          buyerId:       buyer?.id,
          buyerAddress:  buyer?.address,
          buyerPhone:    buyer?.phone,
          inRhd,
          cashAccountId: cashAccountId ? Number(cashAccountId) : undefined,
          notes:         notes.trim() || undefined,
        },
        lines,
        products,
        buyer,
      );
      navigate(returnTo ?? `/sprzedaz/${docId}`);
    } catch (e: unknown) {
      const msg    = (e as { message?: string })?.message ?? String(e);
      const detail = (e as { details?: string })?.details ?? '';
      setError(detail ? `${msg} — ${detail}` : msg);
      setSaving(null);
    }
  };

  const fmt = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!dataLoaded) return <p className="text-sm text-gray-400 text-center py-12">Ładowanie…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <button onClick={() => returnTo ? navigate(returnTo) : navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Wróć</button>
        <h1 className="text-xl font-bold text-gray-900">Nowa sprzedaż</h1>
        {returnTo === '/mleko/rhd' && (
          <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-medium">→ RHD</span>
        )}
      </div>

      <div><AskLLM defaultQuery="co wpisać w ewidencji RHD rodzaj ilość produktu przykład" contextUrl="https://fermly.pl/przewodnik-rhd.html" summaryUrl="/przewodnik-rhd.summary.txt" /></div>

      {/* Nagłówek dokumentu */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
            <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konto kasowe / bankowe</label>
            <select value={cashAccountId} onChange={e => setCashAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">— nie księguj —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.type === 'bank' ? '🏦' : '💵'} {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <BuyerSelector
          buyers={buyers}
          value={buyerName}
          onChange={setBuyerName}
          onBuyerAdded={setBuyers}
        />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi do dokumentu</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Opcjonalne uwagi widoczne w szczegółach dokumentu…" />
        </div>
      </div>

      {/* Linie */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pozycje</p>
          {hasSery && (
            <Link to="/mleko/produkty" className="text-xs text-brand-600 hover:underline">📦 Zarządzaj produktami →</Link>
          )}
        </div>

        {lines.map((l, idx) => {
          const total     = lineTotal(l);
          const dairyProd = products.find(p => p.id === Number(l.dairyProductId));
          const unitLbl   = dairyProd ? UNIT_LABELS[dairyProd.unit as keyof typeof UNIT_LABELS] : '';
          return (
            <div key={l.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium w-4">{idx + 1}.</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {hasDrob && (
                    <button onClick={() => updateLine(l.key, { activity: 'drob' })}
                      className={`px-2 py-1 font-medium transition-colors ${l.activity === 'drob' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
                      🐔 Drób
                    </button>
                  )}
                  {hasSery && (
                    <button onClick={() => updateLine(l.key, { activity: 'sery' })}
                      className={`px-2 py-1 font-medium transition-colors ${l.activity === 'sery' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
                      🧀 Mleczarnia
                    </button>
                  )}
                  <button onClick={() => updateLine(l.key, { activity: 'inne' })}
                    className={`px-2 py-1 font-medium transition-colors ${l.activity === 'inne' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}>
                    🍯 Inne
                  </button>
                </div>
                <div className="flex-1" />
                {total > 0 && <span className="text-sm font-bold text-gray-800">{fmt(total)} zł</span>}
                <button onClick={() => removeLine(l.key)} className="text-gray-300 hover:text-red-400 ml-1 text-lg leading-none">×</button>
              </div>

              {l.activity === 'drob' && (
                <div className="space-y-2">
                  <div className={`grid gap-2 ${l.drobSaleType !== 'jaja' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rodzaj</label>
                      <select value={l.drobSaleType} onChange={e => updateLine(l.key, { drobSaleType: e.target.value as SaleType })}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        {DROB_SALE_TYPES.map(t => <option key={t} value={t}>{DROB_ICONS[t]} {SALE_TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                    {l.drobSaleType !== 'jaja' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Stado *</label>
                        <select value={l.drobBatchId} onChange={e => updateLine(l.key, { drobBatchId: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                          <option value="">— wybierz —</option>
                          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {l.drobSaleType === 'jaja' && (
                    <div className="space-y-1.5">
                      {availableEggs !== null && (
                        <div className={`text-xs px-2 py-1.5 rounded-lg ${availableEggs > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          🥚 Magazyn jaj: <strong>{availableEggs.toLocaleString('pl-PL')} szt.</strong> dostępnych
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Liczba jaj</label>
                          <input type="number" min="0" step="1" value={l.drobEggsCount} onChange={e => updateLine(l.key, { drobEggsCount: e.target.value })} placeholder="0 szt."
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt)</label>
                          <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateLine(l.key, { unitPrice: e.target.value })} placeholder="0.30"
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                      </div>
                    </div>
                  )}
                  {(l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Szt.</label>
                        <input type="number" min="0" step="1" value={l.drobBirdCount} onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })} placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Waga (kg)</label>
                        <input type="number" min="0" step="0.1" value={l.drobWeightKg} onChange={e => updateLine(l.key, { drobWeightKg: e.target.value })} placeholder="0.0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/kg)</label>
                        <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateLine(l.key, { unitPrice: e.target.value })} placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                    </div>
                  )}
                  {l.drobSaleType === 'ptaki_zywe' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba sztuk</label>
                        <input type="number" min="0" step="1" value={l.drobBirdCount} onChange={e => updateLine(l.key, { drobBirdCount: e.target.value })} placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt)</label>
                        <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateLine(l.key, { unitPrice: e.target.value })} placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {l.activity === 'sery' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Produkt *</label>
                    {dataLoaded && products.length === 0 ? (
                      <p className="text-xs text-amber-600 py-1">Brak produktów. <Link to="/mleko/produkty" className="text-brand-600 underline">Dodaj →</Link></p>
                    ) : (
                      <select value={l.dairyProductId}
                        onChange={e => {
                          const prod = products.find(p => p.id === Number(e.target.value));
                          updateLine(l.key, { dairyProductId: e.target.value, unitPrice: prod ? String(prod.defaultPricePln) : l.unitPrice });
                        }}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">— wybierz produkt —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{PRODUCT_ICONS[p.category]} {p.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ilość{unitLbl ? ` (${unitLbl})` : ''} *</label>
                      <input type="number" min="0" step="0.001" value={l.quantity} onChange={e => updateLine(l.key, { quantity: e.target.value })} placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cena{unitLbl ? ` (zł/${unitLbl})` : ' (zł)'} *</label>
                      <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateLine(l.key, { unitPrice: e.target.value })} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
              )}

              {l.activity === 'inne' && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                    🍯 Własne produkty: miód, dżemy, przetwory, świece, rozsady i inne.
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nazwa produktu *</label>
                    <input type="text" value={l.inneName} onChange={e => updateLine(l.key, { inneName: e.target.value })}
                      placeholder="np. Miód lipowy, Powidła śliwkowe, Rozsady pomidorów…"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ilość *</label>
                      <input type="number" min="0" step="1" value={l.inneQuantity} onChange={e => updateLine(l.key, { inneQuantity: e.target.value })} placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Jednostka</label>
                      <input type="text" value={l.inneUnit} onChange={e => updateLine(l.key, { inneUnit: e.target.value })}
                        placeholder="szt."
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cena (zł/szt) *</label>
                      <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={e => updateLine(l.key, { unitPrice: e.target.value })} placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={() => setLines(p => [...p, newLine(defaultActivity)])}
          className="w-full py-2.5 text-sm text-brand-600 hover:text-brand-800 font-medium border-2 border-dashed border-brand-200 rounded-xl hover:border-brand-400 transition-colors">
          + Dodaj kolejną pozycję
        </button>
      </div>

      {grandTotal > 0 && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-brand-700 font-medium">
            Razem ({lines.length} {lines.length === 1 ? 'pozycja' : lines.length < 5 ? 'pozycje' : 'pozycji'})
          </span>
          <span className="text-xl font-bold text-brand-800">{fmt(grandTotal)} zł</span>
        </div>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠ {error}</div>}

      <div className="space-y-2 pb-6">
        {/* Główny przycisk — zawsze "do RHD" (pełna szerokość, wyróżniony) */}
        <Button
          className="w-full text-base py-3"
          loading={saving === 'rhd'}
          disabled={!!saving || lines.length === 0 || grandTotal <= 0}
          onClick={() => handleSave(true)}
        >
          📋 Zapisz sprzedaż do ewidencji RHD
        </Button>
        {/* Opcja drugorzędna — bez RHD (mniejsza, szara) */}
        <Button
          variant="outline"
          className="w-full text-sm text-gray-400"
          loading={saving === 'norhd'}
          disabled={!!saving || lines.length === 0 || grandTotal <= 0}
          onClick={() => handleSave(false)}
        >
          Zapisz tylko wewnętrznie (bez RHD)
        </Button>
        <Button variant="outline" className="w-full" onClick={() => returnTo ? navigate(returnTo) : navigate(-1)}>Anuluj</Button>
        <p className="text-xs text-gray-400 text-center">RHD — sprzedaż bezpośrednia wliczana do limitu {new Date().getFullYear()} r.</p>
      </div>
    </div>
  );
}
