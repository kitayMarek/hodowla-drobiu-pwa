import { CURRENCY_SYMBOL } from '@/constants/units';

export function formatPln(amount: number, decimals = 2): string {
  return `${amount.toFixed(decimals).replace('.', ',')} ${CURRENCY_SYMBOL}`;
}

export function formatKg(kg: number, decimals = 2): string {
  return `${kg.toFixed(decimals).replace('.', ',')} kg`;
}

export function formatGrams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2).replace('.', ',')} kg`;
  return `${Math.round(g)} g`;
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatNumber(n: number | null, decimals = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('pl-PL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatFCR(fcr: number | null): string {
  if (fcr == null) return '—';
  return fcr.toFixed(2).replace('.', ',');
}

export function formatCount(n: number): string {
  return `${n.toLocaleString('pl-PL')} szt.`;
}
