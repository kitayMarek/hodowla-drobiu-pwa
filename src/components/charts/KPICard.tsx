import React from 'react';

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: 'green' | 'blue' | 'red' | 'orange' | 'gray';
  className?: string;
}

const colorMap = {
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
  gray: 'bg-gray-50 text-gray-700',
};

export function KPICard({
  label,
  value,
  sub,
  icon,
  trend,
  trendLabel,
  color = 'gray',
  className = '',
}: KPICardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colorMap[color]}`}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {sub && <span className="ml-1 text-sm text-gray-500">{sub}</span>}
      </div>
      {trendLabel && (
        <div className={`flex items-center gap-1 text-xs ${
          trend === 'up' ? 'text-green-600' :
          trend === 'down' ? 'text-red-600' :
          'text-gray-500'
        }`}>
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendLabel}
        </div>
      )}
    </div>
  );
}
