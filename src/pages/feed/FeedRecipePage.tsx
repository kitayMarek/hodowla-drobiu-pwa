import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { feedRecipeService } from '@/services/feedRecipe.service';
import { feedService } from '@/services/feed.service';
import { feedIngredientService } from '@/services/feedIngredient.service';
import { NORMY_DROBIU, TYPY_DROBIU } from '@/data/poultryFeedData';
import type { FeedRecipe, RecipeIngredient } from '@/models/feedRecipe.model';
import type { FeedIngredient, BirdType } from '@/types/feedIngredient';
import { BIRD_TYPE_LABELS, CATEGORY_LABELS } from '@/types/feedIngredient';

// ─────────────────────────────────────────────────────────────────────────────
// Typy i helpery
// ─────────────────────────────────────────────────────────────────────────────

interface RecipeLine {
  ingredient: FeedIngredient;
  procent: number;
}

const CAT_EMOJI: Record<string, string> = {
  'zboża':                  '🌾',
  'produkty_zbożowe':       '🌾',
  'białkowe_roślinne':      '🫘',
  'białkowe_zwierzęce':     '🐟',
  'tłuszczowe':             '🫒',
  'mineralne':              '🪨',
  'zielonki_susze':         '🌿',
  'okopowe':                '🥕',
  'aminokwasy_syntetyczne': '🧪',
  'premiksy':               '💊',
  'inne':                   '📦',
};

function ingAvatar(ing: FeedIngredient): React.ReactNode {
  if (ing.photo_url) {
    return <img src={ing.photo_url} alt={ing.name} className="w-full h-full object-cover" />;
  }
  return <span className="text-2xl">{CAT_EMOJI[ing.category ?? ''] ?? '📦'}</span>;
}

function ingAvatarSm(ing: FeedIngredient): React.ReactNode {
  if (ing.photo_url) {
    return <img src={ing.photo_url} alt={ing.name} className="w-full h-full object-cover" />;
  }
  return <span className="text-lg">{CAT_EMOJI[ing.category ?? ''] ?? '📦'}</span>;
}

function weighted(lines: RecipeLine[], getter: (i: FeedIngredient) => number | null): number {
  return lines.reduce((sum, l) => sum + (l.procent / 100) * (getter(l.ingredient) ?? 0), 0);
}

type NutrStatus = 'ok' | 'low' | 'high' | 'neutral';
function nutrStatus(val: number, min: number, max?: number): NutrStatus {
  if (min === 0 && !max) return 'neutral';
  if (val < min * 0.95) return 'low';
  if (max && val > max * 1.05) return 'high';
  return 'ok';
}

const STATUS_BAR: Record<NutrStatus, string> = {
  ok:      'bg-green-500',
  low:     'bg-red-400',
  high:    'bg-orange-400',
  neutral: 'bg-gray-300',
};

const STATUS_TEXT: Record<NutrStatus, string> = {
  ok:      'text-green-700',
  low:     'text-red-600',
  high:    'text-orange-600',
  neutral: 'text-gray-600',
};

function lineToRecipeIngredient(l: RecipeLine): RecipeIngredient {
  const i = l.ingredient;
  return {
    nazwa:  i.name,
    procent: l.procent,
    em:     i.energia_mj    ?? 0,
    bialko: i.bialko_ogolne_pct   ?? 0,
    ca:     i.ca_pct        ?? 0,
    p:      i.p_przyswajalne_pct ?? i.p_total_pct ?? 0,
    wlokno: i.wlokno_surowe_pct  ?? 0,
    cenaKg: i.cena_zl_100kg != null ? i.cena_zl_100kg / 100 : 0,
    na:     i.na_pct        ?? 0,
    k:      i.k_pct         ?? 0,
    mg:     i.mg_pct        ?? 0,
    mn:     i.mn_mg         ?? 0,
    zn:     i.zn_mg         ?? 0,
    se:     i.se_mg         ?? 0,
    fe:     i.fe_mg         ?? 0,
    i:      i.i_mg          ?? 0,
  };
}

