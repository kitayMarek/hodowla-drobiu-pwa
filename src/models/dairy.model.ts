// ── Typy bazowe ─────────────────────────────────────────────────

export type DairyProductType =
  | 'ser_dojrzewajacy'
  | 'twarog'
  | 'jogurt'
  | 'kefir'
  | 'smietana'
  | 'maslo'
  | 'rikotta'
  | 'mleko_surowe'   // sprzedaż mleka surowego — bez tworzenia partii
  | 'zwierzeta';     // skarmianie zwierząt — bez tworzenia partii

/** Typy które nie tworzą partii produkcyjnych */
export const NO_BATCH_TYPES = new Set<DairyProductType>(['mleko_surowe', 'zwierzeta']);

export type MilkSource  = 'own' | 'purchase';
export type BatchStatus = 'w_produkcji' | 'dojrzewa' | 'gotowy' | 'sprzedany' | 'wycofany';
export type WheyStatus  = 'na_rikotte' | 'skarmianie' | 'utylizacja';
export type BuyerType   = 'detaliczny' | 'sklep' | 'restauracja' | 'inny';

// ── Dostawca mleka ───────────────────────────────────────────────

export interface MilkSupplier {
  id?: number;
  name: string;
  address?: string;
  peselOrNip?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

// ── Przyjęcie mleka ──────────────────────────────────────────────

export interface MilkReception {
  id?: number;
  date: string;
  source: MilkSource;
  quantityLiters: number;
  temperatureC?: number;
  fatPercent?: number;
  supplierId?: number;
  supplierName?: string;    // denormalizacja do podglądu
  pricePerLiter?: number;
  totalPricePln?: number;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
}

// ── Rozlew mleka na produkty ─────────────────────────────────────

export interface MilkAllocation {
  id?: number;
  receptionId: number;
  productType: DairyProductType;
  litersAllocated: number;
  batchId?: number;         // tworzony automatycznie
  createdAt: string;
}

// ── Partia produkcyjna ───────────────────────────────────────────

export interface ProductionBatch {
  id?: number;
  batchNumber: string;       // PARTIA-2026-05-27-A
  productType: DairyProductType;
  milkLiters: number;
  expectedYieldKg: number;
  actualYieldKg?: number;
  status: BatchStatus;
  productionDate: string;
  expiryDate: string;
  quantityRemainingKg: number;
  agingDays?: number;
  notes?: string;
  createdAt: string;
}

// ── Krok produkcji (workflow) ─────────────────────────────────────

export interface ProductionStep {
  id?: number;
  batchId: number;
  stepType: string;
  label: string;
  sortOrder: number;
  scheduledAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  temperatureC?: number;
  notes?: string;
}

// ── Serwatka ─────────────────────────────────────────────────────

export interface WheyByproduct {
  id?: number;
  batchId: number;
  quantityLiters: number;
  status: WheyStatus;
  ricottaBatchId?: number;
  date: string;
  notes?: string;
}

// ── Sprzedaż mleczarska ──────────────────────────────────────────

export interface DairySale {
  id?: number;
  batchId: number;
  saleDate: string;
  productType: DairyProductType;
  quantityKg: number;
  pricePerKgPln: number;
  totalRevenuePln: number;
  buyerType: BuyerType;
  buyerName?: string;
  inRhd: boolean;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
}

// ── Stałe ────────────────────────────────────────────────────────

export const PRODUCT_LABELS: Record<DairyProductType, string> = {
  ser_dojrzewajacy: 'Ser dojrzewający',
  twarog:           'Twaróg',
  jogurt:           'Jogurt',
  kefir:            'Kefir',
  smietana:         'Śmietana',
  maslo:            'Masło',
  rikotta:          'Rikotta',
  mleko_surowe:     'Mleko surowe (sprzedaż)',
  zwierzeta:        'Skarmianie zwierząt',
};

export const PRODUCT_ICONS: Record<DairyProductType, string> = {
  ser_dojrzewajacy: '🧀',
  twarog:           '🥛',
  jogurt:           '🫙',
  kefir:            '🫙',
  smietana:         '🥄',
  maslo:            '🧈',
  rikotta:          '🫕',
  mleko_surowe:     '🥛',
  zwierzeta:        '🐄',
};

/** Współczynniki wydajności produkcji */
export interface YieldFactor {
  yieldPercent: number;    // kg produktu na 100 L mleka
  wheyPercent: number;     // L serwatki na 100 L mleka
  shelfLifeDays: number;   // domyślny termin przydatności
  agingDays?: number;      // czas dojrzewania (dla serów)
}

export const YIELD_FACTORS: Record<DairyProductType, YieldFactor> = {
  ser_dojrzewajacy: { yieldPercent: 10, wheyPercent: 85, shelfLifeDays: 90, agingDays: 21 },
  twarog:           { yieldPercent: 9,  wheyPercent: 80, shelfLifeDays: 10 },
  jogurt:           { yieldPercent: 95, wheyPercent: 0,  shelfLifeDays: 21 },
  kefir:            { yieldPercent: 98, wheyPercent: 0,  shelfLifeDays: 14 },
  smietana:         { yieldPercent: 15, wheyPercent: 0,  shelfLifeDays: 14 },
  maslo:            { yieldPercent: 5,  wheyPercent: 0,  shelfLifeDays: 60 },
  rikotta:          { yieldPercent: 2,  wheyPercent: 95, shelfLifeDays: 7 },
  mleko_surowe:     { yieldPercent: 0,  wheyPercent: 0,  shelfLifeDays: 0 },
  zwierzeta:        { yieldPercent: 0,  wheyPercent: 0,  shelfLifeDays: 0 },
};

/** Oblicz oczekiwaną wydajność */
export function calcExpectedYield(liters: number, type: DairyProductType): number {
  return Math.round((liters * YIELD_FACTORS[type].yieldPercent) / 100 * 100) / 100;
}

/** Oblicz oczekiwaną serwatkę */
export function calcExpectedWhey(liters: number, type: DairyProductType): number {
  return Math.round(liters * YIELD_FACTORS[type].wheyPercent / 100 * 10) / 10;
}

/** Wygeneruj numer partii */
export function generateBatchNumber(date: string, suffix: string): string {
  return `PARTIA-${date.replace(/-/g, '')}-${suffix}`;
}

/** Oblicz datę ważności */
export function calcExpiryDate(productionDate: string, type: DairyProductType, agingDays?: number): string {
  const d = new Date(productionDate);
  const aging = agingDays ?? YIELD_FACTORS[type].agingDays ?? 0;
  d.setDate(d.getDate() + YIELD_FACTORS[type].shelfLifeDays + aging);
  return d.toISOString().slice(0, 10);
}

/** Kroki workflow per typ produktu */
export interface WorkflowStepDef {
  stepType: string;
  label: string;
  hasTimer: boolean;
  defaultDurationMinutes?: number;
}

export const WORKFLOW_STEPS: Record<DairyProductType, WorkflowStepDef[]> = {
  ser_dojrzewajacy: [
    { stepType: 'pasteryzacja',  label: 'Pasteryzacja',                hasTimer: true,  defaultDurationMinutes: 30  },
    { stepType: 'zaprawienie',   label: 'Zaprawienie kulturami',        hasTimer: false },
    { stepType: 'krojenie',      label: 'Krojenie skrzepu',            hasTimer: false },
    { stepType: 'prasowanie',    label: 'Prasowanie',                  hasTimer: true,  defaultDurationMinutes: 120 },
    { stepType: 'solanka',       label: 'Solanka',                     hasTimer: true,  defaultDurationMinutes: 120 },
    { stepType: 'dojrzewalnia',  label: 'Dojrzewalnia',                hasTimer: true },
  ],
  twarog: [
    { stepType: 'pasteryzacja',  label: 'Pasteryzacja',                hasTimer: true,  defaultDurationMinutes: 30  },
    { stepType: 'zakwaszanie',   label: 'Zakwaszanie',                 hasTimer: true,  defaultDurationMinutes: 720 },
    { stepType: 'krojenie',      label: 'Krojenie i odciskanie',       hasTimer: false },
  ],
  jogurt: [
    { stepType: 'pasteryzacja',  label: 'Pasteryzacja',                hasTimer: true,  defaultDurationMinutes: 30  },
    { stepType: 'inkubacja',     label: 'Inkubacja (42°C)',            hasTimer: true,  defaultDurationMinutes: 480 },
  ],
  kefir: [
    { stepType: 'pasteryzacja',  label: 'Pasteryzacja',                hasTimer: true,  defaultDurationMinutes: 30  },
    { stepType: 'fermentacja',   label: 'Fermentacja ziarnami kefiru', hasTimer: true,  defaultDurationMinutes: 1440 },
  ],
  smietana: [
    { stepType: 'odwirowanie',   label: 'Odwirowanie śmietanki',       hasTimer: false },
    { stepType: 'pasteryzacja',  label: 'Pasteryzacja śmietanki',      hasTimer: true,  defaultDurationMinutes: 15  },
  ],
  maslo: [
    { stepType: 'ubijanie',      label: 'Ubijanie śmietanki',         hasTimer: true,  defaultDurationMinutes: 30  },
    { stepType: 'plukanie',      label: 'Płukanie i formowanie',       hasTimer: false },
  ],
  rikotta: [
    { stepType: 'podgrzewanie',  label: 'Podgrzewanie serwatki',       hasTimer: true,  defaultDurationMinutes: 20  },
    { stepType: 'odciskanie',    label: 'Odciskanie',                  hasTimer: true,  defaultDurationMinutes: 30  },
  ],
  mleko_surowe: [],
  zwierzeta:    [],
};

export const STATUS_LABELS: Record<BatchStatus, string> = {
  w_produkcji: 'W produkcji',
  dojrzewa:    'Dojrzewa',
  gotowy:      'Gotowy',
  sprzedany:   'Sprzedany',
  wycofany:    'Wycofany',
};

export const STATUS_COLORS: Record<BatchStatus, string> = {
  w_produkcji: 'bg-blue-100 text-blue-700',
  dojrzewa:    'bg-amber-100 text-amber-700',
  gotowy:      'bg-green-100 text-green-700',
  sprzedany:   'bg-gray-100 text-gray-500',
  wycofany:    'bg-red-100 text-red-600',
};
