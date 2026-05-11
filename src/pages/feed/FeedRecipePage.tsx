import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { feedRecipeService } from '@/services/feedRecipe.service';
import { feedService } from '@/services/feed.service';
import { NORMY_DROBIU, TYPY_DROBIU, SKLADNIKI_BAZA, type SkladnikPaszowy } from '@/data/poultryFeedData';
import type { FeedRecipe, RecipeIngredient } from '@/models/feedRecipe.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_INGREDIENT = (): RecipeIngredient => ({
  nazwa: '', procent: 0, em: 0, bialko: 0, ca: 0, p: 0,
  wlokno: 0, cenaKg: 0, na: 0, k: 0, mg: 0, mn: 0, zn: 0, se: 0, fe: 0, i: 0,
});

function obliczWazony(ingr: RecipeIngredient[], pole: keyof RecipeIngredient): number {
  return ingr.reduce((sum, s) => {
    const pct = s.procent || 0;
    const val = (s[pole] as number) || 0;
    return sum + pct * val / 100;
  }, 0);
}

function obliczKoszt(ingr: RecipeIngredient[]): number {
  return ingr.reduce((sum, s) => sum + (s.procent || 0) * (s.cenaKg || 0) / 100, 0);
}

type StatusCell = 'ok' | 'low' | 'high' | 'neutral';
function statusCell(val: number, min: number, max?: number): StatusCell {
  if (min === 0 && !max) return 'neutral';
  if (val < min * 0.95) return 'low';
  if (max && val > max * 1.05) return 'high';
  return 'ok';
}

const STATUS_CLASSES: Record<StatusCell, string> = {
  ok:      'text-green-700 bg-green-50',
  low:     'text-red-700 bg-red-50',
  high:    'text-orange-700 bg-orange-50',
  neutral: 'text-gray-600',
};

// ── Tab: Kalkulator ───────────────────────────────────────────────────────────

