/**
 * KONTRAKT PRZEPISU — wspólny schemat fermly.pl ⇄ mojaserowarnia.pl (BRIEF #3).
 *
 * Ten sam obiekt płynie w obie strony:
 *  - READ:    serowarnia → Fermly  (Fermly prowadzi produkcję z przepisu)
 *  - PUBLISH: Fermly → serowarnia   (przepis usera po moderacji Marka → publiczny)
 *
 * To jest ŹRÓDŁO PRAWDY nazw pól. Serowarnia wystawia `/przepisy/index.json`
 * zgodnie z tym kształtem; Fermly produkuje go w edytorze „własny przepis".
 * Nazwy pól zaklepane 2026-06-19 (wersjaSchematu = 2). NIE zmieniać bez nowej rundy
 * gołębia (serowarnia ma pod te nazwy ~140 kroków do rozpisania ręcznie — faza 3b).
 *
 * Zgodność z fazami dostawy serowarni:
 *  - FAZA 3a (od ręki): wypełnione pola tekstowe kroku (nr/nazwa/opis/wskazowka),
 *    a pola liczbowe (temperaturaC/czasMin/pH/warunekKonca/dodatki) bywają null.
 *  - FAZA 3b (docelowo): kroki rozbite na liczby → Fermly odpala etapy i timery.
 */

export const RECIPE_SCHEMA_VERSION = 2 as const;

/** Skąd pochodzi przepis. Społeczność trafia do feedu DOPIERO po akceptacji Marka. */
export type RecipeSource = 'serowarnia-kurated' | 'fermly-spolecznosc';

export type MilkKind = 'krowie' | 'owcze' | 'kozie' | 'mieszane';
export type Pasteryzacja = 'brak' | 'lagodna' | 'pelna';

/** Temperatura etapu — stała, zakres albo rampa („podnoś do 38 °C przez 30 min"). */
export type StepTemp =
  | number
  | { min: number; max: number }
  | { from: number; to: number; rampMin: number };

/** Dodatek wprowadzany w danym kroku. `dawka` jest STRINGIEM (np. „wg producenta"). */
export interface RecipeAdditive {
  co: string;        // np. "kultura mezofilna", "podpuszczka", "CaCl2"
  dawka: string;     // celowo string — dawki bywają opisowe, nie liczbowe
}

export interface RecipeStep {
  nr: number;
  nazwa: string;
  opis?: string;             // 3a — pełny tekst etapu
  wskazowka?: string;        // 3a — „co pilnować" w skrócie
  temperaturaC?: StepTemp | null;
  czasMin?: number | null;   // orientacyjny; właściwy warunek → warunekKonca
  warunekKonca?: string | null; // etap kończy się po STANIE: „pH 6,1", „czysty rozłam"
  pH?: number | null;
  dodatki?: RecipeAdditive[];
}

export interface RecipeSalting {
  typ: 'solanka' | 'w masie';
  stezenieProc?: number;
  czasH?: number;
  temperaturaC?: number;
}

export interface RecipeAging {
  dni: number;
  temperaturaC?: number;
  wilgotnoscProc?: number;
  pielegnacja?: string;      // obracanie / mycie / nakłuwanie
  ubytekWagiProc?: number | null; // CAŁKOWITY % ubytku wagi na koniec dojrzewania (serowarnia, BRIEF #5)
}

/**
 * Szacowana waga sera w trakcie dojrzewania (stan magazynu, Etap 4).
 * Krzywa √ wg rekomendacji serowarni — ubytek „mocno z przodu" (wilgoć ucieka
 * najszybciej na początku): waga(t) = wagaPocz × (1 − ubytek/100 × √(t/dni)).
 */
export function estimateAgingWeightKg(
  initialKg: number, ubytekWagiProc: number | null | undefined,
  elapsedDays: number, totalDays: number,
): number {
  if (!ubytekWagiProc || totalDays <= 0) return initialKg;
  const frac = Math.min(1, Math.max(0, elapsedDays / totalDays));
  const loss = (ubytekWagiProc / 100) * Math.sqrt(frac);
  return Math.max(0, initialKg * (1 - loss));
}

export interface Recipe {
  wersjaSchematu: typeof RECIPE_SCHEMA_VERSION;
  slug: string;              // = id z recipesData serowarni (STABILNY); klucz cheeseVariety
  nazwa: string;
  rodzina: string;           // np. „ser dojrzewający (półtwardy)" — 1:1 z 4. kolumną przepisy.summary.txt; mapowane na DairyProductType
  kategoria?: string;        // faseta RODZAJ (serowarnia): "miekki"|"twardy"|"plesniowy"|"swiezy"|"inne"
  trudnosc?: string;         // faseta TRUDNOŚĆ (serowarnia): "latwy"|"sredni"|"zaawansowany"
  url?: string;              // link do pełnej strony HTML przepisu (deep-link); dodane przez serowarnię w index.json
  zrodlo: RecipeSource;
  autor?: string | null;     // wymagane gdy zrodlo = 'fermly-spolecznosc'
  licencja?: string | null;  // jw. — atrybucja przy publikacji u serowarni
  dataZatwierdzenia?: string; // ISO — ustawiana przy zatwierdzeniu; serowarnia użyje jako datePublished/dateModified

  mleko: {
    litry: number;
    typ?: MilkKind;            // wiodące mleko (= typy[0]); zostaje dla zgodności
    typy?: string[];           // faseta MLEKO (serowarnia): wszystkie wykonalne mleka (OR w grupie)
    pasteryzacja?: Pasteryzacja;
  };
  kultury?: RecipeAdditive[];     // denormalizacja — napędza podpowiedź z bazy kultur serowarni
  podpuszczka?: {
    typ: string;
    dawka: string;                // string (jak RecipeAdditive.dawka)
    czasKrzepnieciaMin?: number;
  } | null;

  kroki: RecipeStep[];
  solenie?: RecipeSalting | null; // osobny blok, NIE krok
  dojrzewanie?: RecipeAging | null;

  wydajnoscKg?: number;
  uwagi?: string;
}

/**
 * Status przepisu usera w Fermly. Domyślnie PRYWATNY — `zrodlo:'fermly-spolecznosc'`
 * pojawia się w publicznym feedzie (fermly.pl/przepisy-spolecznosci.json) DOPIERO
 * po `zatwierdzony` przez Marka. Bramka jakości/SEO serowarni opiera się na tym stanie.
 */
export type UserRecipeStatus = 'prywatny' | 'zgloszony' | 'zatwierdzony' | 'odrzucony';
export const DEFAULT_USER_RECIPE_STATUS: UserRecipeStatus = 'prywatny';

/** Własny przepis usera, zapisany lokalnie z faktycznego przebiegu produkcji (Etap 3 L2). */
export interface UserRecipe {
  id?: number;
  slug: string;             // np. "user-1718800000000"
  status: UserRecipeStatus; // domyślnie 'prywatny'
  recipe: Recipe;           // pełny obiekt (zrodlo: 'fermly-spolecznosc')
  batchId?: number;         // partia, z której powstał
  createdAt: string;
}
