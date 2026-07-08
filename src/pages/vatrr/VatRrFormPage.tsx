import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { vatRrService } from '@/services/vatRr.service';
import { dairyService } from '@/services/dairy.service';
import { cashFlowService } from '@/services/cashFlow.service';
import type { DairyProduct, DairyBuyer, ProductUnit } from '@/models/dairy.model';
import { UNIT_LABELS } from '@/models/dairy.model';
import type { CashAccount } from '@/models/cashFlow.model';
import type { VatRrLine } from '@/models/vatRr.model';
import { lineNetGr, computeTotals, kwotaSlownie, grToPln, isValidNip } from '@/utils/vatRr';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

interface LineDraft {
  productId?: number;
  productName: string;
  qualityClass: string;
  unit: ProductUnit;
  quantity: string;   // wpisywana w jednostkach (kg/szt)
  price: string;      // wpisywana w zł
}

const emptyLine = (): LineDraft => ({ productName: '', qualityClass: '', unit: 'kg', quantity: '', price: '' });

const UNITS: ProductUnit[] = ['kg', 'szt', 'L', 'opak'];

export function VatRrFormPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<DairyProduct[]>([]);
  const [buyers, setBuyers] = useState<DairyBuyer[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);

  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerId, setBuyerId] = useState<number | ''>('');
  const [manualBuyer, setManualBuyer] = useState({ name: '', address: '', nip: '' });
  const [useManual, setUseManual] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>('transfer');
  const [cashAccountId, setCashAccountId] = useState<number | ''>('');
  const [inRhd, setInRhd] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      dairyService.getProducts(),
      dairyService.getBuyers(),
      cashFlowService.getActiveAccounts(),
    ]).then(([prods, buys, accs]) => {
      setProducts(prods.filter(p => p.isActive));
      setBuyers(buys);
      setAccounts(accs);
    });
  }, []);

  const selectedBuyer = buyers.find(b => b.id === buyerId);

  // Pozycje → grosze → sumy (źródło prawdy = grosze)
  const lineNets = useMemo(() => lines.map(l => {
    const qm = Math.round((parseFloat(l.quantity) || 0) * 1000);
    const pg = Math.round((parseFloat(l.price) || 0) * 100);
    return lineNetGr(qm, pg);
  }), [lines]);
  const totals = useMemo(() => computeTotals(lineNets, 7), [lineNets]);

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const pickProduct = (i: number, pid: string) => {
    if (!pid) { setLine(i, { productId: undefined }); return; }
    const p = products.find(pr => pr.id === Number(pid));
    if (!p) return;
    setLine(i, { productId: p.id, productName: p.name, unit: p.unit, price: String(p.defaultPricePln || '') });
  };

  const buyerData = () => useManual
    ? { name: manualBuyer.name.trim(), address: manualBuyer.address.trim() || undefined, nip: manualBuyer.nip.trim() || undefined }
    : selectedBuyer
      ? { name: selectedBuyer.name, address: selectedBuyer.address, nip: selectedBuyer.nip }
      : null;

  const validate = (): string | null => {
    const b = buyerData();
    if (!b || !b.name) return 'Wybierz nabywcę lub wpisz jego dane.';
    if (!b.nip) return 'Nabywca musi mieć NIP (VAT RR dotyczy czynnych podatników VAT).';
    if (!isValidNip(b.nip)) return 'NIP nabywcy ma błędną sumę kontrolną.';
    if (new Date(purchaseDate) > new Date(new Date().toISOString().slice(0, 10))) return 'Data nabycia nie może być z przyszłości.';
    const valid = lines.filter(l => l.productName.trim() && (parseFloat(l.quantity) || 0) > 0 && (parseFloat(l.price) || 0) > 0);
    if (valid.length === 0) return 'Dodaj co najmniej jedną pozycję (nazwa, ilość > 0, cena > 0).';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    try {
      const b = buyerData()!;
      const outLines: VatRrLine[] = lines
        .filter(l => l.productName.trim() && (parseFloat(l.quantity) || 0) > 0 && (parseFloat(l.price) || 0) > 0)
        .map((l, i) => {
          const quantityMilli = Math.round((parseFloat(l.quantity) || 0) * 1000);
          const unitPriceGr = Math.round((parseFloat(l.price) || 0) * 100);
          return {
            position: i + 1,
            productId: l.productId,
            productName: l.productName.trim(),
            qualityClass: l.qualityClass.trim() || undefined,
            unit: l.unit,
            quantityMilli,
            unitPriceGr,
            netValueGr: lineNetGr(quantityMilli, unitPriceGr),
          };
        });
      const id = await vatRrService.createInvoice({
        buyerId: !useManual && typeof buyerId === 'number' ? buyerId : undefined,
        buyerName: b.name,
        buyerAddress: b.address,
        buyerNip: b.nip,
        purchaseDate,
        flatRatePct: 7,
        paymentMethod,
        status: 'draft',
        inRhd,
        cashAccountId: cashAccountId !== '' ? cashAccountId : undefined,
        notes: notes.trim() || undefined,
      }, outLines);
      navigate(`/vat-rr/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/vat-rr" className="text-gray-400 hover:text-gray-600 text-sm">← Faktury VAT RR</Link>
        <h1 className="text-xl font-bold text-gray-900">Nowy projekt faktury VAT RR</h1>
      </div>

      <Card padding="md">
        <div className="space-y-4">
          <Input label="Data dokonania nabycia *" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />

          {/* Nabywca */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Nabywca (czynny podatnik VAT) *</label>
              <Link to="/mleko/nabywcy" className="text-xs text-brand-600 hover:text-brand-800">+ Zarządzaj odbiorcami</Link>
            </div>
            {!useManual ? (
              <select value={buyerId} onChange={e => setBuyerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— wybierz odbiorcę —</option>
                {buyers.filter(b => !b.isAnonymous).map(b => (
                  <option key={b.id} value={b.id}>👤 {b.name}{b.nip ? ` · NIP ${b.nip}` : ' · brak NIP'}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <Input label="Nazwa nabywcy" value={manualBuyer.name} onChange={e => setManualBuyer(m => ({ ...m, name: e.target.value }))} placeholder="np. Restauracja Pod Lipą sp. z o.o." />
                <Input label="Adres" value={manualBuyer.address} onChange={e => setManualBuyer(m => ({ ...m, address: e.target.value }))} placeholder="ul. …, 00-000 …" />
                <Input label="NIP" value={manualBuyer.nip} onChange={e => setManualBuyer(m => ({ ...m, nip: e.target.value }))} placeholder="10 cyfr" />
              </div>
            )}
            <button type="button" onClick={() => setUseManual(v => !v)}
              className="mt-1.5 text-xs text-brand-600 hover:text-brand-800">
              {useManual ? '← wybierz z listy odbiorców' : '✏️ wpisz dane ręcznie'}
            </button>
            {!useManual && selectedBuyer && !selectedBuyer.nip && (
              <p className="text-xs text-amber-600 mt-1">⚠ Ten odbiorca nie ma NIP — uzupełnij go w „Odbiorcy" lub wpisz ręcznie.</p>
            )}
          </div>

          {/* Pozycje */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Pozycje (produkty rolne) *</label>
            <div className="space-y-3">
              {lines.map((l, i) => {
                const net = lineNets[i];
                return (
                  <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Pozycja {i + 1}</span>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-xs text-red-500 hover:text-red-700">Usuń</button>
                      )}
                    </div>
                    {products.length > 0 && (
                      <select value={l.productId ?? ''} onChange={e => pickProduct(i, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="">— z katalogu lub wpisz poniżej —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    <Input label="Nazwa produktu" value={l.productName} onChange={e => setLine(i, { productName: e.target.value, productId: undefined })} placeholder="np. Ser dojrzewający" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Jedn.</label>
                        <select value={l.unit} onChange={e => setLine(i, { unit: e.target.value as ProductUnit })}
                          className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                          {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Ilość</label>
                        <input type="number" min="0" step="0.001" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} placeholder="0"
                          className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Cena netto (zł)</label>
                        <input type="number" min="0" step="0.01" value={l.price} onChange={e => setLine(i, { price: e.target.value })} placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                    </div>
                    <Input label="Klasa / jakość (wymagane przez art. 116 ust. 2)" value={l.qualityClass} onChange={e => setLine(i, { qualityClass: e.target.value })} placeholder="np. klasa I, świeży" />
                    {net > 0 && <div className="text-right text-xs text-gray-500">Wartość netto: <strong className="text-gray-700">{grToPln(net)}</strong></div>}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addLine} className="mt-2 text-sm text-brand-600 hover:text-brand-800 font-medium">+ Dodaj pozycję</button>
          </div>

          {/* Podsumowanie na żywo */}
          <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Wartość netto:</span><strong>{grToPln(totals.netTotalGr)}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Zryczałtowany zwrot (7%):</span><strong>{grToPln(totals.flatRateGr)}</strong></div>
            <div className="flex justify-between text-base pt-1 border-t border-brand-200">
              <span className="font-semibold text-brand-700">Do zapłaty:</span><strong className="text-brand-800">{grToPln(totals.grossTotalGr)}</strong>
            </div>
            {totals.grossTotalGr > 0 && (
              <div className="text-xs text-gray-500 pt-1">Słownie: {kwotaSlownie(totals.grossTotalGr)}</div>
            )}
          </div>

          {/* Płatność */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Forma płatności</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as 'transfer' | 'cash')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="transfer">Przelew (wymagany do odliczenia u nabywcy)</option>
              <option value="cash">Gotówka</option>
            </select>
            {paymentMethod === 'cash' && (
              <p className="text-xs text-amber-600 mt-1">⚠ Płatność gotówką pozbawia nabywcę prawa do odliczenia zryczałtowanego zwrotu. Zalecany przelew.</p>
            )}
          </div>

          {/* Konto kasowe */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Konto do zaksięgowania wpłaty (po opłaceniu)</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Brak kont — <Link to="/kasa" className="text-brand-600 hover:underline">dodaj konto w Kasie</Link>.</p>
            ) : (
              <select value={cashAccountId} onChange={e => setCashAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— wybierz przy księgowaniu wpłaty —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.type === 'bank' ? '🏦' : '💵'} {a.name}</option>)}
              </select>
            )}
          </div>

          {/* RHD */}
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <input type="checkbox" checked={inRhd} onChange={e => setInRhd(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">Zaewidencjonuj w rejestrze RHD po opłaceniu</span>
              <p className="text-xs text-gray-400 mt-0.5">Numer RHD nadawany przy księgowaniu wpłaty (wspólna roczna sekwencja).</p>
            </div>
          </label>

          {/* Uwagi */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="np. ser z mleka surowego" />
          </div>
        </div>
      </Card>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠ {error}</div>}

      <div className="flex gap-3 pb-4">
        <Button className="flex-1" loading={saving} onClick={handleSave}>Zapisz projekt →</Button>
        <Button variant="outline" onClick={() => navigate('/vat-rr')}>Anuluj</Button>
      </div>
    </div>
  );
}
