import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saleDocumentService } from '@/services/saleDocument.service';
import { saleService } from '@/services/sale.service';
import { dairyService } from '@/services/dairy.service';
import { batchService } from '@/services/batch.service';
import type { SaleDocument } from '@/models/saleDocument.model';
import type { Sale } from '@/models/sale.model';
import type { DairySale } from '@/models/dairy.model';
import { UNIT_LABELS } from '@/models/dairy.model';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import { Button } from '@/components/ui/Button';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

const fmt  = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

const DROB_ICONS: Record<string, string> = { jaja: '🥚', tuszki: '🍗', ptaki_zywe: '🐔', elementy: '🦵' };

type Row =
  | { kind: 'document'; doc: SaleDocument }
  | { kind: 'legacy_drob'; sale: Sale; batchName?: string }
  | { kind: 'legacy_dairy'; sale: DairySale };

export function UnifiedSalesPage() {
  const navigate = useNavigate();
  const activities = useActivitiesContext();
  const hasDrob = activities.some(a => a.key === 'drob'  && a.isActive);
  const hasSery = activities.some(a => a.key === 'sery'  && a.isActive);

  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [year,    setYear]    = useState(new Date().getFullYear());

  const load = async (y: number) => {
    setLoading(true);
    const yearStr = String(y);

    const [docs, drobSales, dairySales, allBatches] = await Promise.all([
      saleDocumentService.getDocuments(y),
      hasDrob ? saleService.getAll()        : Promise.resolve([]),
      hasSery ? dairyService.getSales(y)    : Promise.resolve([]),
      hasDrob ? batchService.getAll()       : Promise.resolve([]),
    ]);

    const batchMap = new Map(allBatches.map(b => [b.id!, b.name]));

    const combined: Row[] = [];

    // Dokumenty nowego typu
    docs.forEach(doc => combined.push({ kind: 'document', doc }));

    // Stare drobiowe (bez dokumentu)
    drobSales
      .filter(s => !s.saleDocumentId && s.saleDate.startsWith(yearStr) && s.saleType !== 'jaja_wewn')
      .forEach(s => combined.push({ kind: 'legacy_drob', sale: s, batchName: s.batchId ? batchMap.get(s.batchId) : undefined }));

    // Stare mleczarskie (bez dokumentu)
    dairySales
      .filter(s => !s.saleDocumentId)
      .forEach(s => combined.push({ kind: 'legacy_dairy', sale: s }));

    // Sortuj po dacie malejąco
    combined.sort((a, b) => {
      const da = a.kind === 'document' ? a.doc.docDate : a.kind === 'legacy_drob' ? a.sale.saleDate : (a as { kind: 'legacy_dairy'; sale: DairySale }).sale.saleDate;
      const db_ = b.kind === 'document' ? b.doc.docDate : b.kind === 'legacy_drob' ? b.sale.saleDate : (b as { kind: 'legacy_dairy'; sale: DairySale }).sale.saleDate;
      return db_.localeCompare(da);
    });

    setRows(combined);
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year, hasDrob, hasSery]);

  const handleDeleteLegacyDrob = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis?')) return;
    await saleService.delete(id);
    load(year);
  };

  const handleDeleteLegacyDairy = async (id: number) => {
    if (!window.confirm('Usunąć ten wpis?')) return;
    await dairyService.deleteSale(id);
    load(year);
  };

  const totalRevenue = rows.reduce((s, r) => {
    if (r.kind === 'document')     return s + r.doc.totalValuePln;
    if (r.kind === 'legacy_drob')  return s + r.sale.totalRevenuePln;
    return s + (r as { kind: 'legacy_dairy'; sale: DairySale }).sale.totalValuePln;
  }, 0);

  const rhdTotal = rows.reduce((s, r) => {
    if (r.kind === 'document' && r.doc.inRhd) return s + r.doc.totalValuePln;
    if (r.kind === 'legacy_drob' && r.sale.inRhd !== false) return s + r.sale.totalRevenuePln;
    if (r.kind === 'legacy_dairy') {
      const ds = (r as { kind: 'legacy_dairy'; sale: DairySale }).sale;
      return ds.inRhd ? s + ds.totalValuePln : s;
    }
    return s;
  }, 0);

  const years = [new Date().getFullYear(), new Date().getFullYear() - 1].filter(y => y >= 2024);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sprzedaż</h1>
        <Button size="sm" onClick={() => navigate('/sprzedaz/nowa')}>+ Nowa sprzedaż</Button>
      </div>

      <div className="flex gap-3 text-xs flex-wrap">
        {hasSery && (
          <>
            <Link to="/mleko/rhd"      className="text-brand-600 hover:underline">📋 Rejestr RHD</Link>
            <Link to="/mleko/nabywcy"  className="text-brand-600 hover:underline">👥 Nabywcy</Link>
            <Link to="/mleko/produkty" className="text-brand-600 hover:underline">📦 Produkty</Link>
          </>
        )}
      </div>

      {/* Rok */}
      <div className="flex items-center gap-2">
        {years.map(y => (
          <button key={y} onClick={() => setYear(y)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              year === y ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>{y}</button>
        ))}
      </div>

      {/* Podsumowanie */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Łącznie {year}</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalRevenue)} zł</p>
            <p className="text-xs text-gray-400">{rows.length} wpisów</p>
          </div>
          {hasSery && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">W ewidencji RHD</p>
              <p className="text-lg font-bold text-gray-800">{fmt(rhdTotal)} zł</p>
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

      <div className="space-y-2">
        {rows.map((row, i) => {
          // ── Nowy dokument ──────────────────────────────────
          if (row.kind === 'document') {
            const doc = row.doc;
            return (
              <Link key={`doc-${doc.id}`} to={`/sprzedaz/${doc.id}`}
                className="block bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 hover:border-brand-200 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">
                        {doc.buyerName ?? 'Nabywca detaliczny'}
                      </span>
                      {doc.inRhd && doc.rhdNumber ? (
                        <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-semibold">
                          RHD #{doc.rhdNumber}/{doc.rhdYear}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">wewn.</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmtD(doc.docDate)}
                      {doc.notes && <span className="ml-2 italic">· {doc.notes}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-gray-900">{fmt(doc.totalValuePln)} zł</div>
                    <div className="text-xs text-gray-400">→ szczegóły / edytuj</div>
                  </div>
                </div>
              </Link>
            );
          }

          // ── Stary wpis drobiowy ────────────────────────────
          if (row.kind === 'legacy_drob') {
            const s = row.sale;
            const detail = s.saleType === 'jaja'
              ? `${s.eggsCount?.toLocaleString('pl-PL') ?? 0} szt.`
              : s.weightKg != null ? `${s.birdCount ?? '?'} szt. · ${s.weightKg} kg`
              : `${s.birdCount ?? '?'} szt.`;
            return (
              <div key={`ld-${s.id}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{DROB_ICONS[s.saleType] ?? '🐔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{SALE_TYPE_LABELS[s.saleType]}</span>
                    <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full">starszy wpis</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {fmtD(s.saleDate)} · {detail}
                    {row.batchName && <span> · stado: {row.batchName}</span>}
                    {s.buyerName && <span> · 👤 {s.buyerName}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-gray-900">{fmt(s.totalRevenuePln)} zł</div>
                  <button onClick={() => s.id && handleDeleteLegacyDrob(s.id)}
                    className="text-xs text-gray-200 hover:text-red-400 mt-0.5">🗑</button>
                </div>
              </div>
            );
          }

          // ── Stary wpis mleczarski ──────────────────────────
          const ds = (row as { kind: 'legacy_dairy'; sale: DairySale }).sale;
          return (
            <div key={`lm-${ds.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🧀</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{ds.productName}</span>
                  <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full">starszy wpis</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {fmtD(ds.saleDate)} · {ds.quantity} {UNIT_LABELS[ds.unit as keyof typeof UNIT_LABELS] ?? ds.unit}
                  {ds.buyerName && <span> · 👤 {ds.buyerName}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-gray-900">{fmt(ds.totalValuePln)} zł</div>
                <button onClick={() => ds.id && handleDeleteLegacyDairy(ds.id)}
                  className="text-xs text-gray-200 hover:text-red-400 mt-0.5">🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info dla starszych wpisów */}
      {rows.some(r => r.kind !== 'document') && (
        <p className="text-xs text-gray-400 text-center px-4">
          Wpisy oznaczone „starszy wpis" zostały wprowadzone przed aktualizacją systemu.
          Nowe sprzedaże są automatycznie grupowane jako dokumenty z możliwością edycji.
        </p>
      )}
    </div>
  );
}
