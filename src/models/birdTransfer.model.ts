export type TransferReason = 'wyleg' | 'reorganizacja' | 'separacja' | 'kwarantanna' | 'inne';

export const TRANSFER_REASON_LABELS: Record<TransferReason, string> = {
  wyleg:        'Wylęg (pisklęta)',
  reorganizacja:'Reorganizacja stada',
  separacja:    'Separacja (słabsze)',
  kwarantanna:  'Kwarantanna',
  inne:         'Inne',
};

export interface BirdTransfer {
  id?: number;
  transferDate: string;    // YYYY-MM-DD
  fromBatchId: number;
  toBatchId: number;
  count: number;
  reason: TransferReason;
  notes?: string;
  createdAt: string;
}
