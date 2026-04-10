import React from 'react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', icon: '📊', label: 'Pulpit', end: true },
  { to: '/stada', icon: '🐔', label: 'Stada' },
  { to: '/sprzedaz', icon: '💰', label: 'Sprzedaż' },
  { to: '/finanse', icon: '📈', label: 'Finanse' },
  { to: '/inwestycje', icon: '🏗️', label: 'Inwestycje' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-pb">
      <div className="flex">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                isActive ? 'text-brand-700' : 'text-gray-500'
              }`
            }
          >
            <span className="text-xl leading-none mb-0.5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
