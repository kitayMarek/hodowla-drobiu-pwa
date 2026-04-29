import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { batchPhotoService } from '@/services/batchPhoto.service';
import { blobToObjectUrl } from '@/utils/imageUtils';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { formatDate, todayISO } from '@/utils/date';
import type { BatchPhoto } from '@/models/batchPhoto.model';

// ─── Miniatura z zarządzanym object URL ──────────────────────────────────────
function PhotoThumb({
  photo,
  onClick,
}: {
  photo: BatchPhoto;
  onClick: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const { url, revoke } = blobToObjectUrl(photo.thumbData);
    setSrc(url);
    return revoke;
  }, [photo.thumbData]);

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 hover:ring-2 hover:ring-brand-500 transition-all"
    >
      {src ? (
        <img src={src} alt={photo.description ?? 'Zdjęcie'} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📷</div>
      )}
      {/* Overlay z datą */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 translate-y-0 group-hover:opacity-100">
        <div className="text-white text-xs font-medium">{formatDate(photo.photoDate)}</div>
        {photo.description && (
          <div className="text-white/80 text-xs truncate">{photo.description}</div>
        )}
      </div>
    </button>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  photos,
  startIndex,
  onClose,
  onDelete,
}: {
  photos: BatchPhoto[];
  startIndex: number;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [idx, setIdx]       = useState(startIndex);
  const [src, setSrc]       = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const photo = photos[idx];

  useEffect(() => {
    if (!photo) return;
    const { url, revoke } = blobToObjectUrl(photo.imageData);
    setSrc(url);
    setDescValue(photo.description ?? '');
    setEditDesc(false);
    return revoke;
  }, [photo]);

  // Nawigacja klawiaturą
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(photos.length - 1, i + 1));
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  if (!photo) return null;

  const saveDesc = async () => {
    if (photo.id != null) await batchPhotoService.updateDescription(photo.id, descValue);
    setEditDesc(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-sm">
          <span className="font-medium">{idx + 1}</span>
          <span className="text-white/50"> / {photos.length}</span>
          <span className="ml-3 text-white/70">{formatDate(photo.photoDate)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditDesc(true)}
            className="text-xs text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10"
          >
            ✏️ Opis
          </button>
          <button
            onClick={() => setConfirmDel(true)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-white/10"
          >
            🗑️ Usuń
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none px-1">
            ✕
          </button>
        </div>
      </div>

      {/* Zdjęcie */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0 relative">
        {/* Strzałka lewa */}
        {idx > 0 && (
          <button
            onClick={() => setIdx(i => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl z-10"
          >
            ‹
          </button>
        )}
        {src ? (
          <img
            src={src}
            alt={photo.description ?? 'Zdjęcie'}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
          />
        ) : (
          <div className="text-white/30 text-6xl animate-pulse">📷</div>
        )}
        {/* Strzałka prawa */}
        {idx < photos.length - 1 && (
          <button
            onClick={() => setIdx(i => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl z-10"
          >
            ›
          </button>
        )}
      </div>

      {/* Opis */}
      <div className="px-4 py-3 text-center">
        {editDesc ? (
          <div className="flex gap-2 max-w-lg mx-auto">
            <input
              autoFocus
              value={descValue}
              onChange={e => setDescValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveDesc(); if (e.key === 'Escape') setEditDesc(false); }}
              placeholder="Dodaj opis..."
              className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/50"
            />
            <button onClick={saveDesc} className="text-sm text-brand-400 hover:text-brand-300 px-3">Zapisz</button>
            <button onClick={() => setEditDesc(false)} className="text-sm text-white/50 hover:text-white/70 px-2">✕</button>
          </div>
        ) : (
          <p
            onClick={() => setEditDesc(true)}
            className="text-white/70 text-sm cursor-pointer hover:text-white/90 max-w-lg mx-auto"
          >
            {photo.description || <span className="italic text-white/30">Brak opisu – kliknij aby dodać</span>}
          </p>
        )}
      </div>

      {/* Pasek miniatur */}
      <div className="flex gap-1.5 px-4 pb-4 overflow-x-auto justify-center">
        {photos.map((p, i) => (
          <ThumbStrip key={p.id} photo={p} active={i === idx} onClick={() => setIdx(i)} />
        ))}
      </div>

      {/* Potwierdzenie usunięcia */}
      {confirmDel && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-900 mb-1">Usunąć to zdjęcie?</p>
            <p className="text-sm text-gray-500 mb-4">Tej operacji nie można cofnąć.</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (photo.id != null) { onDelete(photo.id); }
                  setConfirmDel(false);
                  if (photos.length <= 1) onClose();
                  else setIdx(i => Math.min(i, photos.length - 2));
                }}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700"
              >
                Usuń
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Miniatura w pasku lightboxa
function ThumbStrip({ photo, active, onClick }: { photo: BatchPhoto; active: boolean; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const { url, revoke } = blobToObjectUrl(photo.thumbData);
    setSrc(url);
    return revoke;
  }, [photo.thumbData]);
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
        active ? 'ring-2 ring-brand-400 opacity-100' : 'opacity-50 hover:opacity-80'
      }`}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : null}
    </button>
  );
}

// ─── Główny komponent sekcji ─────────────────────────────────────────────────
export function BatchPhotosSection({ batchId }: { batchId: number }) {
  const [showAddModal, setShowAddModal]   = useState(false);
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [isUploading, setIsUploading]     = useState(false);
  const [addError, setAddError]           = useState<string | null>(null);
  const [date, setDate]                   = useState(todayISO());
  const [desc, setDesc]                   = useState('');
  const [previewSrc, setPreviewSrc]       = useState<string | null>(null);
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = useLiveQuery(
    () => db.batchPhotos.where('batchId').equals(batchId).sortBy('photoDate'),
    [batchId]
  ) ?? [];

  // Odwrócona chronologia (najnowsze pierwsze) dla galerii
  const photosDesc = [...photos].reverse();

  const resetForm = () => {
    setDate(todayISO()); setDesc(''); setSelectedFile(null);
    setAddError(null);
    if (previewSrc) { URL.revokeObjectURL(previewSrc); setPreviewSrc(null); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAddError('Wybierz plik graficzny (JPG, PNG, HEIC…)'); return; }
    if (file.size > 30 * 1024 * 1024) { setAddError('Plik jest za duży (maks. 30 MB)'); return; }
    setAddError(null);
    setSelectedFile(file);
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(URL.createObjectURL(file));
  };

  const onSubmit = async () => {
    if (!selectedFile) { setAddError('Wybierz zdjęcie'); return; }
    setIsUploading(true);
    try {
      await batchPhotoService.createFromFile(batchId, selectedFile, date, desc);
      resetForm();
      setShowAddModal(false);
    } catch (err) {
      setAddError('Błąd podczas zapisywania zdjęcia. Spróbuj ponownie.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await batchPhotoService.delete(id);
  };

  return (
    <>
      <Card
        title={`Galeria zdjęć${photos.length > 0 ? ` (${photos.length})` : ''}`}
        action={
          <Button size="sm" icon={<span>📷</span>} onClick={() => { resetForm(); setShowAddModal(true); }}>
            Dodaj zdjęcie
          </Button>
        }
        padding={photos.length === 0 ? 'md' : 'sm'}
      >
        {photos.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-sm text-gray-500">Brak zdjęć. Dodaj dokumentację fotograficzną stada.</p>
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="mt-3 text-sm text-brand-700 hover:underline"
            >
              Dodaj pierwsze zdjęcie
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {photosDesc.map((photo, i) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                onClick={() => setLightboxIdx(i)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Lightbox */}
      {lightboxIdx !== null && photosDesc.length > 0 && (
        <Lightbox
          photos={photosDesc}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={handleDelete}
        />
      )}

      {/* Modal dodawania */}
      <Modal
        open={showAddModal}
        onClose={() => { resetForm(); setShowAddModal(false); }}
        title="Dodaj zdjęcie"
        size="lg"
      >
        <div className="space-y-4">
          {/* Pole wyboru pliku */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl transition-colors flex flex-col items-center justify-center gap-2 ${
              previewSrc
                ? 'border-brand-300 bg-brand-50 p-2'
                : 'border-gray-200 bg-gray-50 hover:border-brand-400 hover:bg-brand-50 p-8'
            }`}
          >
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Podgląd"
                className="max-h-56 max-w-full rounded-lg object-contain"
              />
            ) : (
              <>
                <span className="text-4xl">📁</span>
                <span className="text-sm text-gray-600 font-medium">Kliknij aby wybrać zdjęcie</span>
                <span className="text-xs text-gray-400">JPG, PNG, HEIC — maks. 30 MB</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />

          {addError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {addError}
            </div>
          )}

          {selectedFile && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span>📷</span>
              <span className="flex-1 truncate">{selectedFile.name}</span>
              <span>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
              <button onClick={() => { setSelectedFile(null); if (previewSrc) { URL.revokeObjectURL(previewSrc); setPreviewSrc(null); } }} className="text-gray-400 hover:text-red-400">✕</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data zdjęcia"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <div /> {/* spacer */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis (opcjonalnie)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="np. Dzień 14 – dobry wygląd stada, równomierne upierzenie…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onSubmit}
              loading={isUploading}
              disabled={!selectedFile}
              className="flex-1"
            >
              {isUploading ? 'Przetwarzanie…' : 'Zapisz zdjęcie'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { resetForm(); setShowAddModal(false); }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
