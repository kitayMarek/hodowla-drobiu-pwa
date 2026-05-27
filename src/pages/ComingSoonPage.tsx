import React from 'react';

interface Props {
  module: string;
}

export function ComingSoonPage({ module }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{module}</h1>
      <p className="text-gray-500 text-sm max-w-sm">
        Ten moduł jest aktualnie w przygotowaniu.<br />
        Wkrótce pojawi się tutaj pełna funkcjonalność.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
        <span>⏳</span> Wkrótce dostępne
      </div>
    </div>
  );
}
