import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { DairyProduct } from '@/models/dairy.model';
import { PRODUCT_LABELS, PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import type { DairyProductType, ProductUnit } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

const CATEGORIES: DairyProductType[] = [
  'ser_dojrzewajacy', 'twarog', 'jogurt', 'kefir', 'smietana', 'maslo', 'rikotta', 'mleko_surowe',
];
const UNITS: ProductUnit[] = ['kg', 'szt', 'L', 'opak'];

function ProductForm({
  initial, onSave, onCancel,
}: {
  initial?: DairyProduct;
  onSave: (data: Omit<DairyProduct, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,     setName]     = useState(initial?.name ?? '');
  const [category, setCategory] = useState<DairyProductType>(initial?.category ?? 'ser_dojrzewajacy');
  const [unit,     setUnit]     = useState<ProductUnit>(initial?.unit ?? 'kg');
  const [price,    setPrice]    = useState(initial?.defaultPricePln != null ? String(initial.defaultPricePln) : '');
  const [notes,    setNotes]    = useState(initial?.notes ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Podaj nazwę produktu.'); return; }
    if (!price || isNaN(parseFloat(price))) { setError('Podaj cenę domyślną.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        name: name.trim(),
        category,
        unit,
        defaultPricePln: parseFloat(price),
        isActive,
        notes: notes.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <Input
        label="Nazwa produktu *"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="np. Ser żółty 200g"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria *</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as DairyProductType)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{PRODUCT_ICONS[c]} {PRODUCT_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Jednostka *</label>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as ProductUnit)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {UNITS.map(u => (
              <option key={u} value={u}>{UNIT_LABELS[u]}</option>
            ))}
          </select>
        </div>
      </div>
      <Input
        label="Cena domyślna (zł) *"
        type="number"
        step="0.01"
        min="0"
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="0.00"
      />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Opcjonalny opis, gramatura itp."
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          className="rounded"
        />
        Produkt aktywny (dostępny przy sprzedaży)
      </label>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {error}</p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" loading={saving} onClick={handleSubmit}>
          {initial ? 'Zapisz zmiany' : 'Dodaj produkt'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

export function DairyProductsPage() {
  const [products, setProducts] = useState<DairyProduct[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [expandId, setExpandId] = useState<number | null>(null);

  const load = () =>
    dairyService.getProducts().then(p => { setProducts(p); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: Omit<DairyProduct, 'id' | 'createdAt'>) => {
    await dairyService.saveProduct(data);
    setShowAdd(false);
    load();
  };

  const handleEdit = async (id: number, data: Omit<DairyProduct, 'id' | 'createdAt'>) => {
    await dairyService.updateProduct(id, data);
    setEditId(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Usunąć ten produkt?')) return;
    await dairyService.deleteProduct(id);
    load();
  };

  const handleToggleActive = async (p: DairyProduct) => {
    if (!p.id) return;
    await dairyService.updateProduct(p.id, { ...p, isActive: !p.isActive });
    load();
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
          <h1 className="text-xl font-bold text-gray-900">Katalog produktów</h1>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Dodaj</Button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Zdefiniuj produkty które sprzedajesz — nazwy, jednostki i ceny domyślne. Przy sprzedaży wybierasz z tej listy.
      </p>

      {showAdd && (
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-2">Nowy produkt</p>
          <ProductForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Card>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && products.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-500 text-sm">Brak produktów.<br />Dodaj produkty które sprzedajesz.</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>+ Dodaj produkt</Button>
        </div>
      )}

      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${
            p.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
          }`}>
            <button
              onClick={() => setExpandId(expandId === p.id ? null : p.id ?? null)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl shrink-0">{PRODUCT_ICONS[p.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  {p.name}
                  {!p.isActive && (
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
                      nieaktywny
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {PRODUCT_LABELS[p.category]} · {UNIT_LABELS[p.unit]} · {p.defaultPricePln.toFixed(2)} zł/{UNIT_LABELS[p.unit]}
                </div>
              </div>
              <span className="text-gray-300 text-sm">{expandId === p.id ? '▲' : '▼'}</span>
            </button>

            {expandId === p.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                {editId === p.id ? (
                  <ProductForm
                    initial={p}
                    onSave={data => handleEdit(p.id!, data)}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <span className="text-gray-400 text-xs">Kategoria</span>
                      <span className="text-gray-700">{PRODUCT_ICONS[p.category]} {PRODUCT_LABELS[p.category]}</span>
                      <span className="text-gray-400 text-xs">Jednostka</span>
                      <span className="text-gray-700">{UNIT_LABELS[p.unit]}</span>
                      <span className="text-gray-400 text-xs">Cena domyślna</span>
                      <span className="text-gray-700 font-medium">{p.defaultPricePln.toFixed(2)} zł/{UNIT_LABELS[p.unit]}</span>
                      {p.notes && (
                        <>
                          <span className="text-gray-400 text-xs">Uwagi</span>
                          <span className="text-gray-700">{p.notes}</span>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setEditId(p.id!)}>✎ Edytuj</Button>
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(p)}>
                        {p.isActive ? '⏸ Dezaktywuj' : '▶ Aktywuj'}
                      </Button>
                      <button
                        onClick={() => p.id != null && handleDelete(p.id)}
                        className="ml-auto text-xs text-gray-300 hover:text-red-400 px-2"
                      >
                        🗑 Usuń
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
