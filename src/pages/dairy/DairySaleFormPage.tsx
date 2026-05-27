import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { settingsService } from '@/services/settings.service';
import type { DairyProduct, DairyBuyer } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

// ── Komponent: pasek limitu RHD ─────────────────────────────────

function RhdLimitBar({ currentTotal, added, limit }: {
  currentTotal: number;
  added: number;
  limit: number;
}) {
  const afterSale = currentTotal + added;
  const pct       = Math.min(100, (afterSale / limit) * 100);
  const isWarn    = pct >= 70;
  const isDanger  = pct >= 90;
  const isOver    = afterSale > limit;

  const color = isOver    ? 'bg-red-500'
              : isDanger  ? 'bg-red-400'
              : isWarn    ? 'bg-amber-400'
              : 'bg-green-400';

  const textColor = isOver    ? 'text-red-700'
                  : isDanger  ? 'text-red-600'
                  : isWarn    ? 'text-amber-600'
                  : 'text-green-700';

  return (
    <div className={`rounded-xl border px-4 py-3 ${
      isOver ? 'bg-red-50 border-red-200' : isDanger ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-600">📋 Limit RHD {new Date().getFullYear()}</span>
        <span className={`text-xs font-bold ${textColor}`}>
          {afterSale > limit
            ? `⚠ Przekroczono o ${(afterSale - limit).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł!`
            : `${pct.toFixed(1)}% wykorzystano`}
        </span>
      </div>
      <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
        <span>
          {afterSale.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
          {added > 0 && (
            <span className={`ml-1 ${textColor}`}>
              (+{added.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł)
            </span>
          )}
        </span>
        <span>
          Limit: {limit.toLocaleString('pl-PL')} zł
        </span>
      </div>
    </div>
  );
}

// ── Strona formularza sprzedaży ─────────────────────────────────

export function DairySaleFormPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<DairyProduct[]>([]);
  const [buyers,   setBuyers]   = useState<DairyBuyer[]>([]);
  const [rhdStats, setRhdStats] = useState<{ totalPln: number; nextNumber: number } | null>(null);
  const [rhdLimit, setRhdLimit] = useState(100000);

  // Pola formularza
  const [saleDate,    setSaleDate]    = useState(new Date().toISOString().slice(0, 10));
  const [productId,   setProductId]   = useState<number | ''>('');
  const [buyerId,     setBuyerId]     = useState<number | 'anon' | ''>('');
  const [anonName,    setAnonName]    = useState('');  // gdy brak nabywcy na liście
  const [quantity,    setQuantity]    = useState('');
  const [unitPrice,   setUnitPrice]   = useState('');
  const [inRhd,       setInRhd]       = useState(true);
  const [invoiceNum,  setInvoiceNum]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Pochodne
  const selectedProduct = products.find(p => p.id === productId);
  const selectedBuyer   = buyers.find(b => b.id === buyerId);
  const qty   = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const total = qty * price;
  const year  = new Date(saleDate).getFullYear();

  useEffect(() => {
    Promise.all([
      dairyService.getProducts(),
      dairyService.getBuyers(),
      dairyService.getRhdStats(new Date().getFullYear()),
      settingsService.get('rhd_limit_pln', '100000'),
    ]).then(([prods, buys, stats, limitStr]) => {
      setProducts(prods.filter(p => p.isActive));
      setBuyers(buys);
      setRhdStats(stats);
      if (limitStr) setRhdLimit(parseFloat(limitStr));
    });
  }, []);

  // Gdy zmieniamy datę, przeładuj statystyki RHD dla właściwego roku
  useEffect(() => {
    dairyService.getRhdStats(year).then(setRhdStats);
  }, [year]);

  // Gdy wybieramy produkt, ustaw cenę domyślną
  useEffect(() => {
    if (selectedProduct && !unitPrice) {
      setUnitPrice(String(selectedProduct.defaultPricePln));
    }
  }, [selectedProduct?.id]);

  const validate = () => {
    if (!productId)      { setError('Wybierz produkt.'); return false; }
    if (!qty || qty <= 0) { setError('Podaj ilość.'); return false; }
    if (!price || price <= 0) { setError('Podaj cenę jednostkową.'); return false; }
    if (!getBuyerName()) { setError('Wybierz nabywcę lub podaj nazwę.'); return false; }
    return true;
  };

  const getBuyerName = () => {
    if (buyerId === 'anon') return anonName.trim() || 'Nabywca detaliczny';
    if (selectedBuyer) return selectedBuyer.name;
    if (anonName.trim()) return anonName.trim();
    return '';
  };

  const getBuyerAddress = () => {
    if (selectedBuyer && !selectedBuyer.isAnonymous) return selectedBuyer.address;
    return undefined;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true); setError('');
    try {
      await dairyService.saveSale({
        saleDate,
        productId: productId as number,
        productName: selectedProduct!.name,
        productCategory: selectedProduct!.category,
        unit: selectedProduct!.unit,
        quantity: qty,
        unitPricePln: price,
        totalValuePln: total,
        buyerId: typeof buyerId === 'number' ? buyerId : undefined,
        buyerName: getBuyerName(),
        buyerAddress: getBuyerAddress(),
        inRhd,
        rhdYear: year,
      });
      navigate('/mleko/sprzedaz');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  const unit = selectedProduct ? UNIT_LABELS[selectedProduct.unit as keyof typeof UNIT_LABELS] : '';

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to="/mleko/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
        <h1 className="text-xl font-bold text-gray-900">Nowa sprzedaż</h1>
      </div>

      {/* Pasek RHD — pokazuj tylko gdy inRhd */}
      {inRhd && rhdStats && (
        <RhdLimitBar
          currentTotal={rhdStats.totalPln}
          added={total}
          limit={rhdLimit}
        />
      )}

      <Card padding="md">
        <div className="space-y-4">

          {/* Data */}
          <Input
            label="Data sprzedaży *"
            type="date"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
          />

          {/* Produkt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Produkt *</label>
              <Link to="/mleko/produkty" className="text-xs text-brand-600 hover:text-brand-800">
                + Zarządzaj produktami
              </Link>
            </div>
            {products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-400 mb-2">Brak produktów w katalogu.</p>
                <Link to="/mleko/produkty">
                  <Button size="sm">+ Dodaj produkt</Button>
                </Link>
              </div>
            ) : (
              <select
                value={productId}
                onChange={e => { setProductId(e.target.value ? Number(e.target.value) : ''); setUnitPrice(''); }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— wybierz produkt —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {PRODUCT_ICONS[p.category]} {p.name} ({UNIT_LABELS[p.unit as keyof typeof UNIT_LABELS]})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Ilość + cena */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ilość {unit && `(${unit})`} *
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cena {unit && `(zł/${unit})`} *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Wartość łączna */}
          {qty > 0 && price > 0 && (
            <div className="rounded-lg bg-brand-50 border border-brand-100 px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-brand-700">Wartość łączna:</span>
              <span className="text-lg font-bold text-brand-800">
                {total.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
              </span>
            </div>
          )}

          {/* Nabywca */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Nabywca *</label>
              <Link to="/mleko/nabywcy" className="text-xs text-brand-600 hover:text-brand-800">
                + Zarządzaj nabywcami
              </Link>
            </div>
            <select
              value={buyerId === 'anon' ? 'anon' : (buyerId === '' ? '' : String(buyerId))}
              onChange={e => {
                const v = e.target.value;
                if (v === '') setBuyerId('');
                else if (v === 'anon') setBuyerId('anon');
                else setBuyerId(Number(v));
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— wybierz nabywcę —</option>
              {buyers.map(b => (
                <option key={b.id} value={b.id}>
                  {b.isAnonymous ? '🏪' : '👤'} {b.name}
                </option>
              ))}
              <option value="anon">✏️ Wpisz ręcznie…</option>
            </select>

            {buyerId === 'anon' && (
              <input
                type="text"
                value={anonName}
                onChange={e => setAnonName(e.target.value)}
                placeholder='np. "Targ piątkowy" lub imię i nazwisko'
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Ewidencja RHD */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inRhd}
                onChange={e => setInRhd(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Zaewidencjonuj w rejestrze RHD</span>
                {rhdStats && inRhd && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Numer wpisu: <strong>#{rhdStats.nextNumber}/{year}</strong>
                  </p>
                )}
              </div>
            </label>
            {!inRhd && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                ⚠ Tylko ewidencja wewnętrzna — nie wlicza się do limitu RHD.
              </p>
            )}
          </div>

          {/* Nr faktury */}
          <Input
            label="Numer faktury / paragonu"
            value={invoiceNum}
            onChange={e => setInvoiceNum(e.target.value)}
            placeholder="Opcjonalnie"
          />

          {/* Uwagi */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Opcjonalne uwagi…"
            />
          </div>
        </div>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-3 pb-4">
        <Button
          className="flex-1"
          loading={saving}
          disabled={!productId || !qty || !price}
          onClick={handleSave}
        >
          Zapisz sprzedaż →
        </Button>
        <Button variant="outline" onClick={() => navigate('/mleko/sprzedaz')}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
