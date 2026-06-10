import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { pl } from '@/i18n/pl';
import { getDaysSinceBackup, WARN_AFTER_DAYS } from '@/services/backupReminder';
import { useActivitiesContext } from '@/contexts/ActivitiesContext';

// ── Typy ────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  comingSoon?: boolean;
  /** true = widoczne tylko gdy aktywna jest jakakolwiek działalność produkcyjna */
  requiresProduction?: boolean;
}

interface NavSection {
  key: string;
  label: string;
  activity?: string;   // undefined = sekcja zawsze widoczna
  items: NavItem[];
}

// ── Konfiguracja nawigacji ───────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'main',
    label: 'Główne',
    items: [
      { to: '/', label: pl.nav.dashboard, icon: '📊', end: true },
    ],
  },
  {
    key: 'drob',
    label: '🐔 Hodowla drobiu',
    activity: 'drob',
    items: [
      { to: '/stada',           label: 'Stada',          icon: '🐔' },
      { to: '/pasze',             label: 'Pasza',            icon: '🌾' },
      { to: '/pasze/receptury',  label: 'Receptury',       icon: '🧪' },
      { to: '/pasze/skladniki',  label: 'Składniki pasz.', icon: '🔬' },
      { to: '/sprzedaz/nowa',   label: 'Nowa sprzedaż',   icon: '💰' },
      { to: '/wyleglarnia',     label: 'Wylęgarnia',     icon: '🥚' },
      { to: '/finanse',         label: 'Finanse',        icon: '📈' },
      { to: '/szybki',          label: 'Szybki wpis',    icon: '⚡' },
    ],
  },
  {
    key: 'sery',
    label: '🧀 Przetwórstwo mleka',
    activity: 'sery',
    items: [
      { to: '/mleko',           label: 'Dashboard',       icon: '🧀' },
      { to: '/mleko/przyjecia', label: 'Przyjęcia mleka', icon: '🥛' },
      { to: '/mleko/partie',    label: 'Partie prod.',    icon: '📦' },
      { to: '/mleko/dostawcy',  label: 'Dostawcy mleka', icon: '🚛' },
    ],
  },
  {
    key: 'kiszonki',
    label: '🥬 Przetwory roślinne',
    activity: 'kiszonki',
    items: [
      { to: '/kiszonki', label: 'Przetwory roślinne', icon: '🥬', comingSoon: true },
    ],
  },
  {
    key: 'agroturystyka',
    label: '🏡 Agroturystyka',
    activity: 'agroturystyka',
    items: [
      { to: '/agroturystyka', label: 'Agroturystyka', icon: '🏡', comingSoon: true },
    ],
  },
  {
    key: 'general',
    label: 'Ogólne',
    items: [
      { to: '/sprzedaz',   label: 'Sprzedaż',     icon: '💰', requiresProduction: true },
      { to: '/mleko/rhd',  label: 'Rejestr RHD',  icon: '📋', requiresProduction: true },
      { to: '/kasa',       label: 'Kasa i Bank',  icon: '💳' },
      { to: '/inwestycje', label: 'Inwestycje',   icon: '🏗️' },
      { to: '/raporty',    label: pl.nav.reports, icon: '📊' },
      { to: '/ustawienia', label: pl.nav.settings, icon: '⚙️' },
    ],
  },
];

// ── Backup status ────────────────────────────────────────────────

function BackupStatusLine() {
  const days = getDaysSinceBackup();
  const warn = days === null || days >= WARN_AFTER_DAYS;

  let label: string;
  if (days === null)   label = 'Brak backupu';
  else if (days === 0) label = 'Backup: dziś';
  else if (days === 1) label = 'Backup: wczoraj';
  else                 label = `Backup: ${days} dni temu`;

  return (
    <Link
      to="/ustawienia"
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        warn ? 'text-amber-500 hover:text-amber-700' : 'text-gray-400 hover:text-gray-600'
      }`}
      title="Przejdź do ustawień → Dane i backup"
    >
      <span>{warn ? '⚠' : '✓'}</span>
      <span>{label}</span>
    </Link>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────

interface SidebarProps {
  onNavClick?: () => void;
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const [logoErr, setLogoErr] = useState(false);
  const activities = useActivitiesContext();
  const activeKeys = new Set(activities.filter(a => a.isActive).map(a => a.key));
  // Tryb finansowy = brak działalności produkcyjnych (tylko 'osobiste')
  const hasProduction = activities.some(a => a.isActive && a.key !== 'osobiste');

  // Filtruj sekcje wg aktywnych działalności + pozycje wymagające produkcji
  const visibleSections = NAV_SECTIONS
    .filter(section => !section.activity || activeKeys.has(section.activity))
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.requiresProduction || hasProduction),
    }));

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
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {visibleSections.map((section, si) => (
          <div key={section.key}>
            {/* Nagłówek sekcji (pomijamy dla "main") */}
            {section.key !== 'main' && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.label}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map(item =>
                item.comingSoon ? (
                  <div
                    key={item.to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 cursor-default select-none"
                  >
                    <span>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">
                      wkrótce
                    </span>
                  </div>
                ) : (
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
                )
              )}
            </div>

            {/* Separator między sekcjami (nie po ostatniej) */}
            {si < visibleSections.length - 1 && section.key !== 'main' && (
              <div className="mt-3 border-t border-gray-100" />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 space-y-2">
        <BackupStatusLine />
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
