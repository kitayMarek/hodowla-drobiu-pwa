import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BatchPhotosSection } from './BatchPhotosSection';
import { useBatch } from '@/hooks/useBatch';
import { SPECIES_EMOJI } from '@/constants/species';

export function BatchPhotosPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const id = Number(batchId);
  const batch = useBatch(id);
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/stada/${id}`)}
          className="text-gray-400 hover:text-gray-600"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          {batch && <span className="text-2xl">{SPECIES_EMOJI[batch.species]}</span>}
          <h1 className="text-xl font-bold text-gray-900">
            Galeria zdjęć{batch ? ` – ${batch.name}` : ''}
          </h1>
        </div>
      </div>

      <BatchPhotosSection batchId={id} />
    </div>
  );
}
