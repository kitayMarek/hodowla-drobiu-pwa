import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { carcassService, type CarcassStock } from '@/services/carcass.service';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { SPECIES_EMOJI, SPECIES_LABELS } from '@/constants/species';
import { formatKg } from '@/utils/format';

export function CarcassWarehousePage() {
  const [stocks, setStocks] = useState<CarcassStock[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    carcassService.getAllStock().then(s => { if (!cancelled) setStocks(s); });
    return () => { cancelled = true; };
  }, []);

  if (stocks === null) return <PageLoader />;

  const withStock = stocks.filter(s => s.availableCount > 0 || s.availableKg > 0);
  const totalCount = withStock.reduce((s, x) => s + x.availableCount, 0);
  const totalKg    = withStock.reduce((s, x) => s + x.availableKg, 0);

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">📦 Magazyn tuszek</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tuszki z uboju, rozdzielone wg stada i gatunku. Sprzedaż odejmuje ze stanu.
        </p>
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="Brak tuszek w magazynie"
          description="Zarejestruj ubój w wybranym stadzie — tuszki pojawią się tutaj i będzie je można sprzedać."
          icon="📦"
        />
      ) : (
        <>
          <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-green-700 font-medium">Dostępne łącznie</span>
            <span className="text-lg font-bold text-green-800">{totalCount} szt. · {formatKg(totalKg)}</span>
          </div>

          <Card padding="none">
            <div className="divide-y divide-gray-50">
              {stocks.map(lot => {
                const pctCount = lot.producedCount > 0 ? Math.round((lot.availableCount / lot.producedCount) * 100) : 0;
                const sold = lot.availableCount <= 0 && lot.availableKg <= 0;
                return (
                  <div key={lot.batchId} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{SPECIES_EMOJI[lot.species]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/stada/${lot.batchId}`} className="text-sm font-medium text-gray-900 hover:text-brand-700 hover:underline">
                            {lot.batchName}
                          </Link>
                          <span className="text-xs text-gray-400">{SPECIES_LABELS[lot.species]}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Ubito: {lot.producedCount} szt. / {formatKg(lot.producedKg)}
                          {' · '}Sprzedano: {lot.soldCount} szt. / {formatKg(lot.soldKg)}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pctCount > 30 ? 'bg-green-400' : pctCount > 0 ? 'bg-yellow-400' : 'bg-gray-300'}`}
                              style={{ width: `${pctCount}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${sold ? 'text-gray-400' : 'text-green-700'}`}>
                            {lot.availableCount} szt. · {formatKg(lot.availableKg)}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/sprzedaz/nowa`}
                        className="text-xs text-brand-700 hover:underline shrink-0 mt-0.5"
                      >
                        Sprzedaj →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <p className="text-xs text-gray-400">
            Stan liczony: wyprodukowane przy uboju − sprzedane tuszki/elementy. Sprzedaż księguje
            przychód w Kasie i odejmuje ze stanu magazynu.
          </p>
        </>
      )}
    </div>
  );
}
