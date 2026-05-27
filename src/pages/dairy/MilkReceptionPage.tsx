import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { MilkReception } from '@/models/dairy.model';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function MilkReceptionPage() {
  const [list, setList] = useState<MilkReception[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () =>
    dairyService.getReceptions().then(r => { setList(r); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Usunąć to przyjęcie?')) return;
    await dairyService.deleteReception(id);
    load();
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
                    {new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-xs text-gray-400">Łącznie: {totalL.toFixed(1)} L</p>
                </div>
                <Link to={`/mleko/przyjecia/nowe?date=${date}`}>
                  <Button size="sm" variant="outline">+ Dodaj</Button>
                </Link>
              </div>
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <span className="text-lg">{r.source === 'own' ? '🐄' : '🚛'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {r.quantityLiters.toFixed(1)} L
                        {r.source === 'own' ? ' · własne' : ` · ${r.supplierName ?? 'skup'}`}
                      </div>
                      <div className="text-xs text-gray-400 flex gap-3">
                        {r.temperatureC != null && <span>🌡 {r.temperatureC}°C</span>}
                        {r.fatPercent != null && <span>🧴 {r.fatPercent}% tłuszczu</span>}
                        {r.totalPricePln != null && <span>💰 {r.totalPricePln.toFixed(2)} zł</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!r.milkAllocated && (
                        <Link to={`/mleko/rozlew/${r.id}`}>
                          <span className="text-xs px-2 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg font-medium hover:bg-brand-100">
                            Rozlej →
                          </span>
                        </Link>
                      )}
                      <button
                        onClick={() => r.id != null && handleDelete(r.id)}
                        className="text-gray-300 hover:text-red-400 text-sm"
                      >🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
    </div>
  );
}
