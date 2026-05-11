import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { pl } from '@/i18n/pl';
import { getDaysSinceBackup, WARN_AFTER_DAYS } from '@/services/backupReminder';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: pl.nav.dashboard, icon: '📊', end: true },
  { to: '/szybki', label: '⚡ Szybki wpis', icon: '' },
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

/** Mała linia statusu backupu w stopce */
function BackupStatusLine() {
  const days = getDaysSinceBackup();
  const warn = days === null || days >= WARN_AFTER_DAYS;

  let label: string;
  if (days === null)     label = 'Brak backupu';
  else if (days === 0)   label = 'Backup: dziś';
  else if (days === 1)   label = 'Backup: wczoraj';
  else                   label = `Backup: ${days} dni temu`;

  return (
    <Link
      to="/ustawienia"
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        warn
          ? 'text-amber-500 hover:text-amber-700'
          : 'text-gray-400 hover:text-gray-600'
      }`}
      title="Przejdź do ustawień → Dane i backup"
    >
      <span>{warn ? '⚠' : '✓'}</span>
      <span>{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const [logoErr, setLogoErr] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center min-h-[60px]">
        {!logoErr ? (
          <img
            src="/fermly-logo.jpg"
            alt="Fermly.pl"
            className="h-9 w-auto max-w-[160px] object-contain"
            onError={() => setLogoErr(true)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐓</span>
            <div>
              <div className="text-sm font-bold">
                <span className="text-brand-700">Fermly</span>
                <span className="text-brand-500">.pl</span>
              </div>
              <div className="text-xs text-gray-500">{pl.app.tagline}</div>
            </div>
          </div>
        )}
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

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 space-y-2">
        {/* Backup status */}
        <BackupStatusLine />

        {/* Version + contact */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">v1.0.0</span>
          <a
            href="mailto:marek@fermly.pl"
            className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
          >
            marek@fermly.pl
          </a>
        </div>
      </div>

    </div>
  );
}
