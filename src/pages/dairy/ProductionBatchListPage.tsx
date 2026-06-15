import React, { useEffect, useState } from 'react';
import { AskLLM } from '@/components/AskLLM';
import { Link, useSearchParams } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch, BatchStatus } from '@/models/dairy.model';
import {
  PRODUCT_ICONS, PRODUCT_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';

const STATUS_FILTERS: { label: string; statuses: BatchStatus[] | undefined }[] = [
  { label: 'Aktywne', statuses: ['w_produkcji', 'dojrzewa', 'gotowy'] },
  { label: 'W produkcji', statuses: ['w_produkcji'] },
  { label: 'Dojrzewa', statuses: ['dojrzewa'] },
  { label: 'Gotowe', statuses: ['gotowy'] },
  { label: 'Wszystkie', statuses: undefined },
];

export function ProductionBatchListPage() {
  const [params] = useSearchParams();
  const initStatus = params.get('status') as BatchStatus | null;

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(
    initStatus ? STATUS_FILTERS.findIndex(f => f.statuses?.includes(initStatus)) : 0
  );

  const load = (idx: number) => {
    setLoading(true);
    dairyService.getBatches(STATUS_FILTERS[idx].statuses).then(list => {
      setBatches(list);
      setLoading(false);
    });
  };

  useEffect(() => { load(activeFilter); }, []);

  const handleFilter = (idx: number) => {
    setActiveFilter(idx);
    load(idx);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleko</Link>
          <h1 className="text-xl font-bold text-gray-900">Partie produkcji</h1>
        </div>
        <Link to="/mleko/przyjecia/nowe">
          <Button size="sm">+ Nowe przyjęcie</Button>
        </Link>
      </div>

      <div><AskLLM defaultQuery="jak prowadzić ewidencję partii sera zagrodowego RHD" contextUrl="https://fermly.pl/przewodnik-sery.html" /></div>

      {/* Filtry */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f, i) => (
          <button
            key={i}
            onClick={() => handleFilter(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === i
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && batches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🫙</div>
          <p className="text-gray-500 text-sm">Brak partii w tej kategorii.</p>
          <Link to="/mleko/przyjecia/nowe" className="inline-block mt-4">
            <Button>+ Dodaj pierwsze przyjęcie</Button>
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {batches.map(b => {
          const daysLeft = Math.ceil(
            (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86400000
          );
          const urgent = b.status === 'gotowy' && daysLeft <= 7;
          const expired = daysLeft < 0;

          return (
            <Link
              key={b.id}
              to={`/mleko/partie/${b.id}`}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all"
            >
              <span className="text-3xl">{PRODUCT_ICONS[b.productType]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{b.batchNumber}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {PRODUCT_LABELS[b.productType]} · {b.milkLiters} L mleka
                  · wynik: {b.actualYieldKg ?? b.expectedYieldKg} kg
                </div>
                <div className="text-xs text-gray-400">
                  Produkcja: {new Date(b.productionDate + 'T12:00:00').toLocaleDateString('pl-PL')}
                  {b.status === 'gotowy' && (
                    <span className={`ml-2 font-medium ${expired ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-gray-400'}`}>
                      · Termin: {expired ? 'wygasło!' : `${daysLeft} dni`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {b.quantityRemainingKg.toFixed(2)} kg
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
