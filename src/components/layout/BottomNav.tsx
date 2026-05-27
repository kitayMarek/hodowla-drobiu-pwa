import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useActivities } from '@/hooks/useTableData';

// Elementy menu "Więcej" wg działalności
interface MoreItem {
  to: string;
  icon: string;
  label: string;
  activity?: string;    // undefined = zawsze widoczny
  comingSoon?: boolean;
}

const MORE_ITEMS: MoreItem[] = [
  // Drób
  { to: '/pasze',           icon: '🌾', label: 'Pasza',         activity: 'drob' },
  { to: '/pasze/receptury', icon: '🧪', label: 'Receptury',     activity: 'drob' },
  { to: '/sprzedaz',        icon: '💰', label: 'Sprzedaż',      activity: 'drob' },
  { to: '/wyleglarnia',     icon: '🥚', label: 'Wylęgarnia',    activity: 'drob' },
  { to: '/finanse',         icon: '📈', label: 'Finanse',       activity: 'drob' },
  // Przetwórstwo mleka (placeholder)
  { to: '/mleko',           icon: '🧀', label: 'Mleko',         activity: 'sery',         comingSoon: true },
  // Przetwory roślinne (placeholder)
  { to: '/kiszonki',        icon: '🥬', label: 'Kiszonki',      activity: 'kiszonki',     comingSoon: true },
  // Agroturystyka (placeholder)
  { to: '/agroturystyka',   icon: '🏡', label: 'Agro­turystyka', activity: 'agroturystyka', comingSoon: true },
  // Ogólne
  { to: '/inwestycje',      icon: '🏗️', label: 'Inwestycje' },
  { to: '/raporty',         icon: '📋', label: 'Raporty' },
  { to: '/ustawienia',      icon: '⚙️', label: 'Ustawienia' },
];

export function BottomNav() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const activities = useActivities();
  const activeKeys = new Set(activities.filter(a => a.isActive).map(a => a.key));

  const hasDropActivities = activeKeys.has('drob');

  // Widoczne pozycje "Więcej"
  const visibleMore = MORE_ITEMS.filter(
    item => !item.activity || activeKeys.has(item.activity)
  );

  const isMoreActive = visibleMore.some(
    i => !i.comingSoon && location.pathname.startsWith(i.to) && i.to !== '/'
  );

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
      isActive ? 'text-brand-700' : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-pb">
        <div className="flex">

          {/* Pulpit — zawsze */}
          <NavLink to="/" end className={navLinkClass}>
            <span className="text-xl leading-none mb-0.5">📊</span>
            <span>Pulpit</span>
          </NavLink>

          {hasDropActivities ? (
            <>
              {/* Stada (tylko drób) */}
              <NavLink to="/stada" className={navLinkClass}>
                <span className="text-xl leading-none mb-0.5">🐔</span>
                <span>Stada</span>
              </NavLink>

              {/* Szybki wpis — wysunięty (tylko drób) */}
              <NavLink
                to="/szybki"
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                    isActive ? 'text-brand-700' : 'text-brand-600'
                  }`
                }
              >
                <span className="w-10 h-10 -mt-5 mb-0.5 rounded-full bg-brand-700 flex items-center justify-center text-white text-xl shadow-lg shadow-brand-200">
                  ⚡
                </span>
                <span className="font-semibold">Wpis</span>
              </NavLink>
            </>
          ) : (
            /* Jeśli brak drobiu — pusty slot żeby Kasa była po środku */
            <div className="flex-1" />
          )}

          {/* Kasa — zawsze */}
          <NavLink to="/kasa" className={navLinkClass}>
            <span className="text-xl leading-none mb-0.5">💳</span>
            <span>Kasa</span>
          </NavLink>

          {/* Więcej — zawsze */}
          <button
            onClick={() => setShowMore(true)}
            className={`flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
              isMoreActive ? 'text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-xl leading-none mb-0.5">☰</span>
            <span className={isMoreActive ? 'text-brand-700' : ''}>Więcej</span>
          </button>

        </div>
      </nav>

      {/* ── More drawer ─────────────────────────────────────────── */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShowMore(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl safe-area-pb">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 pb-6 pt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Wszystkie moduły
              </p>
              <div className="grid grid-cols-4 gap-2">
                {visibleMore.map(item => {
                  if (item.comingSoon) {
                    return (
                      <div
                        key={item.to}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-gray-300 relative"
                      >
                        <span className="text-2xl leading-none">{item.icon}</span>
                        <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                        <span className="absolute top-1 right-1 text-[9px] font-bold bg-amber-100 text-amber-500 px-1 rounded-full">
                          wkrótce
                        </span>
                      </div>
                    );
                  }
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      <span className="text-2xl leading-none">{item.icon}</span>
                      <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
