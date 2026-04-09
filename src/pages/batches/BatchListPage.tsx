import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBatches } from '@/hooks/useBatch';
import { batchService } from '@/services/batch.service';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/Modal';
import { SPECIES_LABELS, SPECIES_EMOJI } from '@/constants/species';
import { BATCH_STATUS_LABELS, BATCH_STATUS_COLORS } from '@/constants/phases';
import { formatDate, ageLabel } from '@/utils/date';
import type { Batch } from '@/models/batch.model';

const statusColorMap: Record<string, 'green' | 'blue' | 'gray' | 'yellow'> = {
  active: 'green',
  completed: 'blue',
  sold: 'gray',
  archived: 'yellow',
};

export function BatchListPage() {
  const batches = useBatches();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);

  const handleDelete = async () => {
    if (deleteTarget?.id != null) {
      await batchService.delete(deleteTarget.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Stada</h1>
        <Button onClick={() => navigate('/stada/nowe')} icon={<span>+</span>}>
          Nowe stado
        </Button>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="Brak stad"
          description="Dodaj pierwsze stado, aby zacząć ewidencję."
          icon="🐔"
          action={{ label: 'Dodaj stado', onClick: () => navigate('/stada/nowe') }}
        />
      ) : (
        <div className="space-y-2">
          {batches.map(batch => (
            <Link
              key={batch.id}
              to={`/stada/${batch.id}`}
              className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 p-4">
                <span className="text-3xl">{SPECIES_EMOJI[batch.species]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{batch.name}</span>
                    <Badge color={statusColorMap[batch.status]}>
                      {BATCH_STATUS_LABELS[batch.status]}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {SPECIES_LABELS[batch.species]} · {batch.initialCount.toLocaleString('pl-PL')} szt. · {ageLabel(batch.startDate)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Wstawiono: {formatDate(batch.startDate)}
                    {batch.housingId && ` · ${batch.housingId}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={e => { e.preventDefault(); setDeleteTarget(batch); }}
                    className="text-gray-300 hover:text-red-400 p-1 rounded"
                  >
                    🗑️
                  </button>
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Usuń stado"
        message={`Czy na pewno chcesz usunąć stado "${deleteTarget?.name}"? Wszystkie powiązane dane zostaną trwale usunięte.`}
        confirmLabel="Usuń"
        danger
      />
    </div>
  );
}
