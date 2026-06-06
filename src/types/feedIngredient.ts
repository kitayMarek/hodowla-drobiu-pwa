export type BirdType =
  | 'kury-nioski-lekkie'
  | 'kury-nioski-ciezkie'
  | 'brojlery'
  | 'kaczki'
  | 'gesi'
  | 'indyki';

export type IngredientCategory =
  | 'zboża'
  | 'produkty_zbożowe'
  | 'białkowe_roślinne'
  | 'białkowe_zwierzęce'
  | 'tłuszczowe'
  | 'mineralne'
  | 'zielonki_susze'
  | 'okopowe'
  | 'aminokwasy_syntetyczne'
  | 'premiksy'
  | 'inne';

export interface FeedIngredient {
  id: string;
  name: string;
  category: IngredientCategory | null;
  is_active: boolean;
  notes: string | null;
  recommended_for: BirdType[];

  // Udział w mieszance
  udzial_optymalny_pct: string | null;
  udzial_max_pct: number | null;

  // Skład podstawowy (%)
  sucha_masa_pct: number | null;
  bialko_ogolne_pct: number | null;
  tluszcz_surowy_pct: number | null;
  zwiazki_bezazotowe_pct: number | null;
  wlokno_surowe_pct: number | null;
  popiol_pct: number | null;
  skrobia_pct: number | null;
  cukier_pct: number | null;

  // Energia
  energia_kcal: number | null;
  energia_mj: number | null;

  // Cena
  cena_zl_100kg: number | null;

  // Minerały
  ca_pct: number | null;
  p_total_pct: number | null;
  p_przyswajalne_pct: number | null;
  mg_pct: number | null;
  k_pct: number | null;
  na_pct: number | null;
  cl_pct: number | null;
  s_pct: number | null;
  fe_mg: number | null;
  mn_mg: number | null;
  zn_mg: number | null;
  cu_mg: number | null;
  co_mcg: number | null;
  i_mg: number | null;
  se_mg: number | null;

  // Witaminy
  vit_a_jm: number | null;
  vit_d3: number | null;
  vit_e_mg: number | null;
  vit_b1_mg: number | null;
  vit_b2_mg: number | null;
  vit_b6_mg: number | null;
  kwas_pantotenowy_mg: number | null;
  kwas_foliowy_mg: number | null;
  biotyna_mg: number | null;
  niacyna_mg: number | null;
  vit_b12_mcg: number | null;
  cholina_g: number | null;
  kwas_linolowy_g: number | null;

  // Aminokwasy
  aa_lys: number | null;
  aa_met: number | null;
  aa_met_cys: number | null;
  aa_trp: number | null;
  aa_thr: number | null;
  aa_ile: number | null;
  aa_leu: number | null;
  aa_val: number | null;
  aa_his: number | null;
  aa_arg: number | null;
  aa_phe: number | null;
  aa_tyr: number | null;

  source: string;
  created_at: string;
  updated_at: string;
}

export type FeedIngredientInsert = Omit<FeedIngredient, 'id' | 'created_at' | 'updated_at'>;
export type FeedIngredientUpdate = Partial<FeedIngredientInsert>;

export const BIRD_TYPE_LABELS: Record<BirdType, string> = {
  'kury-nioski-lekkie': 'Nioski lekkie',
  'kury-nioski-ciezkie': 'Nioski ciężkie',
  'brojlery': 'Brojlery',
  'kaczki': 'Kaczki',
  'gesi': 'Gęsi',
  'indyki': 'Indyki',
};

export const BIRD_TYPE_COLORS: Record<BirdType, string> = {
  'kury-nioski-lekkie': 'bg-yellow-100 text-yellow-800',
  'kury-nioski-ciezkie': 'bg-orange-100 text-orange-800',
  'brojlery': 'bg-red-100 text-red-800',
  'kaczki': 'bg-blue-100 text-blue-800',
  'gesi': 'bg-green-100 text-green-800',
  'indyki': 'bg-purple-100 text-purple-800',
};

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  'zboża': 'Zboża i nasiona',
  'produkty_zbożowe': 'Produkty zbożowe',
  'białkowe_roślinne': 'Białkowe roślinne',
  'białkowe_zwierzęce': 'Białkowe zwierzęce',
  'tłuszczowe': 'Tłuszczowe',
  'mineralne': 'Mineralne',
  'zielonki_susze': 'Zielonki i susze',
  'okopowe': 'Okopowe',
  'aminokwasy_syntetyczne': 'Aminokwasy syntetyczne',
  'premiksy': 'Premiksy i koncentraty',
  'inne': 'Inne',
};

export const ALL_BIRD_TYPES: BirdType[] = [
  'kury-nioski-lekkie',
  'kury-nioski-ciezkie',
  'brojlery',
  'kaczki',
  'gesi',
  'indyki',
];

export const ALL_CATEGORIES: IngredientCategory[] = [
  'zboża',
  'produkty_zbożowe',
  'białkowe_roślinne',
  'białkowe_zwierzęce',
  'tłuszczowe',
  'mineralne',
  'zielonki_susze',
  'okopowe',
  'aminokwasy_syntetyczne',
  'premiksy',
  'inne',
];
