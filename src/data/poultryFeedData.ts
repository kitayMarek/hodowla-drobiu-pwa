/**
 * Normy żywieniowe i baza składników paszowych dla drobiu.
 * Źródło: tabele referencyjne Kalkulator Pasz (AGROJELONKI) + INRA/NRC.
 */

// ── Typy ──────────────────────────────────────────────────────────────────────

export interface NormyDrobiu {
  okres:   string;
  em:      number;   // Energia metaboliczna MJ/kg
  bialko:  number;   // Białko ogólne %
  ca:      number;   // Wapń %
  p:       number;   // Fosfor strawny %
  tluszcz: number;   // Tłuszcz %
  wlokno:  number;   // Włókno surowe %
  na:      number;   // Sód %
  k?:      number;
  mg?:     number;
  mn?:     number;   // mg/kg
  zn?:     number;   // mg/kg
  se?:     number;   // mg/kg
  fe?:     number;   // mg/kg
  i?:      number;   // mg/kg
}

export interface SkladnikPaszowy {
  nazwa:   string;
  em:      number;
  bialko:  number;
  ca:      number;
  p:       number;
  wlokno:  number;
  cenaKg:  number;
  na:      number;
  k:       number;
  mg:      number;
  mn:      number;
  zn:      number;
  se:      number;
  fe:      number;
  i:       number;
}

// ── Normy żywieniowe ──────────────────────────────────────────────────────────

export const NORMY_DROBIU: Record<string, NormyDrobiu[]> = {
  'kury-nioski-lekkie': [
    { okres: 'Zarodowe',                   em: 11.7, bialko: 17.5, ca: 3.6, p: 0.55, tluszcz: 3.0, wlokno: 4.5, na: 0.16, k: 0.55, mg: 0.045, mn: 100, zn: 80,  se: 0.30, fe: 60,  i: 1.0 },
    { okres: '1–6 tygodni',                em: 11.5, bialko: 18.0, ca: 1.0, p: 0.65, tluszcz: 3.0, wlokno: 4.0, na: 0.15 },
    { okres: '7–14 tygodni',               em: 11.3, bialko: 15.0, ca: 1.0, p: 0.55, tluszcz: 3.0, wlokno: 5.0, na: 0.15 },
    { okres: '15–20 tygodni',              em: 11.0, bialko: 14.0, ca: 2.0, p: 0.50, tluszcz: 2.5, wlokno: 6.0, na: 0.15 },
    { okres: 'Niesienie (do 45%)',         em: 11.5, bialko: 17.0, ca: 3.5, p: 0.50, tluszcz: 2.5, wlokno: 5.0, na: 0.16 },
    { okres: 'Niesienie (powyżej 45%)',    em: 11.5, bialko: 16.0, ca: 3.8, p: 0.48, tluszcz: 2.5, wlokno: 5.0, na: 0.16 },
  ],
  'kury-nioski-ciezkie': [
    { okres: 'Zarodowe',                   em: 11.7, bialko: 17.5, ca: 3.6, p: 0.55, tluszcz: 3.0, wlokno: 4.5, na: 0.16, k: 0.55, mg: 0.045, mn: 100, zn: 80,  se: 0.30, fe: 60,  i: 1.0 },
    { okres: '1–6 tygodni',                em: 11.5, bialko: 19.0, ca: 1.0, p: 0.70, tluszcz: 3.0, wlokno: 4.0, na: 0.15 },
    { okres: '7–14 tygodni',               em: 11.3, bialko: 16.0, ca: 1.0, p: 0.60, tluszcz: 3.0, wlokno: 5.0, na: 0.15 },
    { okres: '15–20 tygodni',              em: 11.0, bialko: 14.5, ca: 2.0, p: 0.55, tluszcz: 2.5, wlokno: 6.0, na: 0.15 },
    { okres: 'Niesienie (do 45%)',         em: 11.5, bialko: 17.5, ca: 3.5, p: 0.55, tluszcz: 2.5, wlokno: 5.0, na: 0.16 },
    { okres: 'Niesienie (powyżej 45%)',    em: 11.5, bialko: 16.5, ca: 3.8, p: 0.50, tluszcz: 2.5, wlokno: 5.0, na: 0.16 },
  ],
  'brojlery': [
    { okres: 'Zarodowe',                   em: 12.0, bialko: 18.5, ca: 3.2, p: 0.50, tluszcz: 3.5, wlokno: 4.0, na: 0.16, k: 0.50, mg: 0.042, mn: 95,  zn: 75,  se: 0.28, fe: 55,  i: 0.9 },
    { okres: '1–3 tygodnie (starter)',     em: 12.5, bialko: 21.0, ca: 1.0, p: 0.70, tluszcz: 3.0, wlokno: 3.5, na: 0.16 },
    { okres: '4–6 tygodni (grower)',       em: 13.0, bialko: 19.0, ca: 0.9, p: 0.65, tluszcz: 4.0, wlokno: 4.0, na: 0.15 },
    { okres: 'Powyżej 6 tygodni (finisher)', em: 13.2, bialko: 17.0, ca: 0.9, p: 0.60, tluszcz: 5.0, wlokno: 4.5, na: 0.15 },
  ],
  'kaczki': [
    { okres: 'Zarodowe',                   em: 11.5, bialko: 18.0, ca: 3.4, p: 0.52, tluszcz: 3.2, wlokno: 4.2, na: 0.15, k: 0.52, mg: 0.044, mn: 98,  zn: 78,  se: 0.29, fe: 58,  i: 0.95 },
    { okres: '1–3 tygodnie',               em: 11.7, bialko: 20.0, ca: 0.9, p: 0.65, tluszcz: 3.0, wlokno: 4.0, na: 0.15 },
    { okres: '4–7 tygodni',                em: 11.7, bialko: 16.0, ca: 0.9, p: 0.60, tluszcz: 3.0, wlokno: 5.0, na: 0.15 },
    { okres: 'Powyżej 7 tygodni',          em: 11.3, bialko: 15.0, ca: 0.9, p: 0.55, tluszcz: 3.0, wlokno: 6.0, na: 0.15 },
  ],
  'gesi': [
    { okres: 'Zarodowe',                   em: 11.3, bialko: 17.0, ca: 3.3, p: 0.54, tluszcz: 3.0, wlokno: 4.5, na: 0.15, k: 0.50, mg: 0.043, mn: 96,  zn: 76,  se: 0.28, fe: 57,  i: 0.92 },
    { okres: '1–4 tygodnie',               em: 11.5, bialko: 20.0, ca: 1.0, p: 0.70, tluszcz: 3.0, wlokno: 4.0, na: 0.15 },
    { okres: '5–8 tygodni',                em: 11.3, bialko: 16.0, ca: 0.9, p: 0.60, tluszcz: 3.0, wlokno: 5.0, na: 0.15 },
    { okres: 'Powyżej 8 tygodni',          em: 10.5, bialko: 14.0, ca: 0.9, p: 0.55, tluszcz: 2.5, wlokno: 8.0, na: 0.15 },
  ],
  'indyki': [
    { okres: 'Zarodowe',                   em: 11.8, bialko: 19.0, ca: 3.5, p: 0.58, tluszcz: 3.3, wlokno: 4.0, na: 0.16, k: 0.58, mg: 0.048, mn: 105, zn: 85,  se: 0.32, fe: 62,  i: 1.1 },
    { okres: '1–4 tygodnie',               em: 11.9, bialko: 28.0, ca: 1.2, p: 0.80, tluszcz: 3.5, wlokno: 3.5, na: 0.16 },
    { okres: '5–8 tygodni',                em: 12.1, bialko: 24.0, ca: 1.1, p: 0.70, tluszcz: 4.0, wlokno: 4.0, na: 0.16 },
    { okres: '9–12 tygodni',               em: 12.3, bialko: 20.0, ca: 1.0, p: 0.65, tluszcz: 4.5, wlokno: 4.5, na: 0.15 },
    { okres: '13–16 tygodni',              em: 12.5, bialko: 17.0, ca: 1.0, p: 0.60, tluszcz: 5.0, wlokno: 5.0, na: 0.15 },
    { okres: 'Powyżej 16 tygodni',         em: 12.1, bialko: 14.0, ca: 1.0, p: 0.55, tluszcz: 4.5, wlokno: 6.0, na: 0.15 },
  ],
};

