import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saleService } from '@/services/sale.service';
import { dairyService } from '@/services/dairy.service';
import { batchService } from '@/services/batch.service';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import { UNIT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

const fmt = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

interface UnifiedRow {
  id: number;
  activity: 'drob' | 'sery';
  date: string;
  label: string;
  detail: string;
  total: number;
  buyer?: string;
  inRhd: boolean;
  rhdRef?: string;
  icon: string;
}

const DROB_ICONS: Record<string, string> = {
  jaja: '🥚', tuszki: '🍗', ptaki_zywe: '🐔', elementy: '🦵', jaja_wewn: '🥚',
};

export function UnifiedSalesPage() {
  const navigate = useNavigate();
  const activities = useActivitiesContext();
  const hasDrob = activities.some(a => a.key === 'drob' && a.isActive);
  const hasSery = activities.some(a => a.key === 'sery' && a.isActive);

  const [rows,    setRows]    = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year,    setYear]    = useState(new Date().getFullYear());

  const load = async (y: number) => {
    setLoading(true);
    const yearStr = String(y);

    const [drobSales, dairySales, allBatches] = await Promise.all([
      hasDrob ? saleService.getAll() : Promise.resolve([]),
      hasSery ? dairyService.getSales(y) : Promise.resolve([]),
      hasDrob ? batchService.getAll() : Promise.resolve([]),
    ]);
    const batchNameMap = new Map(allBatches.map(b => [b.id!, b.name]));

    const unified: UnifiedRow[] = [];

    for (const s of drobSales.filter(s => s.saleDate.startsWith(yearStr) && s.saleType !== 'jaja_wewn')) {
      const batchName = s.batchId ? batchNameMap.get(s.batchId) : undefined;
      unified.push({
        id:       s.id!,
        activity: 'drob',
        date:     s.saleDate,
        label:    SALE_TYPE_LABELS[s.saleType],
        detail:   [
          s.saleType === 'jaja'
            ? `${s.eggsCount?.toLocaleString('pl-PL') ?? 0} szt.`
            : s.weightKg != null
              ? `${s.birdCount ?? '?'} szt. · ${s.weightKg} kg`
              : `${s.birdCount ?? '?'} szt.`,
          batchName ? `stado: ${batchName}` : null,
        ].filter(Boolean).join(' · '),
        total:    s.totalRevenuePln,
        buyer:    s.buyerName,
        inRhd:    s.inRhd ?? true,
        icon:     DROB_ICONS[s.saleType] ?? '🐔',
      });
    }

    for (const s of dairySales) {
      unified.push({
        id:       s.id!,
        activity: 'sery',
        date:     s.saleDate,
        label:    s.productName,
        detail:   `${s.quantity} ${UNIT_LABELS[s.unit as keyof typeof UNIT_LABELS] ?? s.unit} × ${fmt(s.unitPricePln)} zł`,
        total:    s.totalValuePln,
        buyer:    s.buyerName,
        inRhd:    s.inRhd,
        rhdRef:   s.inRhd && s.rhdNumber ? `#${s.rhdNumber}/${s.rhdYear}` : undefined,
        icon:     '🧀',
      });
    }

    unified.sort((a, b) => b.date.localeCompare(a.date));
    setRows(unified);
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year, hasDrob, hasSery]);

  const handleDeleteDrob = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis sprzedaży?')) return;
    await saleService.delete(id);
    load(year);
  };

  const handleDeleteDairy = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis sprzedaży?')) return;
    await dairyService.deleteSale(id);
    load(year);
  };

  const totalRevenue = rows.reduce((s, r) => s + r.total, 0);
  const rhdTotal     = rows.filter(r => r.inRhd).reduce((s, r) => s + r.total, 0);
  const years = [new Date().getFullYear(), new Date().getFullYear() - 1].filter(y => y >= 2024);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sprzedaż</h1>
        <Button size="sm" onClick={() => navigate('/sprzedaz/nowa')}>+ Nowa sprzedaż</Button>
      </div>

      {/* Szybkie linki do dedykowanych widoków */}
      <div className="flex gap-3 text-xs flex-wrap">
        {hasSery && (
          <>
            <Link to="/mleko/rhd"      className="text-brand-600 hover:underline">📋 Rejestr RHD</Link>
            <Link to="/mleko/nabywcy"  className="text-brand-600 hover:underline">👥 Nabywcy</Link>
            <Link to="/mleko/produkty" className="text-brand-600 hover:underline">📦 Produkty</Link>
          </>
        )}
      </div>

      {/* Wybór roku */}
      <div className="flex items-center gap-2">
        {years.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              year === y
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Podsumowanie */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Łącznie {year}</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalRevenue)} zł</p>
            <p className="text-xs text-gray-400">{rows.length} transakcji</p>
          </div>
          {hasSery && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">W ewidencji RHD</p>
              <p className="text-lg font-bold text-gray-800">{fmt(rhdTotal)} zł</p>
              <p className="text-xs text-gray-400">{rows.filter(r => r.inRhd).length} wpisów</p>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && rows.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">💰</div>
          <p className="text-gray-500 text-sm">Brak sprzedaży w {year} r.</p>
          <Button className="mt-4" onClick={() => navigate('/sprzedaz/nowa')}>+ Pierwsza sprzedaż</Button>
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={`${row.activity}-${row.id}`}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <span className="text-xl shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">{row.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  row.activity === 'sery'
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-orange-50 text-orange-600'
                }`}>
                  {row.activity === 'sery' ? '🧀 Mleczarnia' : '🐔 Drób'}
                </span>
                {row.inRhd && row.rhdRef && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
                    RHD {row.rhdRef}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                <span>{fmtDate(row.date)}</span>
                <span>{row.detail}</span>
                {row.buyer && <span>👤 {row.buyer}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-gray-900">{fmt(row.total)} zł</div>
              <button
                onClick={() => row.activity === 'drob' ? handleDeleteDrob(row.id) : handleDeleteDairy(row.id)}
                className="text-xs text-gray-200 hover:text-red-400 mt-0.5"
              >🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
