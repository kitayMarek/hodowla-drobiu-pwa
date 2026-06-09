import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import { saleDocumentService } from '@/services/saleDocument.service';
import { saleService } from '@/services/sale.service';
import { settingsService } from '@/services/settings.service';
import type { DairySale } from '@/models/dairy.model';
import type { Sale } from '@/models/sale.model';
import type { SaleDocument } from '@/models/saleDocument.model';
import { UNIT_LABELS } from '@/models/dairy.model';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import type { SaleType } from '@/constants/phases';
import { Button } from '@/components/ui/Button';

const fmt  = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ── Ujednolicony typ wpisów RHD ───────────────────────────────────────────────
type RhdEntry =
  | { kind: 'dairy';    sale: DairySale;    date: string; value: number }
  | { kind: 'drob';     sale: Sale;         date: string; value: number }
  | { kind: 'document'; doc:  SaleDocument; date: string; value: number };

function entryProduct(e: RhdEntry): string {
  if (e.kind === 'dairy') return e.sale.productName;
  if (e.kind === 'drob') {
    const t = SALE_TYPE_LABELS[e.sale.saleType as SaleType] ?? e.sale.saleType;
    return e.sale.invoiceNumber ? `${t} (${e.sale.invoiceNumber})` : t;
  }
  return e.doc.buyerName ? `Dok. sprzedaży — ${e.doc.buyerName}` : 'Dok. sprzedaży';
}

function entryQuantity(e: RhdEntry): string {
  if (e.kind === 'dairy') {
    return `${e.sale.quantity} ${UNIT_LABELS[e.sale.unit as keyof typeof UNIT_LABELS] ?? e.sale.unit}`;
  }
  if (e.kind === 'drob') {
    if (e.sale.saleType === 'jaja')     return `${e.sale.eggsCount ?? '—'} szt.`;
    if (e.sale.saleType === 'tuszki' || e.sale.saleType === 'elementy')
                                        return `${e.sale.weightKg ?? '—'} kg`;
    return `${e.sale.birdCount ?? '—'} szt.`;
  }
  return '—';
}

function entryUnitPrice(e: RhdEntry): string {
  if (e.kind === 'dairy') return `${fmt(e.sale.unitPricePln)} zł`;
  if (e.kind === 'drob') {
    if (e.sale.saleType === 'jaja' && e.sale.eggPricePln != null)
      return `${fmt(e.sale.eggPricePln)} zł/szt.`;
    if (e.sale.pricePerKgPln != null)
      return `${fmt(e.sale.pricePerKgPln)} zł/kg`;
    return '—';
  }
  return '—';
}

function entryBuyer(e: RhdEntry): { name?: string; address?: string } {
  if (e.kind === 'dairy')    return { name: e.sale.buyerName,   address: e.sale.buyerAddress };
  if (e.kind === 'drob')     return { name: e.sale.buyerName };
  return { name: e.doc.buyerName, address: e.doc.buyerAddress };
}

function entryRhdNumber(e: RhdEntry): number | undefined {
  if (e.kind === 'dairy')    return e.sale.rhdNumber;
  if (e.kind === 'drob')     return undefined;
  return e.doc.rhdNumber;
}

// ── Komponent ─────────────────────────────────────────────────────────────────

