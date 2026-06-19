import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchRecipes } from '@/services/recipeContract.service';
import type { Recipe, RecipeStep, StepTemp } from '@/models/recipe.schema';
import { Card } from '@/components/ui/Card';

/**
 * POC integracji fermly ⇄ mojaserowarnia (BRIEF #3): wybór sera → proces technologiczny
 * pobrany NA ŻYWO z serowarni (`index.json`, CORS). Domyślnie caciotta.
 * Dowodzi pełnej pętli: wspólny kontrakt → Fermly prowadzi produkcję z przepisu.
 */

const DEFAULT_SLUG = 'caciotta';

function fmtTemp(t: StepTemp | null | undefined): string | null {
  if (t == null) return null;
  if (typeof t === 'number') return `${t}°C`;
  if ('rampMin' in t) return `${t.from}→${t.to}°C w ${t.rampMin} min`;
  return `${t.min}–${t.max}°C`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Wydruk przepisu z procedurą i miejscem na ręczne notatki (dla robiących „z kartki"). */
function printRecipe(recipe: Recipe) {
  const meta = [
    `🥛 ${recipe.mleko.litry} L${recipe.mleko.typ ? ` (${recipe.mleko.typ})` : ''}`,
    recipe.wydajnoscKg != null ? `📦 ~${recipe.wydajnoscKg} kg` : '',
    recipe.dojrzewanie?.dni != null ? `⏳ dojrzewanie ${recipe.dojrzewanie.dni} dni` : '',
  ].filter(Boolean).join(' &nbsp;•&nbsp; ');

  const kultury = recipe.kultury?.length
    ? `<p><b>Kultury:</b> ${esc(recipe.kultury.map(k => `${k.co} (${k.dawka})`).join(', '))}</p>` : '';
  const podp = recipe.podpuszczka
    ? `<p><b>Podpuszczka:</b> ${esc(recipe.podpuszczka.dawka)}</p>` : '';

  const stepRows = recipe.kroki.map(s => {
    const t = fmtTemp(s.temperaturaC);
    const chips = [t ? `🌡 ${t}` : '', s.czasMin != null ? `⏱ ${s.czasMin} min` : '',
      s.warunekKonca ? `✓ koniec: ${s.warunekKonca}` : ''].filter(Boolean).map(esc).join(' &nbsp;•&nbsp; ');
    return `<div class="step">
      <div class="step-head"><span class="num">${s.nr}</span><b>${esc(s.nazwa)}</b></div>
      ${s.opis ? `<div class="desc">${esc(s.opis)}</div>` : ''}
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      ${s.wskazowka ? `<div class="hint">💡 ${esc(s.wskazowka)}</div>` : ''}
      <div class="notes"><span>Notatki:</span></div>
    </div>`;
  }).join('');

  const extra = [
    recipe.solenie ? `<p><b>Solenie:</b> ${recipe.solenie.typ === 'solanka' ? 'solanka' : 'w masie'}${
      recipe.solenie.stezenieProc != null ? ` ${recipe.solenie.stezenieProc}%` : ''}${
      recipe.solenie.czasH != null ? `, ${recipe.solenie.czasH} h` : ''}</p>` : '',
    recipe.dojrzewanie ? `<p><b>Dojrzewanie:</b> ${recipe.dojrzewanie.dni} dni${
      recipe.dojrzewanie.temperaturaC != null ? `, ${recipe.dojrzewanie.temperaturaC}°C` : ''}${
      recipe.dojrzewanie.wilgotnoscProc != null ? `, wilgotność ${recipe.dojrzewanie.wilgotnoscProc}%` : ''}${
      recipe.dojrzewanie.pielegnacja ? `. Pielęgnacja: ${esc(recipe.dojrzewanie.pielegnacja)}` : ''}</p>` : '',
  ].filter(Boolean).join('');

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
    <title>${esc(recipe.nazwa)} — przepis</title>
    <style>
      * { box-sizing: border-box; }
      body { font: 13px/1.5 system-ui, sans-serif; color: #1f2937; max-width: 720px; margin: 0 auto; padding: 24px; }
      h1 { font-size: 22px; margin: 0 0 2px; color: #14532d; }
      .rodzina { color: #6b7280; margin: 0 0 8px; }
      .meta { background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 8px; padding: 8px 12px; margin: 8px 0 16px; }
      .step { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin: 8px 0; page-break-inside: avoid; }
      .step-head { display: flex; align-items: center; gap: 8px; }
      .num { display: inline-flex; width: 22px; height: 22px; border-radius: 50%; background: #15803d; color: #fff;
        align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
      .desc { margin: 4px 0; }
      .chips { color: #374151; font-size: 12px; margin: 2px 0; }
      .hint { color: #92400e; font-size: 12px; margin: 3px 0; }
      .notes { border: 1px dashed #cbd5e1; border-radius: 6px; min-height: 46px; margin-top: 6px; padding: 4px 8px; }
      .notes span { color: #9ca3af; font-size: 11px; }
      .src { margin-top: 16px; color: #9ca3af; font-size: 11px; }
      @media print { body { padding: 0; } button { display: none; } }
    </style></head><body>
    <button onclick="window.print()" style="float:right;padding:6px 12px;border:1px solid #15803d;background:#15803d;color:#fff;border-radius:6px;cursor:pointer">🖨 Drukuj</button>
    <h1>${esc(recipe.nazwa)}</h1>
    <p class="rodzina">${esc(recipe.rodzina)}</p>
    <div class="meta">${meta}</div>
    ${kultury}${podp}
    <h3>Proces (${recipe.kroki.length} kroków)</h3>
    ${stepRows}
    ${extra}
    <p class="src">Przepis: mojaserowarnia.pl${recipe.url ? ` — ${esc(recipe.url)}` : ''} · wydruk z Fermly</p>
    </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

function StepCard({ step }: { step: RecipeStep }) {
  const temp = fmtTemp(step.temperaturaC);
  const chips: string[] = [];
  if (temp) chips.push(`🌡 ${temp}`);
  if (step.czasMin != null) chips.push(`⏱ ${step.czasMin} min`);
  if (step.pH != null) chips.push(`pH ${step.pH}`);

  return (
    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
          {step.nr}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{step.nazwa}</p>
          {step.opis && <p className="text-sm text-gray-600 mt-1">{step.opis}</p>}
          {step.wskazowka && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1.5">
              💡 {step.wskazowka}
            </p>
          )}
          {(chips.length > 0 || step.warunekKonca) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.map(c => (
                <span key={c} className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full px-2 py-0.5">{c}</span>
              ))}
              {step.warunekKonca && (
                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  ✓ koniec: {step.warunekKonca}
                </span>
              )}
            </div>
          )}
          {step.dodatki && step.dodatki.length > 0 && (
            <p className="text-xs text-gray-500 mt-1.5">
              ➕ {step.dodatki.map(d => `${d.co} (${d.dawka})`).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  return (
    <div className="space-y-4">
      {/* Nagłówek przepisu */}
      <Card padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">🧀 {recipe.nazwa}</h2>
            <p className="text-sm text-gray-500">{recipe.rodzina}</p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {recipe.url && (
              <a href={recipe.url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-brand-600 hover:text-brand-800 whitespace-nowrap">
                Pełny przepis ↗
              </a>
            )}
            <button onClick={() => printRecipe(recipe)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 whitespace-nowrap">
              🖨 Wydruk z notatkami
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span className="bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-1">
            🥛 {recipe.mleko.litry} L{recipe.mleko.typ ? ` · ${recipe.mleko.typ}` : ''}
          </span>
          {recipe.wydajnoscKg != null && (
            <span className="bg-green-50 text-green-700 border border-green-100 rounded-full px-2.5 py-1">
              📦 ~{recipe.wydajnoscKg} kg
            </span>
          )}
          {recipe.dojrzewanie?.dni != null && (
            <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1">
              ⏳ dojrzewanie {recipe.dojrzewanie.dni} dni
            </span>
          )}
        </div>
      </Card>

      {/* Składniki: kultury + podpuszczka */}
      {(recipe.kultury?.length || recipe.podpuszczka) && (
        <Card title="Składniki" padding="md">
          {recipe.kultury && recipe.kultury.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Kultury</p>
              <ul className="text-sm text-gray-700 space-y-0.5">
                {recipe.kultury.map((k, i) => (
                  <li key={i}>• {k.co} <span className="text-gray-400">— {k.dawka}</span></li>
                ))}
              </ul>
            </div>
          )}
          {recipe.podpuszczka && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Podpuszczka</p>
              <p className="text-sm text-gray-700">{recipe.podpuszczka.dawka}</p>
            </div>
          )}
        </Card>
      )}

      {/* Proces — kroki */}
      <Card title={`Proces technologiczny (${recipe.kroki.length} kroków)`} padding="md">
        <div className="space-y-2">
          {recipe.kroki.map(s => <StepCard key={s.nr} step={s} />)}
        </div>
      </Card>

      {/* Solenie / Dojrzewanie */}
      {recipe.solenie && (
        <Card title="Solenie" padding="md">
          <p className="text-sm text-gray-700">
            {recipe.solenie.typ === 'solanka' ? 'Solanka' : 'Solenie w masie'}
            {recipe.solenie.stezenieProc != null && ` · ${recipe.solenie.stezenieProc}%`}
            {recipe.solenie.czasH != null && ` · ${recipe.solenie.czasH} h`}
            {recipe.solenie.temperaturaC != null && ` · ${recipe.solenie.temperaturaC}°C`}
          </p>
        </Card>
      )}
      {recipe.dojrzewanie && (
        <Card title="Dojrzewanie" padding="md">
          <p className="text-sm text-gray-700">
            {recipe.dojrzewanie.dni} dni
            {recipe.dojrzewanie.temperaturaC != null && ` · ${recipe.dojrzewanie.temperaturaC}°C`}
            {recipe.dojrzewanie.wilgotnoscProc != null && ` · wilgotność ${recipe.dojrzewanie.wilgotnoscProc}%`}
          </p>
          {recipe.dojrzewanie.pielegnacja && (
            <p className="text-sm text-gray-500 mt-1">🧽 {recipe.dojrzewanie.pielegnacja}</p>
          )}
        </Card>
      )}

      {recipe.uwagi && (
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          📝 {recipe.uwagi}
        </div>
      )}
    </div>
  );
}

export function CheeseRecipePage() {
  const [searchParams] = useSearchParams();
  const wanted = searchParams.get('ser') || DEFAULT_SLUG;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [slug, setSlug] = useState(wanted);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipes()
      .then(list => {
        setRecipes(list);
        if (!list.some(r => r.slug === wanted) && list[0]) setSlug(list[0].slug);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Błąd pobierania'));
  }, [wanted]);

  const recipe = recipes?.find(r => r.slug === slug) ?? null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
        <h1 className="text-xl font-bold text-gray-900">📖 Przepisy serów</h1>
      </div>

      <p className="text-sm text-gray-500">
        Proces technologiczny pobierany na żywo z{' '}
        <a href="https://mojaserowarnia.pl" target="_blank" rel="noopener noreferrer"
          className="text-brand-600 hover:text-brand-800">mojaserowarnia.pl</a>.
        Wybierz ser, by zobaczyć jak go zrobić.
      </p>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          ⚠ {error}
        </div>
      )}

      {!recipes && !error && <p className="text-sm text-gray-400">Pobieram przepisy…</p>}

      {recipes && recipes.length > 0 && (
        <>
          <select
            value={slug}
            onChange={e => setSlug(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {recipes.map(r => (
              <option key={r.slug} value={r.slug}>{r.nazwa} — {r.rodzina}</option>
            ))}
          </select>

          {recipe && <RecipeView recipe={recipe} />}
        </>
      )}
    </div>
  );
}
