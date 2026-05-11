import React, { useState } from 'react';
import { useInstallPWA } from '@/hooks/useInstallPWA';

export function InstallBanner() {
  const { state, shouldShow, install, dismiss } = useInstallPWA();
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  if (!shouldShow) return null;

  return (
    <div className="bg-brand-700 text-white px-4 py-3 md:hidden">
      {state.type === 'android' && (
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Zainstaluj Fermly na telefonie</p>
            <p className="text-xs text-brand-200 mt-0.5">Szybszy dostęp, działa offline, ikona na ekranie</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={install}
              className="bg-white text-brand-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-50 active:scale-95 transition-all"
            >
              Zainstaluj
            </button>
            <button
              onClick={dismiss}
              className="text-brand-300 hover:text-white p-1"
              aria-label="Zamknij"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {state.type === 'ios' && !showIOSSteps && (
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📲</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Dodaj Fermly do ekranu głównego</p>
            <p className="text-xs text-brand-200 mt-0.5">Jak ikona aplikacji, bez otwierania Safari</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowIOSSteps(true)}
              className="bg-white text-brand-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-50 active:scale-95 transition-all"
            >
              Jak?
            </button>
            <button
              onClick={dismiss}
              className="text-brand-300 hover:text-white p-1"
              aria-label="Zamknij"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {state.type === 'ios' && showIOSSteps && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Dodaj do ekranu głównego:</p>
            <button onClick={dismiss} className="text-brand-300 hover:text-white p-1">✕</button>
          </div>
          <ol className="text-sm text-brand-100 space-y-1 list-none">
            <li className="flex items-start gap-2">
              <span className="bg-white text-brand-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <span>Kliknij ikonę <strong className="text-white">Udostępnij</strong> (kwadrat ze strzałką w górę) na dole ekranu</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-white text-brand-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <span>Wybierz <strong className="text-white">„Dodaj do ekranu głównego"</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-white text-brand-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <span>Potwierdź klikając <strong className="text-white">„Dodaj"</strong> w prawym górnym rogu</span>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
