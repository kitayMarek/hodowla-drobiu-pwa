import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch, ProductionStep, WheyByproduct } from '@/models/dairy.model';
import {
  PRODUCT_ICONS, PRODUCT_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '@/models/dairy.model';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const STATUS_ORDER: ProductionBatch['status'][] = ['w_produkcji', 'dojrzewa', 'gotowy', 'sprzedany', 'wycofany'];

const WHEY_LABELS = { na_rikotte: '🫕 Na rikottę', skarmianie: '🐄 Skarmianie', utylizacja: '♻️ Utylizacja' };

export function ProductionBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch]   = useState<ProductionBatch | null>(null);
  const [steps, setSteps]   = useState<ProductionStep[]>([]);
  const [whey,  setWhey]    = useState<WheyByproduct | null>(null);
  const [saving, setSaving] = useState(false);

  // Edycja wyniku
  const [editYield, setEditYield] = useState(false);
  const [yieldVal,  setYieldVal]  = useState('');
  // Fork do własnego przepisu (L2)
  const [savedRecipe, setSavedRecipe] = useState(false);

  const handleSaveRecipe = async () => {
    if (!batch?.id) return;
    setSaving(true);
    try {
      await dairyService.saveUserRecipeFromBatch(batch.id);
      setSavedRecipe(true);
    } finally {
      setSaving(false);
    }
  };

  const load = async () => {
    if (!id) return;
    const [b, s, w] = await Promise.all([
      dairyService.getBatchById(Number(id)),
      dairyService.getStepsByBatch(Number(id)),
      dairyService.getWheyByBatch(Number(id)),
    ]);
    if (b) { setBatch(b); setYieldVal(String(b.actualYieldKg ?? b.expectedYieldKg)); }
    setSteps(s);
    setWhey(w ?? null);
  };

  useEffect(() => { load(); }, [id]);

  const handleCompleteStep = async (step: ProductionStep) => {
    if (!step.id) return;
    setSaving(true);
    await dairyService.completeStep(step.id);
    await load();
    setSaving(false);
  };

  const handleStatusChange = async (status: ProductionBatch['status']) => {
    if (!batch?.id) return;
    setSaving(true);
    await dairyService.updateBatchStatus(batch.id, status);
    await load();
    setSaving(false);
  };

  const handleSaveYield = async () => {
    if (!batch?.id) return;
    setSaving(true);
    await dairyService.updateBatchYield(batch.id, parseFloat(yieldVal));
    setEditYield(false);
    await load();
    setSaving(false);
  };

  const handleWheyStatus = async (status: WheyByproduct['status']) => {
    if (!whey?.id) return;
    setSaving(true);
    await dairyService.updateWheyStatus(whey.id, status);
    await load();
    setSaving(false);
  };

  if (!batch) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = Math.ceil(
    (new Date(batch.expiryDate).getTime() - new Date(today).getTime()) / 86400000
  );
  const completedSteps = steps.filter(s => s.completedAt).length;
  const currentStep = steps.find(s => !s.completedAt);

  return (
    <div className="space-y-4 max-w-lg">
      {/* Nagłówek */}
      <div className="flex items-center gap-2">
        <Link to="/mleko/partie" className="text-gray-400 hover:text-gray-600 text-sm">← Partie</Link>
        <h1 className="text-lg font-bold text-gray-900 truncate">{batch.batchNumber}</h1>
      </div>

      {/* Karta podstawowa */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-start gap-3">
          <span className="text-4xl">{PRODUCT_ICONS[batch.productType]}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-gray-800">
                {batch.cheeseName || PRODUCT_LABELS[batch.productType]}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[batch.status]}`}>
                {STATUS_LABELS[batch.status]}
              </span>
            </div>
            {batch.cheeseName && (
              <div className="text-xs text-gray-400">{PRODUCT_LABELS[batch.productType]}</div>
            )}
            {batch.cheeseVariety && (
              <Link to={`/mleko/przepisy?ser=${batch.cheeseVariety}`}
                className="inline-block text-xs font-medium text-brand-600 hover:text-brand-800 mt-0.5">
                📖 Przepis i proces →
              </Link>
            )}
            {batch.additives && batch.additives.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {batch.additives.map((a, i) => (
                  <span key={i} className="text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                    ➕ {a.co}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1 space-y-0.5">
              <div>📅 Produkcja: {new Date(batch.productionDate + 'T12:00:00').toLocaleDateString('pl-PL')}</div>
              <div className={`font-medium ${daysLeft <= 7 && batch.status === 'gotowy' ? 'text-amber-600' : daysLeft < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                ⏳ Termin: {new Date(batch.expiryDate + 'T12:00:00').toLocaleDateString('pl-PL')}
                {batch.status === 'gotowy' && (daysLeft < 0 ? ' (WYGASŁO)' : daysLeft <= 7 ? ` (${daysLeft} dni!)` : '')}
              </div>
              <div>🥛 Mleko: {batch.milkLiters} L</div>
            </div>
          </div>
        </div>

        {/* Wydajność */}
        <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-gray-400">Oczekiwano</div>
            <div className="font-semibold text-gray-700">{batch.expectedYieldKg} kg</div>
          </div>
          <div>
            <div className="text-gray-400">Uzyskano</div>
            {editYield ? (
              <div className="flex gap-1 items-center justify-center">
                <input
                  type="number" step="0.1" value={yieldVal}
                  onChange={e => setYieldVal(e.target.value)}
                  className="w-16 text-center rounded border border-brand-300 text-xs py-0.5 focus:outline-none"
                />
                <button onClick={handleSaveYield} disabled={saving} className="text-green-600 hover:text-green-700 font-bold">✓</button>
              </div>
            ) : (
              <div
                className="font-semibold text-gray-700 cursor-pointer hover:text-brand-600 flex items-center justify-center gap-1"
                onClick={() => setEditYield(true)}
              >
                {batch.actualYieldKg != null ? `${batch.actualYieldKg} kg` : <span className="text-gray-300">—</span>}
                <span className="text-brand-400 text-[10px]">✎</span>
              </div>
            )}
          </div>
          <div>
            <div className="text-gray-400">W magazynie</div>
            <div className={`font-semibold ${batch.quantityRemainingKg === 0 ? 'text-gray-300' : 'text-green-600'}`}>
              {batch.quantityRemainingKg.toFixed(2)} kg
            </div>
          </div>
        </div>
      </div>

      {/* Zmiana statusu */}
      {batch.status !== 'sprzedany' && batch.status !== 'wycofany' && (
        <Card padding="md">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Zmień status partii</p>
          <div className="flex gap-2 flex-wrap">
            {STATUS_ORDER.filter(s => s !== batch.status).map(s => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={saving}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${STATUS_COLORS[s]} hover:opacity-80`}
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Okno produkcji (runner z timerami) */}
      {steps.length > 0 && completedSteps < steps.length && (
        <Link to={`/mleko/partie/${batch.id}/produkcja`} className="block">
          <Button className="w-full">▶ Otwórz okno produkcji</Button>
        </Link>
      )}

      {/* Fork: zapisz jako własny przepis (z faktycznym przebiegiem) */}
      {savedRecipe ? (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 flex items-center justify-between">
          <span>✅ Zapisano jako Twój przepis (prywatny).</span>
          <Link to="/mleko/moje-przepisy" className="font-medium text-green-800 hover:underline">Moje przepisy →</Link>
        </div>
      ) : (
        <Button variant="outline" className="w-full" loading={saving} onClick={handleSaveRecipe}>
          💾 Zapisz jako mój przepis
        </Button>
      )}

      {/* Workflow kroków */}
      <Card title={`Workflow (${completedSteps}/${steps.length})`} padding="md">
        {steps.length === 0 && (
          <p className="text-xs text-gray-400">Brak kroków workflow.</p>
        )}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const done = !!step.completedAt;
            const active = !done && step === currentStep;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  done ? 'bg-green-50 border border-green-100' :
                  active ? 'bg-brand-50 border border-brand-200' :
                  'bg-gray-50 border border-gray-100 opacity-60'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  done ? 'bg-green-500 text-white' :
                  active ? 'bg-brand-600 text-white' :
                  'bg-gray-300 text-white'
                }`}>
                  {done ? '✓' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${done ? 'text-green-700' : active ? 'text-brand-800' : 'text-gray-500'}`}>
                    {step.label}
                  </div>
                  {step.durationMinutes && (
                    <div className="text-xs text-gray-400">
                      ⏱ {step.durationMinutes >= 1440
                        ? `${Math.round(step.durationMinutes / 1440)} dni`
                        : step.durationMinutes >= 60
                        ? `${Math.round(step.durationMinutes / 60)} h`
                        : `${step.durationMinutes} min`}
                    </div>
                  )}
                  {done && step.completedAt && (
                    <div className="text-xs text-green-600">
                      ✓ {new Date(step.completedAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                {active && (
                  <Button size="sm" onClick={() => handleCompleteStep(step)} loading={saving}>
                    Gotowe ✓
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Serwatka */}
      {whey && (
        <Card title="💧 Serwatka" padding="md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700 font-medium">{whey.quantityLiters.toFixed(1)} L</span>
            <span className="text-sm">{WHEY_LABELS[whey.status]}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">Zmień przeznaczenie serwatki:</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(WHEY_LABELS) as WheyByproduct['status'][]).map(s => (
              <button
                key={s}
                onClick={() => handleWheyStatus(s)}
                disabled={saving || whey.status === s}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  whey.status === s
                    ? 'bg-brand-50 border-brand-300 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {WHEY_LABELS[s]}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
