import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useBatch } from '@/hooks/useBatch';
import { useKPIs } from '@/hooks/useKPIs';
import { KPICard } from '@/components/charts/KPICard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { SPECIES_LABELS, SPECIES_EMOJI, isLayerSpecies } from '@/constants/species';
import { BATCH_STATUS_LABELS } from '@/constants/phases';
import { formatDate, ageLabel } from '@/utils/date';
import { formatPln, formatPercent, formatFCR, formatGrams, formatKg } from '@/utils/format';
import { healthService } from '@/services/health.service';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { addDays, parseISO, isAfter } from 'date-fns';

const statusBadgeColor: Record<string, 'green' | 'blue' | 'gray' | 'yellow'> = {
  active: 'green',
  completed: 'blue',
  sold: 'gray',
  archived: 'yellow',
};

export function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const kpis = useKPIs(id);
  const navigate = useNavigate();

  const withdrawals = useLiveQuery(async () => {
    if (!id) return [];
    return healthService.getActiveWithdrawals(id);
  }, [id]) ?? [];

  if (!batch) return <PageLoader />;

  const isLayer = isLayerSpecies(batch.species);

  const modules = [
    { to: 'dziennik', label: 'Dziennik dzienny', icon: '📅', desc: 'Wpisy dzienne – pasza, jaja, padnięcia' },
    { to: 'wazenia', label: 'Ważenia', icon: '⚖️', desc: 'Historia ważeń i krzywa wzrostu' },
    { to: 'zdrowie', label: 'Zdrowie', icon: '💊', desc: 'Zdarzenia zdrowotne i padnięcia' },
    { to: 'warunki', label: 'Warunki', icon: '🌡️', desc: 'Temperatura, wilgotność, ściółka' },
    { to: 'uboj', label: 'Ubój', icon: '🔪', desc: 'Rekordy uboju i wydajność tuszki' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/stada')} className="text-gray-400 hover:text-gray-600 mt-1">
          ←
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-3xl">{SPECIES_EMOJI[batch.species]}</span>
            <h1 className="text-xl font-bold text-gray-900">{batch.name}</h1>
            <Badge color={statusBadgeColor[batch.status]}>
              {BATCH_STATUS_LABELS[batch.status]}
            </Badge>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {SPECIES_LABELS[batch.species]} · Wiek: {ageLabel(batch.startDate)} · Wstawiono: {formatDate(batch.startDate)}
            {batch.housingId && ` · ${batch.housingId}`}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/stada/${id}/edytuj`)}>
          Edytuj
        </Button>
      </div>

      {/* Withdrawal alert */}
      {withdrawals.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-red-800">Aktywna karencja lekowa!</div>
              {withdrawals.map(w => (
                <div key={w.id} className="text-xs text-red-700 mt-0.5">
                  {w.medicationName ?? w.diagnosis}: do {addDays(parseISO(w.eventDate), w.withdrawalPeriodDays!).toLocaleDateString('pl-PL')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Aktualnie ptaków"
            value={kpis.currentBirdCount.toLocaleString('pl-PL')}
            sub="szt."
            icon="🐔"
            color="green"
          />
          <KPICard
            label="Upadki"
            value={formatPercent(kpis.mortalityPercent)}
            sub={`${kpis.totalMortality} szt.`}
            icon="📉"
            color={kpis.mortalityPercent > 5 ? 'red' : 'gray'}
          />
          <KPICard
            label="FCR"
            value={formatFCR(kpis.fcr)}
            icon="🌾"
            color={kpis.fcr != null && kpis.fcr < 1.8 ? 'green' : 'orange'}
          />
          {isLayer ? (
            <KPICard
              label="Produkcja jaj"
              value={kpis.totalEggsCollected.toLocaleString('pl-PL')}
              sub="jaj"
              icon="🥚"
              color="orange"
            />
          ) : (
            <KPICard
              label="Masa śr."
              value={kpis.currentAvgWeightGrams != null ? formatGrams(kpis.currentAvgWeightGrams) : '—'}
              icon="⚖️"
              color="blue"
            />
          )}
        </div>
      )}

      {/* Finance summary */}
      {kpis && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-xs text-green-700 font-medium">Przychód</div>
            <div className="text-lg font-bold text-green-800">{formatPln(kpis.totalRevenuePln)}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <div className="text-xs text-red-700 font-medium">Koszty</div>
            <div className="text-lg font-bold text-red-800">{formatPln(kpis.totalCostPln)}</div>
          </div>
          <div className={`${kpis.grossMarginPln >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-xl p-3 text-center`}>
            <div className={`text-xs font-medium ${kpis.grossMarginPln >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Marża</div>
            <div className={`text-lg font-bold ${kpis.grossMarginPln >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
              {formatPln(kpis.grossMarginPln)}
            </div>
          </div>
        </div>
      )}

      {/* Module navigation */}
      <Card title="Moduły" padding="none">
        <div className="divide-y divide-gray-50">
          {modules.map(m => (
            <Link
              key={m.to}
              to={`/stada/${id}/${m.to}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">{m.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{m.label}</div>
                <div className="text-xs text-gray-500">{m.desc}</div>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </Card>

      {/* Quick add daily entry */}
      <div className="flex gap-3">
        <Link
          to={`/stada/${id}/dziennik/nowy`}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-700 text-white rounded-xl font-medium hover:bg-brand-800"
        >
          📝 Dodaj wpis dzienny
        </Link>
      </div>
    </div>
  );
}
