import React, { useState, useMemo } from 'react';
import {
  ComposedChart, LineChart, AreaChart,
  Line, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { FeedType, FeedConsumption } from '@/models/feed.model';
import type { DailyEntry } from '@/models/dailyEntry.model';
import type { Weighing } from '@/models/weighing.model';
import { formatDateShort } from '@/utils/date';

interface Props {
  feedTypes: FeedType[];              // tylko te z kg > 0 dla tego stada
  dailyEntries: DailyEntry[];         // przefiltrowane – daty i total
  feedConsumptions: FeedConsumption[]; // przefiltrowane – per typ
  weighings: Weighing[];
  birdCount: number;
}

const FEED_COLORS = ['#2563eb', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#65a30d'];
const COLOR_TOTAL  = '#1f2937';
const COLOR_GAIN   = '#2563eb';
const COLOR_FCR    = '#ea580c';
const COLOR_CUMUL  = '#16a34a';

// ─── Tooltip helpers ─────────────────────────────────────────────────────────

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-gray-500">{label}:</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

// ─── Toggle chips ─────────────────────────────────────────────────────────────

interface ChipItem { key: string; label: string; color: string }

function ToggleChips({
  items,
  hidden,
  onToggle,
}: {
  items: ChipItem[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {items.map(item => {
        const isHidden = hidden.has(item.key);
        return (
          <button
            key={item.key}
            onClick={() => onToggle(item.key)}
            className={`text-xs px-2.5 py-0.5 rounded-full border font-medium transition-all ${
              isHidden ? 'bg-gray-50 text-gray-400 border-gray-200' : 'text-white border-transparent'
            }`}
            style={isHidden ? {} : { backgroundColor: item.color }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function useToggle(initial?: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(initial ?? []));
  const toggle = (key: string) =>
    setHidden(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  return { hidden, toggle };
}

// ─── Wykres 1: Zużycie paszy wg rodzajów (dziennie) ─────────────────────────

function Chart1({
  feedTypes,
  dailyEntries,
  feedConsumptions,
}: {
  feedTypes: FeedType[];
  dailyEntries: DailyEntry[];
  feedConsumptions: FeedConsumption[];
}) {
  const { hidden, toggle } = useToggle();

  const { chartData, chips } = useMemo(() => {
    const dates = [...new Set(dailyEntries.map(e => e.date))].sort();

    const data = dates.map(date => {
      const row: Record<string, string | number | null> = { date: formatDateShort(date) };
      // Total pochodzi z dailyEntries (suma niezależnie od typów)
      const dayTotal = dailyEntries.filter(e => e.date === date).reduce((s, e) => s + e.feedConsumedKg, 0);
      row.total = dayTotal > 0 ? Math.round(dayTotal * 100) / 100 : null;
      // Per-typ pochodzi z feedConsumptions
      for (const ft of feedTypes) {
        const kg = feedConsumptions
          .filter(fc => fc.feedTypeId === ft.id && fc.date === date)
          .reduce((s, fc) => s + fc.consumedKg, 0);
        row[`ft_${ft.id}`] = kg > 0 ? Math.round(kg * 100) / 100 : null;
      }
      return row;
    });

    const items: ChipItem[] = [
      { key: 'total', label: 'Łącznie', color: COLOR_TOTAL },
      ...feedTypes.map((ft, i) => ({ key: `ft_${ft.id}`, label: ft.name, color: FEED_COLORS[i % FEED_COLORS.length] })),
    ];

    return { chartData: data, chips: items };
  }, [feedTypes, dailyEntries, feedConsumptions]);

  if (chartData.length < 2) return null;

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">Zużycie paszy wg rodzajów (kg/dzień)</div>
      <ToggleChips items={chips} hidden={hidden} onToggle={toggle} />
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10 }} width={40}
            label={{ value: 'kg', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 10, fill: '#9ca3af' } }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
                  <div className="font-medium text-gray-700 mb-1">{label}</div>
                  {payload.map(p => p.value != null && (
                    <TooltipRow key={p.dataKey as string} color={p.color!} label={p.name as string} value={`${p.value} kg`} />
                  ))}
                </div>
              );
            }}
          />
          {chips.map(item => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={item.key === 'total' ? 2.5 : 1.8}
              dot={false}
              hide={hidden.has(item.key)}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Wykres 2: Przyrosty dzienne + FCR ───────────────────────────────────────

function Chart2({
  dailyEntries,
  weighings,
  birdCount,
}: {
  dailyEntries: DailyEntry[];
  weighings: Weighing[];
  birdCount: number;
}) {
  const { hidden, toggle } = useToggle();

  const { chartData, hasData } = useMemo(() => {
    // Zbierz wszystkie punkty wagowe (ważenia formalne + sample z wpisów dziennych)
    const weightMap = new Map<string, number>();
    dailyEntries
      .filter(e => e.sampleWeightGrams != null && e.sampleWeightGrams > 0)
      .forEach(e => weightMap.set(e.date, e.sampleWeightGrams!));
    weighings.forEach(w => weightMap.set(w.weighingDate, w.averageWeightGrams));

    const sorted = [...weightMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) return { chartData: [], hasData: false };

    const data: { date: string; gainG: number | null; fcr: number | null }[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const [d1, g1] = sorted[i - 1];
      const [d2, g2] = sorted[i];
      const days = (new Date(d2).getTime() - new Date(d1).getTime()) / 86400000;
      if (days <= 0) continue;

      const gainPerBirdG = g2 - g1;
      const dailyGainG   = Math.round((gainPerBirdG / days) * 10) / 10;

      // FCR: kg paszy / kg przyrostu stada
      let fcr: number | null = null;
      if (birdCount > 0 && gainPerBirdG > 0) {
        const feedInPeriod = dailyEntries
          .filter(e => e.date > d1 && e.date <= d2)
          .reduce((s, e) => s + e.feedConsumedKg, 0);
        const totalGainKg = (gainPerBirdG / 1000) * birdCount;
        fcr = totalGainKg > 0 ? Math.round((feedInPeriod / totalGainKg) * 100) / 100 : null;
      }

      data.push({ date: formatDateShort(d2), gainG: dailyGainG, fcr });
    }

    return { chartData: data, hasData: data.length > 0 };
  }, [dailyEntries, weighings, birdCount]);

  if (!hasData) return null;

  const hasFCR = chartData.some(d => d.fcr != null);
  const chips: ChipItem[] = [
    { key: 'gainG', label: 'Przyrost dzienny (g/ptak)', color: COLOR_GAIN },
    ...(hasFCR ? [{ key: 'fcr', label: 'FCR (kg paszy / kg przyrostu)', color: COLOR_FCR }] : []),
  ];

  const showRightAxis = hasFCR && !hidden.has('fcr');

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">Przyrosty dzienne i efektywność paszy</div>
      <ToggleChips items={chips} hidden={hidden} onToggle={toggle} />
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: showRightAxis ? 52 : 10, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }} width={44}
            label={{ value: 'g/ptak', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 10, fill: '#9ca3af' } }}
          />
          {showRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }} width={44}
              label={{ value: 'FCR', angle: 90, position: 'insideRight', offset: 12, style: { fontSize: 10, fill: '#9ca3af' } }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
                  <div className="font-medium text-gray-700 mb-1">{label}</div>
                  {payload.map(p => p.value != null && (
                    <TooltipRow
                      key={p.dataKey as string}
                      color={p.color!}
                      label={p.name as string}
                      value={p.dataKey === 'fcr' ? `${p.value}` : `${p.value} g`}
                    />
                  ))}
                </div>
              );
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="gainG"
            name="Przyrost dzienny"
            stroke={COLOR_GAIN}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_GAIN }}
            hide={hidden.has('gainG')}
            connectNulls
          />
          {hasFCR && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="fcr"
              name="FCR"
              stroke={COLOR_FCR}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={{ r: 3, fill: COLOR_FCR }}
              hide={hidden.has('fcr')}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Wykres 3: Skumulowane zużycie paszy ──────────────────────────────────────

function Chart3({ dailyEntries }: { dailyEntries: DailyEntry[] }) {
  const chartData = useMemo(() => {
    const dates = [...new Set(dailyEntries.map(e => e.date))].sort();
    let cumul = 0;
    return dates.map(date => {
      const dayTotal = dailyEntries.filter(e => e.date === date).reduce((s, e) => s + e.feedConsumedKg, 0);
      cumul += dayTotal;
      return { date: formatDateShort(date), cumul: Math.round(cumul * 10) / 10 };
    });
  }, [dailyEntries]);

  if (chartData.length < 2) return null;

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">Łączne zużycie paszy (skumulowane, kg)</div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="cumulGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLOR_CUMUL} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLOR_CUMUL} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10 }} width={48}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}`}
            label={{ value: 'kg', angle: -90, position: 'insideLeft', offset: 8, style: { fontSize: 10, fill: '#9ca3af' } }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const val = payload[0]?.value as number;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-xs">
                  <div className="font-medium text-gray-700 mb-1">{label}</div>
                  <TooltipRow color={COLOR_CUMUL} label="Łącznie" value={`${val} kg`} />
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="cumul"
            name="Łącznie"
            stroke={COLOR_CUMUL}
            strokeWidth={2}
            fill="url(#cumulGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Główny eksport ───────────────────────────────────────────────────────────

export function FeedConsumptionChart({ feedTypes, dailyEntries, feedConsumptions, weighings, birdCount }: Props) {
  if (dailyEntries.length < 2) return null;

  return (
    <div className="mt-4 border-t border-gray-50 pt-4 space-y-6">
      <Chart1 feedTypes={feedTypes} dailyEntries={dailyEntries} feedConsumptions={feedConsumptions} />
      <Chart2 dailyEntries={dailyEntries} weighings={weighings} birdCount={birdCount} />
      <Chart3 dailyEntries={dailyEntries} />
    </div>
  );
}
