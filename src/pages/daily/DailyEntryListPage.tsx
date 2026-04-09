import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useDailyEntries } from '@/hooks/useDailyEntries';
import { useBatch } from '@/hooks/useBatch';
import { dailyEntryService } from '@/services/dailyEntry.service';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/utils/date';
import { isLayerSpecies } from '@/constants/species';
import type { DailyEntry } from '@/models/dailyEntry.model';

export function DailyEntryListPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const entries = useDailyEntries(id);
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<DailyEntry | null>(null);

  if (!batch) return <PageLoader />;
  const isLayer = isLayerSpecies(batch.species);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/stada/${id}`)} className="text-gray-400 hover:text-gray-600">
            ←
          </button>
          <h1 className="text-xl font-bold text-gray-900">Dziennik</h1>
        </div>
        <Button onClick={() => navigate(`/stada/${id}/dziennik/nowy`)} size="sm" icon={<span>+</span>}>
          Nowy wpis
        </Button>
      </div>

      <div className="text-sm text-gray-500">{batch.name}</div>

      {entries.length === 0 ? (
        <EmptyState
          title="Brak wpisów"
          description="Dodaj pierwszy wpis dzienny."
          icon="📅"
          action={{ label: 'Dodaj wpis', onClick: () => navigate(`/stada/${id}/dziennik/nowy`) }}
        />
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="text-center">
                  <div className="text-xs text-gray-400 uppercase">{formatDate(entry.date).slice(3, 8)}</div>
                  <div className="text-lg font-bold text-gray-900 leading-none">{formatDate(entry.date).slice(0, 2)}</div>
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-sm">
                  <div><span className="text-gray-400 text-xs">Padnięcia</span><br/><span className="font-medium">{entry.deadCount + entry.culledCount}</span></div>
                  <div><span className="text-gray-400 text-xs">Pasza</span><br/><span className="font-medium">{entry.feedConsumedKg} kg</span></div>
                  {isLayer && <div><span className="text-gray-400 text-xs">Jaja</span><br/><span className="font-medium">{entry.eggsCollected ?? 0}</span></div>}
                  {entry.sampleWeightGrams != null && <div><span className="text-gray-400 text-xs">Masa</span><br/><span className="font-medium">{entry.sampleWeightGrams}g</span></div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link
                    to={`/stada/${id}/dziennik/${entry.id}`}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                  >
                    ✏️
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(entry)}
                    className="p-1.5 text-gray-300 hover:text-red-400 rounded"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {entry.notes && (
                <div className="px-4 pb-3 text-xs text-gray-500 italic">{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.id != null) await dailyEntryService.delete(deleteTarget.id);
        }}
        message="Usunąć ten wpis dzienny?"
        danger
      />
    </div>
  );
}
