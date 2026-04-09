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

export type SaleType = 'jaja' | 'ptaki_zywe' | 'tuszki' | 'elementy';

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  jaja: 'Jaja',
  ptaki_zywe: 'Ptaki żywe',
  tuszki: 'Tuszki',
  elementy: 'Elementy (części)',
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

export type SourceType = 'zakupione' | 'wlasny_wyleg';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  zakupione: 'Zakupione',
  wlasny_wyleg: 'Własny wylęg',
};
