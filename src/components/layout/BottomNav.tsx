import React from 'react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/',       icon: '📊', label: 'Pulpit',  end: true },
  { to: '/stada',  icon: '🐔', label: 'Stada' },
  { to: '/szybki', icon: '⚡', label: 'Wpis',    quick: true },
  { to: '/kasa',   icon: '💳', label: 'Kasa' },
  { to: '/ustawienia', icon: '⚙️', label: 'Więcej' },
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
                item.quick
                  ? isActive
                    ? 'text-brand-700'
                    : 'text-brand-600'
                  : isActive
                    ? 'text-brand-700'
                    : 'text-gray-500'
              }`
            }
          >
            {item.quick ? (
              <span className="w-10 h-10 -mt-5 mb-0.5 rounded-full bg-brand-700 flex items-center justify-center text-white text-xl shadow-lg shadow-brand-200">
                {item.icon}
              </span>
            ) : (
              <span className="text-xl leading-none mb-0.5">{item.icon}</span>
            )}
            <span className={item.quick ? 'font-semibold' : ''}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
