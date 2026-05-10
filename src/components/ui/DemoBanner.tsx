import React from 'react';
import { Link } from 'react-router-dom';

export function DemoBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <span>👁️</span>
        <span>
          <strong>Tryb demo</strong> — przeglądasz przykładowe dane. Twoje wpisy nie są zapisywane.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/logowanie"
          className="text-amber-700 font-medium hover:underline whitespace-nowrap"
        >
          Zaloguj się
        </Link>
        <Link
          to="/rejestracja"
          className="bg-green-700 text-white px-3 py-1 rounded-lg font-medium hover:bg-green-800 transition-colors whitespace-nowrap"
        >
          Zarejestruj się
        </Link>
      </div>
    </div>
  );
}
