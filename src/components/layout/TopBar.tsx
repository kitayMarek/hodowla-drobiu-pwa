import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSetting } from '@/hooks/useSettings';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const farmName = useSetting<string>('farm_name', 'Moja Ferma');

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-700 truncate">{farmName}</span>
      </div>

      {/* Quick add button */}
      <Link
        to="/stada"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="hidden sm:inline">Stada</span>
      </Link>
    </header>
  );
}
