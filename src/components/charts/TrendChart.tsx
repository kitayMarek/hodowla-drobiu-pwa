import React from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { TrendPoint } from '@/engine/types';
import { formatDateShort } from '@/utils/date';

interface ChartProps {
  data: TrendPoint[];
  label?: string;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  /** Custom X-axis formatter. If omitted, treats `date` as ISO date string. */
  xFormatter?: (x: string) => string;
}

export function SimpleLine({ data, label, color = '#15803d', height = 200, formatValue, xFormatter }: ChartProps) {
  const fmt = xFormatter ?? formatDateShort;
  const mapped = data.map(d => ({ ...d, date: fmt(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={mapped} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={45} tickFormatter={formatValue} />
        <Tooltip formatter={(v: number) => formatValue ? formatValue(v) : v} labelStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleBar({ data, label, color = '#16a34a', height = 200, formatValue, xFormatter }: ChartProps) {
  const fmt = xFormatter ?? formatDateShort;
  const mapped = data.map(d => ({ ...d, date: fmt(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={mapped} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={45} tickFormatter={formatValue} />
        <Tooltip formatter={(v: number) => formatValue ? formatValue(v) : v} labelStyle={{ fontSize: 12 }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} name={label} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleArea({ data, label, color = '#22c55e', height = 200, formatValue, xFormatter }: ChartProps) {
  const fmt = xFormatter ?? formatDateShort;
  const mapped = data.map(d => ({ ...d, date: fmt(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={mapped} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={45} tickFormatter={formatValue} />
        <Tooltip formatter={(v: number) => formatValue ? formatValue(v) : v} labelStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke={color} fill={`${color}33`} strokeWidth={2} name={label} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface CostPieData {
  name: string;
  value: number;
}

interface MultiBarProps {
  data: Record<string, unknown>[];
  bars: Array<{ key: string; label: string; color: string }>;
  xKey: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export function MultiBar({ data, bars, xKey, height = 250, formatValue }: MultiBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={formatValue} />
        <Tooltip formatter={(v: number) => formatValue ? formatValue(v) : v} labelStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map(b => (
          <Bar key={b.key} dataKey={b.key} fill={b.color} name={b.label} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
