import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllBatchKPIs } from '@/hooks/useKPIs';
import { useActiveBatches, useBatches } from '@/hooks/useBatch';
import { KPICard } from '@/components/charts/KPICard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { MultiBar } from '@/components/charts/TrendChart';
import { formatPln, formatPercent, formatFCR, formatGrams, formatCount } from '@/utils/format';
import { formatDate, ageLabel } from '@/utils/date';
import { SPECIES_LABELS, SPECIES_EMOJI, isLayerSpecies } from '@/constants/species';
import { BATCH_STATUS_COLORS } from '@/constants/phases';
import { Modal } from '@/components/ui/Modal';
import { pl } from '@/i18n/pl';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { DailyCalendar } from '@/components/dashboard/DailyCalendar';
import { incubationService, calcKeyDates } from '@/services/incubation.service';
import { useAllExpenses, useAllSales, useAllFeedDeliveries } from '@/hooks/useTableData';
import { useAllDailyEntries } from '@/hooks/useDailyEntries';
import { seedDemoData } from '@/services/demoData.service';
import { useAuth } from '@/contexts/AuthContext';

type DashModal = 'stada' | 'ptaki' | 'przychody' | 'marza';

const FB_DISMISSED_KEY = 'fermly_fb_dismissed';

function CommunityCard() {
  const [dismissed, setDismissed] = React.useState(
    () => !!localStorage.getItem(FB_DISMISSED_KEY)
  );
  if (dismissed) return null;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#1877F2] to-[#0a5dc7] text-white px-5 py-5 shadow-md">
      {/* Zamknij */}
      <button
        onClick={() => { localStorage.setItem(FB_DISMISSED_KEY, '1'); setDismissed(true); }}
        className="absolute top-3 right-3 text-white/50 hover:text-white/90 text-lg leading-none p-1"
        aria-label="Zamknij"
      >
        ✕
      </button>

      <div className="flex items-start gap-4 pr-6">
        {/* FB icon */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-2xl">
          👥
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="font-bold text-base leading-tight">Dołącz do społeczności Fermly!</p>
            <p className="text-white/80 text-sm mt-1 leading-relaxed">
              Masz pomysł na nową funkcję? Chcesz podzielić się doświadczeniami
              z hodowli lub zgłosić błąd? Czekamy na Ciebie w naszej grupie na Facebooku.
            </p>
          </div>

          <a
            href="https://www.facebook.com/groups/1351454033578483/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-[#1877F2] font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors active:scale-95"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            Dołącz do grupy →
          </a>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const allKPIs = useAllBatchKPIs();
  const activeBatches = useActiveBatches();
  const allBatches = useBatches();
  const [dashModal, setDashModal] = React.useState<DashModal | null>(null);
  const [seeding, setSeeding] = React.useState(false);
  const { user } = useAuth();

  const feedDeliveries = useAllFeedDeliveries();
  const allExpenses    = useAllExpenses();
  const allSales       = useAllSales();

  // Wylęgarnia – alerty lockdown (Dexie-only for now)
  const upcomingLockdowns = useLiveQuery(
    () => incubationService.getUpcomingLockdowns(3),
    []
  ) ?? [];
  const activeIncubations = useLiveQuery(
    () => db.incubations.where('status').anyOf('incubating', 'lockdown').count(),
    []
  ) ?? 0;

  // Wpisy dzienne – dla kalendarza
  const allDailyEntries = useAllDailyEntries();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEntries = allDailyEntries.filter(e => e.date >= monthStart && e.date <= today);

  const totalBirds = allKPIs.reduce((s, k) => s + k.currentBirdCount, 0);
  const totalRevenue = allSales.reduce((s, x) => s + x.totalRevenuePln, 0);
  const totalFeedDeliveryCost = feedDeliveries.reduce((s, d) => s + d.totalCostPln, 0);
  const totalOtherExpenses = allExpenses.reduce((s, e) => s + e.amountPln, 0);
  const totalChickCost = allBatches.reduce(
    (s, b) => s + (b.chick_cost_per_unit ?? 0) * b.initialCount + (b.transport_cost ?? 0),
    0
  );
  const totalCosts = totalFeedDeliveryCost + totalOtherExpenses + totalChickCost;
  const totalMargin = totalRevenue - totalCosts;

  // ── Wykres miesięczny (ostatnie 6 miesięcy) ───────────────────────────────
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: Record<string, { month: string; income: number; cost: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = {
        month: d.toLocaleDateString('pl-PL', { month: 'short' }),
        income: 0,
        cost: 0,
      };
    }
    allSales.forEach(s => {
      const m = s.saleDate.slice(0, 7);
      if (months[m]) months[m].income += s.totalRevenuePln;
    });
    feedDeliveries.forEach(d => {
      const m = d.deliveryDate.slice(0, 7);
      if (months[m]) months[m].cost += d.totalCostPln;
    });
    allExpenses.forEach(e => {
      const m = e.expenseDate.slice(0, 7);
      if (months[m]) months[m].cost += e.amountPln;
    });
    allBatches.forEach(b => {
      const m = b.startDate.slice(0, 7);
      const chickCost = (b.chick_cost_per_unit ?? 0) * b.initialCount + (b.transport_cost ?? 0);
      if (months[m]) months[m].cost += chickCost;
    });
    return Object.values(months);
  }, [allSales, feedDeliveries, allExpenses, allBatches]);

  const hasMonthlyData = monthlyData.some(m => m.income > 0 || m.cost > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Pulpit</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {activeBatches.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title="Witaj w Fermly!"
            description="Nie masz jeszcze żadnych aktywnych stad. Zacznij od dodania pierwszego stada."
            icon="🐓"
            action={{ label: 'Dodaj pierwsze stado', onClick: () => window.location.href = '/stada/nowe' }}
          />
          {!user && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-center space-y-2">
              <div className="text-sm font-semibold text-amber-800">Chcesz zobaczyć jak działa aplikacja?</div>
              <div className="text-xs text-amber-700">Załaduj przykładowe dane — 2 aktywne stada, historię pasz, jaj, kasy i więcej.</div>
              <button
                onClick={async () => {
                  setSeeding(true);
                  await seedDemoData();
                  setSeeding(false);
                }}
                disabled={seeding}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {seeding ? '⏳ Ładowanie…' : '🚀 Wypróbuj z przykładowymi danymi'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Alert lockdown wylęgarni */}
          {upcomingLockdowns.map(inc => {
            const { lockdownDate } = calcKeyDates(inc.startDate, inc.totalDays, inc.lockdownDay);
            const today = new Date(); today.setHours(0,0,0,0);
            const ld = new Date(lockdownDate); ld.setHours(0,0,0,0);
            const daysUntil = Math.floor((ld.getTime() - today.getTime()) / 86_400_000);
            return (
              <Link key={inc.id} to={`/wyleglarnia/${inc.id}`} className="block">
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-2xl">🔔</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-orange-800">
                      {daysUntil === 0 ? 'DZIŚ: Przejdź w lockdown!' : `Za ${daysUntil} ${daysUntil === 1 ? 'dzień' : 'dni'}: Lockdown`}
                    </div>
                    <div className="text-xs text-orange-700">
                      {inc.name} · zmień na {inc.lockdownTempC} °C / {inc.lockdownHumidityPct}% wilg. · zatrzymaj obracanie
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}

          {/* Szybki podgląd wylęgarni */}
          {activeIncubations > 0 && upcomingLockdowns.length === 0 && (
            <Link to="/wyleglarnia" className="block">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🥚</span>
                <div className="flex-1 text-sm text-amber-800">
                  <span className="font-semibold">{activeIncubations} aktywny wsad inkubacji</span>
                </div>
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )}

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              label="Aktywne stada"
              value={String(activeBatches.length)}
              icon="🐔"
              color="green"
              onClick={() => setDashModal('stada')}
            />
            <KPICard
              label="Ptaki łącznie"
              value={totalBirds.toLocaleString('pl-PL')}
              sub="szt."
              icon="🐓"
              color="blue"
              onClick={totalBirds > 0 ? () => setDashModal('ptaki') : undefined}
            />
            <KPICard
              label="Przychody"
              value={formatPln(totalRevenue)}
              sub="od początku"
              icon="💰"
              color="green"
              onClick={totalRevenue > 0 ? () => setDashModal('przychody') : undefined}
            />
            <KPICard
              label="Marża"
              value={formatPln(totalMargin)}
              sub={totalRevenue > 0 ? `${formatPercent(totalMargin / totalRevenue * 100)} rent.` : 'od początku'}
              icon="📈"
              color={totalMargin >= 0 ? 'green' : 'red'}
              onClick={allKPIs.length > 0 ? () => setDashModal('marza') : undefined}
            />
          </div>

          {/* Wykres miesięczny */}
          {hasMonthlyData && (
            <Card title="Przychody vs Koszty – ostatnie 6 miesięcy" padding="sm">
              <MultiBar
                data={monthlyData}
                xKey="month"
                bars={[
                  { key: 'income', label: 'Przychody', color: '#16a34a' },
                  { key: 'cost',   label: 'Koszty',    color: '#dc2626' },
                ]}
                formatValue={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))}
                height={160}
              />
            </Card>
          )}

          {/* Active batches summary */}
          <Card title="Aktywne stada" action={
            <Link to="/stada" className="text-sm text-brand-700 hover:underline">
              Wszystkie →
            </Link>
          } padding="none">
            <div className="divide-y divide-gray-50">
              {allKPIs.map(kpi => {
                const batch = activeBatches.find(b => b.id === kpi.batchId);
                const todayEntry = monthEntries.find(e => e.batchId === kpi.batchId && e.date === today);
                // Status dzisiejszy: missing / partial (nioska bez jaj) / complete
                const todayStatus = !todayEntry
                  ? 'missing'
                  : (batch && isLayerSpecies(batch.species) && todayEntry.eggsCollected == null)
                    ? 'partial'
                    : 'complete';
                const dotColor = todayStatus === 'complete'
                  ? 'bg-green-500'
                  : todayStatus === 'partial'
                    ? 'bg-orange-400'
                    : 'bg-red-400';
                return (
                  <Link
                    key={kpi.batchId}
                    to={`/stada/${kpi.batchId}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <span className="text-2xl">{SPECIES_EMOJI[batch?.species ?? 'brojler']}</span>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${dotColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{kpi.batchName}</div>
                      <div className="text-xs text-gray-500">
                        {kpi.ageInDays} dni · {kpi.currentBirdCount.toLocaleString('pl-PL')} szt.
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-gray-800">FCR: {formatFCR(kpi.fcr)}</div>
                      <div className="text-xs text-gray-500">
                        {kpi.mortalityPercent.toFixed(1)}% upadki
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* Kalendarz kompletności wpisów */}
          <DailyCalendar activeBatches={activeBatches} monthEntries={monthEntries} />

          {/* Link do archiwum */}
          {allBatches.length > activeBatches.length && (
            <div className="text-center">
              <Link to="/stada" className="text-sm text-gray-400 hover:text-brand-600 transition-colors">
                📁 Archiwum: {allBatches.length - activeBatches.length} zakończonych stad →
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Społeczność ────────────────────────────────────────────── */}
      <CommunityCard />

      {/* ── Modalne szczegółów KPI ─────────────────────────────────── */}
      {dashModal && (
        <Modal
          open
          onClose={() => setDashModal(null)}
          title={
            dashModal === 'stada'     ? 'Aktywne stada' :
            dashModal === 'ptaki'     ? 'Ptaki – rozkład wg stad' :
            dashModal === 'przychody' ? 'Przychody – rozkład wg stad' :
                                        'Marża – rozkład wg stad'
          }
        >
          {dashModal === 'stada' && (
            <div className="divide-y divide-gray-50">
              {activeBatches.map(b => {
                const kpi = allKPIs.find(k => k.batchId === b.id);
                return (
                  <Link
                    key={b.id}
                    to={`/stada/${b.id}`}
                    onClick={() => setDashModal(null)}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-colors"
                  >
                    <span className="text-2xl">{SPECIES_EMOJI[b.species]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{b.name}</div>
                      <div className="text-xs text-gray-500">
                        {kpi ? `${kpi.ageInDays} dni · ${kpi.currentBirdCount.toLocaleString('pl-PL')} szt. · FCR ${formatFCR(kpi.fcr)}` : SPECIES_LABELS[b.species]}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
              {activeBatches.length === 0 && (
                <p className="text-sm text-gray-400 py-2 text-center">Brak aktywnych stad.</p>
              )}
            </div>
          )}

          {dashModal === 'ptaki' && (
            <div className="space-y-1">
              <div className="divide-y divide-gray-50">
                {allKPIs.map(kpi => (
                  <div key={kpi.batchId} className="flex justify-between items-center py-2.5">
                    <div>
                      <div className="text-sm text-gray-800">{kpi.batchName}</div>
                      <div className="text-xs text-gray-400">upadki {formatPercent(kpi.mortalityPercent)} · FCR {formatFCR(kpi.fcr)}</div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{kpi.currentBirdCount.toLocaleString('pl-PL')} szt.</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold pt-3 border-t border-gray-100">
                <span className="text-sm">Łącznie</span>
                <span className="text-sm">{totalBirds.toLocaleString('pl-PL')} szt.</span>
              </div>
            </div>
          )}

          {dashModal === 'przychody' && (
            <div className="space-y-1">
              <div className="divide-y divide-gray-50">
                {allKPIs.map(kpi => (
                  <div key={kpi.batchId} className="flex justify-between items-center py-2.5">
                    <span className="text-sm text-gray-800">{kpi.batchName}</span>
                    <span className="text-sm font-bold text-green-700">{formatPln(kpi.totalRevenuePln)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold pt-3 border-t border-gray-100">
                <span className="text-sm">Łącznie</span>
                <span className="text-sm text-green-700">{formatPln(totalRevenue)}</span>
              </div>
            </div>
          )}

          {dashModal === 'marza' && (
            <div className="space-y-1">
              <div className="divide-y divide-gray-50">
                {allKPIs.map(kpi => (
                  <div key={kpi.batchId} className="py-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900">{kpi.batchName}</span>
                      <span className={`text-sm font-bold ${kpi.grossMarginPln >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatPln(kpi.grossMarginPln)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mt-0.5">
                      <span>Przychód: {formatPln(kpi.totalRevenuePln)}</span>
                      <span>Koszty: {formatPln(kpi.totalCostPln)}</span>
                      {kpi.grossMarginPercent != null && (
                        <span>Rentowność: {formatPercent(kpi.grossMarginPercent)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold pt-3 border-t border-gray-100 text-sm">
                <span>Marża łącznie</span>
                <span className={totalMargin >= 0 ? 'text-green-700' : 'text-red-600'}>{formatPln(totalMargin)}</span>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
