import React from 'react';

type BadgeColor = 'green' | 'blue' | 'red' | 'yellow' | 'gray' | 'orange';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
};

export function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[color]} ${className}`}>
      {children}
    </span>
  );
}
