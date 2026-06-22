import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch, ProductionStep } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS } from '@/models/dairy.model';
import { fetchRecipeBySlug } from '@/services/recipeContract.service';
import type { Recipe } from '@/models/recipe.schema';
import { batchCode, readyDate, estimateBatchWeightKg, daysSince } from '@/utils/cheeseStock';
import { Card } from '@/components/ui/Card';

const fmtD = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pl-PL') : '—');
const fmtMin = (m?: number) => {
  if (m == null) return null;
  if (m >= 24 * 60) return `${Math.round(m / (24 * 60))} dni`;
  if (m >= 60) return `${(m / 60) % 1 === 0 ? m / 60 : (m / 60).toFixed(1)} h`;
  return `${m} min`;
};

/**
 * 📜 Metryczka sera — paszport partii: kod, proces, faktyczne czasy, notatki, kultury.
 * Cel przyszłego QR z etykiety. Widoczna dla właściciela; „dlaczego ser jest jaki jest".
 */
export function MetryczkaPage() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<ProductionBatch | null>(null);
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([dairyService.getBatchById(Number(id)), dairyService.getStepsByBatch(Number(id))])
      .then(([b, s]) => {
        setBatch(b ?? null); setSteps(s);
        if (b?.cheeseVariety) fetchRecipeBySlug(b.cheeseVariety).then(r => setRecipe(r)).catch(() => {});
      });
  }, [id]);

  if (!batch) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;

  const title = batch.cheeseName || PRODUCT_LABELS[batch.productType];
  const ubytek = recipe?.dojrzewanie?.ubytekWagiProc;
  const estKg = estimateBatchWeightKg(batch, ubytek);

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to={`/mleko/partie/${batch.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Partia</Link>
        <h1 className="text-xl font-bold text-gray-900">📜 Metryczka sera</h1>
      </div>

      {/* Nagłówek paszportu */}
      <Card padding="md">
        <div className="text-center">
          <div className="text-4xl mb-1">{PRODUCT_ICONS[batch.productType]}</div>
          <p className="text-lg font-bold text-gray-900">{title}</p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">{batchCode(batch)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
          <div><span className="text-gray-400">Typ:</span> {PRODUCT_LABELS[batch.productType]}</div>
          <div><span className="text-gray-400">Warzenie:</span> {fmtD(batch.productionDate)}</div>
          <div><span className="text-gray-400">Mleko:</span> {batch.milkLiters} L</div>
          <div><span className="text-gray-400">Gotowy ok.:</span> {fmtD(readyDate(batch))}</div>
          <div>
            <span className="text-gray-400">Stan szac.:</span> ~{estKg.toFixed(2)} kg
            <span className="text-gray-300"> (dojrzewa {daysSince(batch.productionDate)} dni)</span>
          </div>
          {batch.cheeseVariety && (
            <div>
              <Link to={`/mleko/przepisy?ser=${batch.cheeseVariety}`} className="text-brand-600 hover:text-brand-800">📖 Przepis bazowy</Link>
            </div>
          )}
        </div>
      </Card>

      {/* Kultury */}
      {recipe?.kultury && recipe.kultury.length > 0 && (
        <Card title="Kultury" padding="md">
          <ul className="text-sm text-gray-700 space-y-0.5">
            {recipe.kultury.map((k, i) => <li key={i}>• {k.co} <span className="text-gray-400">— {k.dawka}</span></li>)}
          </ul>
        </Card>
      )}

      {/* Dodatki */}
      {batch.additives && batch.additives.length > 0 && (
        <Card title="Dodatki" padding="md">
          <div className="flex flex-wrap gap-1.5">
            {batch.additives.map((a, i) => (
              <span key={i} className="text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                ➕ {a.co}{a.atStep ? ` · ${a.atStep.slice(0, 20)}` : ''}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Proces — kroki z faktycznym czasem i notatkami */}
      <Card title={`Proces produkcji (${steps.length} kroków)`} padding="md">
        <div className="space-y-2">
          {steps.map((s, i) => {
            const planned = fmtMin(s.durationMinutes);
            const actual = fmtMin(s.actualDurationMin);
            return (
              <div key={s.id ?? i} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-gray-300 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{s.label}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                      {s.temperatureC != null && <span>🌡 {s.temperatureC}°C</span>}
                      {actual ? <span>⏱ {actual} <span className="text-gray-300">(plan {planned ?? '—'})</span></span>
                        : planned && <span>⏱ plan {planned}</span>}
                      {s.endCondition && <span>✓ {s.endCondition}</span>}
                    </div>
                    {s.notes && <p className="text-xs text-gray-600 mt-1 italic">📝 {s.notes}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Metryczka = historia tej partii. Pomaga zrozumieć, dlaczego ser wyszedł taki, jaki jest.
      </p>
    </div>
  );
}