export function RhdRegisterPage() {
  const printRef    = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();

  const [year,      setYear]      = useState(currentYear);
  const [entries,   setEntries]   = useState<RhdEntry[]>([]);
  const [rhdLimit,  setRhdLimit]  = useState(100000);
  const [farmName,  setFarmName]  = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading,   setLoading]   = useState(true);

  const load = async (y: number) => {
    setLoading(true);
    const yearStr = String(y);

    const [dairySales, drobSales, docs, limitStr, farm, owner] = await Promise.all([
      dairyService.getSales(y),
      saleService.getAll(),
      saleDocumentService.getDocuments(y),
      settingsService.get('rhd_limit_pln', '100000'),
      settingsService.get('farm_name', '"Moja Ferma"'),
      settingsService.get('owner_name', '""'),
    ]);

    const combined: RhdEntry[] = [];

    // 1. Samodzielne wpisy mleczarskie (bez dokumentu nadrzędnego)
    dairySales
      .filter(s => s.inRhd && !s.saleDocumentId)
      .forEach(s => combined.push({ kind: 'dairy', sale: s, date: s.saleDate, value: s.totalValuePln }));

    // 2. Samodzielne wpisy drobiowe (bez dokumentu, oznaczone jako RHD)
    drobSales
      .filter(s =>
        s.inRhd !== false &&
        !s.saleDocumentId &&
        s.saleDate.startsWith(yearStr) &&
        s.saleType !== 'jaja_wewn'
      )
      .forEach(s => combined.push({ kind: 'drob', sale: s, date: s.saleDate, value: s.totalRevenuePln }));

    // 3. Dokumenty sprzedaży (nowy system — łączone pozycje drób + mleko)
    docs
      .filter(d => d.inRhd)
      .forEach(d => combined.push({ kind: 'document', doc: d, date: d.docDate, value: d.totalValuePln }));

    // Sortuj chronologicznie rosnąco (RHD wymaga porządku dat)
    combined.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (entryRhdNumber(a) ?? 9999) - (entryRhdNumber(b) ?? 9999);
    });

    setEntries(combined);
    if (limitStr) setRhdLimit(parseFloat(limitStr));
    if (farm)     setFarmName(JSON.parse(farm));
    if (owner)    setOwnerName(JSON.parse(owner));
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const totalRevenue = entries.reduce((s, e) => s + e.value, 0);
  const remaining    = rhdLimit - totalRevenue;
  const pct          = Math.min(100, (totalRevenue / rhdLimit) * 100);
  const isWarn       = pct >= 70;
  const isDanger     = pct >= 90;
  const isOver       = totalRevenue > rhdLimit;

  const years      = [currentYear, currentYear - 1, currentYear - 2].filter(y => y >= 2024);
  const countDocs  = entries.filter(e => e.kind === 'document').length;
  const countDairy = entries.filter(e => e.kind === 'dairy').length;
  const countDrob  = entries.filter(e => e.kind === 'drob').length;

  return (
    <div className="space-y-4 max-w-4xl">

      {/* Nagłówek */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/zamowienia" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
          <h1 className="text-xl font-bold text-gray-900">Rejestr RHD</h1>
        </div>
        <Button size="sm" onClick={() => window.print()}>🖨 Drukuj</Button>
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

      {/* Podsumowanie limitu */}
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
              <p className={`text-lg font-bold ${
                isOver ? 'text-red-600' : remaining < rhdLimit * 0.1 ? 'text-amber-600' : 'text-green-600'
              }`}>
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
          {entries.length > 0 && (
            <div className="flex gap-4 mt-2 justify-center flex-wrap text-xs text-gray-500">
              {countDocs  > 0 && <span>📄 Dokumenty sprzedaży: {countDocs}</span>}
              {countDairy > 0 && <span>🧀 Mleko / sery: {countDairy}</span>}
              {countDrob  > 0 && <span>🐔 Drób: {countDrob}</span>}
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {/* Rejestr */}
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

          {entries.length === 0 ? (
            <div className="text-center py-12 print:hidden">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-gray-500 text-sm">Brak wpisów RHD w {year} r.</p>
              <p className="text-gray-400 text-xs mt-2">
                Wpisy pojawiają się tu automatycznie gdy zaznaczysz „Ujmij w RHD" przy zapisywaniu sprzedaży
                (dokumenty sprzedaży 📄, sprzedaż drobiu 🐔, sprzedaż mleka/serów 🧀).
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm print:text-xs">
                  <thead>
                    <tr className="bg-gray-50 print:bg-gray-100">
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Lp.</th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Data sprzedaży</th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">Produkt</th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Ilość</th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Cena jedn.</th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Wartość (zł)</th>
                      <th className="border border-gray-200 px-3 py-2 text-right font-semibold text-gray-600 whitespace-nowrap">Narastająco (zł)</th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">Nabywca</th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 print:hidden">Podpis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.reduce<{ rows: React.ReactElement[]; running: number }>(
                      ({ rows, running }, entry, idx) => {
                        const runningNew = running + entry.value;
                        const overLimit  = runningNew > rhdLimit;
                        const buyer      = entryBuyer(entry);
                        const rhdNum     = entryRhdNumber(entry);
                        const sourceIcon = entry.kind === 'document' ? '📄' : entry.kind === 'drob' ? '🐔' : '🧀';

                        rows.push(
                          <tr
                            key={`${entry.kind}-${idx}`}
                            className={`hover:bg-gray-50 ${overLimit ? 'bg-red-50 print:bg-red-50' : ''}`}
                          >
                            <td className="border border-gray-200 px-3 py-2 text-center font-mono text-gray-600 whitespace-nowrap">
                              {idx + 1}
                              {rhdNum != null && (
                                <span className="text-xs text-gray-400 ml-1">#{rhdNum}</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 whitespace-nowrap text-gray-700">
                              {fmtD(entry.date)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-800 font-medium">
                              <span className="mr-1 print:hidden">{sourceIcon}</span>
                              {entryProduct(entry)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                              {entryQuantity(entry)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                              {entryUnitPrice(entry)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-right font-medium text-gray-800 whitespace-nowrap">
                              {fmt(entry.value)} zł
                            </td>
                            <td className={`border border-gray-200 px-3 py-2 text-right font-semibold whitespace-nowrap ${
                              overLimit ? 'text-red-600' : runningNew > rhdLimit * 0.9 ? 'text-amber-600' : 'text-gray-800'
                            }`}>
                              {fmt(runningNew)} zł
                              {overLimit && <span className="ml-1 text-red-500">⚠</span>}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-gray-700 text-xs">
                              {buyer.name    && <div>{buyer.name}</div>}
                              {buyer.address && <div className="text-gray-400">{buyer.address}</div>}
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
                        Łącznie ({entries.length} poz.):
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
          Ewidencja prowadzona zgodnie z art. 12 ust. 2 ustawy z dnia 16 listopada 2016 r.
          Roczny limit sprzedaży w ramach RHD: <strong>{rhdLimit.toLocaleString('pl-PL')} zł</strong>{' '}
          (zmień w Ustawieniach).
        </p>
        <p className="mt-1 text-gray-400">
          Rejestr zbiera automatycznie wszystkie sprzedaże oznaczone „Ujmij w RHD":
          📄 dokumenty sprzedaży · 🐔 sprzedaż drobiu · 🧀 sprzedaż mleka/serów.
        </p>
      </div>
    </div>
  );
}
