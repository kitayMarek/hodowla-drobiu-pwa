import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { DairyProductType } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS, YIELD_FACTORS } from '@/models/dairy.model';
import { fetchRecipes, productTypeFromRodzina } from '@/services/recipeContract.service';
import type { Recipe } from '@/models/recipe.schema';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Produkty mleczne bez przepisu serowarni (osobna ścieżka — twaróg ≠ ser z listy). */
const OTHER_PRODUCTS: DairyProductType[] = ['twarog', 'jogurt', 'kefir', 'smietana', 'maslo'];

type Facet = { key: string; label: string };
const MLEKO: Facet[] = [{ key: 'krowie', label: 'Krowie' }, { key: 'kozie', label: 'Kozie' }, { key: 'owcze', label: 'Owcze' }];
const RODZAJ: Facet[] = [
  { key: 'miekki', label: 'Miękki' }, { key: 'twardy', label: 'Twardy' },
  { key: 'plesniowy', label: 'Pleśniowy' }, { key: 'swiezy', label: 'Świeży' }, { key: 'inne', label: 'Inne' },
];
const TRUDNOSC: Facet[] = [{ key: 'latwy', label: 'Łatwy' }, { key: 'sredni', label: 'Średni' }, { key: 'zaawansowany', label: 'Zaawansowany' }];

const SEL_CLS: Record<string, string> = {
  mleko:   'bg-blue-50 text-blue-700 border-blue-300',
  rodzaj:  'bg-green-50 text-green-700 border-green-300',
  trud:    'bg-amber-50 text-amber-700 border-amber-300',
};
const labelOf = (facets: Facet[], key: string) => facets.find(f => f.key === key)?.label ?? key;

function milksOf(r: Recipe): string[] {
  return r.mleko.typy ?? (r.mleko.typ ? [r.mleko.typ] : []);
}

/**
 * Warzenie sera BEZ rozlewu mleka — wybór sera przez FASETY (mleko / rodzaj / trudność,
 * OR w grupie, AND między grupami) albo inny produkt mleczny. Obsługuje deep-link `?ser=<slug>`.
 */
