import React from 'react';
import { Link } from 'react-router-dom';
import { useAllBatchKPIs } from '@/hooks/useKPIs';
import { useActiveBatches, useBatches } from '@/hooks/useBatch';
import { KPICard } from '@/components/charts/KPICard';
import { Card } from '@/components/ui/Card';
import { SimpleArea, SimpleBar } from '@/components/charts/TrendChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { formatPln, formatPercent, formatFCR, formatGrams, formatCount } from '@/utils/format';
import { formatDate, ageLabel } from '@/utils/date';
import { SPECIES_LABELS, SPECIES_EMOJI } from '@/constants/species';
import { BATCH_STATUS_COLORS } from '@/constants/phases';
import { pl } from '@/i18n/pl';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { Weighing } from '@/models/weighing.model';
import { calcDailyMortalityTrend } from '@/engine/mortality';
import { calcWeightGainTrend } from '@/engine/growth';
import { calcDailyEggTrend } from '@/engine/eggs';

export function DashboardPage() {
  const allKPIs = useAllBatchKPIs();
  const activeBatches = useActiveBatches();
  const allBatches = useBatches();

  const totalBirds = allKPIs.reduce((s, k) => s + k.currentBirdCount, 0);
  const totalRevenue = allKPIs.reduce((s, k) => s + k.totalRevenuePln, 0);
  const totalCosts = allKPIs.reduce((s, k) => s + k.totalCostPln, 0);
  const totalMargin = totalRevenue - totalCosts;

  // Wybierz pierwszą aktywną partię do wykresów
  const firstBatchId = activeBatches[0]?.id;

  const dailyEntries = useLiveQuery<DailyEntry[]>(
    async () => firstBatchId ? db.dailyEntries.where('batchId').equals(firstBatchId).sortBy('date') : [],
    [firstBatchId]
  ) ?? [];

  const weighings = useLiveQuery<Weighing[]>(
    async () => firstBatchId ? db.weighings.where('batchId').equals(firstBatchId).sortBy('weighingDate') : [],
    [firstBatchId]
  ) ?? [];

  const mortalityTrend = calcDailyMortalityTrend(dailyEntries).slice(-14);
  const weightTrend = calcWeightGainTrend(weighings);
  const eggTrend = calcDailyEggTrend(dailyEntries).slice(-14);
  const hasEggs = eggTrend.some(p => p.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pulpit</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {activeBatches.length === 0 ? (
        <EmptyState
          title="Witaj w Hodowla PL!"
          description="Nie masz jeszcze żadnych aktywnych stad. Zacznij od dodania pierwszego stada."
          icon="🐓"
          action={{ label: 'Dodaj pierwsze stado', onClick: () => window.location.href = '/stada/nowe' }}
        />
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="Aktywne stada"
              value={String(activeBatches.length)}
              icon="🐔"
              color="green"
            />
            <KPICard
              label="Łączna liczba ptaków"
              value={totalBirds.toLocaleString('pl-PL')}
              sub="szt."
              icon="🐓"
              color="blue"
            />
            <KPICard
              label="Łączne przychody"
              value={formatPln(totalRevenue)}
              icon="💰"
              color="green"
            />
            <KPICard
              label="Marża łącznie"
              value={formatPln(totalMargin)}
              icon="📈"
              color={totalMargin >= 0 ? 'green' : 'red'}
              trendLabel={totalRevenue > 0 ? `${formatPercent(totalMargin / totalRevenue * 100)} rentowności` : undefined}
            />
          </div>

          {/* Active batches summary */}
          <Card title="Aktywne stada" action={
            <Link to="/stada" className="text-sm text-brand-700 hover:underline">
              Wszystkie →
            </Link>
          } padding="none">
            <div className="divide-y divide-gray-50">
              {allKPIs.map(kpi => (
                <Link
                  key={kpi.batchId}
                  to={`/stada/${kpi.batchId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl">{SPECIES_EMOJI[activeBatches.find(b => b.id === kpi.batchId)?.species ?? 'brojler']}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{kpi.batchName}</div>
                    <div className="text-xs text-gray-500">
                      {kpi.ageInDays} dni · {kpi.currentBirdCount.toLocaleString('pl-PL')} szt.
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium">FCR: {formatFCR(kpi.fcr)}</div>
                    <div className="text-xs text-gray-500">
                      {kpi.mortalityPercent.toFixed(1)}% upadki
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </Card>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            {mortalityTrend.length > 1 && (
              <Card title={`Padnięcia – ${activeBatches[0]?.name ?? ''}`}>
                <SimpleBar
                  data={mortalityTrend}
                  label="Padnięcia (szt.)"
                  color="#ef4444"
                  height={180}
                />
              </Card>
            )}
            {weightTrend.length > 1 && (
              <Card title="Masa ciała (g)">
                <SimpleArea
                  data={weightTrend}
                  label="Masa śr. (g)"
                  color="#15803d"
                  height={180}
                  formatValue={v => `${v}g`}
                />
              </Card>
            )}
            {hasEggs && (
              <Card title="Produkcja jaj (szt./dzień)">
                <SimpleBar
                  data={eggTrend}
                  label="Zebrane jaja"
                  color="#f59e0b"
                  height={180}
                />
              </Card>
            )}
          </div>

          {/* All batches list */}
          {allBatches.length > activeBatches.length && (
            <Card title="Archiwum stad" padding="none">
              <div className="divide-y divide-gray-50">
                {allBatches.filter(b => b.status !== 'active').slice(0, 5).map(batch => (
                  <Link
                    key={batch.id}
                    to={`/stada/${batch.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="text-xl">{SPECIES_EMOJI[batch.species]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 truncate">{batch.name}</div>
                      <div className="text-xs text-gray-400">{formatDate(batch.startDate)}</div>
                    </div>
                    <Badge color={batch.status === 'sold' ? 'gray' : 'blue'}>
                      {batch.status === 'sold' ? 'Sprzedana' : batch.status === 'completed' ? 'Zakończona' : 'Zarchiwizowana'}
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
