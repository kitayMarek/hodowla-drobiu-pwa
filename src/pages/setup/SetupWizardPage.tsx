import React, { useState } from 'react';
import { WIZARD_ACTIVITIES } from '@/models/activity.model';
import { activityService } from '@/services/activity.service';
import { Button } from '@/components/ui/Button';

interface Props {
  onComplete: () => void;
}

export function SetupWizardPage({ onComplete }: Props) {
  const [selected, setSelected]   = useState<Set<string>>(new Set(['drob']));
  const [saving,   setSaving]     = useState(false);
  const [error,    setError]      = useState('');

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onStart = async () => {
    if (selected.size === 0) {
      setError('Wybierz co najmniej jedną działalność.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await activityService.completeSetup([...selected]);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu — spróbuj ponownie.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Nagłówek */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🌾</div>
          <h1 className="text-2xl font-bold text-gray-900">Witaj w Fermly!</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Zaznacz czym się zajmujesz — aplikacja pokaże tylko potrzebne moduły.<br />
            Możesz to zmienić w każdej chwili w Ustawieniach.
          </p>
        </div>

        {/* Karty działalności */}
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
                {/* Checkbox wizualny */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Ikona */}
                <span className="text-3xl">{activity.icon}</span>

                {/* Treść */}
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

        {/* Info o osobiste */}
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
          onClick={onStart}
        >
          Zacznij pracę →
        </Button>

        <p className="text-xs text-center text-gray-400 mt-4">
          Wybrano: {selected.size} {selected.size === 1 ? 'działalność' : selected.size < 5 ? 'działalności' : 'działalności'}
        </p>
      </div>
    </div>
  );
}
