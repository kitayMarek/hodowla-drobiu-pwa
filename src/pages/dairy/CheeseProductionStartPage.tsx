import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { DairyProductType } from '@/models/dairy.model';
import { PRODUCT_ICONS, PRODUCT_LABELS, YIELD_FACTORS } from '@/models/dairy.model';
import { fetchRecipes, recipesForProductType, productTypeFromRodzina } from '@/services/recipeContract.service';
import type { Recipe } from '@/models/recipe.schema';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/** Typy produkcyjne, dla których warto warzyć „wprost" (bez rozlewu mleka). */
const TYPES: DairyProductType[] = ['ser_dojrzewajacy', 'twarog', 'jogurt', 'kefir', 'smietana', 'maslo', 'rikotta'];

/**
 * Drugie wejście w produkcję: warzenie sera BEZ przyjęcia/rozlewu mleka.
 * Wybierasz typ + odmianę (z serowarni) → tworzy partię i ląduje na jej karcie.
 */
export function CheeseProductionStartPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [searchParams] = useSearchParams();
  const wantedSlug = searchParams.get('ser');   // deep-link z serowarni: „Uwarz ten ser w Fermly"

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [fromSerowarnia, setFromSerowarnia] = useState('');  // nazwa sera, gdy przyszedł z deep-linku
  const [productType, setProductType] = useState<DairyProductType>('ser_dojrzewajacy');
  const [variety, setVariety] = useState('');        // slug
  const [customName, setCustomName] = useState('');
  const [milk, setMilk] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipes().then(list => {
      setRecipes(list);
      // Deep-link „Uwarz ten ser w Fermly" — preselekcja typu + odmiany z przepisu
      if (wantedSlug) {
        const r = list.find(x => x.slug === wantedSlug);
        if (r) {
          setProductType(productTypeFromRodzina(r.rodzina));
          setVariety(r.slug);
          setFromSerowarnia(r.nazwa);
        }
      }
    }).catch(() => { /* offline — działamy bez przepisów */ });
  }, [wantedSlug]);

  const matching = recipesForProductType(recipes, productType);
  const selectedRecipe = matching.find(r => r.slug === variety) ?? null;
  // Nazwa sera: własna > nazwa z przepisu > etykieta kategorii
  const effectiveName = customName.trim() || selectedRecipe?.nazwa || '';

  const milkL = parseFloat(milk);
  const milkValid = milk !== '' && milkL > 0;

  const handleStart = async () => {
    if (!milkValid) { setError('Podaj ilość mleka (większą od 0) — bez mleka nie ma sera.'); return; }
    setSaving(true); setError('');
    try {
      const id = await dairyService.createStandaloneBatch({
        productType,
        cheeseVariety: variety || undefined,
        cheeseName: effectiveName || undefined,
        milkLiters: milkL,
        productionDate: date,
        agingDays: YIELD_FACTORS[productType].agingDays,
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
      <p className="text-sm text-gray-500">
        Zacznij produkcję bez rozlewu mleka — wybierz typ i odmianę, a Fermly przygotuje partię i proces.
      </p>

      {fromSerowarnia && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-brand-800">
          🧀 Z <strong>mojaserowarnia.pl</strong> — masz wybrany ser <strong>{fromSerowarnia}</strong>.
          Uzupełnij ilość mleka i kliknij „Rozpocznij produkcję", a Fermly poprowadzi Cię przez proces.
        </div>
      )}

      <Card padding="md">
        <div className="space-y-3">
          {/* Typ */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Typ produktu</label>
            <select
              value={productType}
              onChange={e => { setProductType(e.target.value as DairyProductType); setVariety(''); }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {TYPES.map(t => <option key={t} value={t}>{PRODUCT_ICONS[t]} {PRODUCT_LABELS[t]}</option>)}
            </select>
          </div>

          {/* Odmiana sera (z serowarni) */}
          {matching.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Odmiana sera <span className="text-gray-300 normal-case font-normal">(przepis z serowarni)</span>
              </label>
              <select
                value={variety}
                onChange={e => setVariety(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— bez przepisu —</option>
                {matching.map(r => <option key={r.slug} value={r.slug}>{r.nazwa}</option>)}
              </select>
              {selectedRecipe && (
                <p className="text-xs text-gray-400 mt-1">
                  Proces zostanie podpięty z przepisu „{selectedRecipe.nazwa}" ({selectedRecipe.kroki.length} kroków).
                </p>
              )}
            </div>
          )}

          {/* Nazwa własna */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Nazwa sera <span className="text-gray-300 normal-case font-normal">(opcjonalnie — np. „Caciotta z orzechami")</span>
            </label>
            <input
              type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder={selectedRecipe?.nazwa || 'Twoja nazwa…'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Mleko + data */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Mleko (L) <span className="text-red-400 normal-case font-normal">wymagane</span>
              </label>
              <input
                type="number" step="0.5" min="0" value={milk} onChange={e => setMilk(e.target.value)}
                placeholder="np. 10"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">⚠ {error}</div>
      )}

      <Button className="w-full" loading={saving} disabled={!milkValid} onClick={handleStart}>
        Rozpocznij produkcję{effectiveName ? `: ${effectiveName}` : ''} →
      </Button>
    </div>
  );
}
