import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { MilkReception, DairyProductType } from '@/models/dairy.model';
import {
  PRODUCT_ICONS, PRODUCT_LABELS, YIELD_FACTORS,
  calcExpectedYield, calcExpectedWhey,
} from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AllocLine {
  key: string;
  productType: DairyProductType;
  liters: string;
  agingDays: string;
}

const ALLOCATABLE_PRODUCTS: DairyProductType[] = [
  'ser_dojrzewajacy', 'twarog', 'jogurt', 'kefir', 'smietana', 'maslo',
];

export function MilkAllocationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [reception, setReception] = useState<MilkReception | null>(null);
  const [lines, setLines] = useState<AllocLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    dairyService.getReceptionById(Number(id)).then(r => {
      if (!r) { navigate('/mleko/przyjecia'); return; }
      setReception(r);
    });
  }, [id]);

  const addLine = () => {
    setLines(prev => [...prev, {
      key: Math.random().toString(36).slice(2),
      productType: 'ser_dojrzewajacy',
      liters: '',
      agingDays: String(YIELD_FACTORS.ser_dojrzewajacy.agingDays ?? 21),
    }]);
  };

  const updateLine = (key: string, field: keyof AllocLine, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      if (field === 'productType') {
        const pt = value as DairyProductType;
        return { ...l, productType: pt, agingDays: String(YIELD_FACTORS[pt].agingDays ?? '') };
      }
      return { ...l, [field]: value };
    }));
  };

  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key));

  const totalAllocated = lines.reduce((s, l) => s + (parseFloat(l.liters) || 0), 0);
  const available = reception ? reception.quantityLiters : 0;
  const remaining = available - totalAllocated;

  const handleSave = async () => {
    if (!reception?.id) return;
    if (lines.length === 0) { setError('Dodaj co najmniej jeden produkt.'); return; }
    if (remaining < -0.01) { setError(`Przekroczono ilość mleka o ${(-remaining).toFixed(1)} L.`); return; }
    setSaving(true); setError('');
    try {
      const batchIds = await dairyService.saveAllocations(
        reception.id,
        lines
          .filter(l => parseFloat(l.liters) > 0)
          .map(l => ({
            productType: l.productType,
            litersAllocated: parseFloat(l.liters),
            agingDays: l.agingDays ? parseInt(l.agingDays) : undefined,
          }))
      );
      // Przejdź do pierwszej utworzonej partii
      navigate(batchIds.length === 1 ? `/mleko/partie/${batchIds[0]}` : '/mleko/partie');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  if (!reception) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to="/mleko/przyjecia" className="text-gray-400 hover:text-gray-600 text-sm">← Przyjęcia</Link>
        <h1 className="text-xl font-bold text-gray-900">Rozlew mleka</h1>
      </div>

      {/* Info o przyjęciu */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-800">
              🥛 {reception.quantityLiters.toFixed(1)} L
              {reception.source === 'own' ? ' · własne' : ` · ${reception.supplierName ?? 'skup'}`}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {new Date(reception.date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-600">Pozostało do rozlania:</p>
            <p className={`text-sm font-bold ${remaining < 0 ? 'text-red-600' : remaining === 0 ? 'text-green-600' : 'text-blue-800'}`}>
              {remaining.toFixed(1)} L
            </p>
          </div>
        </div>
        {/* Pasek postępu */}
        <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-red-400' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(100, (totalAllocated / available) * 100)}%` }}
          />
        </div>
      </div>

      {/* Linie rozlewu */}
      <Card padding="md">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rozdziel mleko na produkty</p>
        <div className="space-y-3">
          {lines.map(line => {
            const liters = parseFloat(line.liters) || 0;
            const yieldKg = liters > 0 ? calcExpectedYield(liters, line.productType) : null;
            const wheyL   = liters > 0 ? calcExpectedWhey(liters, line.productType) : null;
            const hasAging = YIELD_FACTORS[line.productType].agingDays !== undefined;

            return (
              <div key={line.key} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{PRODUCT_ICONS[line.productType]}</span>
                  <select
                    value={line.productType}
                    onChange={e => updateLine(line.key, 'productType', e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {ALLOCATABLE_PRODUCTS.map(pt => (
                      <option key={pt} value={pt}>{PRODUCT_LABELS[pt]}</option>
                    ))}
                  </select>
                  <button onClick={() => removeLine(line.key)} className="text-gray-300 hover:text-red-400">✕</button>
                </div>

                <div className={`grid gap-2 ${hasAging ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Litry mleka</label>
                    <input
                      type="number" step="0.5" min="0"
                      value={line.liters}
                      onChange={e => updateLine(line.key, 'liters', e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {hasAging && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Dojrzewanie (dni)</label>
                      <input
                        type="number" min="1"
                        value={line.agingDays}
                        onChange={e => updateLine(line.key, 'agingDays', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  )}
                </div>

                {/* Podgląd wydajności */}
                {liters > 0 && (
                  <div className="flex gap-4 text-xs text-gray-500 pt-1">
                    <span>📦 Oczekiwany wynik: <strong className="text-gray-700">{yieldKg} kg</strong></span>
                    {wheyL != null && wheyL > 0 && (
                      <span>💧 Serwatka: <strong className="text-gray-700">~{wheyL} L</strong></span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={addLine}
            className="w-full py-2 text-sm text-brand-600 hover:text-brand-800 font-medium border-2 border-dashed border-gray-200 rounded-xl hover:border-brand-300 transition-colors"
          >
            + Dodaj produkt
          </button>
        </div>
      </Card>

      {/* Serwatka summary */}
      {lines.some(l => calcExpectedWhey(parseFloat(l.liters) || 0, l.productType) > 0) && (
        <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-sm text-cyan-700">
          <p className="font-semibold mb-1">💧 Łączna oczekiwana serwatka:</p>
          <p>
            {lines.reduce((s, l) => s + calcExpectedWhey(parseFloat(l.liters) || 0, l.productType), 0).toFixed(1)} L
            {' '}— system automatycznie zapisze ją jako „skarmianie". Możesz zmienić w szczegółach partii.
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          ⚠ {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          className="flex-1"
          loading={saving}
          disabled={lines.length === 0}
          onClick={handleSave}
        >
          Utwórz {lines.filter(l => parseFloat(l.liters) > 0).length} {lines.filter(l => parseFloat(l.liters) > 0).length === 1 ? 'partię' : 'partie'} →
        </Button>
        <Button variant="outline" onClick={() => navigate('/mleko/przyjecia')}>
          Wróć
        </Button>
      </div>
    </div>
  );
}
