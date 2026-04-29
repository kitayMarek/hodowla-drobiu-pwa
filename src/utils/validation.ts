import { z } from 'zod';
import { ACTIVE_SPECIES } from '@/constants/species';

// Wymagana data ISO (YYYY-MM-DD)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (YYYY-MM-DD)');

// Opcjonalna data – pusty string DOM (type="date") traktujemy jako brak wartości
const isoDateOptional = z
  .string()
  .optional()
  .transform(v => (v === '' ? undefined : v))
  .pipe(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Nieprawidłowy format daty (YYYY-MM-DD)').optional()
  );

const positiveNum = z.coerce.number().min(0, 'Wartość nie może być ujemna');
const positiveInt = z.coerce.number().int().min(0, 'Wartość musi być nieujemną liczbą całkowitą');

export const batchSchema = z.object({
  name: z.string().min(3, 'Nazwa musi mieć minimum 3 znaki'),
  species: z.enum(['brojler', 'nioska', 'kaczka', 'indyk', 'ges']),
  breed: z.string().optional(),
  status: z.enum(['active', 'completed', 'sold', 'archived']),
  startDate: isoDate,
  plannedEndDate: isoDateOptional,
  initialCount: z.coerce.number().int().min(1, 'Minimum 1 ptak'),
  initialWeightGrams: positiveNum.optional(),
  sourceType: z.enum(['zakupione', 'wlasny_wyleg']),
  chick_cost_per_unit: positiveNum.optional(),
  transport_cost: positiveNum.optional(),
  housingId: z.string().optional(),
  notes: z.string().optional(),
});

export const dailyEntrySchema = z.object({
  date: isoDate,
  deadCount: positiveInt,
  culledCount: positiveInt,
  feedConsumedKg: positiveNum,
  feedTypeId: z.coerce.number().int().positive().optional(),
  waterLiters: positiveNum.optional(),
  eggsCollected: positiveInt.optional(),
  eggsDefective: positiveInt.optional(),
  sampleWeightGrams: positiveNum.optional(),
  sampleSize: positiveInt.optional(),
  temperatureCelsius: z.coerce.number().min(-10).max(60).optional(),
  humidity: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
}).refine(
  d => !d.eggsDefective || (d.eggsCollected != null && d.eggsDefective <= d.eggsCollected),
  { message: 'Jaja wadliwe nie mogą przekraczać zebranych', path: ['eggsDefective'] }
);

export const feedTypeSchema = z.object({
  name: z.string().min(2, 'Minimum 2 znaki'),
  phase: z.enum(['starter', 'grower', 'finisher', 'layer', 'own_mix']),
  manufacturer: z.string().optional(),
  proteinPercent: positiveNum.optional(),
  energyMjKg: positiveNum.optional(),
  pricePerKg: z.coerce.number().min(0.01, 'Cena musi być większa od 0'),
  isActive: z.boolean(),
  recipeNotes: z.string().optional(),
  notes: z.string().optional(),
});

export const weighingSchema = z.object({
  weighingDate: isoDate,
  ageAtWeighingDays: z.coerce.number().int().min(0),
  method: z.enum(['sample', 'full_flock']),
  sampleSize: positiveInt.optional(),
  averageWeightGrams: z.coerce.number().min(1, 'Masa musi być większa od 0'),
  minWeightGrams: positiveNum.optional(),
  maxWeightGrams: positiveNum.optional(),
  coefficientOfVariation: positiveNum.optional(),
  notes: z.string().optional(),
});

export const healthEventSchema = z.object({
  eventDate: isoDate,
  eventType: z.enum(['choroba', 'szczepienie', 'leczenie', 'obserwacja', 'profilaktyka']),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  medicationName: z.string().optional(),
  dosageMgPerKg: positiveNum.optional(),
  durationDays: positiveInt.optional(),
  withdrawalPeriodDays: positiveInt.optional(),
  affectedCount: positiveInt.optional(),
  costPln: positiveNum.optional(),
  veterinarianName: z.string().optional(),
  notes: z.string().optional(),
});

export const slaughterSchema = z.object({
  slaughterDate: isoDate,
  ageAtSlaughterDays: positiveInt.optional(),
  birdsSlaughtered: z.coerce.number().int().min(1),
  liveWeightTotalKg: z.coerce.number().min(0.1),
  carcassWeightTotalKg: z.coerce.number().min(0.1),
  condemnedCount: positiveInt.optional(),
  condemnedWeightKg: positiveNum.optional(),
  slaughterHouseId: z.string().optional(),
  pricePerKgPln: positiveNum.optional(),
  totalRevenuePln: positiveNum.optional(),
  notes: z.string().optional(),
});

