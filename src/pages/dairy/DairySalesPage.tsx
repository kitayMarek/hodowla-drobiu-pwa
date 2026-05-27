import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { settingsService } from '@/services/settings.service';
import type { DairySale } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';

const fmt = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (pct: number) => `${pct.toFixed(1)}%`;

export function DairySalesPage() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [sales,    setSales]    = useState<DairySale[]>([]);
  const [rhdStats, setRhdStats] = useState<{ totalPln: number; nextNumber: number; count: number } | null>(null);
  const [rhdLimit, setRhdLimit] = useState(100000);
  const [year,     setYear]     = useState(currentYear);
  const [loading,  setLoading]  = useState(true);

  const load = async (y: number) => {
    setLoading(true);
    const [s, stats, limitStr] = await Promise.all([
      dairyService.getSales(y),
      dairyService.getRhdStats(y),
      settingsService.get('rhd_limit_pln', '100000'),
    ]);
    setSales(s);
    setRhdStats(stats);
    if (limitStr) setRhdLimit(parseFloat(limitStr));
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis sprzedaży?')) return;
    await dairyService.deleteSale(id);
    load(year);
  };

  const rhdTotal = rhdStats?.totalPln ?? 0;
  const rhdPct   = Math.min(100, (rhdTotal / rhdLimit) * 100);
  const isWarn   = rhdPct >= 70;
  const isDanger = rhdPct >= 90;
  const isOver   = rhdTotal > rhdLimit;

  const rhdColor   = isOver ? 'bg-red-500' : isDanger ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-green-400';
  const rhdBg      = isOver ? 'bg-red-50 border-red-200' : isDanger ? 'bg-amber-50 border-amber-200' : isWarn ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-200';
  const rhdText    = isOver ? 'text-red-700' : isDanger ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-green-700';

  const totalRevenue = sales.reduce((s, r) => s + r.totalValuePln, 0);

  const years = [currentYear, currentYear - 1, currentYear - 2].filter(y => y >= 2024);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleko</Link>
          <h1 className="text-xl font-bold text-gray-900">Sprzedaż</h1>
        </div>
        <Button size="sm" onClick={() => navigate('/mleko/sprzedaz/nowa')}>+ Nowa sprzedaż</Button>
      </div>

      {/* Linki pomocnicze */}
      <div className="flex gap-3 text-xs">
        <Link to="/mleko/produkty" className="text-brand-600 hover:text-brand-800">📦 Katalog produktów</Link>
        <Link to="/mleko/nabywcy"  className="text-brand-600 hover:text-brand-800">👥 Nabywcy</Link>
        <Link to="/mleko/rhd"      className="text-brand-600 hover:text-brand-800">📋 Rejestr RHD</Link>
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

      {/* Status RHD */}
      {rhdStats && (
        <div className={`rounded-xl border px-4 py-3 ${rhdBg}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-gray-700">
              📋 Ewidencja RHD {year}
              <span className="ml-2 text-xs font-normal text-gray-400">
                {rhdStats.count} {rhdStats.count === 1 ? 'wpis' : rhdStats.count < 5 ? 'wpisy' : 'wpisów'}
              </span>
            </span>
            <Link to="/mleko/rhd" className="text-xs text-brand-600 hover:text-brand-800 font-medium">
              Otwórz rejestr →
            </Link>
          </div>
          <div className="h-2.5 bg-white rounded-full overflow-hidden border border-gray-100 mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${rhdColor}`}
              style={{ width: `${rhdPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={`font-semibold ${rhdText}`}>
              {fmt(rhdTotal)} zł
              {isOver && <span className="ml-1">⚠ Przekroczono!</span>}
            </span>
            <span className="text-gray-400">
              Limit: {rhdLimit.toLocaleString('pl-PL')} zł · {fmtPct(rhdPct)} wykorzystano
            </span>
          </div>
        </div>
      )}

      {/* Podsumowanie roku */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Łączna sprzedaż {year}</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalRevenue)} zł</p>
            <p className="text-xs text-gray-400">{sales.length} transakcji</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">W ewidencji RHD</p>
            <p className="text-lg font-bold text-gray-800">{fmt(rhdTotal)} zł</p>
            <p className="text-xs text-gray-400">
              {sales.filter(s => s.inRhd).length} z {sales.length} transakcji
            </p>
          </div>
        </div>
      )}

      {/* Lista sprzedaży */}
      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && sales.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">💰</div>
          <p className="text-gray-500 text-sm">Brak sprzedaży w {year} r.</p>
          <Button className="mt-4" onClick={() => navigate('/mleko/sprzedaz/nowa')}>
            + Pierwsza sprzedaż
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {sales.map(sale => {
          const icon = sale.productCategory ? PRODUCT_ICONS[sale.productCategory] : '💰';
          const unitLabel = UNIT_LABELS[sale.unit as keyof typeof UNIT_LABELS] ?? sale.unit;
          return (
            <div key={sale.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{sale.productName}</span>
                  {sale.inRhd && sale.rhdNumber && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold">
                      RHD #{sale.rhdNumber}/{sale.rhdYear}
                    </span>
                  )}
                  {!sale.inRhd && (
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                      wewn.
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                  <span>
                    {new Date(sale.saleDate + 'T12:00:00').toLocaleDateString('pl-PL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                  <span>{sale.quantity} {unitLabel} × {fmt(sale.unitPricePln)} zł</span>
                  {sale.buyerName && <span>👤 {sale.buyerName}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-gray-900">{fmt(sale.totalValuePln)} zł</div>
                <button
                  onClick={() => sale.id != null && handleDelete(sale.id)}
                  className="text-xs text-gray-200 hover:text-red-400 mt-0.5"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
