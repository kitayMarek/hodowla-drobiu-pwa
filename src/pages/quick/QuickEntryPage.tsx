/**
 * Szybki wpis — mobilny notatnik dzienny.
 * Kumuluje dosypania paszy i upadki przez cały dzień,
 * po kliknięciu "Zatwierdź" zapisuje / doplutuje do wpisu dziennego.
 */

import React, { useState, useEffect, useRef } from 'react';
import { todayISO } from '@/utils/date';
import { useActiveBatches } from '@/hooks/useBatch';
import { dailyEntryService } from '@/services/dailyEntry.service';

// ── Typy ───────────────────────────────────────────────────────

interface LogItem {
  amount: number;
  time:   string; // "08:15"
}

interface Accumulator {
  batchId:     number;
  date:        string;
  feedEntries: LogItem[];
  deadEntries: LogItem[];
}

// ── LocalStorage helpers ───────────────────────────────────────

const key = (batchId: number, date: string) => `fermly_quick_${batchId}_${date}`;

function loadAcc(batchId: number, date: string): Accumulator {
  try {
    const s = localStorage.getItem(key(batchId, date));
    if (s) return JSON.parse(s) as Accumulator;
  } catch { /* ignore */ }
  return { batchId, date, feedEntries: [], deadEntries: [] };
}

function saveAcc(acc: Accumulator) {
  localStorage.setItem(key(acc.batchId, acc.date), JSON.stringify(acc));
}

function clearAcc(batchId: number, date: string) {
  localStorage.removeItem(key(batchId, date));
}

