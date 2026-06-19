/**
 * Konsument wspólnego kontraktu przepisów (BRIEF #3) — pobiera na żywo `index.json`
 * z mojaserowarnia.pl. CORS po stronie serowarni jest włączony (`Access-Control-Allow-Origin: *`),
 * więc działa to wprost z przeglądarki Fermly.
 *
 * Kontrakt pól: `@/models/recipe.schema` (wersjaSchematu 2). Faza 3a = kroki opisowe
 * (pola liczbowe bywają null); faza 3b dopełni `temperaturaC/czasMin/pH/warunekKonca`.
 */
import type { Recipe } from '@/models/recipe.schema';

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

/** Jeden przepis po slug-u (= `cheeseVariety` w przyszłej przebudowie). */
export async function fetchRecipeBySlug(slug: string): Promise<Recipe | null> {
  const list = await fetchRecipes();
  return list.find(r => r.slug === slug) ?? null;
}
