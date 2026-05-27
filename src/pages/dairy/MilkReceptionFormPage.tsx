import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { MilkSupplier } from '@/models/dairy.model';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function MilkReceptionFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [source, setSource]       = useState<'own' | 'purchase'>('own');
  const [date, setDate]           = useState(params.get('date') ?? new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity]   = useState('');
  const [temp, setTemp]           = useState('');
  const [fat, setFat]             = useState('');
  const [pricePerL, setPricePerL] = useState('');
  const [invoice, setInvoice]     = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // Dostawcy
  const [suppliers, setSuppliers]       = useState<MilkSupplier[]>([]);
  const [supplierId, setSupplierId]     = useState<number | ''>('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupName, setNewSupName]     = useState('');
  const [newSupAddress, setNewSupAddress] = useState('');
  const [newSupPesel, setNewSupPesel]   = useState('');
  const [newSupPhone, setNewSupPhone]   = useState('');

  useEffect(() => {
    dairyService.getSuppliers().then(setSuppliers);
  }, []);

  const totalPrice = pricePerL && quantity
    ? (parseFloat(pricePerL) * parseFloat(quantity)).toFixed(2)
    : '';

  const handleSaveSupplier = async () => {
    if (!newSupName.trim()) return;
    const id = await dairyService.saveSupplier({
      name: newSupName.trim(), address: newSupAddress.trim() || undefined,
      peselOrNip: newSupPesel.trim() || undefined, phone: newSupPhone.trim() || undefined,
    });
    const updated = await dairyService.getSuppliers();
    setSuppliers(updated);
    setSupplierId(id);
    setShowNewSupplier(false);
    setNewSupName(''); setNewSupAddress(''); setNewSupPesel(''); setNewSupPhone('');
  };

  const handleSave = async () => {
    if (!quantity || parseFloat(quantity) <= 0) { setError('Podaj ilość mleka.'); return; }
    if (source === 'purchase' && !supplierId && !showNewSupplier) {
      setError('Wybierz dostawcę.'); return;
    }
    setSaving(true); setError('');
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      const id = await dairyService.saveReception({
        date, source, quantityLiters: parseFloat(quantity),
        temperatureC: temp ? parseFloat(temp) : undefined,
        fatPercent: fat ? parseFloat(fat) : undefined,
        supplierId: source === 'purchase' ? (supplierId || undefined) as number | undefined : undefined,
        supplierName: source === 'purchase' ? supplier?.name : undefined,
        pricePerLiter: source === 'purchase' && pricePerL ? parseFloat(pricePerL) : undefined,
        totalPricePln: source === 'purchase' && totalPrice ? parseFloat(totalPrice) : undefined,
        invoiceNumber: invoice || undefined,
        notes: notes || undefined,
      });
      navigate(`/mleko/rozlew/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to="/mleko/przyjecia" className="text-gray-400 hover:text-gray-600 text-sm">← Przyjęcia</Link>
        <h1 className="text-xl font-bold text-gray-900">Nowe przyjęcie mleka</h1>
      </div>

      {/* Źródło mleka */}
      <Card padding="md">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Źródło mleka</p>
        <div className="grid grid-cols-2 gap-2">
          {(['own', 'purchase'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                source === s ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{s === 'own' ? '🐄' : '🚛'}</span>
              {s === 'own' ? 'Własne mleko' : 'Skup od dostawcy'}
            </button>
          ))}
        </div>
      </Card>

      {/* Dane podstawowe */}
      <Card padding="md">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dane przyjęcia</p>
        <div className="space-y-3">
          <Input label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input
            label="Ilość mleka (litry)"
            type="number" step="0.1" min="0"
            value={quantity} onChange={e => setQuantity(e.target.value)}
            placeholder="np. 120"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Temperatura przy przyjęciu (°C)"
              type="number" step="0.1"
              value={temp} onChange={e => setTemp(e.target.value)}
              placeholder="np. 4"
            />
            <Input
              label="Zawartość tłuszczu (%)"
              type="number" step="0.1"
              value={fat} onChange={e => setFat(e.target.value)}
              placeholder="np. 3.8"
            />
          </div>
        </div>
      </Card>

      {/* Dane skupu */}
      {source === 'purchase' && (
        <Card padding="md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dane skupu</p>
          <div className="space-y-3">
            {/* Wybór dostawcy */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dostawca</label>
              <select
                value={supplierId}
                onChange={e => { setSupplierId(e.target.value ? Number(e.target.value) : ''); setShowNewSupplier(false); }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— wybierz dostawcę —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={() => { setShowNewSupplier(v => !v); setSupplierId(''); }}
                className="mt-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
              >
                {showNewSupplier ? '← Wybierz istniejącego' : '+ Nowy dostawca'}
              </button>
            </div>

            {showNewSupplier && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-700">Nowy dostawca</p>
                <Input label="Imię i nazwisko / Nazwa" value={newSupName} onChange={e => setNewSupName(e.target.value)} />
                <Input label="Adres" value={newSupAddress} onChange={e => setNewSupAddress(e.target.value)} placeholder="Ulica, miejscowość" />
                <Input label="PESEL / KRUS / NIP" value={newSupPesel} onChange={e => setNewSupPesel(e.target.value)} />
                <Input label="Telefon" value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)} />
                <Button size="sm" onClick={handleSaveSupplier} disabled={!newSupName.trim()}>
                  Zapisz dostawcę
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Cena za litr (zł)"
                type="number" step="0.01"
                value={pricePerL} onChange={e => setPricePerL(e.target.value)}
                placeholder="np. 1.80"
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Łączna kwota</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 font-medium">
                  {totalPrice ? `${totalPrice} zł` : '—'}
                </div>
              </div>
            </div>
            <Input
              label="Numer dokumentu / faktury"
              value={invoice} onChange={e => setInvoice(e.target.value)}
              placeholder="np. FV/2026/05/001"
            />
          </div>
        </Card>
      )}

      {/* Uwagi */}
      <Card padding="md">
        <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Opcjonalne uwagi…"
        />
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button className="flex-1" loading={saving} onClick={handleSave}>
          Zapisz i przejdź do rozlewu →
        </Button>
        <Button variant="outline" onClick={() => navigate('/mleko/przyjecia')}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