/** Syntetyczny FeedIngredient z danych legacy RecipeIngredient (gdy składnik nie istnieje w DB) */
function legacyIngredient(ri: RecipeIngredient): FeedIngredient {
  return {
    id: `legacy-${ri.nazwa}`, name: ri.nazwa, category: null,
    is_active: true, notes: null, recommended_for: [],
    udzial_optymalny_pct: null, udzial_max_pct: null,
    sucha_masa_pct: null, bialko_ogolne_pct: ri.bialko,
    tluszcz_surowy_pct: null, zwiazki_bezazotowe_pct: null,
    wlokno_surowe_pct: ri.wlokno, popiol_pct: null,
    skrobia_pct: null, cukier_pct: null, energia_kcal: null,
    energia_mj: ri.em, cena_zl_100kg: ri.cenaKg * 100,
    ca_pct: ri.ca, p_total_pct: ri.p, p_przyswajalne_pct: ri.p,
    mg_pct: ri.mg, k_pct: ri.k, na_pct: ri.na,
    cl_pct: null, s_pct: null, fe_mg: ri.fe, mn_mg: ri.mn,
    zn_mg: ri.zn, cu_mg: null, co_mcg: null, i_mg: ri.i, se_mg: ri.se,
    vit_a_jm: null, vit_d3: null, vit_e_mg: null, vit_b1_mg: null,
    vit_b2_mg: null, vit_b6_mg: null, kwas_pantotenowy_mg: null,
    kwas_foliowy_mg: null, biotyna_mg: null, niacyna_mg: null,
    vit_b12_mcg: null, cholina_g: null, kwas_linolowy_g: null,
    aa_lys: null, aa_met: null, aa_met_cys: null, aa_trp: null,
    aa_thr: null, aa_ile: null, aa_leu: null, aa_val: null,
    aa_his: null, aa_arg: null, aa_phe: null, aa_tyr: null,
    source: 'legacy', photo_url: null, created_at: '', updated_at: '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IngredientCard
// ─────────────────────────────────────────────────────────────────────────────

function IngredientCard({ line, onRemove, onChangePercent, onPriceChange }: {
  line: RecipeLine;
  onRemove: () => void;
  onChangePercent: (v: number) => void;
  onPriceChange: (pricePerKg: number) => void;
}) {
  const i = line.ingredient;
  const isLegacy = i.id.startsWith('legacy-');

  // Stan lokalny ceny — edytowalny inline
  const [priceEdit, setPriceEdit] = useState<string>(
    i.cena_zl_100kg != null ? (i.cena_zl_100kg / 100).toFixed(2) : ''
  );
  const [priceSaved, setPriceSaved] = useState(false);

  // Gdy składnik się zmieni (np. po załadowaniu receptury), zsynchronizuj
  useEffect(() => {
    setPriceEdit(i.cena_zl_100kg != null ? (i.cena_zl_100kg / 100).toFixed(2) : '');
  }, [i.id, i.cena_zl_100kg]);

  const handlePriceBlur = () => {
    const val = parseFloat(priceEdit);
    if (!isNaN(val) && val >= 0) {
      onPriceChange(val);
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 1500);
    } else {
      // przywróć poprzednią wartość
      setPriceEdit(i.cena_zl_100kg != null ? (i.cena_zl_100kg / 100).toFixed(2) : '');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 flex gap-3">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
        {ingAvatar(i)}
      </div>

      {/* Treść */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <div>
            <span className="font-semibold text-gray-800 text-sm leading-tight">{i.name}</span>
            {isLegacy && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">starszy wpis</span>
            )}
          </div>
          <button
            onClick={onRemove}
            className="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-0.5 text-sm leading-none"
          >
            ✕
          </button>
        </div>

        {/* Wartości odżywcze + cena edytowalna */}
        <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {i.energia_mj        != null && <span>EM {i.energia_mj.toFixed(1)} MJ</span>}
          {i.bialko_ogolne_pct != null && <span>Białko {i.bialko_ogolne_pct.toFixed(1)}%</span>}
          {i.ca_pct            != null && <span>Ca {i.ca_pct.toFixed(2)}%</span>}
          {i.p_przyswajalne_pct != null && <span>P {i.p_przyswajalne_pct.toFixed(2)}%</span>}

          {/* Cena — edytowalna inline */}
          <span className="flex items-center gap-1 text-green-600">
            💰
            <input
              type="number"
              min={0}
              step={0.01}
              value={priceEdit}
              onChange={e => setPriceEdit(e.target.value)}
              onBlur={handlePriceBlur}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="w-14 text-right text-xs font-medium text-green-600 bg-transparent border-b border-green-200 focus:border-green-500 focus:outline-none"
              title="Kliknij aby zmienić cenę — zostanie zapisana do bazy"
            />
            <span>zł/kg</span>
            {priceSaved && <span className="text-green-500 font-bold">✓</span>}
          </span>
        </div>

        {/* Suwak + input */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="range" min={0} max={100} step={1}
            value={line.procent}
            onChange={e => onChangePercent(Number(e.target.value))}
            className="flex-1 h-1.5 accent-green-600"
          />
          <div className="flex items-center gap-0.5 shrink-0">
            <input
              type="number" min={0} max={100} step={1}
              value={line.procent || ''}
              onChange={e => onChangePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-12 text-right text-sm font-bold text-gray-800 border border-gray-200 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
        </div>

        {/* Hint udziału zalecanego */}
        {i.udzial_optymalny_pct && (
          <div className="text-xs text-gray-400 mt-0.5">
            Zalecany: {i.udzial_optymalny_pct}%
            {i.udzial_max_pct != null && ` (max ${i.udzial_max_pct}%)`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IngredientPicker (bottom sheet)
// ─────────────────────────────────────────────────────────────────────────────

function IngredientPicker({ ingredients, birdType, addedIds, onAdd, onClose }: {
  ingredients: FeedIngredient[];
  birdType: string;
  addedIds: Set<string>;
  onAdd: (i: FeedIngredient) => void;
  onClose: () => void;
}) {
  const [search, setSearch]         = useState('');
  const [filterBird, setFilterBird] = useState(true);

  const filtered = useMemo(() => {
    let list = ingredients;
    if (filterBird) {
      list = list.filter(i =>
        i.recommended_for.length === 0 ||
        i.recommended_for.includes(birdType as BirdType)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [ingredients, search, birdType, filterBird]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedIngredient[]>();
    for (const ing of filtered) {
      const cat = ing.category ?? 'inne';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ing);
    }
    return map;
  }, [filtered]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '82vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">Dodaj składnik</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-sm">✕</button>
          </div>

          <input
            type="text"
            autoFocus
            placeholder="🔍 Szukaj składnika…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setFilterBird(!filterBird)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterBird
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}
            >
              🐔 {BIRD_TYPE_LABELS[birdType as BirdType] ?? birdType}
            </button>
            <span className="text-xs text-gray-400">{filtered.length} składników</span>
          </div>
        </div>

        {/* Lista składników */}
        <div className="overflow-y-auto flex-1 px-4 pb-8">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">Brak wyników</div>
          )}

          {Array.from(grouped.entries()).map(([cat, items]) => (
            <React.Fragment key={cat}>
              {/* Separator kategorii */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1 sticky top-0 bg-white">
                {CAT_EMOJI[cat] ?? '📦'} {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
              </div>

              {items.map(ing => {
                const added = addedIds.has(ing.id);
                return (
                  <button
                    key={ing.id}
                    onClick={() => onAdd(ing)}
                    disabled={added}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors mb-0.5 ${
                      added
                        ? 'bg-green-50 border border-green-200 opacity-60 cursor-default'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {ingAvatarSm(ing)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{ing.name}</div>
                      <div className="text-xs text-gray-400 flex gap-3">
                        {ing.energia_mj     != null && <span>EM {ing.energia_mj.toFixed(1)} MJ</span>}
                        {ing.bialko_ogolne_pct != null && <span>B {ing.bialko_ogolne_pct.toFixed(1)}%</span>}
                        {ing.cena_zl_100kg  != null && (
                          <span className="text-green-600">{(ing.cena_zl_100kg / 100).toFixed(2)} zł/kg</span>
                        )}
                      </div>
                    </div>

                    <span className={`text-lg font-bold ${added ? 'text-green-500' : 'text-gray-300'}`}>
                      {added ? '✓' : '+'}
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BilansePanel — slupki postępu vs. normy
// ─────────────────────────────────────────────────────────────────────────────

type NormyRow = { em: number; bialko: number; ca: number; p: number; wlokno: number; na: number; [key: string]: number | string | undefined };

function NutrBar({ label, val, norm, unit, decimals = 2 }: {
  label: string; val: number; norm: number; unit: string; decimals?: number;
}) {
  const pct = norm > 0 ? Math.min((val / norm) * 100, 130) : 0;
  const st = nutrStatus(val, norm);
  const fmtNum = (v: number) => v.toFixed(decimals);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={`font-bold tabular-nums ${STATUS_TEXT[st]}`}>
          {fmtNum(val)} / {fmtNum(norm)} {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${STATUS_BAR[st]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BilansePanel({ lines, normy }: {
  lines: RecipeLine[];
  normy: NormyRow | null | undefined;
}) {
  const em     = weighted(lines, i => i.energia_mj);
  const bialko = weighted(lines, i => i.bialko_ogolne_pct);
  const ca     = weighted(lines, i => i.ca_pct);
  const p      = weighted(lines, i => i.p_przyswajalne_pct ?? i.p_total_pct);
  const wlokno = weighted(lines, i => i.wlokno_surowe_pct);
  const na     = weighted(lines, i => i.na_pct);
  const lys    = weighted(lines, i => i.aa_lys);
  const met    = weighted(lines, i => i.aa_met);
  const metCys = weighted(lines, i => i.aa_met_cys);
  const trp    = weighted(lines, i => i.aa_trp);
  const thr    = weighted(lines, i => i.aa_thr);

  if (!normy) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm">Wybierz fazę odchowu<br />aby zobaczyć bilans vs. normy</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-3xl mb-2">🌾</div>
        <p className="text-sm">Dodaj składniki<br />aby zobaczyć bilans</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-700">📊 Bilans vs. normy</h3>

      <div className="space-y-3">
        <NutrBar label="Energia metaboliczna" val={em}     norm={normy.em}     unit="MJ/kg" />
        <NutrBar label="Białko ogólne"         val={bialko} norm={normy.bialko} unit="%" />
        <NutrBar label="Wapń Ca"               val={ca}     norm={normy.ca}     unit="%" decimals={3} />
        <NutrBar label="Fosfor P"              val={p}      norm={normy.p}      unit="%" decimals={3} />
        <NutrBar label="Włókno surowe"         val={wlokno} norm={normy.wlokno} unit="%" />
        {normy.na > 0 && (
          <NutrBar label="Sód Na"              val={na}     norm={normy.na}     unit="%" decimals={3} />
        )}
      </div>

      {(lys > 0 || met > 0 || trp > 0) && (
        <>
          <h3 className="text-sm font-bold text-gray-700 pt-1">Aminokwasy (wyliczone)</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Lys', val: lys },
              { label: 'Met', val: met },
              { label: 'Met+Cys', val: metCys },
              { label: 'Trp', val: trp },
              { label: 'Thr', val: thr },
            ].filter(a => a.val > 0).map(a => (
              <div key={a.label} className="bg-gray-50 rounded-xl p-2 text-center">
                <div className="text-xs text-gray-500">{a.label}</div>
                <div className="text-sm font-bold text-gray-800">{a.val.toFixed(3)}%</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SavePanel
// ─────────────────────────────────────────────────────────────────────────────

function SavePanel({ recipeName, setRecipeName, notes, setNotes,
  isPublic, setIsPublic, addToFeed, setAddToFeed,
  saving, saveMsg, procentOk, hasUser, onSave, onExport,
}: {
  recipeName: string; setRecipeName: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  isPublic: boolean; setIsPublic: (v: boolean) => void;
  addToFeed: boolean; setAddToFeed: (v: boolean) => void;
  saving: boolean; saveMsg: string; procentOk: boolean; hasUser: boolean;
  onSave: () => void; onExport: () => void;
}) {
  return (
    <div className="space-y-2">
      <input
        value={recipeName}
        onChange={e => setRecipeName(e.target.value)}
        placeholder="Nazwa receptury…"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Uwagi (opcjonalnie)…"
        rows={2}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
        <input type="checkbox" checked={addToFeed} onChange={e => setAddToFeed(e.target.checked)}
          className="w-3.5 h-3.5 accent-green-600" />
        <span>Dodaj jako typ paszy (do wyboru przy dostawach)</span>
      </label>
      {hasUser && (
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
            className="w-3.5 h-3.5 accent-green-600" />
          <span>🌐 Udostępnij społeczności</span>
        </label>
      )}
      {saveMsg && (
        <p className={`text-xs font-medium ${saveMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
          {saveMsg}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !recipeName.trim() || !procentOk}
          className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Zapisuję…' : '💾 Zapisz recepturę'}
        </button>
        <button
          onClick={onExport}
          disabled={!procentOk}
          title="Eksportuj jako TXT"
          className="py-2 px-3 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          ⬇
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CalculatorTab — główny kalkulator
// ─────────────────────────────────────────────────────────────────────────────

function CalculatorTab({ initialRecipe, onSaved }: {
  initialRecipe?: FeedRecipe | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [birdType, setBirdType]         = useState(initialRecipe?.birdType ?? 'kury-nioski-lekkie');
  const [period, setPeriod]             = useState(initialRecipe?.period ?? '');
  const [lines, setLines]               = useState<RecipeLine[]>([]);
  const [dbIngredients, setDbIngredients] = useState<FeedIngredient[]>([]);
  const [dbLoading, setDbLoading]       = useState(true);
  const [showPicker, setShowPicker]     = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [recipeName, setRecipeName]     = useState(initialRecipe?.name ?? '');
  const [notes, setNotes]               = useState(initialRecipe?.notes ?? '');
  const [isPublic, setIsPublic]         = useState(initialRecipe?.isPublic ?? false);
  const [addToFeed, setAddToFeed]       = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  // Ładuj wszystkie składniki raz
  useEffect(() => {
    feedIngredientService.getAll()
      .then(setDbIngredients)
      .catch(() => setDbIngredients([]))
      .finally(() => setDbLoading(false));
  }, []);

  // Odtwórz linie z załadowanej receptury gdy DB gotowa
  useEffect(() => {
    if (!initialRecipe || dbIngredients.length === 0) return;
    const newLines: RecipeLine[] = initialRecipe.ingredients.map(ri => {
      const dbIng = dbIngredients.find(i => i.name === ri.nazwa);
      return { ingredient: dbIng ?? legacyIngredient(ri), procent: ri.procent };
    });
    setLines(newLines);
  }, [initialRecipe, dbIngredients]);

  // Wartości wyliczone
  const normy     = period ? NORMY_DROBIU[birdType]?.find(n => n.okres === period) : null;
  const sumaProc  = lines.reduce((s, l) => s + l.procent, 0);
  const procentOk = Math.abs(sumaProc - 100) < 0.5;
  const koszt     = lines.reduce((s, l) => s + (l.procent / 100) * ((l.ingredient.cena_zl_100kg ?? 0) / 100), 0);
  const addedIds  = useMemo(() => new Set(lines.map(l => l.ingredient.id)), [lines]);

  // Szybki podgląd do dolnego paska
  const emSum     = weighted(lines, i => i.energia_mj);
  const bialkoSum = weighted(lines, i => i.bialko_ogolne_pct);
  const caSum     = weighted(lines, i => i.ca_pct);

  const handleAdd = useCallback((ing: FeedIngredient) => {
    if (addedIds.has(ing.id)) return;
    setLines(prev => [...prev, { ingredient: ing, procent: 0 }]);
  }, [addedIds]);

  const handleRemove = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleChangePercent = useCallback((idx: number, val: number) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], procent: val };
      return next;
    });
  }, []);

  /** Aktualizuje cenę lokalnie + zapisuje do bazy Supabase */
  const handlePriceChange = useCallback((idx: number, pricePerKg: number) => {
    const cena_zl_100kg = Math.round(pricePerKg * 100 * 100) / 100; // zł/100kg, 2 miejsca
    // Aktualizuj lokalnie
    setLines(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        ingredient: { ...next[idx].ingredient, cena_zl_100kg },
      };
      return next;
    });
    // Aktualizuj też w dbIngredients żeby picker miał świeżą cenę
    setDbIngredients(prev =>
      prev.map(i =>
        i.id === lines[idx]?.ingredient.id ? { ...i, cena_zl_100kg } : i
      )
    );
    // Zapisz do bazy (legacy ingredienty pomijamy — nie mają prawdziwego UUID)
    const ingId = lines[idx]?.ingredient.id;
    if (ingId && !ingId.startsWith('legacy-')) {
      feedIngredientService.update(ingId, { cena_zl_100kg }).catch(console.error);
    }
  }, [lines]);

  const handleSave = async () => {
    if (!recipeName.trim()) { setSaveMsg('Podaj nazwę receptury.'); return; }
    if (!procentOk) { setSaveMsg('Suma składników musi wynosić 100%.'); return; }
    setSaving(true);
    try {
      await feedRecipeService.create({
        name: recipeName.trim(), birdType, period,
        ingredients: lines.map(lineToRecipeIngredient),
        costPerKg: koszt > 0 ? Math.round(koszt * 100) / 100 : undefined,
        notes: notes.trim() || undefined,
        isPublic,
        authorName: user ? (user.email?.split('@')[0] ?? 'Anonimowy') : undefined,
      });
      if (addToFeed) {
        await feedService.createType({
          name: recipeName.trim(), phase: 'own_mix', isActive: true,
          pricePerKg: koszt > 0 ? Math.round(koszt * 100) / 100 : 0,
          notes: `Własna receptura – ${TYPY_DROBIU.find(t => t.value === birdType)?.label ?? birdType}`,
        });
      }
      setSaveMsg('✅ Zapisano recepturę!');
      onSaved();
    } catch (e) {
      setSaveMsg('❌ Błąd: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 4000);
    }
  };

  const handleExport = () => {
    let txt = `RECEPTURA PASZY – ${recipeName || 'bez nazwy'}\n`;
    txt += `Gatunek: ${TYPY_DROBIU.find(t => t.value === birdType)?.label}  |  Faza: ${period || 'brak'}\n`;
    txt += `Data: ${new Date().toLocaleDateString('pl-PL')}\n\n`;
    txt += 'SKŁADNIKI:\n';
    lines.filter(l => l.procent > 0).forEach(l => {
      txt += `  ${l.ingredient.name.padEnd(30)} ${String(l.procent).padStart(5)}%`;
      if (l.ingredient.cena_zl_100kg) {
        txt += `  (${(l.ingredient.cena_zl_100kg / 100).toFixed(2)} zł/kg)`;
      }
      txt += '\n';
    });
    if (normy) {
      txt += `\nPARAMETRY:\n`;
      txt += `  Energia:  ${emSum.toFixed(2)} MJ/kg  (norma: ${normy.em})\n`;
      txt += `  Białko:   ${bialkoSum.toFixed(2)}%      (norma: ${normy.bialko})\n`;
      txt += `  Wapń Ca:  ${caSum.toFixed(3)}%      (norma: ${normy.ca})\n`;
    }
    if (koszt > 0) txt += `\nKoszt: ${koszt.toFixed(2)} zł/kg\n`;
    txt += `\nFermly – fermly.pl\n`;
    const blob = new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receptura_${birdType}_${(period || 'brak').replace(/\s+/g, '_')}.txt`;
    a.click();
  };

  return (
    <div className="relative pb-20">

      {/* Selektory — gatunek + faza */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Gatunek</label>
          <select
            value={birdType}
            onChange={e => { setBirdType(e.target.value); setPeriod(''); }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {TYPY_DROBIU.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Faza odchowu</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">— wybierz —</option>
            {(NORMY_DROBIU[birdType] ?? []).map(n => (
              <option key={n.okres} value={n.okres}>{n.okres}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Brak składników w DB */}
      {!dbLoading && dbIngredients.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">
          ⚠️ Nie znaleziono składników w bazie. Uruchom seed SQL lub dodaj składniki w{' '}
          <a href="/pasze/skladniki" className="underline font-medium">Składniki paszowe</a>.
        </div>
      )}

      {/* Layout: mobile one-col, desktop two-col */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start">

        {/* ── Lewa kolumna — lista składników ── */}
        <div className="lg:col-span-3 space-y-2">

          {lines.length === 0 ? (
            <div
              className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-green-400 transition-colors"
              onClick={() => setShowPicker(true)}
            >
              <div className="text-5xl mb-3">🌾</div>
              <p className="text-sm font-medium">Brak składników</p>
              <p className="text-xs mt-1">Kliknij tutaj lub ➕ żeby dodać pierwszy składnik</p>
            </div>
          ) : (
            <>
              {lines.map((line, idx) => (
                <IngredientCard
                  key={line.ingredient.id}
                  line={line}
                  onRemove={() => handleRemove(idx)}
                  onChangePercent={v => handleChangePercent(idx, v)}
                  onPriceChange={v => handlePriceChange(idx, v)}
                />
              ))}

              {/* Suma */}
              <div className={`rounded-xl p-3 text-sm font-medium flex items-center justify-between border transition-colors ${
                procentOk
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-orange-50 border-orange-200 text-orange-700'
              }`}>
                <span>Suma składników</span>
                <span className="font-bold">{sumaProc.toFixed(1)}% {procentOk ? '✓' : '— potrzeba 100%'}</span>
              </div>
            </>
          )}

          {/* Zapis — akordeon (tylko mobile) */}
          {lines.length > 0 && (
            <div className="lg:hidden mt-4">
              <button
                onClick={() => setShowSavePanel(!showSavePanel)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>💾 Zapisz recepturę</span>
                <span className="text-gray-400">{showSavePanel ? '▲' : '▼'}</span>
              </button>
              {showSavePanel && (
                <div className="mt-2 bg-white border border-gray-200 rounded-xl p-4">
                  <SavePanel
                    recipeName={recipeName} setRecipeName={setRecipeName}
                    notes={notes} setNotes={setNotes}
                    isPublic={isPublic} setIsPublic={setIsPublic}
                    addToFeed={addToFeed} setAddToFeed={setAddToFeed}
                    saving={saving} saveMsg={saveMsg}
                    procentOk={procentOk} hasUser={!!user}
                    onSave={handleSave} onExport={handleExport}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Prawa kolumna — bilans + zapis (tylko desktop) ── */}
        <div className="lg:col-span-2 hidden lg:block">
          <div className="sticky top-4 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <BilansePanel lines={lines} normy={normy as NormyRow | null | undefined} />

              {lines.length > 0 && koszt > 0 && (
                <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between text-sm">
                  <span className="text-gray-600">Koszt mieszanki</span>
                  <span className="font-bold text-green-700">{koszt.toFixed(2)} zł/kg</span>
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">💾 Zapisz recepturę</h3>
                <SavePanel
                  recipeName={recipeName} setRecipeName={setRecipeName}
                  notes={notes} setNotes={setNotes}
                  isPublic={isPublic} setIsPublic={setIsPublic}
                  addToFeed={addToFeed} setAddToFeed={setAddToFeed}
                  saving={saving} saveMsg={saveMsg}
                  procentOk={procentOk} hasUser={!!user}
                  onSave={handleSave} onExport={handleExport}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating ➕ button */}
      <button
        onClick={() => setShowPicker(true)}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 w-14 h-14 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-full shadow-xl text-3xl flex items-center justify-center z-30 transition-colors"
        title="Dodaj składnik"
      >
        +
      </button>

      {/* Dolny pasek sum — widoczny na mobile gdy są składniki */}
      {lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-2 z-20 lg:hidden">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex gap-4">
              <div>
                <span className="text-gray-400">EM </span>
                <span className={`font-bold ${
                  normy && nutrStatus(emSum, normy.em) === 'ok'
                    ? 'text-green-700'
                    : 'text-gray-800'
                }`}>
                  {emSum.toFixed(1)}{normy ? `/${normy.em}` : ''} MJ
                </span>
              </div>
              <div>
                <span className="text-gray-400">B </span>
                <span className={`font-bold ${
                  normy && nutrStatus(bialkoSum, normy.bialko) === 'ok'
                    ? 'text-green-700'
                    : 'text-gray-800'
                }`}>
                  {bialkoSum.toFixed(1)}{normy ? `/${normy.bialko}` : ''}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">Ca </span>
                <span className="font-bold text-gray-800">{caSum.toFixed(2)}%</span>
              </div>
              {koszt > 0 && (
                <div>
                  <span className="text-gray-400">💰 </span>
                  <span className="font-bold text-green-700">{koszt.toFixed(2)} zł/kg</span>
                </div>
              )}
            </div>
            <div className={`font-bold px-2 py-1 rounded-full text-xs shrink-0 ${
              procentOk
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {sumaProc.toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      {/* Picker */}
      {showPicker && (
        <IngredientPicker
          ingredients={dbIngredients}
          birdType={birdType}
          addedIds={addedIds}
          onAdd={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyRecipesTab
// ─────────────────────────────────────────────────────────────────────────────

function MyRecipesTab({ recipes, onLoad, onRefresh }: {
  recipes: FeedRecipe[];
  onLoad: (r: FeedRecipe) => void;
  onRefresh: () => void;
}) {
  const [delTarget, setDelTarget] = useState<number | null>(null);
  const [toggling, setToggling]   = useState<number | null>(null);

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
        <div className="text-4xl mb-2">📖</div>
        <p className="text-sm">Brak zapisanych receptur.<br />Stwórz pierwszą w zakładce Kalkulator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recipes.map(r => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-800 text-sm">{r.name}</h3>
                {r.isPublic
                  ? <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">🌐 Publiczna</span>
                  : <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">🔒 Prywatna</span>
                }
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {TYPY_DROBIU.find(t => t.value === r.birdType)?.label ?? r.birdType}
                {r.period && ` — ${r.period}`}
              </p>
              {r.costPerKg != null && (
                <p className="text-xs text-green-700 font-medium mt-0.5">
                  💰 {r.costPerKg.toFixed(2)} zł/kg
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleTogglePublic(r)} disabled={toggling === r.id}
                title={r.isPublic ? 'Ustaw jako prywatną' : 'Udostępnij'}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                {r.isPublic ? '🔒' : '🌐'}
              </button>
              <button onClick={() => onLoad(r)} title="Załaduj do kalkulatora"
                className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-700 transition-colors">
                🧪
              </button>
              <button onClick={() => setDelTarget(r.id!)} title="Usuń"
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                🗑
              </button>
            </div>
          </div>

          {r.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{r.notes}</p>}

          <div className="flex flex-wrap gap-1">
            {r.ingredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {ing.nazwa} {ing.procent}%
              </span>
            ))}
            {r.ingredients.length > 6 && (
              <span className="text-xs text-gray-400">+{r.ingredients.length - 6} więcej</span>
            )}
          </div>

          {delTarget === r.id && (
            <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex items-center justify-between gap-3">
              <span className="text-xs text-red-700">Usunąć recepturę „{r.name}"?</span>
              <div className="flex gap-2">
                <button onClick={() => setDelTarget(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white">Anuluj</button>
                <button onClick={() => handleDelete(r.id!)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white">Usuń</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommunityTab
// ─────────────────────────────────────────────────────────────────────────────

function CommunityTab({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState<number | null>(null);
  const [copied, setCopied]   = useState<number | null>(null);
  const [filter, setFilter]   = useState('');

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
        <div className="text-4xl mb-2">👥</div>
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
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />

      {loading && <div className="text-center py-8 text-gray-400 text-sm">Ładowanie…</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-sm">{filter ? 'Brak wyników.' : 'Brak publicznych receptur. Bądź pierwszy!'}</p>
        </div>
      )}

      {filtered.map(r => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{r.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {TYPY_DROBIU.find(t => t.value === r.birdType)?.label ?? r.birdType}
                {r.period && ` — ${r.period}`}
              </p>
              {r.authorName && <p className="text-xs text-gray-400">od: {r.authorName}</p>}
              {r.costPerKg != null && (
                <p className="text-xs text-green-700 font-medium mt-0.5">💰 {r.costPerKg.toFixed(2)} zł/kg</p>
              )}
            </div>
            <button onClick={() => handleCopy(r)} disabled={copying === r.id || copied === r.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-60 transition-colors shrink-0">
              📋 {copied === r.id ? 'Skopiowano!' : copying === r.id ? 'Kopiuję…' : 'Skopiuj'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {r.ingredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
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

// ─────────────────────────────────────────────────────────────────────────────
// FeedRecipePage — główny komponent
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'kalkulator' | 'moje' | 'spolecznosc';

export function FeedRecipePage() {
  const [tab, setTab]                   = useState<TabId>('kalkulator');
  const [myRecipes, setMyRecipes]       = useState<FeedRecipe[]>([]);
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
    { id: 'kalkulator'  as TabId, label: 'Kalkulator',                 icon: '🧪' },
    { id: 'moje'        as TabId, label: `Moje (${myRecipes.length})`, icon: '📖' },
    { id: 'spolecznosc' as TabId, label: 'Społeczność',                icon: '👥' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-1 pb-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🧪 Receptury pasz</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bilansuj mieszankę na podstawie bazy {' '}
          <a href="/pasze/skladniki" className="text-green-600 hover:underline">składników paszowych</a>.
        </p>
      </div>

      {/* Zakładki */}
      <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Zawartość */}
      {tab === 'kalkulator' && (
        <CalculatorTab
          key={loadedRecipe?.id ?? 'new'}
          initialRecipe={loadedRecipe}
          onSaved={() => { refreshMy(); setTab('moje'); }}
        />
      )}
      {tab === 'moje' && (
        <MyRecipesTab recipes={myRecipes} onLoad={handleLoad} onRefresh={refreshMy} />
      )}
      {tab === 'spolecznosc' && (
        <CommunityTab onRefresh={refreshMy} />
      )}
    </div>
  );
}
