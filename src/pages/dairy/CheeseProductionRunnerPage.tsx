import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch, ProductionStep, BatchAdditive } from '@/models/dairy.model';
import { PRODUCT_LABELS } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Powyżej tego progu krok jest „bierny" (dojrzewanie, długie zakwaszanie) — bez tykającego timera. */
const LONG_THRESHOLD_MIN = 240;

function fmtPlanned(min?: number): string | null {
  if (min == null) return null;
  if (min >= 24 * 60) return `${Math.round(min / (24 * 60))} dni`;
  if (min >= 60) return `${(min / 60) % 1 === 0 ? min / 60 : (min / 60).toFixed(1)} h`;
  return `${min} min`;
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + ':' + String(ss).padStart(2, '0');
}

/** Krótki dźwięk alarmu przez Web Audio (bez plików). */
function beep(ctx: AudioContext, times = 3) {
  let t = ctx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.37);
    t += 0.5;
  }
}

export function CheeseProductionRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [batch, setBatch] = useState<ProductionBatch | null>(null);
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(0); // sek
  const [alarm, setAlarm] = useState(false);
  const [note, setNote] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  // L1: dodatki + nazwanie wariantu
  const [additives, setAdditives] = useState<BatchAdditive[]>([]);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addVal, setAddVal] = useState('');

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const load = async () => {
    if (!id) return;
    const [b, s] = await Promise.all([
      dairyService.getBatchById(Number(id)),
      dairyService.getStepsByBatch(Number(id)),
    ]);
    if (!b) { navigate('/mleko/partie'); return; }
    setBatch(b);
    setSteps(s);
    setAdditives(b.additives ?? []);
    setNameVal(b.cheeseName || '');
    const firstOpen = s.findIndex(x => !x.completedAt);
    setIdx(firstOpen < 0 ? s.length : firstOpen);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const step = steps[idx];
  const plannedMin = step?.durationMinutes;
  const isLong = plannedMin != null && plannedMin > LONG_THRESHOLD_MIN;
  const hasTimer = plannedMin != null && !isLong;

  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  // Pętla timera
  useEffect(() => {
    if (!running || !hasTimer || startMsRef.current == null) return;
    const totalSec = (plannedMin as number) * 60;
    tickRef.current = setInterval(() => {
      const elapsed = (Date.now() - (startMsRef.current as number)) / 1000;
      const left = totalSec - elapsed;
      setRemaining(left);
      if (left <= 0) {
        stopTick();
        setAlarm(true);
        if (soundOn && audioRef.current) beep(audioRef.current);
      }
    }, 250);
    return stopTick;
    // eslint-disable-next-line
  }, [running, idx]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioRef.current = new Ctor();
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
  };

  const handleStart = async () => {
    ensureAudio(); // gest użytkownika → odblokowuje dźwięk na później
    setAlarm(false);
    startMsRef.current = Date.now();
    if (hasTimer) setRemaining((plannedMin as number) * 60);
    setRunning(true);
    if (step?.id) await dairyService.startStep(step.id);
  };

  const finishStep = async () => {
    stopTick();
    if (step?.id) {
      const actual = startMsRef.current != null
        ? Math.round((Date.now() - startMsRef.current) / 60000)
        : undefined;
      await dairyService.completeStep(step.id, {
        notes: note.trim() || undefined,
        actualDurationMin: actual,
      });
    }
    // reset i przejście dalej
    startMsRef.current = null;
    setRunning(false); setAlarm(false); setNote(''); setRemaining(0);
    const next = idx + 1;
    setSteps(prev => prev.map((x, i) => i === idx ? { ...x, completedAt: new Date().toISOString() } : x));
    setIdx(next);
  };

  const saveName = async () => {
    const v = nameVal.trim();
    if (id) await dairyService.updateBatchMeta(Number(id), { cheeseName: v || undefined });
    setBatch(b => b ? { ...b, cheeseName: v || undefined } : b);
    setEditName(false);
  };

  const addAdditive = async (co: string) => {
    const c = co.trim();
    if (!c || !id) return;
    const next = [...additives, { co: c, atStep: steps[idx]?.label, addedAt: new Date().toISOString() }];
    setAdditives(next);
    await dairyService.updateBatchMeta(Number(id), { additives: next });
    setAddVal(''); setShowAdd(false);
  };

  if (!batch) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;

  const title = batch.cheeseName || PRODUCT_LABELS[batch.productType];
  const done = idx >= steps.length;
  const planned = fmtPlanned(plannedMin);

  return (
    <div className={`space-y-4 max-w-lg transition-colors ${alarm ? 'animate-pulse' : ''}`}>
      <div className="flex items-center gap-2">
        <Link to={`/mleko/partie/${batch.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Partia</Link>
        <h1 className="text-xl font-bold text-gray-900">🧀 Produkcja: {title}</h1>
      </div>

      {/* Pasek postępu */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${steps.length ? (Math.min(idx, steps.length) / steps.length) * 100 : 0}%` }} />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{Math.min(idx, steps.length)}/{steps.length}</span>
        <button onClick={() => setSoundOn(s => !s)} title="Dźwięk alarmu"
          className="text-sm shrink-0">{soundOn ? '🔔' : '🔕'}</button>
      </div>

      {/* Nazwa wariantu + dodatki (L1 — bez zmiany receptury) */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-2">
          {editName ? (
            <div className="flex-1 flex gap-2">
              <input
                value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus
                placeholder="Nazwa sera…"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button size="sm" onClick={saveName}>Zapisz</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-800 truncate">{batch.cheeseName || PRODUCT_LABELS[batch.productType]}</span>
              <button onClick={() => { setNameVal(batch.cheeseName || ''); setEditName(true); }}
                className="text-xs text-gray-400 hover:text-gray-700 shrink-0">✏️ nazwij</button>
            </div>
          )}
          <button onClick={() => setShowAdd(s => !s)}
            className="text-xs font-medium text-brand-600 hover:text-brand-800 shrink-0">+ Dodatek</button>
        </div>

        {additives.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {additives.map((a, i) => (
              <span key={i} className="text-xs bg-amber-50 border border-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                ➕ {a.co}{a.atStep ? ` · ${a.atStep.slice(0, 22)}` : ''}
              </span>
            ))}
          </div>
        )}

        {showAdd && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {['orzechy', 'popiół', 'wino', 'piwo', 'zioła', 'czosnek', 'papryka'].map(s => (
                <button key={s} onClick={() => addAdditive(s)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-0.5">{s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={addVal} onChange={e => setAddVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addAdditive(addVal); }}
                placeholder="własny dodatek…"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button size="sm" onClick={() => addAdditive(addVal)}>Dodaj</Button>
            </div>
          </div>
        )}
      </Card>

      {done ? (
        <Card padding="md">
          <div className="text-center py-6">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-lg font-bold text-gray-800">Produkcja zakończona!</p>
            <p className="text-sm text-gray-500 mt-1">Wszystkie kroki odhaczone. Partia czeka w karcie.</p>
            <Link to={`/mleko/partie/${batch.id}`} className="inline-block mt-4">
              <Button>Przejdź do partii →</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Alarm */}
          {alarm && (
            <div className="rounded-xl bg-red-500 text-white px-4 py-3 text-center font-bold shadow-lg">
              ⏰ Czas minął! — krok „{step.label}"
            </div>
          )}

          {/* Bieżący krok */}
          <Card padding="md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Krok {idx + 1} z {steps.length}</p>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5">{step.label}</h2>
              </div>
              {planned && (
                <span className="shrink-0 text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
                  {isLong ? '⏳' : '⏱'} {planned}
                </span>
              )}
            </div>

            {step.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{step.description}</p>}
            {step.temperatureC != null && (
              <p className="text-sm text-gray-700 mt-1">🌡 {step.temperatureC}°C</p>
            )}
            {step.hint && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 mt-2">💡 {step.hint}</p>
            )}
            {step.endCondition && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-2 py-1.5 mt-2">
                ✓ Kończ, gdy: <strong>{step.endCondition}</strong>
              </p>
            )}

            {/* Timer */}
            {hasTimer && running && (
              <div className={`text-center my-4 ${alarm ? 'text-red-600' : 'text-gray-900'}`}>
                <div className="text-5xl font-bold tabular-nums">{fmtClock(remaining)}</div>
                <div className="text-xs text-gray-400 mt-1">{alarm ? 'czas minął — możesz zakończyć' : 'do końca kroku'}</div>
              </div>
            )}

            {/* Notatka */}
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Notatka do kroku (opcjonalnie — np. faktyczny przebieg, obserwacje)…"
              rows={2}
              className="w-full mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            {/* Akcje */}
            <div className="flex gap-2 mt-3">
              {hasTimer && !running && (
                <Button className="flex-1" onClick={handleStart}>▶ Start ({planned})</Button>
              )}
              {hasTimer && running && (
                <Button className="flex-1" onClick={finishStep}>
                  {alarm ? 'Zakończ krok ✓' : 'Zakończ wcześniej ✓'}
                </Button>
              )}
              {!hasTimer && (
                <Button className="flex-1" onClick={finishStep}>Gotowe ✓</Button>
              )}
              <Button variant="outline" onClick={finishStep} title="Przejdź dalej bez czekania">Następna →</Button>
            </div>
          </Card>

          {/* Podgląd kolejnych */}
          {steps.length - idx - 1 > 0 && (
            <p className="text-xs text-gray-400 text-center">
              Kolejne: {steps.slice(idx + 1, idx + 4).map(s => s.label).join(' · ')}
              {steps.length - idx - 1 > 3 ? ' …' : ''}
            </p>
          )}
        </>
      )}
    </div>
  );
}