function nowTime() {
  return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// ── Komponent ─────────────────────────────────────────────────

type ModalType = 'feed' | 'dead' | null;
type SaveStatus = 'idle' | 'saving' | 'ok' | 'err';

export function QuickEntryPage() {
  const today   = todayISO();
  const batches = useActiveBatches();

  const [batchId,    setBatchId]    = useState<number | null>(null);
  const [acc,        setAcc]        = useState<Accumulator | null>(null);
  const [modal,      setModal]      = useState<ModalType>(null);
  const [inputVal,   setInputVal]   = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errMsg,     setErrMsg]     = useState('');
  const [alreadySaved, setAlreadySaved] = useState<{ feedKg: number; deadCount: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wybierz pierwsze stado domyślnie
  useEffect(() => {
    if (batches.length > 0 && batchId === null) {
      setBatchId(batches[0].id!);
    }
  }, [batches, batchId]);

  // Ładuj akumulator gdy zmieni się stado
  useEffect(() => {
    if (batchId === null) return;
    setAcc(loadAcc(batchId, today));
  }, [batchId, today]);

  // Ładuj istniejący wpis z bazy (co ile danych już jest zapisane)
  useEffect(() => {
    if (batchId === null) return;
    dailyEntryService.getByBatchAndDate(batchId, today).then(entry => {
      setAlreadySaved(entry ? { feedKg: entry.feedConsumedKg, deadCount: entry.deadCount } : null);
    });
  }, [batchId, today, saveStatus]);

  // Focus input po otwarciu modala
  useEffect(() => {
    if (modal) setTimeout(() => inputRef.current?.focus(), 80);
  }, [modal]);

  const feedTotal = acc?.feedEntries.reduce((s, e) => s + e.amount, 0) ?? 0;
  const deadTotal = acc?.deadEntries.reduce((s, e) => s + e.amount, 0) ?? 0;
  const hasData   = feedTotal > 0 || deadTotal > 0;

  // ── Dodaj pozycję ────────────────────────────────────────────
  const handleAdd = () => {
    if (!acc || !inputVal.trim()) return;
    const amount = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;

    const item: LogItem = { amount, time: nowTime() };
    const newAcc: Accumulator = modal === 'feed'
      ? { ...acc, feedEntries: [...acc.feedEntries, item] }
      : { ...acc, deadEntries: [...acc.deadEntries, item] };
    saveAcc(newAcc);
    setAcc(newAcc);
    setModal(null);
    setInputVal('');
  };

  // ── Usuń pozycję ─────────────────────────────────────────────
  const removeEntry = (type: 'feed' | 'dead', idx: number) => {
    if (!acc) return;
    const newAcc: Accumulator = type === 'feed'
      ? { ...acc, feedEntries: acc.feedEntries.filter((_, i) => i !== idx) }
      : { ...acc, deadEntries: acc.deadEntries.filter((_, i) => i !== idx) };
    saveAcc(newAcc);
    setAcc(newAcc);
  };

  // ── Zatwierdź ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!acc || !batchId || !hasData) return;
    setSaveStatus('saving');
    try {
      const existing = await dailyEntryService.getByBatchAndDate(batchId, today);
      if (existing?.id != null) {
        await dailyEntryService.update(existing.id, {
          feedConsumedKg: Math.round((existing.feedConsumedKg + feedTotal) * 100) / 100,
          deadCount:      existing.deadCount + deadTotal,
        });
      } else {
        await dailyEntryService.create({
          batchId,
          date:           today,
          feedConsumedKg: Math.round(feedTotal * 100) / 100,
          deadCount:      deadTotal,
          culledCount:    0,
        });
      }
      clearAcc(batchId, today);
      setAcc(loadAcc(batchId, today));
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (e) {
      setErrMsg((e as Error).message);
      setSaveStatus('err');
    }
  };

  const selectedBatch = batches.find(b => b.id === batchId);

  // ── Render ─────────────────────────────────────────────────

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 space-y-3">
        <span className="text-5xl">🐔</span>
        <p className="text-gray-600 font-medium">Brak aktywnych stad</p>
        <p className="text-sm text-gray-400">Dodaj stado ze statusem „aktywne", żeby korzystać z szybkiego wpisu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-6">

      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">⚡ Szybki wpis</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Wybór stada */}
      {batches.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {batches.map(b => (
            <button
              key={b.id}
              onClick={() => setBatchId(b.id!)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                batchId === b.id
                  ? 'bg-brand-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {batches.length === 1 && (
        <div className="px-3 py-1.5 bg-brand-50 rounded-lg inline-flex items-center gap-2">
          <span className="text-sm font-medium text-brand-700">🐔 {selectedBatch?.name}</span>
        </div>
      )}

      {/* Co już zapisane w bazie dziś */}
      {alreadySaved && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm">
          <p className="font-medium text-green-800 mb-1">✓ Już w Fermly dziś:</p>
          <p className="text-green-700">
            Pasza: <strong>{alreadySaved.feedKg} kg</strong>
            {' · '}
            Upadki: <strong>{alreadySaved.deadCount} szt.</strong>
          </p>
          <p className="text-xs text-green-600 mt-0.5">Nowe wpisy zostaną do tego doliczone.</p>
        </div>
      )}

      {/* ── Kafelek PASZA ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-brand-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌾</span>
            <div>
              <p className="text-white font-bold text-lg leading-none">Pasza</p>
              <p className="text-brand-200 text-xs mt-0.5">dziś łącznie</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-3xl leading-none">{feedTotal.toFixed(1)}</p>
            <p className="text-brand-200 text-sm">kg</p>
          </div>
        </div>

        {/* Historia wpisów */}
        {acc && acc.feedEntries.length > 0 && (
          <div className="divide-y divide-gray-50">
            {acc.feedEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm text-gray-500">{e.time}</span>
                <span className="text-sm font-medium text-gray-800">+{e.amount} kg</span>
                <button
                  onClick={() => removeEntry('feed', i)}
                  className="text-gray-300 hover:text-red-400 text-xs px-2 py-1 rounded"
                  title="Usuń"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Przycisk dodaj */}
        <div className="px-5 py-4">
          <button
            onClick={() => { setModal('feed'); setInputVal(''); }}
            className="w-full py-3.5 rounded-xl border-2 border-dashed border-brand-200 text-brand-700 font-semibold text-base hover:bg-brand-50 hover:border-brand-400 transition-colors active:scale-[0.98]"
          >
            + Dosypałem
          </button>
        </div>
      </div>

      {/* ── Kafelek UPADKI ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💀</span>
            <div>
              <p className="text-white font-bold text-lg leading-none">Upadki</p>
              <p className="text-red-200 text-xs mt-0.5">dziś łącznie</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-3xl leading-none">{deadTotal}</p>
            <p className="text-red-200 text-sm">szt.</p>
          </div>
        </div>

        {acc && acc.deadEntries.length > 0 && (
          <div className="divide-y divide-gray-50">
            {acc.deadEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm text-gray-500">{e.time}</span>
                <span className="text-sm font-medium text-gray-800">+{e.amount} szt.</span>
                <button
                  onClick={() => removeEntry('dead', i)}
                  className="text-gray-300 hover:text-red-400 text-xs px-2 py-1 rounded"
                  title="Usuń"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-4">
          <button
            onClick={() => { setModal('dead'); setInputVal(''); }}
            className="w-full py-3.5 rounded-xl border-2 border-dashed border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 hover:border-red-400 transition-colors active:scale-[0.98]"
          >
            + Padło
          </button>
        </div>
      </div>

      {/* ── Zatwierdź ── */}
      {saveStatus === 'ok' ? (
        <div className="bg-green-600 text-white rounded-2xl px-5 py-5 text-center">
          <p className="text-xl font-bold">✓ Zapisano w Fermly!</p>
          <p className="text-green-100 text-sm mt-1">Możesz dalej dodawać wpisy — będą doliczone przy następnym zatwierdzeniu.</p>
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!hasData || saveStatus === 'saving'}
          className={`w-full py-5 rounded-2xl font-bold text-lg transition-all ${
            hasData
              ? 'bg-brand-700 text-white hover:bg-brand-800 active:scale-[0.98] shadow-md'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' ? '⏳ Zapisuję…' : '✅ Zatwierdź dzień'}
        </button>
      )}

      {saveStatus === 'err' && (
        <p className="text-sm text-red-600 text-center bg-red-50 rounded-xl px-4 py-3">{errMsg}</p>
      )}

      <p className="text-xs text-gray-400 text-center">
        Wpisy są tymczasowo przechowywane na tym urządzeniu i nie znikną po zamknięciu przeglądarki.
      </p>

      {/* ── Modal dodawania ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) { setModal(null); setInputVal(''); } }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 space-y-5 shadow-2xl">

            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1" />

            <h2 className="text-xl font-bold text-gray-900 text-center">
              {modal === 'feed' ? '🌾 Ile dosypałeś?' : '💀 Ile padło?'}
            </h2>

            {/* Input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                inputMode={modal === 'feed' ? 'decimal' : 'numeric'}
                min="0"
                step={modal === 'feed' ? '0.5' : '1'}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={modal === 'feed' ? '0.0' : '0'}
                className="w-full text-center text-5xl font-bold text-gray-900 border-2 border-gray-200 rounded-2xl py-5 px-4 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xl text-gray-400 font-medium pointer-events-none">
                {modal === 'feed' ? 'kg' : 'szt.'}
              </span>
            </div>

            {/* Szybkie przyciski */}
            <div className="grid grid-cols-4 gap-2">
              {(modal === 'feed'
                ? ['5', '10', '25', '50']
                : ['1', '2', '5', '10']
              ).map(v => (
                <button
                  key={v}
                  onClick={() => setInputVal(v)}
                  className={`py-3 rounded-xl font-semibold text-sm transition-colors ${
                    inputVal === v
                      ? 'bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Przyciski akcji */}
            <div className="flex gap-3">
              <button
                onClick={() => { setModal(null); setInputVal(''); }}
                className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
              >
                Anuluj
              </button>
              <button
                onClick={handleAdd}
                disabled={!inputVal || parseFloat(inputVal) <= 0}
                className="flex-[2] py-4 rounded-xl bg-brand-700 text-white font-bold text-lg hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
