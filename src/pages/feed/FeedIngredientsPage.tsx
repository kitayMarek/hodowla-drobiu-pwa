import React, { useState, useEffect, useMemo, useRef } from 'react';
import { feedIngredientService } from '@/services/feedIngredient.service';
import type {
  FeedIngredient,
  FeedIngredientInsert,
  FeedIngredientUpdate,
  BirdType,
  IngredientCategory,
} from '@/types/feedIngredient';
import {
  BIRD_TYPE_LABELS,
  BIRD_TYPE_COLORS,
  CATEGORY_LABELS,
  ALL_BIRD_TYPES,
  ALL_CATEGORIES,
} from '@/types/feedIngredient';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

const EMPTY_FORM = (): FeedIngredientInsert => ({
  name: '',
  category: null,
  is_active: true,
  notes: null,
  recommended_for: [],
  udzial_optymalny_pct: null,
  udzial_max_pct: null,
  sucha_masa_pct: null,
  bialko_ogolne_pct: null,
  tluszcz_surowy_pct: null,
  zwiazki_bezazotowe_pct: null,
  wlokno_surowe_pct: null,
  popiol_pct: null,
  skrobia_pct: null,
  cukier_pct: null,
  energia_kcal: null,
  energia_mj: null,
  cena_zl_100kg: null,
  ca_pct: null,
  p_total_pct: null,
  p_przyswajalne_pct: null,
  mg_pct: null,
  k_pct: null,
  na_pct: null,
  cl_pct: null,
  s_pct: null,
  fe_mg: null,
  mn_mg: null,
  zn_mg: null,
  cu_mg: null,
  co_mcg: null,
  i_mg: null,
  se_mg: null,
  vit_a_jm: null,
  vit_d3: null,
  vit_e_mg: null,
  vit_b1_mg: null,
  vit_b2_mg: null,
  vit_b6_mg: null,
  kwas_pantotenowy_mg: null,
  kwas_foliowy_mg: null,
  biotyna_mg: null,
  niacyna_mg: null,
  vit_b12_mcg: null,
  cholina_g: null,
  kwas_linolowy_g: null,
  aa_lys: null,
  aa_met: null,
  aa_met_cys: null,
  aa_trp: null,
  aa_thr: null,
  aa_ile: null,
  aa_leu: null,
  aa_val: null,
  aa_his: null,
  aa_arg: null,
  aa_phe: null,
  aa_tyr: null,
  source: 'użytkownik',
});

// ─────────────────────────────────────────────────────────────────────────────
// Zakładki grup kolumn
// ─────────────────────────────────────────────────────────────────────────────

type ColGroup = 'podstawowe' | 'mineraly' | 'aminokwasy' | 'witaminy' | 'udzial';

const COL_GROUP_LABELS: Record<ColGroup, string> = {
  podstawowe: 'Podstawowe',
  mineraly: 'Minerały',
  aminokwasy: 'Aminokwasy',
  witaminy: 'Witaminy',
  udzial: 'Udział %',
};

// ─────────────────────────────────────────────────────────────────────────────
// Formularz składnika (modal)
// ─────────────────────────────────────────────────────────────────────────────

interface IngredientFormProps {
  initial?: FeedIngredient | null;
  onSave: (data: FeedIngredientInsert | FeedIngredientUpdate, addNext?: boolean) => Promise<void>;
  onCancel: () => void;
  isNew: boolean;
}