export const saleSchema = z.object({
  saleDate: isoDate,
  saleType: z.enum(['jaja', 'ptaki_zywe', 'tuszki', 'elementy']),
  batchId: z.coerce.number().int().positive('Wybierz stado'),
  eggsCount: positiveInt.optional(),
  eggPricePln: positiveNum.optional(),
  birdCount: positiveInt.optional(),
  weightKg: positiveNum.optional(),
  pricePerKgPln: positiveNum.optional(),
  totalRevenuePln: z.coerce.number().min(0.01, 'Wartość sprzedaży musi być większa od 0'),
  buyerName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  expenseDate: isoDate,
  category: z.enum(['piskleta', 'pasza', 'leki', 'weterynarz', 'energia', 'praca', 'transport', 'sciolka', 'inne']),
  description: z.string().min(2, 'Opis wymagany'),
  amountPln: z.coerce.number().min(0.01, 'Kwota musi być większa od 0'),
  invoiceNumber: z.string().optional(),
  supplierName: z.string().optional(),
  notes: z.string().optional(),
});

export const feedDeliverySchema = z.object({
  deliveryDate: isoDate,
  feedTypeId: z.coerce.number().int().positive('Wybierz rodzaj paszy'),
  quantityKg: z.coerce.number().min(0.1, 'Ilość musi być większa od 0'),
  totalCostPln: z.coerce.number().min(0, 'Kwota nie może być ujemna'),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const investmentSchema = z.object({
  purchaseDate: isoDate,
  category: z.enum(['budynek', 'maszyna', 'wyposazenie', 'instalacja', 'pojazd', 'grunty', 'inne_st']),
  name: z.string().min(3, 'Nazwa musi mieć minimum 3 znaki'),
  amountPln: z.coerce.number().min(0.01, 'Kwota musi być większa od 0'),
  usefulLifeYears: z.coerce.number().int().min(1).max(99).optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v) || undefined),
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const eggPurchaseSchema = z.object({
  purchaseDate: isoDate,
  count: z.coerce.number().int().min(1, 'Minimalna ilość to 1 jajko'),
  pricePerEgg: positiveNum.optional(),
  totalCostPln: positiveNum,
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const eggHatchTransferSchema = z.object({
  transferDate: isoDate,
  count: z.coerce.number().int().min(1, 'Minimalna ilość to 1 jajko'),
  sourceBatchId: z.coerce.number().int().positive().optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v) || undefined),
  pricePerEgg: positiveNum.optional(),
  totalRevenuePln: positiveNum.optional(),
  notes: z.string().optional(),
});

export const orderSchema = z.object({
  batchId:           z.coerce.number().int().positive('Wybierz stado'),
  orderType:         z.enum(['jaja', 'ptaki_zywe', 'tuszki']),
  plannedDate:       isoDate,
  quantity:          positiveInt.optional(),
  weightKg:          positiveNum.optional(),
  pricePerUnit:      positiveNum.optional(),
  estimatedPricePln: z.coerce.number().min(0.01, 'Podaj szacunkową wartość zamówienia'),
  buyerName:         z.string().optional(),
  phone:             z.string().optional(),
  notes:             z.string().optional(),
});

export type BatchFormValues = z.infer<typeof batchSchema>;
export type DailyEntryFormValues = z.infer<typeof dailyEntrySchema>;
export type FeedTypeFormValues = z.infer<typeof feedTypeSchema>;
export type WeighingFormValues = z.infer<typeof weighingSchema>;
export type HealthEventFormValues = z.infer<typeof healthEventSchema>;
export type SlaughterFormValues = z.infer<typeof slaughterSchema>;
export type SaleFormValues = z.infer<typeof saleSchema>;
export type ExpenseFormValues = z.infer<typeof expenseSchema>;
export type FeedDeliveryFormValues = z.infer<typeof feedDeliverySchema>;
export type InvestmentFormValues = z.infer<typeof investmentSchema>;
export type EggPurchaseFormValues = z.infer<typeof eggPurchaseSchema>;
export type EggHatchTransferFormValues = z.infer<typeof eggHatchTransferSchema>;
export type OrderFormValues = z.infer<typeof orderSchema>;
