/**
 * Faktura VAT RR — czyste funkcje: arytmetyka groszowa (§5 specu) + kwota słownie (§6).
 *
 * ⚠️ WARSTWA PRAWNA — nie upraszczać bez sprawdzenia z tabelami testów w vatRr.spec.mjs.
 * Wszystkie kwoty w GROSZACH jako całkowite `number` (bezpieczne do 2^53). Zero `float`.
 */

/** Zaokrąglenie „w górę od połowy" — NIE bankierskie (§5). */
export const roundHalfUp = (x: number) => Math.floor(x + 0.5);

/** Wartość netto pozycji: ilość (×1000) × cena_gr / 1000, zaokrąglona do grosza. */
export const lineNetGr = (quantityMilli: number, unitPriceGr: number) =>
  Math.round((quantityMilli * unitPriceGr) / 1000);

/** Suma netto dokumentu z pozycji. */
export const sumNetGr = (linesNetGr: number[]) => linesNetGr.reduce((s, n) => s + n, 0);

/**
 * Kwota zryczałtowanego zwrotu — liczona OD SUMY NETTO DOKUMENTU (nie per pozycja),
 * bo dokument wykazuje jedną kwotę zwrotu (§5). Domyślnie 7%.
 */
export const flatRateGr = (netTotalGr: number, pct = 7) => roundHalfUp((netTotalGr * pct) / 100);

/** Podsumowanie dokumentu. */
export interface VatRrTotals {
  netTotalGr: number;
  flatRatePct: number;
  flatRateGr: number;
  grossTotalGr: number;
}
export function computeTotals(linesNetGr: number[], pct = 7): VatRrTotals {
  const netTotalGr = sumNetGr(linesNetGr);
  const flat = flatRateGr(netTotalGr, pct);
  return { netTotalGr, flatRatePct: pct, flatRateGr: flat, grossTotalGr: netTotalGr + flat };
}

/** Poprawność sumy kontrolnej NIP (10 cyfr, wagi 6,5,7,2,3,4,5,6,7 mod 11). §11 walidacja. */
export function isValidNip(nip: string): boolean {
  const d = (nip || '').replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(d)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((s, wi, i) => s + wi * Number(d[i]), 0);
  const ctrl = sum % 11;
  return ctrl !== 10 && ctrl === Number(d[9]);
}

/** grosze → tekst „1 234,56 zł" (wyświetlanie). */
export const grToPln = (gr: number) =>
  (gr / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';

// ─── Kwota słownie (PL) ──────────────────────────────────────────────────────

const JEDNOSTKI = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć'];
const NASTKI = ['dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
const DZIESIATKI = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt'];
const SETKI = ['', 'sto', 'dwieście', 'trzysta', 'czterysta', 'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset'];

const GRUPY: Array<[string, string, string]> = [
  ['', '', ''],
  ['tysiąc', 'tysiące', 'tysięcy'],
  ['milion', 'miliony', 'milionów'],
  ['miliard', 'miliardy', 'miliardów'],
];

const ZLOTY: [string, string, string] = ['złoty', 'złote', 'złotych'];

/**
 * Indeks formy liczby mnogiej PL: 0 = pojedyncza (tylko dokładnie 1),
 * 1 = „mała mnoga" (2–4 bez 12–14), 2 = „duża mnoga" (reszta).
 * Uwaga: forma 0 dotyczy WYŁĄCZNIE n===1 (21 → forma 2: „złotych", nie „złoty").
 */
export function pluralIndex(n: number): 0 | 1 | 2 {
  if (n === 1) return 0;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 1;
  return 2;
}

/** Słownie liczba 1..999 (bez zer wiodących). */
function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const s = Math.floor(n / 100);
  if (s) parts.push(SETKI[s]);
  const r = n % 100;
  if (r >= 20) {
    parts.push(DZIESIATKI[Math.floor(r / 10)]);
    if (r % 10) parts.push(JEDNOSTKI[r % 10]);
  } else if (r >= 10) {
    parts.push(NASTKI[r - 10]);
  } else if (r >= 1) {
    parts.push(JEDNOSTKI[r]);
  }
  return parts.join(' ');
}

/** Liczba całkowita (0..999 999 999 999) słownie. */
export function integerToWords(n: number): string {
  if (n === 0) return JEDNOSTKI[0];
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const out: string[] = [];
  for (let g = groups.length - 1; g >= 0; g--) {
    const val = groups[g];
    if (val === 0) continue;
    out.push(threeDigitsToWords(val));
    if (g > 0) out.push(GRUPY[g][pluralIndex(val)]);
  }
  return out.join(' ');
}

/**
 * Kwota w groszach → słownie, format: „<liczba> <złoty/złote/złotych> GG/100".
 * Np. 14445 → „sto czterdzieści cztery złote 45/100".
 */
export function kwotaSlownie(totalGr: number): string {
  const zl = Math.floor(totalGr / 100);
  const gr = totalGr % 100;
  const gg = String(gr).padStart(2, '0');
  return `${integerToWords(zl)} ${ZLOTY[pluralIndex(zl)]} ${gg}/100`;
}
