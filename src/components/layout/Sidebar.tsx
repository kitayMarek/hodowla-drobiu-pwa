import React from 'react';
import { NavLink } from 'react-router-dom';
import { pl } from '@/i18n/pl';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: pl.nav.dashboard, icon: '📊', end: true },
  { to: '/stada', label: pl.nav.batches, icon: '🐔' },
  { to: '/pasze', label: pl.nav.feed, icon: '🌾' },
  { to: '/sprzedaz', label: pl.nav.sales, icon: '💰' },
  { to: '/finanse', label: pl.nav.finance, icon: '📈' },
  { to: '/kasa', label: 'Kasa i Bank', icon: '💳' },
  { to: '/wyleglarnia', label: 'Wylęgarnia', icon: '🥚' },
  { to: '/inwestycje', label: 'Inwestycje', icon: '🏗️' },
  { to: '/raporty', label: pl.nav.reports, icon: '📋' },
  { to: '/ustawienia', label: pl.nav.settings, icon: '⚙️' },
];

interface SidebarProps {
  onNavClick?: () => void;
}

export function Sidebar({ onNavClick }: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐓</span>
          <div>
            <div className="text-sm font-bold text-gray-900">{pl.app.name}</div>
            <div className="text-xs text-gray-500">{pl.app.tagline}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div className="px-4 py-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">v1.0.0 – offline-first</span>
      </div>
    </div>
  );
}
