import React, { useState } from 'react';
import { WIZARD_ACTIVITIES } from '@/models/activity.model';
import { activityService } from '@/services/activity.service';
import { Button } from '@/components/ui/Button';

interface Props {
  onComplete: () => void;
}

type Step = 'mode' | 'activities';
type Mode = 'farm' | 'finance';

export function SetupWizardPage({ onComplete }: Props) {
  const [step,     setStep]     = useState<Step>('mode');
  const [mode,     setMode]     = useState<Mode | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(['drob']));
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleModeChoice = (chosen: Mode) => {
    setMode(chosen);
    if (chosen === 'finance') {
      // Pomiń wybór działalności — zapisz od razu
      handleSave([]);
    } else {
      setStep('activities');
    }
  };

  const handleSave = async (keys: string[]) => {
    setSaving(true); setError('');
    try {
      await activityService.completeSetup(keys);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu — spróbuj ponownie.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* ── Krok 1: wybór trybu ─────────────────────────────────── */}
        {step === 'mode' && (
          <>
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">🌾</div>
              <h1 className="text-2xl font-bold text-gray-900">Witaj w Fermly!</h1>
              <p className="text-gray-500 mt-2 text-sm">
                Powiedz nam jak chcesz używać aplikacji.<br />
                Możesz to zmienić w każdej chwili w Ustawieniach.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {/* Karta: Działalność / Ferma */}
              <button
                type="button"
                onClick={() => handleModeChoice('farm')}
                disabled={saving}
                className="w-full text-left rounded-2xl border-2 border-gray-200 bg-white px-5 py-5 flex items-center gap-4 hover:border-brand-400 hover:bg-brand-50 transition-all active:scale-[0.99]"
              >
                <span className="text-4xl">🏡</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">Prowadzę działalność / fermę</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Hodowla drobiu, przetwórstwo mleka, agroturystyka — pełne moduły zarządzania produkcją i finansami
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Karta: Tylko finanse */}
              <button
                type="button"
                onClick={() => handleModeChoice('finance')}
                disabled={saving}
                className="w-full text-left rounded-2xl border-2 border-gray-200 bg-white px-5 py-5 flex items-center gap-4 hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-[0.99]"
              >
                {saving && mode === 'finance' ? (
                  <span className="text-4xl animate-pulse">⏳</span>
                ) : (
                  <span className="text-4xl">💳</span>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">Chcę śledzić tylko finanse</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Kasa i Bank, budżet domowy, inwestycje — bez modułów produkcyjnych
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center">
                ⚠ {error}
              </div>
            )}
          </>
        )}

        {/* ── Krok 2: wybór działalności (tylko tryb farm) ─────────── */}
        {step === 'activities' && (
          <>
            <div className="text-center mb-8">
              <button onClick={() => setStep('mode')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 block mx-auto">
                ← Wróć
              </button>
              <div className="text-5xl mb-3">🌾</div>
              <h1 className="text-2xl font-bold text-gray-900">Czym się zajmujesz?</h1>
              <p className="text-gray-500 mt-2 text-sm">
                Zaznacz aktywne działalności — aplikacja pokaże tylko potrzebne moduły.<br />
                Możesz to zmienić w każdej chwili w Ustawieniach.
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {WIZARD_ACTIVITIES.map(activity => {
                const isSelected = selected.has(activity.key);
                return (
                  <button
                    key={activity.key}
                    type="button"
                    onClick={() => toggle(activity.key)}
                    className={`w-full text-left rounded-2xl border-2 px-5 py-4 flex items-center gap-4 transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'border-brand-400 bg-brand-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-3xl">{activity.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm ${isSelected ? 'text-brand-800' : 'text-gray-800'}`}>
                        {activity.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{activity.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-center text-gray-400 mb-4">
              Konto osobiste (domowe wydatki) dodawane automatycznie.
            </p>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center">
                ⚠ {error}
              </div>
            )}

            <Button
              className="w-full py-3 text-base"
              loading={saving}
              disabled={selected.size === 0}
              onClick={() => handleSave([...selected])}
            >
              Zacznij pracę →
            </Button>

            <p className="text-xs text-center text-gray-400 mt-4">
              Wybrano: {selected.size} {selected.size === 1 ? 'działalność' : 'działalności'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
