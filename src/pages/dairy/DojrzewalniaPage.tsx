import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS } from '@/models/dairy.model';
import { fetchRecipes } from '@/services/recipeContract.service';
import { estimateBatchWeightKg, daysSince } from '@/utils/cheeseStock';
import { Card } from '@/components/ui/Card';

/** Dojrzewalnia = magazyn wyrobów gotowych. Stan szacunkowy (waga maleje w czasie leżakowania). */
export function DojrzewalniaPage() {
  const [batches, setBatches] = useState<ProductionBatch[] | null>(null);
  const [ubytekBySlug, setUbytekBySlug] = useState<Record<string, number | null | undefined>>({});

  useEffect(() => {
    dairyService.getBatches(['dojrzewa', 'gotowy']).then(setBatches);
    fetchRecipes()
      .then(list => {
        const m: Record<string, number | null | undefined> = {};
        list.forEach(r => { m[r.slug] = r.dojrzewanie?.ubytekWagiProc; });
        setUbytekBySlug(m);
      })
      .catch(() => { /* offline → domyślne wartości per rodzina */ });
  }, []);

  const ubytekFor = (b: ProductionBatch) => (b.cheeseVariety ? ubytekBySlug[b.cheeseVariety] : undefined);

  const totalEst = (batches ?? []).reduce((s, b) => s + estimateBatchWeightKg(b, ubytekFor(b)), 0);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">🏚️ Dojrzewalnia / Magazyn</h1>
      </div>
      <p className="text-sm text-gray-500">
        Stan magazynu wyrobów dojrzewających. Waga jest <strong>szacunkowa</strong> — ser traci na wadze w czasie
        leżakowania. Przeważ partię na karcie, by uściślić.
      </p>

      {!batches && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {batches && batches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🏚️</div>
          <p className="text-gray-500 text-sm">Dojrzewalnia pusta — brak partii w dojrzewaniu.</p>
        </div>
      )}

      {batches && batches.length > 0 && (
        <>
          <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm">
            <span className="text-gray-500">Szacowany stan magazynu: </span>
            <strong className="text-brand-700">{totalEst.toFixed(2)} kg</strong>
            <span className="text-gray-400"> w {batches.length} {batches.length === 1 ? 'partii' : 'partiach'}</span>
          </div>

          <div className="space-y-2">
            {batches.map(b => {
              const est = estimateBatchWeightKg(b, ubytekFor(b));
              const nominal = b.quantityRemainingKg;
              const lost = nominal > 0 ? (1 - est / nominal) * 100 : 0;
              const age = daysSince(b.productionDate);
              const total = b.agingDays ?? 0;
              const ready = b.status === 'gotowy' || (total > 0 && age >= total);
              return (
                <div key={b.id} className="p-3 bg-white rounded-xl border border-gray-100">
                  <Link to={`/mleko/partie/${b.id}`} className="flex items-center gap-3 hover:opacity-80">
                    <span className="text-3xl">{PRODUCT_ICONS[b.productType]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {b.cheeseName || PRODUCT_LABELS[b.productType]}
                      </div>
                      <div className="text-xs text-gray-400">
                        Dojrzewa {age}{total > 0 ? `/${total}` : ''} dni
                        {b.lastWeighedAt && <span className="text-gray-300"> · przeważono {new Date(b.lastWeighedAt + 'T12:00:00').toLocaleDateString('pl-PL')}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-sm font-bold text-gray-800">~{est.toFixed(2)} kg</span>
                      {lost >= 0.5 && <span className="text-xs text-gray-400">−{lost.toFixed(0)}% wagi</span>}
                      {ready && <span className="text-xs font-medium text-green-600">gotowy</span>}
                    </div>
                  </Link>
                  <div className="flex gap-3 mt-2 pt-2 border-t border-gray-50">
                    <Link to={`/mleko/partie/${b.id}/etykieta`} className="text-xs font-medium text-brand-600 hover:text-brand-800">🏷️ Etykieta</Link>
                    <Link to={`/mleko/partie/${b.id}/metryczka`} className="text-xs font-medium text-brand-600 hover:text-brand-800">📜 Metryczka</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
