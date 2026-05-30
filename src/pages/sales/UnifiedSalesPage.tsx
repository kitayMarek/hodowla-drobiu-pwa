import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saleDocumentService } from '@/services/saleDocument.service';
import type { SaleDocument } from '@/models/saleDocument.model';
import { Button } from '@/components/ui/Button';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

const fmt  = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

export function UnifiedSalesPage() {
  const navigate = useNavigate();
  const activities = useActivitiesContext();
  const hasSery = activities.some(a => a.key === 'sery' && a.isActive);

  const [docs,    setDocs]    = useState<SaleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [year,    setYear]    = useState(new Date().getFullYear());

  const load = async (y: number) => {
    setLoading(true);
    const d = await saleDocumentService.getDocuments(y);
    setDocs(d);
    setLoading(false);
  };

  useEffect(() => { load(year); }, [year]);

  const totalRevenue = docs.reduce((s, d) => s + d.totalValuePln, 0);
  const rhdTotal     = docs.filter(d => d.inRhd).reduce((s, d) => s + d.totalValuePln, 0);
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

      {/* Wybór roku */}
      <div className="flex items-center gap-2">
        {years.map(y => (
          <button key={y} onClick={() => setYear(y)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              year === y ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>{y}</button>
        ))}
      </div>

      {/* Podsumowanie */}
      {docs.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Łącznie {year}</p>
            <p className="text-lg font-bold text-gray-800">{fmt(totalRevenue)} zł</p>
            <p className="text-xs text-gray-400">{docs.length} dokumentów</p>
          </div>
          {hasSery && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">W ewidencji RHD</p>
              <p className="text-lg font-bold text-gray-800">{fmt(rhdTotal)} zł</p>
              <p className="text-xs text-gray-400">{docs.filter(d => d.inRhd).length} dokumentów</p>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && docs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">💰</div>
          <p className="text-gray-500 text-sm">Brak sprzedaży w {year} r.</p>
          <Button className="mt-4" onClick={() => navigate('/sprzedaz/nowa')}>+ Pierwsza sprzedaż</Button>
        </div>
      )}

      <div className="space-y-2">
        {docs.map(doc => (
          <Link key={doc.id} to={`/sprzedaz/${doc.id}`}
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
                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">
                      wewn.
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {fmtD(doc.docDate)}
                  {doc.notes && <span className="ml-2 italic truncate">· {doc.notes}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-gray-900">{fmt(doc.totalValuePln)} zł</div>
                <div className="text-xs text-gray-400">→ szczegóły</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