export function CheeseProductionStartPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [searchParams] = useSearchParams();
  const wantedSlug = searchParams.get('ser');

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [milkSel, setMilkSel] = useState<Set<string>>(new Set());
  const [katSel, setKatSel] = useState<Set<string>>(new Set());
  const [trudSel, setTrudSel] = useState<Set<string>>(new Set());
  const [selectedSlug, setSelectedSlug] = useState('');
  const [otherProduct, setOtherProduct] = useState<DairyProductType | ''>('');
  const [fromSerowarnia, setFromSerowarnia] = useState('');
  const [customName, setCustomName] = useState('');
  const [milk, setMilk] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipes().then(list => {
      setRecipes(list);
      if (wantedSlug) {
        const r = list.find(x => x.slug === wantedSlug);
        if (r) { setSelectedSlug(r.slug); setFromSerowarnia(r.nazwa); }
      }
    }).catch(() => { /* offline — bez przepisów */ });
  }, [wantedSlug]);

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setFn(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const clearAll = () => { setMilkSel(new Set()); setKatSel(new Set()); setTrudSel(new Set()); };
  const anyFilter = milkSel.size + katSel.size + trudSel.size > 0;

  const filtered = recipes.filter(r =>
    (milkSel.size === 0 || milksOf(r).some(t => milkSel.has(t))) &&
    (katSel.size === 0 || (r.kategoria != null && katSel.has(r.kategoria))) &&
    (trudSel.size === 0 || (r.trudnosc != null && trudSel.has(r.trudnosc)))
  );

  const selectedRecipe = recipes.find(r => r.slug === selectedSlug) ?? null;
  const effectiveName = customName.trim() || selectedRecipe?.nazwa || (otherProduct ? PRODUCT_LABELS[otherProduct] : '');

  const milkL = parseFloat(milk);
  const milkValid = milk !== '' && milkL > 0;
  const canStart = milkValid && (!!selectedSlug || !!otherProduct);

  const pickCheese = (slug: string) => { setSelectedSlug(slug); setOtherProduct(''); setError(''); };
  const pickOther = (pt: DairyProductType | '') => { setOtherProduct(pt); if (pt) setSelectedSlug(''); };

  const handleStart = async () => {
    const pt = otherProduct || (selectedRecipe ? productTypeFromRodzina(selectedRecipe.rodzina) : null);
    if (!pt) { setError('Wybierz ser z listy albo inny produkt mleczny.'); return; }
    if (!milkValid) { setError('Podaj ilość mleka (większą od 0) — bez mleka nie ma sera.'); return; }
    setSaving(true); setError('');
    try {
      const id = await dairyService.createStandaloneBatch({
        productType: pt,
        cheeseVariety: otherProduct ? undefined : (selectedSlug || undefined),
        cheeseName: effectiveName || undefined,
        milkLiters: milkL,
        productionDate: date,
        agingDays: YIELD_FACTORS[pt].agingDays,
      });
      navigate(`/mleko/partie/${id}/produkcja`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd tworzenia partii');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">🧀 Warzenie sera</h1>
      </div>

      {fromSerowarnia ? (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-800">
          🧀 Z <strong>mojaserowarnia.pl</strong> — masz wybrany ser <strong>{fromSerowarnia}</strong>.
          Uzupełnij ilość mleka i kliknij „Rozpocznij produkcję".
        </div>
      ) : (
        <p className="text-sm text-gray-500">Wybierz ser filtrami albo z listy, podaj ilość mleka — Fermly przygotuje partię i proces.</p>
      )}

      {/* Filtry fasetowe */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filtruj sery</p>
          {anyFilter && (
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-700">✕ Wyczyść</button>
          )}
        </div>

        <div className="space-y-3">
          <div><p className="text-xs text-gray-400 mb-1.5">🥛 Mleko</p><Pill group="mleko" set={milkSel} facets={MLEKO} onToggle={k => toggle(setMilkSel, k)} /></div>
          <div><p className="text-xs text-gray-400 mb-1.5">🧀 Rodzaj</p><Pill group="rodzaj" set={katSel} facets={RODZAJ} onToggle={k => toggle(setKatSel, k)} /></div>
          <div><p className="text-xs text-gray-400 mb-1.5">⭐ Trudność</p><Pill group="trud" set={trudSel} facets={TRUDNOSC} onToggle={k => toggle(setTrudSel, k)} /></div>
        </div>

        {/* Pasek „Wybrane" */}
        {anyFilter && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">Wybrane:</span>
            {[...milkSel].map(k => <Chip key={'m' + k} cls="bg-blue-50 text-blue-700" label={labelOf(MLEKO, k)} onX={() => toggle(setMilkSel, k)} />)}
            {[...katSel].map(k => <Chip key={'k' + k} cls="bg-green-50 text-green-700" label={labelOf(RODZAJ, k)} onX={() => toggle(setKatSel, k)} />)}
            {[...trudSel].map(k => <Chip key={'t' + k} cls="bg-amber-50 text-amber-700" label={labelOf(TRUDNOSC, k)} onX={() => toggle(setTrudSel, k)} />)}
          </div>
        )}
      </Card>

      {/* Lista serów (wynik filtra) */}
      <div>
        <p className="text-sm text-gray-500 mb-2">
          Pasuje: <strong className="text-gray-800">{filtered.length}</strong> {filtered.length === 1 ? 'ser' : 'serów'}
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Brak serów dla tych filtrów — poszerz wybór.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(r => {
              const on = r.slug === selectedSlug;
              return (
                <button key={r.slug} onClick={() => pickCheese(r.slug)}
                  className={`text-left p-3 rounded-xl border transition-all ${on ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300' : 'border-gray-100 bg-white hover:border-brand-200'}`}>
                  <div className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                    {on && <span className="text-brand-600">✓</span>}{r.nazwa}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {[r.kategoria, milksOf(r).join('/'), r.trudnosc].filter(Boolean).join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Inny produkt (bez przepisu) */}
      <details className="rounded-xl border border-gray-100 px-4 py-2">
        <summary className="text-sm text-gray-500 cursor-pointer">lub zacznij inny produkt mleczny (twaróg, jogurt…)</summary>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {OTHER_PRODUCTS.map(pt => (
            <button key={pt} onClick={() => pickOther(otherProduct === pt ? '' : pt)}
              className={`text-xs px-2 py-2 rounded-lg border transition-colors ${otherProduct === pt ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {PRODUCT_ICONS[pt]} {PRODUCT_LABELS[pt]}
            </button>
          ))}
        </div>
      </details>

      {/* Nazwa / mleko / data */}
      <Card padding="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Nazwa <span className="text-gray-300 normal-case font-normal">(opcjonalnie — np. „Caciotta z orzechami")</span>
            </label>
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder={effectiveName || 'Twoja nazwa…'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Mleko (L) <span className="text-red-400 normal-case font-normal">wymagane</span>
              </label>
              <input type="number" step="0.5" min="0" value={milk} onChange={e => setMilk(e.target.value)} placeholder="np. 10"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>
      </Card>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠ {error}</div>}

      <Button className="w-full" loading={saving} disabled={!canStart} onClick={handleStart}>
        Rozpocznij produkcję{effectiveName ? `: ${effectiveName}` : ''} →
      </Button>
    </div>
  );
}

function Pill({ group, set, facets, onToggle }: { group: string; set: Set<string>; facets: Facet[]; onToggle: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {facets.map(f => {
        const on = set.has(f.key);
        return (
          <button key={f.key} onClick={() => onToggle(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${on ? SEL_CLS[group] : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {on && '✓ '}{f.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ cls, label, onX }: { cls: string; label: string; onX: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      {label}
      <button onClick={onX} className="hover:opacity-70" aria-label={`Usuń ${label}`}>✕</button>
    </span>
  );
}
