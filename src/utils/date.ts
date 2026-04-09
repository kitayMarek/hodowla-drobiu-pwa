import {
  format,
  formatDistance,
  parseISO,
  differenceInDays,
  isToday,
  isYesterday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { pl } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy');
}

export function formatDateLong(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMMM yyyy', { locale: pl });
}

export function formatDateShort(dateStr: string): string {
  const d = parseISO(dateStr);
  return isNaN(d.getTime()) ? dateStr : format(d, 'dd.MM');
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy HH:mm');
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function ageLabel(startDate: string): string {
  const days = differenceInDays(new Date(), parseISO(startDate));
  if (days === 0) return 'Dzisiaj wstawiono';
  if (days === 1) return '1 dzień';
  if (days < 7) return `${days} dni`;
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  if (remDays === 0) return `${weeks} tyg.`;
  return `${weeks} tyg. ${remDays} dni`;
}

export function relativeDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Dzisiaj';
  if (isYesterday(d)) return 'Wczoraj';
  return formatDistance(d, new Date(), { locale: pl, addSuffix: true });
}

export {
  parseISO,
  differenceInDays,
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
};