function CalculatorTab({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [birdType, setBirdType]       = useState('kury-nioski-lekkie');
  const [period, setPeriod]           = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([EMPTY_INGREDIENT()]);
  const [recipeName, setRecipeName]   = useState('');
  const [isPublic, setIsPublic]       = useState(false);
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');
  const [addToFeed, setAddToFeed]     = useState(true);

  const normy        = period ? NORMY_DROBIU[birdType]?.find(n => n.okres === period) : null;
  const sumaProc     = ingredients.reduce((s, i) => s + (i.procent || 0), 0);
  const procentOk    = Math.abs(sumaProc - 100) < 0.5;
  const koszt        = obliczKoszt(ingredients);

  const updateIngr = useCallback((idx: number, field: keyof RecipeIngredient, value: string | number) => {
    setIngredients(prev => {
      const next = [...prev];
      if (field === 'nazwa') {
        const ref = SKLADNIKI_BAZA.find(s => s.nazwa === value);
        if (ref) {
          // spread ref first, then override with current procent
          next[idx] = { ...next[idx], ...ref, procent: next[idx].procent };
        } else {
          next[idx] = { ...next[idx], nazwa: value as string };
        }
      } else {
        next[idx] = { ...next[idx], [field]: value };
      }
      return next;
    });
  }, []);

  const addRow    = () => setIngredients(p => [...p, EMPTY_INGREDIENT()]);
  const removeRow = (i: number) => setIngredients(p => p.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!recipeName.trim()) { setSaveMsg('Podaj nazwę receptury.'); return; }
    if (!procentOk)         { setSaveMsg('Suma składników musi wynosić 100%.'); return; }
    setSaving(true);
    try {
      const id = await feedRecipeService.create({
        name: recipeName.trim(), birdType, period,
        ingredients: ingredients.filter(i => i.procent > 0),
        costPerKg: koszt > 0 ? Math.round(koszt * 100) / 100 : undefined,
        notes: notes.trim() || undefined,
        isPublic,
        authorName: user ? (user.email?.split('@')[0] ?? 'Anonimowy') : undefined,
      });
      if (addToFeed) {
        await feedService.createType({
          name:       recipeName.trim(),
          phase:      'own_mix',
          isActive:   true,
          pricePerKg: koszt > 0 ? Math.round(koszt * 100) / 100 : 0,
          notes:      `Własna receptura – ${TYPY_DROBIU.find(t => t.value === birdType)?.label ?? birdType}`,
        });
      }
      setSaveMsg(`✅ Zapisano recepturę${addToFeed ? ' i dodano do typów pasz' : ''}.`);
      onSaved();
    } catch (e) {
      setSaveMsg('❌ Błąd zapisu: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  const handleExport = () => {
    if (!procentOk || !normy) return;
    let txt = `RECEPTURA PASZY – ${recipeName || 'bez nazwy'}\n`;
    txt += `Gatunek: ${TYPY_DROBIU.find(t => t.value === birdType)?.label}  |  Okres: ${period}\n`;
    txt += `Data: ${new Date().toLocaleDateString('pl-PL')}\n\n`;
    txt += 'SKŁADNIKI:\n';
    ingredients.filter(i => i.procent > 0).forEach(i => {
      txt += `  ${i.nazwa.padEnd(24)} ${String(i.procent).padStart(5)}%`;
      if (i.cenaKg > 0) txt += `  (${i.cenaKg.toFixed(2)} zł/kg)`;
      txt += '\n';
    });
    txt += `\nPARAMETRY:\n`;
    txt += `  Energia metaboliczna: ${obliczWazony(ingredients,'em').toFixed(2)} MJ/kg  (norma: ${normy.em})\n`;
    txt += `  Białko:               ${obliczWazony(ingredients,'bialko').toFixed(2)}%      (norma: ${normy.bialko})\n`;
    txt += `  Wapń:                 ${obliczWazony(ingredients,'ca').toFixed(2)}%      (norma: ${normy.ca})\n`;
    txt += `  Fosfor:               ${obliczWazony(ingredients,'p').toFixed(2)}%      (norma: ${normy.p})\n`;
    txt += `  Włókno:               ${obliczWazony(ingredients,'wlokno').toFixed(2)}%      (norma: ${normy.wlokno})\n`;
    if (koszt > 0) txt += `\nKoszt: ${koszt.toFixed(2)} zł/kg\n`;
    txt += `\nFermly – fermly.pl\n`;
    const blob = new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `receptura_${birdType}_${period.replace(/\s+/g,'_') || 'brak'}.txt`;
    a.click();
  };

  return (
    <div className="space-y-5">

      {/* Gatunek / Okres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Gatunek drobiu</label>
          <select value={birdType} onChange={e => { setBirdType(e.target.value); setPeriod(''); }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            {TYPY_DROBIU.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Okres / faza</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">— wybierz —</option>
            {(NORMY_DROBIU[birdType] ?? []).map(n =>
              <option key={n.okres} value={n.okres}>{n.okres}</option>
            )}
          </select>
        </div>
      </div>

      {/* Tabela składników */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Składniki receptury</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${procentOk ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            Suma: {sumaProc.toFixed(1)}%{procentOk ? ' ✓' : ' ≠ 100'}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                <th className="px-2 py-2 font-medium min-w-[160px]">Składnik</th>
                <th className="px-2 py-2 font-medium w-16 text-right">%</th>
                <th className="px-2 py-2 font-medium w-16 text-right">EM</th>
                <th className="px-2 py-2 font-medium w-16 text-right">Białko</th>
                <th className="px-2 py-2 font-medium w-14 text-right">Ca</th>
                <th className="px-2 py-2 font-medium w-14 text-right">P</th>
                <th className="px-2 py-2 font-medium w-16 text-right">Włókno</th>
                <th className="px-2 py-2 font-medium w-16 text-right">Cena/kg</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingr, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    <input list={`baza-${idx}`} value={ingr.nazwa}
                      onChange={e => updateIngr(idx, 'nazwa', e.target.value)}
                      placeholder="Wpisz lub wybierz…"
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    <datalist id={`baza-${idx}`}>
                      {SKLADNIKI_BAZA.map(s => <option key={s.nazwa} value={s.nazwa} />)}
                    </datalist>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} max={100} step={0.1}
                      value={ingr.procent || ''} placeholder="0"
                      onChange={e => updateIngr(idx, 'procent', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </td>
                  {(['em','bialko','ca','p','wlokno'] as (keyof RecipeIngredient)[]).map(f => (
                    <td key={f} className="px-2 py-1.5">
                      <input type="number" min={0} step={0.01}
                        value={(ingr[f] as number) || ''} placeholder="0"
                        onChange={e => updateIngr(idx, f, parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-500" />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} step={0.01}
                      value={ingr.cenaKg || ''} placeholder="0"
                      onChange={e => updateIngr(idx, 'cenaKg', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </td>
                  <td className="px-1 py-1.5">
                    <button onClick={() => removeRow(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded">
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addRow}
          className="mt-2 flex items-center gap-1 text-xs text-brand-700 hover:text-brand-800 font-medium">
          + Dodaj składnik
        </button>
      </div>

      {/* Bilans vs normy */}
      {normy && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Bilans vs normy — {normy.okres}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { label: 'Energia (MJ/kg)', val: obliczWazony(ingredients,'em'),     norma: normy.em,     fmt: (v: number) => v.toFixed(2) },
              { label: 'Białko (%)',       val: obliczWazony(ingredients,'bialko'), norma: normy.bialko, fmt: (v: number) => v.toFixed(2) },
              { label: 'Wapń Ca (%)',      val: obliczWazony(ingredients,'ca'),     norma: normy.ca,     fmt: (v: number) => v.toFixed(3) },
              { label: 'Fosfor P (%)',     val: obliczWazony(ingredients,'p'),      norma: normy.p,      fmt: (v: number) => v.toFixed(3) },
              { label: 'Włókno (%)',       val: obliczWazony(ingredients,'wlokno'), norma: normy.wlokno, fmt: (v: number) => v.toFixed(2) },
              { label: 'Sód Na (%)',       val: obliczWazony(ingredients,'na'),     norma: normy.na,     fmt: (v: number) => v.toFixed(3) },
            ].map(({ label, val, norma, fmt }) => {
              const st = statusCell(val, norma);
              return (
                <div key={label} className={`rounded-lg px-3 py-2 ${STATUS_CLASSES[st]}`}>
                  <div className="font-medium">{label}</div>
                  <div className="text-base font-bold">{fmt(val)}</div>
                  <div className="opacity-70">norma: {fmt(norma)}</div>
                </div>
              );
            })}
          </div>
          {koszt > 0 && (
            <div className="mt-3 text-sm font-medium text-gray-700">
              💰 Koszt receptury: <span className="text-brand-700 font-bold">{koszt.toFixed(2)} zł/kg</span>
            </div>
          )}
        </div>
      )}

      {/* Zapis */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Zapisz recepturę</h3>
        <input value={recipeName} onChange={e => setRecipeName(e.target.value)}
          placeholder="Nazwa receptury (np. Mieszanka nioski letnie)"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Uwagi (opcjonalnie)…" rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={addToFeed} onChange={e => setAddToFeed(e.target.checked)}
              className="w-4 h-4 accent-brand-600" />
            <span>Dodaj jako typ paszy (do wyboru przy dostawach)</span>
          </label>
          {user && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-brand-600" />
              <span className="flex items-center gap-1">
                🌐 Udostępnij społeczności
              </span>
            </label>
          )}
        </div>

        {saveMsg && (
          <p className={`text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
            {saveMsg}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSave} disabled={saving || !recipeName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50 transition-colors">
            💾
            {saving ? 'Zapisuję…' : 'Zapisz recepturę'}
          </button>
          <button onClick={handleExport} disabled={!procentOk || !normy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors">
            ⬇ Eksportuj TXT
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Moje receptury ───────────────────────────────────────────────────────

function MyRecipesTab({ recipes, onLoad, onRefresh }: {
  recipes: FeedRecipe[];
  onLoad:    (r: FeedRecipe) => void;
  onRefresh: () => void;
}) {
  const [delTarget, setDelTarget]   = useState<number | null>(null);
  const [toggling,  setToggling]    = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    await feedRecipeService.delete(id);
    setDelTarget(null);
    onRefresh();
  };

  const handleTogglePublic = async (r: FeedRecipe) => {
    setToggling(r.id!);
    await feedRecipeService.togglePublic(r.id!, !r.isPublic);
    setToggling(null);
    onRefresh();
  };

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        📖
        <p className="text-sm">Brak zapisanych receptur.<br />Stwórz pierwszą w zakładce Kalkulator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recipes.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 text-sm">{r.name}</h3>
                {r.isPublic
                  ? <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">🌐 Publiczna</span>
                  : <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">🔒 Prywatna</span>
                }
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {TYPY_DROBIU.find(t => t.value === r.birdType)?.label ?? r.birdType} — {r.period}
              </p>
              {r.costPerKg != null && (
                <p className="text-xs text-brand-700 font-medium mt-0.5">
                  💰 {r.costPerKg.toFixed(2)} zł/kg
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleTogglePublic(r)} disabled={toggling === r.id}
                title={r.isPublic ? 'Ustaw jako prywatną' : 'Udostępnij społeczności'}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50">
                {r.isPublic ? '🔒' : '🌐'}
              </button>
              <button onClick={() => onLoad(r)}
                title="Załaduj do kalkulatora"
                className="p-2 rounded-lg hover:bg-brand-50 text-gray-500 hover:text-brand-700 transition-colors">
                🧪
              </button>
              <button onClick={() => setDelTarget(r.id!)}
                title="Usuń"
                className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
                🗑
              </button>
            </div>
          </div>

          {r.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{r.notes}</p>}

          {/* Mini skład */}
          <div className="flex flex-wrap gap-1">
            {r.ingredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {ing.nazwa} {ing.procent}%
              </span>
            ))}
            {r.ingredients.length > 6 && (
              <span className="text-xs text-gray-400">+{r.ingredients.length - 6} więcej</span>
            )}
          </div>

          {/* Potwierdzenie usunięcia */}
          {delTarget === r.id && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-100 flex items-center justify-between gap-3">
              <span className="text-xs text-red-700">Usunąć recepturę „{r.name}"?</span>
              <div className="flex gap-2">
                <button onClick={() => setDelTarget(null)}
                  className="text-xs px-2 py-1 rounded border border-gray-200 bg-white">Anuluj</button>
                <button onClick={() => handleDelete(r.id!)}
                  className="text-xs px-2 py-1 rounded bg-red-600 text-white">Usuń</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tab: Społeczność ──────────────────────────────────────────────────────────

function CommunityTab({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const [recipes, setRecipes]   = useState<FeedRecipe[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copying, setCopying]   = useState<number | null>(null);
  const [copied,  setCopied]    = useState<number | null>(null);
  const [filter,  setFilter]    = useState('');

  useEffect(() => {
    feedRecipeService.getCommunity().then(data => {
      setRecipes(data);
      setLoading(false);
    });
  }, []);

  const handleCopy = async (r: FeedRecipe) => {
    setCopying(r.id!);
    await feedRecipeService.copyFromCommunity(r);
    setCopied(r.id!);
    setCopying(null);
    onRefresh();
    setTimeout(() => setCopied(null), 2000);
  };

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-400">
        👥
        <p className="text-sm">Zaloguj się, aby przeglądać receptury społeczności.</p>
      </div>
    );
  }

  const filtered = recipes.filter(r =>
    !filter || r.name.toLowerCase().includes(filter.toLowerCase()) ||
    r.birdType.includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="🔍 Szukaj receptury…"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">Ładowanie…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          👥
          <p className="text-sm">{filter ? 'Brak wyników.' : 'Brak publicznych receptur. Bądź pierwszy!'}</p>
        </div>
      )}

      {filtered.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{r.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {TYPY_DROBIU.find(t => t.value === r.birdType)?.label ?? r.birdType} — {r.period}
              </p>
              {r.authorName && (
                <p className="text-xs text-gray-400">od: {r.authorName}</p>
              )}
              {r.costPerKg != null && (
                <p className="text-xs text-brand-700 font-medium mt-0.5">
                  💰 {r.costPerKg.toFixed(2)} zł/kg
                </p>
              )}
            </div>
            <button onClick={() => handleCopy(r)}
              disabled={copying === r.id || copied === r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-700 text-white text-xs font-medium hover:bg-brand-800 disabled:opacity-60 transition-colors shrink-0">
              📋
              {copied === r.id ? 'Skopiowano!' : copying === r.id ? 'Kopiuję…' : 'Skopiuj'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {r.ingredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {ing.nazwa} {ing.procent}%
              </span>
            ))}
            {r.ingredients.length > 6 && (
              <span className="text-xs text-gray-400">+{r.ingredients.length - 6} więcej</span>
            )}
          </div>

          {r.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{r.notes}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Główna strona ─────────────────────────────────────────────────────────────

type TabId = 'kalkulator' | 'moje' | 'spolecznosc';

export function FeedRecipePage() {
  const [tab, setTab]           = useState<TabId>('kalkulator');
  const [myRecipes, setMyRecipes] = useState<FeedRecipe[]>([]);
  const [loadedRecipe, setLoadedRecipe] = useState<FeedRecipe | null>(null);

  const refreshMy = useCallback(async () => {
    const data = await feedRecipeService.getMy();
    setMyRecipes(data);
  }, []);

  useEffect(() => { refreshMy(); }, [refreshMy]);

  const handleLoad = (r: FeedRecipe) => {
    setLoadedRecipe(r);
    setTab('kalkulator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const TABS = [
    { id: 'kalkulator'  as TabId, label: 'Kalkulator',                    icon: '🧪' },
    { id: 'moje'        as TabId, label: `Moje (${myRecipes.length})`,    icon: '📖' },
    { id: 'spolecznosc' as TabId, label: 'Społeczność',                   icon: '👥' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4 px-1">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🧪 Receptury pasz</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Oblicz i zapisz własną mieszankę dostosowaną do gatunku i fazy odchowu.
        </p>
      </div>

      {/* Zakładki */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === t.id ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.id === 'kalkulator' ? '🧪' : t.id === 'moje' ? '📖' : '👥'}</span>
          </button>
        ))}
      </div>

      {/* Zawartość */}
      {tab === 'kalkulator' && (
        <CalculatorTab
          key={loadedRecipe?.id ?? 'new'}
          onSaved={() => { refreshMy(); setTab('moje'); }}
        />
      )}
      {tab === 'moje' && (
        <MyRecipesTab
          recipes={myRecipes}
          onLoad={handleLoad}
          onRefresh={refreshMy}
        />
      )}
      {tab === 'spolecznosc' && (
        <CommunityTab onRefresh={refreshMy} />
      )}
    </div>
  );
}
