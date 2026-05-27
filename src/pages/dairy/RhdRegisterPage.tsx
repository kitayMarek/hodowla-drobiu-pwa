import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { settingsService } from '@/services/settings.service';
import type { DairySale } from '@/models/dairy.model';
import { UNIT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';

const fmt  = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function RhdRegisterPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();

  const [year,      setYear]      = useState(currentYear);
  const [sales,     setSales]     = useState<DairySale[]>([]);
  const [rhdLimit,  setRhdLimit]  = useState(100000);
  const [farmName,  setFarmName]  = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading,   setLoading]   = useState(true);

  const load = async (y: number) => {
    setLoading(true);
    const [allSales, limitStr, farm, owner] = await Promise.all([
      dairyService.getSales(y),
      settingsService.get('rhd_limit_pln', '100000'),
      settingsService.get('farm_name', '"Moja Ferma"'),
      settingsService.get('owner_name', '""'),
    ]);
    // Tylko wpisy RHD, posortowane wg numeru
    const rhdSales = allSales
      .filter(s => s.inRhd)
      .sort((a, b) => (a.rhdNumber ?? 0) - (b.rhdNumber ?? 0));
    setSales(rhdSales);
    if (limitStr) setRhdLimit(parseFloat(limitStr));
    if (farm)  setFarmName(JSON.parse(farm));
    if (owner) setOwnerName(JSON.parse(owner));
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const totalRevenue = sales.reduce((s, r) => s + r.totalValuePln, 0);
  const remaining    = rhdLimit - totalRevenue;
  const pct          = Math.min(100, (totalRevenue / rhdLimit) * 100);
  const isWarn       = pct >= 70;
  const isDanger     = pct >= 90;
  const isOver       = totalRevenue > rhdLimit;

  const handlePrint = () => {
    window.print();
  };

  const years = [currentYear, currentYear - 1, currentYear - 2].filter(y => y >= 2024);

  return (
    <div className="space-y-4 max-w-4xl">

      {/* Nagłówek — ukryty przy druku */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/mleko/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
          <h1 className="text-xl font-bold text-gray-900">Rejestr RHD</h1>
        </div>
        <Button size="sm" onClick={handlePrint}>🖨 Drukuj</Button>
      </div>

      {/* Wybór roku */}
      <div className="flex items-center gap-2 print:hidden">
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

      {/* Podsumowanie limitu — ukryty przy druku */}
      {!loading && (
        <div className={`rounded-xl border px-4 py-3 print:hidden ${
          isOver ? 'bg-red-50 border-red-200' : isDanger ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">Sprzedaż RHD {year}</p>
              <p className={`text-lg font-bold ${isOver ? 'text-red-700' : 'text-gray-900'}`}>{fmt(totalRevenue)} zł</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Limit roczny</p>
              <p className="text-lg font-bold text-gray-900">{rhdLimit.toLocaleString('pl-PL')} zł</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Pozostało</p>
              <p className={`text-lg font-bold ${isOver ? 'text-red-600' : remaining < rhdLimit * 0.1 ? 'text-amber-600' : 'text-green-600'}`}>
                {isOver ? '−' : ''}{fmt(Math.abs(remaining))} zł
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-white rounded-full overflow-hidden border border-gray-100">
            <div
              className={`h-full rounded-full ${isOver ? 'bg-red-500' : isDanger ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-green-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {/* Rejestr — widoczny też przy druku */}
      {!loading && (
        <div ref={printRef}>

          {/* Nagłówek wydruku */}
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-bold text-center mb-1">
              Ewidencja sprzedaży — Rolniczy Handel Detaliczny
            </h2>
            <p className="text-center text-sm text-gray-600">Rok: {year}</p>
            {(farmName || ownerName) && (
              <p className="text-center text-sm text-gray-600 mt-1">
                {farmName && `Gospodarstwo: ${farmName}`}
                {farmName && ownerName && ' · '}
                {ownerName && `Właściciel: ${ownerName}`}
              </p>
            )}
            <hr className="mt-4 border-gray-300" />
          </div>

          {sales.length === 0 ? (
            <div className="text-center py-12 print:hidden">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-gray-500 text-sm">Brak wpisów RHD w {year} r.</p>
              <Link to="/mleko/sprzedaz/nowa">
                <Button className="mt-4">+ Dodaj sprzedaż RHD</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm print:text-xs">
                  <thead>
                    <tr className="bg-gray-50 print:bg-gray-100">
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        Lp.
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">
                        Data sprzedaży
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">
                        Produkt
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                        Ilość
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                        Cena jedn.
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                        Wartość (zł)
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">
                        Narastająco (zł)
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">
                        Nabywca
                      </th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 print:hidden">
                        Podpis
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.reduce<{ rows: React.ReactElement[]; running: number }>(
                      ({ rows, running }, sale, idx) => {
                        const runningNew = running + sale.totalValuePln;
                        const overLimit  = runningNew > rhdLimit;
                        rows.push(
                          <tr
                            key={sale.id}
                            className={`hover:bg-gray-50 ${overLimit ? 'bg-red-50 print:bg-red-50' : ''}`}
                          >
                            <td className="border border-gray-200 px-3 py-2 text-center text-gray-500 font-mono">
                              {sale.rhdNumber ?? idx + 1}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 whitespace-nowrap text-gray-700">
                              {fmtD(sale.saleDate)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-800 font-medium">
                              {sale.productName}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                              {sale.quantity} {UNIT_LABELS[sale.unit as keyof typeof UNIT_LABELS] ?? sale.unit}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                              {fmt(sale.unitPricePln)} zł
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right font-medium text-gray-800 whitespace-nowrap">
                              {fmt(sale.totalValuePln)} zł
                            </td>
                            <td className={`border border-gray-200 px-3 py-2 text-right font-semibold whitespace-nowrap ${
                              overLimit ? 'text-red-600' : runningNew > rhdLimit * 0.9 ? 'text-amber-600' : 'text-gray-800'
                            }`}>
                              {fmt(runningNew)} zł
                              {overLimit && <span className="ml-1 text-red-500">⚠</span>}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-700 text-xs">
                              <div>{sale.buyerName}</div>
                              {sale.buyerAddress && (
                                <div className="text-gray-400">{sale.buyerAddress}</div>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 print:hidden" />
                          </tr>
                        );
                        return { rows, running: runningNew };
                      },
                      { rows: [], running: 0 }
                    ).rows}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={5} className="border border-gray-200 px-3 py-2 text-right text-gray-600">
                        Łącznie:
                      </td>
                      <td className={`border border-gray-200 px-3 py-2 text-right whitespace-nowrap ${
                        isOver ? 'text-red-700' : 'text-gray-800'
                      }`}>
                        {fmt(totalRevenue)} zł
                      </td>
                      <td colSpan={3} className={`border border-gray-200 px-3 py-2 text-xs ${
                        isOver ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {isOver
                          ? `⚠ Przekroczono limit o ${fmt(totalRevenue - rhdLimit)} zł`
                          : `Pozostało do limitu: ${fmt(remaining)} zł`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Stopka wydruku */}
              <div className="hidden print:block mt-8">
                <p className="text-xs text-gray-500 text-center">
                  Wygenerowano: {new Date().toLocaleDateString('pl-PL')} · Fermly.pl
                </p>
                <div className="mt-8 flex justify-end">
                  <div className="text-center">
                    <div className="border-t border-gray-400 pt-2 px-16 text-xs text-gray-500">
                      Podpis prowadzącego ewidencję
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Informacja prawna */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 print:hidden">
        <p className="font-medium text-gray-500 mb-1">ℹ Ewidencja RHD</p>
        <p>
          Ewidencja prowadzona zgodnie z art. 12 ust. 2 ustawy z dnia 16 listopada 2016 r. o zmianie
          niektórych ustaw w celu ułatwienia sprzedaży żywności przez rolników (Dz.U. 2016 poz. 1961).
          Roczny limit sprzedaży w ramach RHD: <strong>{rhdLimit.toLocaleString('pl-PL')} zł</strong>{' '}
          (zmień w Ustawieniach).
        </p>
      </div>
    </div>
  );
}