export const TYPY_DROBIU = [
  { value: 'kury-nioski-lekkie',  label: '🐔 Kury nioski – lekkie'     },
  { value: 'kury-nioski-ciezkie', label: '🐔 Kury nioski – ciężkie'    },
  { value: 'brojlery',            label: '🍗 Brojlery (kurczęta mięsne)' },
  { value: 'kaczki',              label: '🦆 Kaczki'                   },
  { value: 'gesi',                label: '🦢 Gęsi'                     },
  { value: 'indyki',              label: '🦃 Indyki'                   },
];

// ── Baza składników ───────────────────────────────────────────────────────────

export const SKLADNIKI_BAZA: SkladnikPaszowy[] = [
  { nazwa: 'Pszenica',          em: 13.5, bialko: 12.0, ca: 0.05, p: 0.35, wlokno: 2.5,  cenaKg: 0.90, na: 0.02, k: 0.45, mg: 0.13, mn: 40,   zn: 30,  se: 0.05, fe: 45,  i: 0.08 },
  { nazwa: 'Kukurydza',         em: 14.5, bialko: 8.5,  ca: 0.02, p: 0.28, wlokno: 2.0,  cenaKg: 0.85, na: 0.01, k: 0.35, mg: 0.12, mn: 6,    zn: 20,  se: 0.03, fe: 25,  i: 0.05 },
  { nazwa: 'Jęczmień',          em: 12.5, bialko: 11.0, ca: 0.08, p: 0.38, wlokno: 5.0,  cenaKg: 0.80, na: 0.02, k: 0.50, mg: 0.12, mn: 15,   zn: 25,  se: 0.04, fe: 35,  i: 0.06 },
  { nazwa: 'Owies',             em: 11.0, bialko: 11.0, ca: 0.08, p: 0.35, wlokno: 10.0, cenaKg: 0.75, na: 0.02, k: 0.43, mg: 0.14, mn: 45,   zn: 32,  se: 0.06, fe: 48,  i: 0.07 },
  { nazwa: 'Groch',             em: 12.5, bialko: 23.0, ca: 0.10, p: 0.40, wlokno: 5.5,  cenaKg: 1.10, na: 0.02, k: 1.00, mg: 0.13, mn: 12,   zn: 35,  se: 0.08, fe: 50,  i: 0.09 },
  { nazwa: 'Bobik',             em: 12.0, bialko: 27.0, ca: 0.15, p: 0.45, wlokno: 8.0,  cenaKg: 1.05, na: 0.03, k: 1.10, mg: 0.15, mn: 14,   zn: 38,  se: 0.09, fe: 55,  i: 0.10 },
  { nazwa: 'Ziemniaki gotowane', em: 13.5, bialko: 9.0, ca: 0.01, p: 0.20, wlokno: 1.8,  cenaKg: 0.30, na: 0.01, k: 0.42, mg: 0.02, mn: 3,    zn: 3,   se: 0.01, fe: 8,   i: 0.02 },
  { nazwa: 'Śruta słonecznikowa', em: 10.5, bialko: 32.0, ca: 0.25, p: 0.70, wlokno: 25.0, cenaKg: 1.35, na: 0.03, k: 0.95, mg: 0.35, mn: 30, zn: 50,  se: 0.70, fe: 70,  i: 0.12 },
  { nazwa: 'Śruta sojowa',      em: 9.5,  bialko: 46.0, ca: 0.30, p: 0.65, wlokno: 6.0,  cenaKg: 2.20, na: 0.02, k: 2.00, mg: 0.28, mn: 25,   zn: 45,  se: 0.12, fe: 90,  i: 0.15 },
  { nazwa: 'Śruta rzepakowa',   em: 8.5,  bialko: 34.0, ca: 0.70, p: 1.10, wlokno: 12.0, cenaKg: 1.40, na: 0.03, k: 1.20, mg: 0.40, mn: 50,   zn: 60,  se: 1.10, fe: 150, i: 0.20 },
  { nazwa: 'Otręby pszenne',    em: 8.0,  bialko: 16.0, ca: 0.12, p: 1.20, wlokno: 42.0, cenaKg: 0.70, na: 0.02, k: 1.15, mg: 0.50, mn: 120,  zn: 70,  se: 0.30, fe: 140, i: 0.08 },
  { nazwa: 'Kreda pastewna',    em: 0,    bialko: 0,    ca: 38.0, p: 0.01, wlokno: 0,    cenaKg: 0.80, na: 0.10, k: 0.01, mg: 0.50, mn: 5,    zn: 3,   se: 0.01, fe: 10,  i: 0.02 },
  { nazwa: 'Fosforan wapnia',   em: 0,    bialko: 0,    ca: 24.0, p: 18.0, wlokno: 0,    cenaKg: 3.50, na: 0.30, k: 0.02, mg: 0.20, mn: 8,    zn: 10,  se: 0.02, fe: 15,  i: 0.03 },
  { nazwa: 'Sól kamienna',      em: 0,    bialko: 0,    ca: 0,    p: 0,    wlokno: 0,    cenaKg: 0.60, na: 39.0, k: 0.01, mg: 0.01, mn: 0,    zn: 0,   se: 0,    fe: 0,   i: 0.01 },
  { nazwa: 'Dolmix Capri',      em: 2.5,  bialko: 7.0,  ca: 12.0, p: 5.0,  wlokno: 1.5,  cenaKg: 8.00, na: 0.25, k: 0.30, mg: 0.45, mn: 1200, zn: 800, se: 8.0,  fe: 600, i: 15  },
  { nazwa: 'Premiks witaminowy', em: 0,   bialko: 0,    ca: 0,    p: 0,    wlokno: 0,    cenaKg: 12.0, na: 0,    k: 0,    mg: 0.10, mn: 8000, zn: 6000, se: 30,  fe: 5000, i: 100 },
  { nazwa: 'Olej roślinny',     em: 37.0, bialko: 0,    ca: 0,    p: 0,    wlokno: 0,    cenaKg: 5.50, na: 0,    k: 0,    mg: 0,    mn: 0,    zn: 0,   se: 0,    fe: 0,   i: 0   },
  { nazwa: 'Mączka rybna',      em: 12.5, bialko: 65.0, ca: 5.50, p: 3.50, wlokno: 0,    cenaKg: 5.00, na: 0.80, k: 0.80, mg: 0.20, mn: 20,   zn: 100, se: 2.0,  fe: 300, i: 2.5 },
  { nazwa: 'Drożdże paszowe',   em: 10.5, bialko: 45.0, ca: 0.80, p: 1.50, wlokno: 0,    cenaKg: 4.00, na: 0.10, k: 1.70, mg: 0.30, mn: 15,   zn: 75,  se: 0.50, fe: 120, i: 0.20 },
];
