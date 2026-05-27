import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { MilkReception } from '@/models/dairy.model';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type AllocSummary = { allocatedL: number; hasSales: boolean };

export function MilkReceptionPage() {
  const [list,      setList]      = useState<MilkReception[]>([]);
  const [summaries, setSummaries] = useState<Map<number, AllocSummary>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState<number | null>(null);   // receptionId którego rozlew usuwamy
  const navigate = useNavigate();

  const load = async () => {
    const receptions = await dairyService.getReceptions();
    setList(receptions);
    const ids = receptions.map(r => r.id).filter((id): id is number => id != null);
    const sums = await dairyService.getAllocationSummaries(ids);
    setSummaries(sums);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDeleteReception = async (id: number) => {
    const sum = summaries.get(id);
    if (sum && sum.allocatedL > 0) {
      alert('Najpierw usuń rozlew tego przyjęcia, a potem możesz usunąć samo przyjęcie.');
      return;
    }
    if (!window.confirm('Usunąć to przyjęcie mleka?')) return;
    await dairyService.deleteReception(id);
    load();
  };

  const handleDeleteAllocations = async (receptionId: number) => {
    const sum = summaries.get(receptionId);
    if (sum?.hasSales) {
      alert('Nie można usunąć rozlewu — dla jednej z partii zarejestrowano już sprzedaż.');
      return;
    }
    if (!window.confirm(
      'Usunąć cały rozlew tego przyjęcia?\n\nZostaną usunięte wszystkie partie produkcyjne, kroki i serwatka. Samo przyjęcie mleka zostanie.'
    )) return;
    setDeleting(receptionId);
    try {
      await dairyService.deleteReceptionAllocations(receptionId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Błąd usuwania');
    } finally {
      setDeleting(null);
    }
  };

  // Grupuj po dacie
  const grouped = list.reduce<Record<string, MilkReception[]>>((acc, r) => {
    (acc[r.date] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleko</Link>
          <h1 className="text-xl font-bold text-gray-900">Historia przyjęć</h1>
        </div>
        <Link to="/mleko/przyjecia/nowe">
          <Button size="sm">+ Przyjęcie</Button>
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && list.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🥛</div>
          <p className="text-gray-500 text-sm">Brak przyjęć mleka.<br />Zacznij od dodania pierwszego.</p>
          <Link to="/mleko/przyjecia/nowe" className="inline-block mt-4">
            <Button>+ Pierwsze przyjęcie</Button>
          </Link>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, rows]) => {
          const totalL = rows.reduce((s, r) => s + r.quantityLiters, 0);
          return (
            <Card key={date} padding="md">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', {
                      weekday: 'short', day: 'numeric', month: 'long',
                    })}
                  </p>
                  <p className="text-xs text-gray-400">Łącznie: {totalL.toFixed(1)} L</p>
                </div>
                <Link to={`/mleko/przyjecia/nowe?date=${date}`}>
                  <Button size="sm" variant="outline">+ Dodaj</Button>
                </Link>
              </div>

              <div className="space-y-2">
                {rows.map(r => {
                  const sum         = r.id != null ? summaries.get(r.id) : undefined;
                  const allocatedL  = sum?.allocatedL ?? 0;
                  const isFullAlloc = allocatedL >= r.quantityLiters - 0.01;
                  const isPartial   = allocatedL > 0.01 && !isFullAlloc;
                  const remainingL  = r.quantityLiters - allocatedL;
                  const hasSales    = sum?.hasSales ?? false;

                  return (
                    <div key={r.id} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-lg mt-0.5">{r.source === 'own' ? '🐄' : '🚛'}</span>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">
                          {r.quantityLiters.toFixed(1)} L
                          {r.source === 'own' ? ' · własne' : ` · ${r.supplierName ?? 'skup'}`}
                        </div>
                        <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                          {r.temperatureC != null && <span>🌡 {r.temperatureC}°C</span>}
                          {r.fatPercent != null && <span>🧴 {r.fatPercent}% tłuszczu</span>}
                          {r.totalPricePln != null && <span>💰 {r.totalPricePln.toFixed(2)} zł</span>}
                        </div>

                        {/* Status alokacji */}
                        {isFullAlloc && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              ✓ Rozlano w całości
                            </span>
                            {/* Usuń rozlew */}
                            {!hasSales ? (
                              <button
                                onClick={() => r.id != null && handleDeleteAllocations(r.id)}
                                disabled={deleting === r.id}
                                className="text-[10px] text-gray-400 hover:text-red-500 underline disabled:opacity-50"
                              >
                                {deleting === r.id ? 'Usuwanie…' : '🗑 Usuń rozlew'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-300" title="Sprzedaż już zarejestrowana">
                                🔒 Rozlew zablokowany
                              </span>
                            )}
                          </div>
                        )}
                        {isPartial && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Rozlano {allocatedL.toFixed(1)} L · zostało {remainingL.toFixed(1)} L
                            </span>
                            {!hasSales && (
                              <button
                                onClick={() => r.id != null && handleDeleteAllocations(r.id)}
                                disabled={deleting === r.id}
                                className="text-[10px] text-gray-400 hover:text-red-500 underline disabled:opacity-50"
                              >
                                {deleting === r.id ? 'Usuwanie…' : '🗑 Usuń rozlew'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Przycisk Rozlej — tylko jeśli jest co rozlewać */}
                        {!isFullAlloc && (
                          <Link to={`/mleko/rozlew/${r.id}`}>
                            <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg font-medium hover:bg-brand-100 whitespace-nowrap">
                              {isPartial
                                ? `Dołóż ${remainingL.toFixed(1)} L →`
                                : 'Rozlej →'}
                            </span>
                          </Link>
                        )}

                        {/* Usuń przyjęcie — tylko jeśli brak alokacji */}
                        {allocatedL < 0.01 && (
                          <button
                            onClick={() => r.id != null && handleDeleteReception(r.id)}
                            className="text-gray-300 hover:text-red-400 text-sm"
                            title="Usuń przyjęcie"
                          >🗑</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
    </div>
  );
}