function IngredientForm({ initial, onSave, onCancel, isNew }: IngredientFormProps) {
  const [tab, setTab] = useState<ColGroup>('podstawowe');
  const [form, setForm] = useState<FeedIngredientInsert>(() =>
    initial
      ? {
          name: initial.name,
          category: initial.category,
          is_active: initial.is_active,
          notes: initial.notes,
          recommended_for: initial.recommended_for ?? [],
          udzial_optymalny_pct: initial.udzial_optymalny_pct,
          udzial_max_pct: initial.udzial_max_pct,
          sucha_masa_pct: initial.sucha_masa_pct,
          bialko_ogolne_pct: initial.bialko_ogolne_pct,
          tluszcz_surowy_pct: initial.tluszcz_surowy_pct,
          zwiazki_bezazotowe_pct: initial.zwiazki_bezazotowe_pct,
          wlokno_surowe_pct: initial.wlokno_surowe_pct,
          popiol_pct: initial.popiol_pct,
          skrobia_pct: initial.skrobia_pct,
          cukier_pct: initial.cukier_pct,
          energia_kcal: initial.energia_kcal,
          energia_mj: initial.energia_mj,
          cena_zl_100kg: initial.cena_zl_100kg,
          ca_pct: initial.ca_pct,
          p_total_pct: initial.p_total_pct,
          p_przyswajalne_pct: initial.p_przyswajalne_pct,
          mg_pct: initial.mg_pct,
          k_pct: initial.k_pct,
          na_pct: initial.na_pct,
          cl_pct: initial.cl_pct,
          s_pct: initial.s_pct,
          fe_mg: initial.fe_mg,
          mn_mg: initial.mn_mg,
          zn_mg: initial.zn_mg,
          cu_mg: initial.cu_mg,
          co_mcg: initial.co_mcg,
          i_mg: initial.i_mg,
          se_mg: initial.se_mg,
          vit_a_jm: initial.vit_a_jm,
          vit_d3: initial.vit_d3,
          vit_e_mg: initial.vit_e_mg,
          vit_b1_mg: initial.vit_b1_mg,
          vit_b2_mg: initial.vit_b2_mg,
          vit_b6_mg: initial.vit_b6_mg,
          kwas_pantotenowy_mg: initial.kwas_pantotenowy_mg,
          kwas_foliowy_mg: initial.kwas_foliowy_mg,
          biotyna_mg: initial.biotyna_mg,
          niacyna_mg: initial.niacyna_mg,
          vit_b12_mcg: initial.vit_b12_mcg,
          cholina_g: initial.cholina_g,
          kwas_linolowy_g: initial.kwas_linolowy_g,
          aa_lys: initial.aa_lys,
          aa_met: initial.aa_met,
          aa_met_cys: initial.aa_met_cys,
          aa_trp: initial.aa_trp,
          aa_thr: initial.aa_thr,
          aa_ile: initial.aa_ile,
          aa_leu: initial.aa_leu,
          aa_val: initial.aa_val,
          aa_his: initial.aa_his,
          aa_arg: initial.aa_arg,
          aa_phe: initial.aa_phe,
          aa_tyr: initial.aa_tyr,
          source: initial.source,
        }
      : EMPTY_FORM()
  );
  const [saving, setSaving] = useState(false);

  function setN(field: keyof FeedIngredientInsert, value: string) {
    const num = value === '' ? null : parseFloat(value);
    setForm(f => ({ ...f, [field]: num }));
  }

  function setS(field: keyof FeedIngredientInsert, value: string) {
    setForm(f => ({ ...f, [field]: value === '' ? null : value }));
  }

  function toggleBird(bt: BirdType) {
    setForm(f => ({
      ...f,
      recommended_for: f.recommended_for.includes(bt)
        ? f.recommended_for.filter(b => b !== bt)
        : [...f.recommended_for, bt],
    }));
  }

  async function handleSave(addNext = false) {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form, addNext);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-0.5';

  function NumField({ label, field, step = '0.01' }: { label: string; field: keyof FeedIngredientInsert; step?: string }) {
    const val = form[field];
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <input
          type="number"
          step={step}
          value={val == null ? '' : String(val)}
          onChange={e => setN(field, e.target.value)}
          className={inputCls}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        {/* Nagłówek */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            {isNew ? '➕ Nowy składnik' : '✏️ Edycja składnika'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Nazwa + kategoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Nazwa *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Kategoria</label>
              <select
                value={form.category ?? ''}
                onChange={e => setForm(f => ({ ...f, category: (e.target.value as IngredientCategory) || null }))}
                className={inputCls}
              >
                <option value="">— wybierz —</option>
                {ALL_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Polecane dla */}
          <div>
            <label className={labelCls}>Polecane dla</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_BIRD_TYPES.map(bt => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => toggleBird(bt)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    form.recommended_for.includes(bt)
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {BIRD_TYPE_LABELS[bt]}
                </button>
              ))}
            </div>
          </div>

          {/* Cena */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Cena (zł/100 kg)</label>
              <input
                type="number" step="0.01"
                value={form.cena_zl_100kg == null ? '' : String(form.cena_zl_100kg)}
                onChange={e => setN('cena_zl_100kg', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Udział optymalny (%)</label>
              <input
                type="text"
                value={form.udzial_optymalny_pct ?? ''}
                onChange={e => setS('udzial_optymalny_pct', e.target.value)}
                placeholder="np. 5--15"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Udział max (%)</label>
              <input
                type="number" step="1"
                value={form.udzial_max_pct == null ? '' : String(form.udzial_max_pct)}
                onChange={e => setN('udzial_max_pct', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Zakładki danych technicznych */}
          <div>
            <div className="flex gap-1 border-b border-gray-200 mb-3 overflow-x-auto">
              {(Object.keys(COL_GROUP_LABELS) as ColGroup[]).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTab(g)}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-t transition-colors ${
                    tab === g
                      ? 'bg-green-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {COL_GROUP_LABELS[g]}
                </button>
              ))}
            </div>

            {tab === 'podstawowe' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Sucha masa (%)" field="sucha_masa_pct" />
                <NumField label="Białko (%)" field="bialko_ogolne_pct" />
                <NumField label="Tłuszcz (%)" field="tluszcz_surowy_pct" />
                <NumField label="Włókno (%)" field="wlokno_surowe_pct" />
                <NumField label="Zw. bezazot. (%)" field="zwiazki_bezazotowe_pct" />
                <NumField label="Popiół (%)" field="popiol_pct" />
                <NumField label="Skrobia (%)" field="skrobia_pct" />
                <NumField label="Cukier (%)" field="cukier_pct" />
                <NumField label="Energia (kcal)" field="energia_kcal" step="1" />
                <NumField label="Energia (MJ)" field="energia_mj" />
              </div>
            )}

            {tab === 'mineraly' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Ca (%)" field="ca_pct" step="0.001" />
                <NumField label="P całk. (%)" field="p_total_pct" step="0.001" />
                <NumField label="P przysw. (%)" field="p_przyswajalne_pct" step="0.001" />
                <NumField label="Mg (%)" field="mg_pct" step="0.001" />
                <NumField label="K (%)" field="k_pct" step="0.001" />
                <NumField label="Na (%)" field="na_pct" step="0.001" />
                <NumField label="Cl (%)" field="cl_pct" step="0.001" />
                <NumField label="S (%)" field="s_pct" step="0.001" />
                <NumField label="Fe (mg)" field="fe_mg" />
                <NumField label="Mn (mg)" field="mn_mg" />
                <NumField label="Zn (mg)" field="zn_mg" />
                <NumField label="Cu (mg)" field="cu_mg" />
                <NumField label="Co (µg)" field="co_mcg" />
                <NumField label="I (mg)" field="i_mg" step="0.001" />
                <NumField label="Se (mg)" field="se_mg" step="0.0001" />
              </div>
            )}

            {tab === 'aminokwasy' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Lys (%)" field="aa_lys" step="0.001" />
                <NumField label="Met (%)" field="aa_met" step="0.001" />
                <NumField label="Met+Cys (%)" field="aa_met_cys" step="0.001" />
                <NumField label="Trp (%)" field="aa_trp" step="0.001" />
                <NumField label="Thr (%)" field="aa_thr" step="0.001" />
                <NumField label="Ile (%)" field="aa_ile" step="0.001" />
                <NumField label="Leu (%)" field="aa_leu" step="0.001" />
                <NumField label="Val (%)" field="aa_val" step="0.001" />
                <NumField label="His (%)" field="aa_his" step="0.001" />
                <NumField label="Arg (%)" field="aa_arg" step="0.001" />
                <NumField label="Phe (%)" field="aa_phe" step="0.001" />
                <NumField label="Tyr (%)" field="aa_tyr" step="0.001" />
              </div>
            )}

            {tab === 'witaminy' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumField label="Wit. A (j.m.)" field="vit_a_jm" />
                <NumField label="Wit. D3" field="vit_d3" />
                <NumField label="Wit. E (mg)" field="vit_e_mg" />
                <NumField label="Wit. B1 (mg)" field="vit_b1_mg" step="0.001" />
                <NumField label="Wit. B2 (mg)" field="vit_b2_mg" step="0.001" />
                <NumField label="Wit. B6 (mg)" field="vit_b6_mg" step="0.001" />
                <NumField label="Kw. pantotenowy (mg)" field="kwas_pantotenowy_mg" step="0.001" />
                <NumField label="Kw. foliowy (mg)" field="kwas_foliowy_mg" step="0.001" />
                <NumField label="Biotyna (mg)" field="biotyna_mg" step="0.001" />
                <NumField label="Niacyna (mg)" field="niacyna_mg" />
                <NumField label="Wit. B12 (µg)" field="vit_b12_mcg" step="0.001" />
                <NumField label="Cholina (g)" field="cholina_g" step="0.001" />
                <NumField label="Kw. linolowy (g)" field="kwas_linolowy_g" step="0.001" />
              </div>
            )}

            {tab === 'udzial' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Udział optymalny to zakres tekstowy np. <code className="bg-gray-100 px-1 rounded">5--15</code>.
                  Udział max to liczba — maksymalny procent w mieszance.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Udział optymalny (%)</label>
                    <input
                      type="text"
                      value={form.udzial_optymalny_pct ?? ''}
                      onChange={e => setS('udzial_optymalny_pct', e.target.value)}
                      placeholder="np. 5--15"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Udział max (%)</label>
                    <input
                      type="number" step="1"
                      value={form.udzial_max_pct == null ? '' : String(form.udzial_max_pct)}
                      onChange={e => setN('udzial_max_pct', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notatki */}
          <div>
            <label className={labelCls}>Notatki</label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={e => setS('notes', e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Stopka */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Anuluj
          </button>
          {isNew && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 font-medium"
            >
              Zapisz i dodaj kolejny
            </button>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Zapisuję…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Główna strona
// ─────────────────────────────────────────────────────────────────────────────

export function FeedIngredientsPage() {
  const [ingredients, setIngredients] = useState<FeedIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtry
  const [search, setSearch] = useState('');
  const [filterBird, setFilterBird] = useState<BirdType | ''>('');
  const [filterCategory, setFilterCategory] = useState<IngredientCategory | ''>('');

  // Zakładka kolumn
  const [colGroup, setColGroup] = useState<ColGroup>('podstawowe');

  // Modal edycji/nowego
  const [editItem, setEditItem] = useState<FeedIngredient | null | 'new'>(null);

  // Toast
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo soft-delete
  const [undoPending, setUndoPending] = useState<{ id: string; name: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ładowanie danych ──
  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await feedIngredientService.getAll();
      setIngredients(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Błąd ładowania';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtrowanie ──
  const filtered = useMemo(() => {
    return ingredients.filter(i => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterBird && !i.recommended_for.includes(filterBird as BirdType)) return false;
      if (filterCategory && i.category !== filterCategory) return false;
      return true;
    });
  }, [ingredients, search, filterBird, filterCategory]);

  // Grupowanie po kategorii
  const grouped = useMemo(() => {
    const map = new Map<string, FeedIngredient[]>();
    for (const ing of filtered) {
      const cat = ing.category
        ? CATEGORY_LABELS[ing.category as IngredientCategory] ?? ing.category
        : 'Inne';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ing);
    }
    return map;
  }, [filtered]);

  // ── Toast helper ──
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  // ── Zapis (create/update) ──
  async function handleSave(data: FeedIngredientInsert | FeedIngredientUpdate, addNext = false) {
    try {
      if (editItem === 'new') {
        await feedIngredientService.create(data as FeedIngredientInsert);
        showToast('✅ Składnik dodany');
      } else if (editItem) {
        await feedIngredientService.update(editItem.id, data as FeedIngredientUpdate);
        showToast('✅ Zapisano zmiany');
      }
      await load();
      if (addNext) {
        setEditItem('new');
      } else {
        setEditItem(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Błąd zapisu';
      showToast(`❌ ${msg}`);
    }
  }

  // ── Usuwanie (soft) z undo ──
  async function handleDelete(ing: FeedIngredient) {
    if (!window.confirm(`Usunąć składnik „${ing.name}"?`)) return;

    // Optymistycznie usuń z listy
    setIngredients(prev => prev.filter(i => i.id !== ing.id));
    setUndoPending({ id: ing.id, name: ing.name });

    // Soft delete po 5 sek. (lub od razu, jeśli nie cofną)
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      try {
        await feedIngredientService.delete(ing.id);
        setUndoPending(null);
      } catch {
        // przywróć
        await load();
        setUndoPending(null);
      }
    }, 5000);
  }

  async function handleUndo() {
    if (!undoPending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoPending(null);
    await load(); // przywróć stan z bazy (składnik nie został jeszcze soft-deleted)
    showToast(`↩️ Cofnięto usunięcie „${undoPending.name}"`);
  }

  // ── Kolumny wg zakładki ──
  const colDefs = useMemo(() => {
    if (colGroup === 'podstawowe') return [
      { key: 'sucha_masa_pct',       label: 'Sucha\nmasa %',  dec: 1 },
      { key: 'bialko_ogolne_pct',    label: 'Białko %',       dec: 1 },
      { key: 'tluszcz_surowy_pct',   label: 'Tłuszcz %',      dec: 1 },
      { key: 'wlokno_surowe_pct',    label: 'Włókno %',       dec: 1 },
      { key: 'energia_kcal',         label: 'EM\n(kcal)',      dec: 0 },
      { key: 'energia_mj',           label: 'EM\n(MJ)',        dec: 2 },
    ];
    if (colGroup === 'mineraly') return [
      { key: 'ca_pct',               label: 'Ca %',    dec: 3 },
      { key: 'p_total_pct',          label: 'P całk.', dec: 3 },
      { key: 'p_przyswajalne_pct',   label: 'P przysw.',dec: 3 },
      { key: 'na_pct',               label: 'Na %',    dec: 3 },
      { key: 'mg_pct',               label: 'Mg %',    dec: 3 },
      { key: 'k_pct',                label: 'K %',     dec: 3 },
    ];
    if (colGroup === 'aminokwasy') return [
      { key: 'aa_lys',    label: 'Lys %', dec: 3 },
      { key: 'aa_met',    label: 'Met %', dec: 3 },
      { key: 'aa_met_cys',label: 'Met\n+Cys', dec: 3 },
      { key: 'aa_trp',    label: 'Trp %', dec: 3 },
      { key: 'aa_thr',    label: 'Thr %', dec: 3 },
    ];
    if (colGroup === 'witaminy') return [
      { key: 'vit_e_mg',   label: 'Wit. E\n(mg)',  dec: 1 },
      { key: 'vit_b1_mg',  label: 'B1\n(mg)',      dec: 2 },
      { key: 'vit_b2_mg',  label: 'B2\n(mg)',      dec: 2 },
      { key: 'niacyna_mg', label: 'Niacyna\n(mg)', dec: 1 },
    ];
    if (colGroup === 'udzial') return [
      { key: 'udzial_optymalny_pct', label: 'Optymalny %', dec: -1 },
      { key: 'udzial_max_pct',       label: 'Max %',        dec: 0 },
      { key: 'cena_zl_100kg',        label: 'Cena\nzł/100kg', dec: 2 },
    ];
    return [];
  }, [colGroup]);

  // ── Render ──
  const selectCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-white';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Nagłówek */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🧪 Składniki paszowe</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Baza {ingredients.length} składników — wartości odżywcze, minerały, aminokwasy
          </p>
        </div>
        <button
          onClick={() => setEditItem('new')}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          ➕ Nowy składnik
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="🔍 Szukaj po nazwie…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <select
          value={filterBird}
          onChange={e => setFilterBird(e.target.value as BirdType | '')}
          className={selectCls}
        >
          <option value="">Wszystkie gatunki</option>
          {ALL_BIRD_TYPES.map(bt => (
            <option key={bt} value={bt}>{BIRD_TYPE_LABELS[bt]}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value as IngredientCategory | '')}
          className={selectCls}
        >
          <option value="">Wszystkie kategorie</option>
          {ALL_CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        {(search || filterBird || filterCategory) && (
          <button
            onClick={() => { setSearch(''); setFilterBird(''); setFilterCategory(''); }}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
          >
            ✕ Wyczyść filtry
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400">
          {filtered.length} / {ingredients.length} składników
        </span>
      </div>

      {/* Zakładki kolumn */}
      <div className="flex gap-1 overflow-x-auto">
        {(Object.keys(COL_GROUP_LABELS) as ColGroup[]).map(g => (
          <button
            key={g}
            onClick={() => setColGroup(g)}
            className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              colGroup === g
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {COL_GROUP_LABELS[g]}
          </button>
        ))}
      </div>

      {/* Błąd */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Tabela */}
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[180px]">Nazwa</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-700 min-w-[130px]">Kategoria</th>
                {colDefs.map(c => (
                  <th key={c.key} className="text-right px-2 py-2.5 font-semibold text-gray-700 min-w-[70px] whitespace-pre-line leading-tight">
                    {c.label}
                  </th>
                ))}
                <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Polecane dla</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colDefs.length + 4} className="text-center py-12 text-gray-400">
                    {ingredients.length === 0
                      ? 'Brak składników — dodaj pierwszy lub załaduj seed SQL'
                      : 'Brak wyników dla podanych filtrów'}
                  </td>
                </tr>
              )}
              {Array.from(grouped.entries()).map(([cat, items]) => (
                <React.Fragment key={cat}>
                  {/* Separator kategorii */}
                  <tr className="bg-green-50/60 border-t border-b border-green-100">
                    <td colSpan={colDefs.length + 4} className="px-3 py-1.5">
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">{cat}</span>
                      <span className="ml-2 text-xs text-green-500">({items.length})</span>
                    </td>
                  </tr>
                  {items.map((ing, idx) => (
                    <tr
                      key={ing.id}
                      className={`border-b border-gray-100 hover:bg-green-50/30 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">{ing.name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {ing.category ? CATEGORY_LABELS[ing.category as IngredientCategory] : '—'}
                      </td>
                      {colDefs.map(c => {
                        const val = (ing as unknown as Record<string, unknown>)[c.key];
                        return (
                          <td key={c.key} className="px-2 py-2 text-right text-gray-700 tabular-nums">
                            {c.dec === -1
                              ? String(val ?? '—')
                              : fmt(val as number | null, c.dec)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {ing.recommended_for.map(bt => (
                            <span
                              key={bt}
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BIRD_TYPE_COLORS[bt as BirdType]}`}
                            >
                              {BIRD_TYPE_LABELS[bt as BirdType]}
                            </span>
                          ))}
                          {ing.recommended_for.length === 0 && (
                            <span className="text-xs text-gray-400">wszystkie</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setEditItem(ing)}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded"
                            title="Edytuj"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(ing)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded"
                            title="Usuń"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {editItem !== null && (
        <IngredientForm
          initial={editItem === 'new' ? null : editItem}
          onSave={handleSave}
          onCancel={() => setEditItem(null)}
          isNew={editItem === 'new'}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 transition-all">
          {toast}
        </div>
      )}

      {/* Undo soft-delete */}
      {undoPending && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-3">
          <span>🗑️ Usunięto „{undoPending.name}"</span>
          <button
            onClick={handleUndo}
            className="bg-white text-gray-800 font-semibold px-3 py-1 rounded-lg hover:bg-gray-100 text-xs"
          >
            Cofnij
          </button>
        </div>
      )}
    </div>
  );
}
