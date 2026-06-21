import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';

interface Row { batch: ProductionBatch; done: number; total: number; }

/** Lista partii W TRAKCIE produkcji — dokończ albo usuń. Porządkuje nieskończone/testowe warzenia. */
export function WProdukcjiPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const list = await dairyService.getBatches(['w_produkcji']);
    const withProgress = await Promise.all(list.map(async b => {
      const steps = await dairyService.getStepsByBatch(b.id!);
      return { batch: b, done: steps.filter(s => s.completedAt).length, total: steps.length };
    }));
    setRows(withProgress);
  };
  useEffect(() => { load(); }, []);

  const delOne = async (b: ProductionBatch) => {
    if (!b.id || !window.confirm(`Usunąć partię „${b.cheeseName || PRODUCT_LABELS[b.productType]}" (${b.batchNumber})?`)) return;
    setBusy(true);
    try { await dairyService.deleteBatch(b.id); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd usuwania'); }
    finally { setBusy(false); }
  };

  const unstarted = (rows ?? []).filter(r => r.done === 0);
  const delUnstarted = async () => {
    if (!unstarted.length || !window.confirm(`Usunąć ${unstarted.length} niezaczętych partii (0 ukończonych kroków)?`)) return;
    setBusy(true);
    try { for (const r of unstarted) if (r.batch.id) await dairyService.deleteBatch(r.batch.id); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : 'Błąd usuwania'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">🔄 W trakcie produkcji</h1>
      </div>
      <p className="text-sm text-gray-500">
        Partie, których jeszcze nie skończyłeś. Wróć do procesu („Dokończ") albo usuń nieudane/testowe.
      </p>

      {!rows && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {rows && rows.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-gray-500 text-sm">Brak partii w trakcie — wszystko dokończone.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-500">{rows.length} {rows.length === 1 ? 'partia' : 'partii'} w toku</span>
            {unstarted.length > 0 && (
              <Button size="sm" variant="outline" loading={busy} onClick={delUnstarted}>
                🗑 Usuń niezaczęte ({unstarted.length})
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {rows.map(({ batch: b, done, total }) => (
              <div key={b.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                <span className="text-2xl">{PRODUCT_ICONS[b.productType]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{b.cheeseName || PRODUCT_LABELS[b.productType]}</div>
                  <div className="text-xs text-gray-400">
                    {b.batchNumber} · {new Date(b.productionDate + 'T12:00:00').toLocaleDateString('pl-PL')}
                    {' · '}
                    <span className={done === 0 ? 'text-gray-400' : 'text-brand-600'}>kroki {done}/{total}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link to={`/mleko/partie/${b.id}/produkcja`}>
                    <Button size="sm">▶ Dokończ</Button>
                  </Link>
                  <button onClick={() => delOne(b)} disabled={busy}
                    className="text-gray-300 hover:text-red-500 px-1.5 py-1 text-lg" title="Usuń partię" aria-label="Usuń partię">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
