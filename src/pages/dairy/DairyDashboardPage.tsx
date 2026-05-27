import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/models/dairy.model';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Stats {
  activeBatches: number;
  expiringIn7Days: ProductionBatch[];
  totalStockKg: number;
  todayReception: number;
  monthlyWheyL: number;
}

export function DairyDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dairyService.getDashboardStats().then(s => { setStats(s); setLoading(false); });
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">🧀 Przetwórstwo Mleka</h1>
        <Link to="/mleko/przyjecia/nowe">
          <Button size="sm">+ Przyjęcie mleka</Button>
        </Link>
      </div>

      {/* Alerty */}
      {stats?.expiringIn7Days && stats.expiringIn7Days.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-amber-800">⚠ Produkty kończące termin (7 dni)</p>
          {stats.expiringIn7Days.map(b => {
            const daysLeft = Math.ceil(
              (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86400000
            );
            return (
              <Link key={b.id} to={`/mleko/partie/${b.id}`}
                className="flex items-center justify-between text-sm text-amber-700 hover:text-amber-900">
                <span>{PRODUCT_ICONS[b.productType]} {b.batchNumber} — {b.quantityRemainingKg} kg</span>
                <span className={`font-semibold ${daysLeft <= 2 ? 'text-red-600' : ''}`}>
                  {daysLeft === 0 ? 'dziś!' : `${daysLeft} dni`}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Statystyki */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Aktywne partie', value: loading ? '…' : String(stats?.activeBatches ?? 0), icon: '🫙', color: 'text-blue-600' },
          { label: 'Stan magazynu', value: loading ? '…' : `${stats?.totalStockKg.toFixed(1)} kg`, icon: '📦', color: 'text-green-600' },
          { label: 'Dziś przyjęto', value: loading ? '…' : `${stats?.todayReception ?? 0} L`, icon: '🥛', color: 'text-brand-600' },
          { label: 'Serwatka (mies.)', value: loading ? '…' : `${stats?.monthlyWheyL.toFixed(0)} L`, icon: '💧', color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Szybkie akcje */}
      <Card title="Szybkie akcje" padding="md">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/mleko/przyjecia/nowe"
            className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm font-medium text-gray-700">
            <span className="text-xl">🥛</span> Przyjęcie mleka
          </Link>
          <Link to="/mleko/przyjecia"
            className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm font-medium text-gray-700">
            <span className="text-xl">📋</span> Historia przyjęć
          </Link>
          <Link to="/mleko/partie"
            className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm font-medium text-gray-700">
            <span className="text-xl">🫙</span> Partie produkcji
          </Link>
          <Link to="/mleko/partie?status=gotowy"
            className="flex items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-sm font-medium text-gray-700">
            <span className="text-xl">✅</span> Gotowe do sprzedaży
          </Link>
        </div>
      </Card>

      {/* Ostatnie partie */}
      <DairyBatchesPreview />
    </div>
  );
}

function DairyBatchesPreview() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);

  useEffect(() => {
    dairyService.getBatches(['w_produkcji', 'dojrzewa', 'gotowy']).then(list => {
      setBatches(list.slice(0, 5));
    });
  }, []);

  if (batches.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card title="Aktywne partie" padding="md">
      <div className="space-y-2">
        {batches.map(b => {
          const daysLeft = Math.ceil(
            (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / 86400000
          );
          const urgent = b.status === 'gotowy' && daysLeft <= 7;
          return (
            <Link key={b.id} to={`/mleko/partie/${b.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              <span className="text-2xl">{PRODUCT_ICONS[b.productType]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{b.batchNumber}</div>
                <div className="text-xs text-gray-400">{PRODUCT_LABELS[b.productType]} · {b.quantityRemainingKg} kg</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>
                  {STATUS_LABELS[b.status]}
                </span>
                {b.status === 'gotowy' && (
                  <span className={`text-xs ${urgent ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {daysLeft <= 0 ? 'Wygasło!' : `${daysLeft} dni`}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        <Link to="/mleko/partie" className="block text-center text-xs text-brand-600 hover:text-brand-800 pt-1 font-medium">
          Wszystkie partie →
        </Link>
      </div>
    </Card>
  );
}
