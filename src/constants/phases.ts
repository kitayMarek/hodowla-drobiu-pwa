export type BatchStatus = 'active' | 'completed' | 'sold' | 'archived';

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  active: 'Aktywna',
  completed: 'Zakończona',
  sold: 'Sprzedana',
  archived: 'Zarchiwizowana',
};

export const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  sold: 'bg-gray-100 text-gray-700',
  archived: 'bg-yellow-100 text-yellow-800',
};

export type FeedPhase = 'starter' | 'grower' | 'finisher' | 'layer' | 'own_mix';

export const FEED_PHASE_LABELS: Record<FeedPhase, string> = {
  starter: 'Starter',
  grower: 'Grower',
  finisher: 'Finisher',
  layer: 'Nioska',
  own_mix: 'Własna mieszanka',
};

export type HealthEventType = 'choroba' | 'szczepienie' | 'leczenie' | 'obserwacja' | 'profilaktyka';

export const HEALTH_EVENT_LABELS: Record<HealthEventType, string> = {
  choroba: 'Choroba',
  szczepienie: 'Szczepienie',
  leczenie: 'Leczenie',
  obserwacja: 'Obserwacja',
  profilaktyka: 'Profilaktyka',
};

export type SaleType = 'jaja' | 'ptaki_zywe' | 'tuszki' | 'elementy' | 'jaja_wewn';

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  jaja: 'Jaja',
  ptaki_zywe: 'Ptaki żywe',
  tuszki: 'Tuszki',
  elementy: 'Elementy (części)',
  jaja_wewn: 'Jaja → Wylęgarnia',
};

export type ExpenseCategory =
  | 'piskleta'
  | 'pasza'
  | 'leki'
  | 'weterynarz'
  | 'energia'
  | 'praca'
  | 'transport'
  | 'sciolka'
  | 'inne';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  piskleta: 'Pisklęta',
  pasza: 'Pasza',
  leki: 'Leki i szczepionki',
  weterynarz: 'Weterynarz',
  energia: 'Energia (prąd, gaz)',
  praca: 'Praca',
  transport: 'Transport',
  sciolka: 'Ściółka',
  inne: 'Inne',
};

export type InvestmentCategory =
  | 'budynek'
  | 'maszyna'
  | 'wyposazenie'
  | 'instalacja'
  | 'pojazd'
  | 'grunty'
  | 'inne_st';

export const INVESTMENT_CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  budynek:     'Budynek / obiekt',
  maszyna:     'Maszyna / urządzenie',
  wyposazenie: 'Wyposażenie kurnika',
  instalacja:  'Instalacja (el., went., ogrzew.)',
  pojazd:      'Pojazd',
  grunty:      'Grunty / dzierżawa',
  inne_st:     'Inne środki trwałe',
};

export const INVESTMENT_CATEGORY_ICONS: Record<InvestmentCategory, string> = {
  budynek:     '🏗️',
  maszyna:     '⚙️',
  wyposazenie: '🪣',
  instalacja:  '🔌',
  pojazd:      '🚜',
  grunty:      '🌱',
  inne_st:     '📦',
};

export type WeighingMethod = 'sample' | 'full_flock';

export const WEIGHING_METHOD_LABELS: Record<WeighingMethod, string> = {
  sample: 'Próba (wyrywkowe)',
  full_flock: 'Całe stado',
};

export type LitterCondition = 'dobra' | 'srednia' | 'zla';

export const LITTER_CONDITION_LABELS: Record<LitterCondition, string> = {
  dobra: 'Dobra',
  srednia: 'Średnia',
  zla: 'Zła',
};

export type IncubationStatus = 'incubating' | 'lockdown' | 'completed' | 'cancelled';

export const INCUBATION_STATUS_LABELS: Record<IncubationStatus, string> = {
  incubating: 'Inkubacja',
  lockdown:   'Lockdown / Klucie',
  completed:  'Zakończony',
  cancelled:  'Anulowany',
};

export const INCUBATION_STATUS_COLORS: Record<IncubationStatus, string> = {
  incubating: 'bg-amber-100 text-amber-800',
  lockdown:   'bg-orange-100 text-orange-800',
  completed:  'bg-green-100 text-green-800',
  cancelled:  'bg-gray-100 text-gray-500',
};

// Domyślne parametry inkubacji per gatunek
export interface IncubationDefaults {
  totalDays: number;
  lockdownDay: number;
  incubationTempC: number;
  incubationHumidityPct: number;
  lockdownTempC: number;
  lockdownHumidityPct: number;
}

export const INCUBATION_DEFAULTS: Record<string, IncubationDefaults> = {
  brojler: { totalDays: 21, lockdownDay: 18, incubationTempC: 37.5, incubationHumidityPct: 55, lockdownTempC: 37.2, lockdownHumidityPct: 70 },
  nioska:  { totalDays: 21, lockdownDay: 18, incubationTempC: 37.5, incubationHumidityPct: 55, lockdownTempC: 37.2, lockdownHumidityPct: 70 },
  kaczka:  { totalDays: 28, lockdownDay: 25, incubationTempC: 37.5, incubationHumidityPct: 55, lockdownTempC: 37.2, lockdownHumidityPct: 80 },
  indyk:   { totalDays: 28, lockdownDay: 25, incubationTempC: 37.5, incubationHumidityPct: 55, lockdownTempC: 37.2, lockdownHumidityPct: 70 },
  ges:     { totalDays: 30, lockdownDay: 27, incubationTempC: 37.5, incubationHumidityPct: 55, lockdownTempC: 37.2, lockdownHumidityPct: 80 },
};

export type SourceType = 'zakupione' | 'wlasny_wyleg';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  zakupione: 'Zakupione',
  wlasny_wyleg: 'Własny wylęg',
};

export type OrderType = 'jaja' | 'ptaki_zywe' | 'tuszki';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  jaja:       'Jaja',
  ptaki_zywe: 'Ptaki żywe',
  tuszki:     'Tuszki',
};

export type OrderStatus = 'oczekujace' | 'zrealizowane' | 'anulowane';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  oczekujace:   'Oczekujące',
  zrealizowane: 'Zrealizowane',
  anulowane:    'Anulowane',
};
