import React from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { HatchingEggPage } from './HatchingEggPage';
import {
  INCUBATION_STATUS_LABELS,
  INCUBATION_STATUS_COLORS,
} from '@/constants/phases';
import { calcIncubationDay, calcKeyDates } from '@/services/incubation.service';
import { formatDate } from '@/utils/date';
import { SPECIES_EMOJI, SPECIES_LABELS } from '@/constants/species';
import type { Incubation } from '@/models/incubation.model';

type Tab = 'wsady' | 'magazyn';

// ── Pasek postępu ─────────────────────────────────────────────────────────────
function ProgressBar({ inc }: { inc: Incubation }) {
  if (inc.status === 'completed' || inc.status === 'cancelled') return null;
  const day         = calcIncubationDay(inc.startDate, inc.totalDays);
  const pct         = Math.round((day / inc.totalDays) * 100);
  const lockdownPct = Math.round((inc.lockdownDay / inc.totalDays) * 100);
  const isLockdown  = day >= inc.lockdownDay;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Dzień {day} / {inc.totalDays}</span>
        <span>{isLockdown ? 'Lockdown' : `Lockdown za ${inc.lockdownDay - day} dni`}</span>
      </div>
      <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-orange-400 z-10"
          style={{ left: `${lockdownPct}%` }} />
        <div
          className={`h-full rounded-full ${isLockdown ? 'bg-orange-400' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function groupSummary(groups: { species: string; breed?: string; count: number }[]): string {
  if (groups.length === 0) return '–';
  return groups.map(g => `${g.count} szt. ${g.breed ?? SPECIES_LABELS[g.species as keyof typeof SPECIES_LABELS] ?? g.species}`).join(', ');
}

// ── Zakładka: Wsady ───────────────────────────────────────────────────────────
function IncubationTab() {
  const incubations = useLiveQuery(() => db.incubations.orderBy('startDate').reverse().toArray(), []) ?? [];
  const eggGroups   = useLiveQuery(() => db.incubationEggGroups.toArray(), []) ?? [];

  const active    = incubations.filter(i => i.status === 'incubating' || i.status === 'lockdown');
  const completed = incubations.filter(i => i.status === 'completed' || i.status === 'cancelled');

  function groupsFor(incId: number) {
    return eggGroups.filter(g => g.incubationId === incId);
  }

  return (
    <div className="space-y-4">
      {incubations.length === 0 && (
        <EmptyState
          title="Brak wsadów inkubacji"
          description="Dodaj pierwszy wsad, aby śledzić postęp wylęgu."
          icon="🥚"
          action={{ label: '+ Nowy wsad', onClick: () => window.location.href = '/wyleglarnia/nowy' }}
        />
      )}

      {active.length > 0 && (
        <Card title="Aktywne wsady" padding="none">
          <div className="divide-y divide-gray-50">
            {active.map(inc => {
              const groups = groupsFor(inc.id!);
              const { hatchDate } = calcKeyDates(inc.startDate, inc.totalDays, inc.lockdownDay);
              return (
                <Link key={inc.id} to={`/wyleglarnia/${inc.id}`}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{inc.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INCUBATION_STATUS_COLORS[inc.status]}`}>
                          {INCUBATION_STATUS_LABELS[inc.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Nałożono: {formatDate(inc.startDate)} · Klujenie: {formatDate(hatchDate)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">
                        {groupSummary(groups)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-700">
                        {groups.reduce((s, g) => s + g.count, 0)} jaj
                      </div>
                    </div>
                  </div>
                  <ProgressBar inc={inc} />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {completed.length > 0 && (
        <Card title="Historia wylęgów" padding="none">
          <div className="divide-y divide-gray-50">
            {completed.map(inc => {
              const groups = groupsFor(inc.id!);
              const totalEggs = groups.reduce((s, g) => s + g.count, 0);
              const pctHatch = inc.totalHatched != null && totalEggs > 0
                ? `${Math.round((inc.totalHatched / totalEggs) * 100)}%` : null;
              return (
                <Link key={inc.id} to={`/wyleglarnia/${inc.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="text-xl">🐣</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">{inc.name}</div>
                    <div className="text-xs text-gray-400">
                      {formatDate(inc.startDate)} · {totalEggs} jaj
                      {pctHatch ? ` · ${pctHatch} wylęgu` : ''}
                    </div>
                  </div>
                  <Badge color={inc.status === 'completed' ? 'green' : 'gray'}>
                    {INCUBATION_STATUS_LABELS[inc.status]}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Główna strona z zakładkami ────────────────────────────────────────────────
export function HatcheryListPage() {
  const [tab, setTab] = React.useState<Tab>('wsady');

  const lotsRaw   = useLiveQuery(() => db.hatchingEggLots.toArray(), []) ?? [];
  const allGroups = useLiveQuery(() => db.incubationEggGroups.toArray(), []) ?? [];
  const totalAvailable = lotsRaw.reduce((s, lot) => {
    const used = allGroups.filter(g => (g as any).hatchingEggLotId === lot.id).reduce((a, g) => a + g.count, 0);
    return s + Math.max(0, lot.count - used);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Wylęgarnia</h1>
        {tab === 'wsady'
          ? <Link to="/wyleglarnia/nowy"><Button size="sm">+ Nowy wsad</Button></Link>
          : null
        }
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([
          { id: 'wsady',   label: '🥚 Wsady inkubacji' },
          { id: 'magazyn', label: `📦 Magazyn${totalAvailable > 0 ? ` (${totalAvailable})` : ''}` },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'wsady'   && <IncubationTab />}
      {tab === 'magazyn' && <HatchingEggPage />}
    </div>
  );
}
