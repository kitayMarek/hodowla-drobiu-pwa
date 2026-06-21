/**
 * Konsument wspólnego kontraktu przepisów (BRIEF #3) — pobiera na żywo `index.json`
 * z mojaserowarnia.pl. CORS po stronie serowarni jest włączony (`Access-Control-Allow-Origin: *`),
 * więc działa to wprost z przeglądarki Fermly.
 *
 * Kontrakt pól: `@/models/recipe.schema` (wersjaSchematu 2). Faza 3a = kroki opisowe
 * (pola liczbowe bywają null); faza 3b dopełni `temperaturaC/czasMin/pH/warunekKonca`.
 */
import type { Recipe, StepTemp } from '@/models/recipe.schema';
import type { DairyProductType, ProductionStep } from '@/models/dairy.model';

const INDEX_URL = 'https://mojaserowarnia.pl/przepisy/index.json';
const TTL_MS = 1000 * 60 * 30; // 30 min — przepisy zmieniają się rzadko

/** Górna koperta pliku index.json (recepty pod kluczem `przepisy`). */
interface RecipeIndex {
  wersjaSchematu?: number;
  zrodlo?: string;
  wygenerowano?: string;
  faza?: string;
  przepisy?: Recipe[];
}

let cache: { at: number; data: Recipe[] } | null = null;

/** Pobierz wszystkie przepisy z serowarni (z prostym cache w pamięci). */
export async function fetchRecipes(force = false): Promise<Recipe[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const res = await fetch(INDEX_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nie udało się pobrać przepisów z serowarni (HTTP ${res.status})`);
  const json = (await res.json()) as RecipeIndex;
  const list = Array.isArray(json?.przepisy) ? json.przepisy : [];
  cache = { at: Date.now(), data: list };
  return list;
}

/** Jeden przepis po slug-u (= `cheeseVariety` partii). */
export async function fetchRecipeBySlug(slug: string): Promise<Recipe | null> {
  const list = await fetchRecipes();
  return list.find(r => r.slug === slug) ?? null;
}

/**
 * Mapuje „rodzinę" sera z serowarni na kategorię technologiczną Fermly.
 * Serowarnia podała: dojrzewające → ser_dojrzewajacy; serwatkowy → rikotta;
 * śmietankowy → smietana; świeże/solankowe (mozzarella, feta, halloumi) — brak
 * idealnej kategorii u nas → najbliżej `twarog`.
 */
export function productTypeFromRodzina(rodzina: string): DairyProductType {
  const r = (rodzina || '').toLowerCase();
  if (r.includes('serwatk') || r.includes('rikotta') || r.includes('ricotta')) return 'rikotta';
  if (r.includes('śmietank') || r.includes('smietank') || r.includes('mascarpone')) return 'smietana';
  if (r.includes('dojrzewa')) return 'ser_dojrzewajacy';
  return 'twarog'; // świeże / solankowe i reszta
}

/** Przepisy pasujące do danej kategorii produkcyjnej (do selektora odmiany sera). */
export function recipesForProductType(recipes: Recipe[], pt: DairyProductType): Recipe[] {
  return recipes.filter(r => productTypeFromRodzina(r.rodzina) === pt);
}

/** Reprezentatywna liczba temperatury (do chipa); zakres→max, rampa→to. */
export function tempToNumber(t: StepTemp | null | undefined): number | undefined {
  if (t == null) return undefined;
  if (typeof t === 'number') return t;
  if ('rampMin' in t) return t.to;
  return t.max;
}

/** Czytelny opis temperatury (zachowuje zakres/rampę). */
export function tempToText(t: StepTemp | null | undefined): string | null {
  if (t == null) return null;
  if (typeof t === 'number') return `${t}°C`;
  if ('rampMin' in t) return `${t.from}→${t.to}°C w ${t.rampMin} min`;
  return `${t.min}–${t.max}°C`;
}

type NewStep = Omit<ProductionStep, 'id' | 'batchId'>;

/**
 * Buduje kroki produkcji (`ProductionStep`) z przepisu: kroki przepisu + solenie
 * + dojrzewanie jako osobne etapy. Liczby z fazy 3b lądują w `durationMinutes`/
 * `temperatureC`; tekst i warunek końca w `description`/`hint`/`endCondition`.
 */
export function buildStepsFromRecipe(recipe: Recipe): NewStep[] {
  const steps: NewStep[] = recipe.kroki.map((k, i) => {
    const tText = (typeof k.temperaturaC === 'object') ? tempToText(k.temperaturaC) : null;
    const dodatki = k.dodatki?.length ? `Dodatki: ${k.dodatki.map(d => `${d.co} (${d.dawka})`).join(', ')}` : '';
    const desc = [k.opis, tText ? `Temperatura: ${tText}` : '', dodatki].filter(Boolean).join('\n');
    return {
      stepType: 'przepis',
      label: k.nazwa,
      sortOrder: i,
      durationMinutes: k.czasMin ?? undefined,
      temperatureC: tempToNumber(k.temperaturaC),
      description: desc || undefined,
      hint: k.wskazowka ?? undefined,
      endCondition: k.warunekKonca ?? undefined,
    };
  });

  // Bloki solenie/dojrzewanie doklejaj TYLKO gdy przepis nie ma ich już wśród kroków
  // (serowarnia trzyma je i jako kroki, i jako bloki — bez tego powstawał duplikat i zła kolejność).
  const hasSolStep = recipe.kroki.some(k => /solen|solank/i.test(k.nazwa));
  const hasDojStep = recipe.kroki.some(k => /dojrzewa/i.test(k.nazwa));

  let order = steps.length;
  if (recipe.solenie && !hasSolStep) {
    const s = recipe.solenie;
    const desc = [
      s.typ === 'solanka' ? 'Solanka' : 'Solenie w masie',
      s.stezenieProc != null ? `stężenie ${s.stezenieProc}%` : '',
      s.czasH != null ? `czas ${s.czasH} h` : '',
    ].filter(Boolean).join(' · ');
    steps.push({
      stepType: 'solenie', label: 'Solenie', sortOrder: order++,
      durationMinutes: s.czasH != null ? Math.round(s.czasH * 60) : undefined,
      temperatureC: s.temperaturaC ?? undefined,
      description: desc || undefined,
    });
  }
  if (recipe.dojrzewanie && !hasDojStep) {
    const d = recipe.dojrzewanie;
    const desc = [
      `${d.dni} dni`,
      d.temperaturaC != null ? `${d.temperaturaC}°C` : '',
      d.wilgotnoscProc != null ? `wilgotność ${d.wilgotnoscProc}%` : '',
    ].filter(Boolean).join(' · ');
    steps.push({
      stepType: 'dojrzewalnia', label: 'Dojrzewanie', sortOrder: order++,
      durationMinutes: d.dni != null ? d.dni * 24 * 60 : undefined,
      temperatureC: d.temperaturaC ?? undefined,
      description: desc || undefined,
      hint: d.pielegnacja ?? undefined,
    });
  }

  return steps;
}
