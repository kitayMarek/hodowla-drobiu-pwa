import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { isLayerSpecies } from '@/constants/species';
import { SPECIES_EMOJI } from '@/constants/species';
import { formatDate } from '@/utils/date';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { Batch } from '@/models/batch.model';

// ─── Typy ────────────────────────────────────────────────────────────────────

type DayStatus = 'complete' | 'partial' | 'missing' | 'future';

interface BatchDayResult {
  batch: Batch;
  status: 'complete' | 'partial' | 'missing';
  entry: DailyEntry | null;
  missingFields: string[];
}

// ─── Logika statusu ───────────────────────────────────────────────────────────

function getBatchDayResult(batch: Batch, entries: DailyEntry[], dateISO: string): BatchDayResult {
  const entry = entries.find(e => e.batchId === batch.id && e.date === dateISO) ?? null;

  if (!entry) {
    return { batch, status: 'missing', entry: null, missingFields: [] };
  }

  const missing: string[] = [];
  if (isLayerSpecies(batch.species) && entry.eggsCollected == null) {
    missing.push('zebrane jaja');
  }

  return {
    batch,
    status: missing.length === 0 ? 'complete' : 'partial',
    entry,
    missingFields: missing,
  };
}

function getDayStatus(
  activeBatches: Batch[],
  entries: DailyEntry[],
  dateISO: string,
  today: string,
): DayStatus {
  if (dateISO > today) return 'future';

  // Tylko stada, które już istniały w tym dniu
  const batchesForDate = activeBatches.filter(b => b.startDate <= dateISO);
  if (batchesForDate.length === 0) return 'future';

  const results = batchesForDate.map(b => getBatchDayResult(b, entries, dateISO));
  if (results.every(r => r.status === 'complete')) return 'complete';
  if (results.every(r => r.status === 'missing'))  return 'missing';
  return 'partial';
}

// ─── Budowanie siatki miesiąca ────────────────────────────────────────────────

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Pn=0 … Nd=6
  const offset = (firstDay.getDay() + 6) % 7;
  const days: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  return days;
}

// ─── Stałe ───────────────────────────────────────────────────────────────────

const DAY_HEADERS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

const STATUS_BG: Record<DayStatus, string> = {
  complete: 'bg-green-500 text-white hover:bg-green-600',
  partial:  'bg-orange-400 text-white hover:bg-orange-500',
  missing:  'bg-red-400   text-white hover:bg-red-500',
  future:   'text-gray-300 cursor-default',
};

const STATUS_LABEL: Record<'complete' | 'partial' | 'missing', string> = {
  complete: '✓ Kompletny',
  partial:  '⚠ Niekompletny',
  missing:  '✗ Brak wpisu',
};

const STATUS_ROW_BG: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'bg-green-50 border-green-100',
  partial:  'bg-orange-50 border-orange-100',
  missing:  'bg-red-50 border-red-100',
};

const STATUS_BADGE: Record<'complete' | 'partial' | 'missing', string> = {
  complete: 'bg-green-500',
  partial:  'bg-orange-400',
  missing:  'bg-red-400',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  activeBatches: Batch[];
  monthEntries: DailyEntry[];
}

// ─── Komponent ────────────────────────────────────────────────────────────────

export function DailyCalendar({ activeBatches, monthEntries }: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const monthName = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const days      = useMemo(() => buildCalendarDays(year, month), [year, month]);

  // Status każdego dnia
  const dayStatuses = useMemo(() => {
    const result: Record<string, DayStatus> = {};
    for (const d of days) {
      if (d) result[d] = getDayStatus(activeBatches, monthEntries, d, today);
    }
    return result;
  }, [days, activeBatches, monthEntries, today]);

  // Szczegóły wybranego dnia
  const selectedDetails: BatchDayResult[] = useMemo(
    () => selectedDay
      ? activeBatches
          .filter(b => b.startDate <= selectedDay)
          .map(b => getBatchDayResult(b, monthEntries, selectedDay))
      : [],
    [selectedDay, activeBatches, monthEntries],
  );

  return (
    <Card
      title={`Kompletność wpisów – ${monthName}`}
      action={
        <div className="flex gap-3 text-xs text-gray-400">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 align-middle" />Kompletny</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-orange-400 mr-1 align-middle" />Częściowy</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1 align-middle" />Brak</span>
        </div>
      }
    >
      {/* Nagłówki dni */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map(h => (
          <div key={h} className="text-center text-xs font-medium text-gray-400 py-0.5">{h}</div>
        ))}
      </div>

      {/* Siatka dni */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((dateISO, i) => {
          if (!dateISO) return <div key={`e-${i}`} />;
          const status  = dayStatuses[dateISO] ?? 'future';
          const isToday = dateISO === today;
          const dayNum  = parseInt(dateISO.slice(8), 10);

          return (
            <button
              key={dateISO}
              onClick={() => status !== 'future' ? setSelectedDay(dateISO) : undefined}
              disabled={status === 'future'}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-xs font-semibold
                transition-all
                ${STATUS_BG[status]}
                ${isToday ? 'ring-2 ring-offset-1 ring-brand-600' : ''}
              `}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      {/* Modal szczegółów dnia */}
      <Modal
        open={selectedDay != null}
        onClose={() => setSelectedDay(null)}
        title={`Wpisy – ${selectedDay ? formatDate(selectedDay) : ''}`}
      >
        <div className="space-y-3">
          {selectedDetails.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Brak aktywnych stad</p>
          )}
          {selectedDetails.map(({ batch, status, entry, missingFields }) => (
            <div
              key={batch.id}
              className={`rounded-xl border p-3 ${STATUS_ROW_BG[status]}`}
            >
              {/* Nagłówek stada */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{SPECIES_EMOJI[batch.species]}</span>
                <span className="font-semibold text-sm text-gray-900 flex-1 truncate">{batch.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full text-white ${STATUS_BADGE[status]}`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>

              {/* Dane wpisu */}
              {entry && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600 mb-1.5">
                  <span>🌾 {entry.feedConsumedKg} kg paszy</span>
                  <span>💀 {entry.deadCount + entry.culledCount} upadków</span>
                  {isLayerSpecies(batch.species) && (
                    <span>🥚 {entry.eggsCollected ?? '—'} jaj</span>
                  )}
                </div>
              )}

              {/* Brakujące pola */}
              {missingFields.length > 0 && (
                <p className="text-xs text-orange-700 mb-1.5">
                  Brakuje: {missingFields.join(', ')}
                </p>
              )}

              {/* Akcja */}
              {status !== 'complete' && (
                <Link
                  to={entry
                    ? `/stada/${batch.id}/dziennik/${entry.id}`
                    : `/stada/${batch.id}/dziennik/nowy`}
                  onClick={() => setSelectedDay(null)}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {entry ? '✏️ Uzupełnij wpis →' : '+ Dodaj wpis →'}
                </Link>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  );
}
