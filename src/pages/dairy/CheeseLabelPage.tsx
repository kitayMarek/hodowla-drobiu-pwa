import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { ProductionBatch } from '@/models/dairy.model';
import { PRODUCT_LABELS } from '@/models/dairy.model';
import { fetchRecipeBySlug } from '@/services/recipeContract.service';
import type { Recipe } from '@/models/recipe.schema';
import { useSettings } from '@/hooks/useSettings';
import { batchCode } from '@/utils/cheeseStock';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface LabelFields {
  nazwa: string; masaNetto: string; dataProdukcji: string; typDaty: 'minimalnej' | 'przydatnosci';
  dataWaznosci: string; przechowywanie: string; sklad: string; alergeny: string;
  numerPartii: string; producent: string; adres: string; nrWet: string; nrRhd: string; uwagi: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtD = (d: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pl-PL') : '');
const dateLabel = (t: string) => (t === 'minimalnej' ? 'Najlepiej spożyć przed' : 'Należy spożyć do');

export function CheeseLabelPage() {
  const { id } = useParams<{ id: string }>();
  const settings = useSettings();
  const [batch, setBatch] = useState<ProductionBatch | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [f, setF] = useState<LabelFields | null>(null);
  const [copies, setCopies] = useState('1');

  useEffect(() => {
    if (!id) return;
    dairyService.getBatchById(Number(id)).then(b => {
      setBatch(b ?? null);
      if (b?.cheeseVariety) fetchRecipeBySlug(b.cheeseVariety).then(setRecipe).catch(() => {});
    });
  }, [id]);

  // Prefill raz, gdy partia (i ew. przepis) gotowe
  useEffect(() => {
    if (!batch || f) return;
    const milk = recipe?.mleko.typy?.[0] || recipe?.mleko.typ || 'krowie';
    const sklad = [`MLEKO ${milk}`, recipe?.kultury?.length ? 'kultury bakterii fermentacji mlekowej' : '', recipe?.podpuszczka ? 'podpuszczka' : '', 'sól']
      .filter(Boolean).join(', ');
    setF({
      nazwa: batch.cheeseName || PRODUCT_LABELS[batch.productType],
      masaNetto: '',
      dataProdukcji: batch.productionDate,
      typDaty: 'minimalnej',
      dataWaznosci: batch.expiryDate || '',
      przechowywanie: String(settings.rhd_storage_default || 'Przechowywać w temp. 4–8°C'),
      sklad,
      alergeny: 'Zawiera: mleko',
      numerPartii: batchCode(batch),
      producent: String(settings.rhd_producer_name || ''),
      adres: String(settings.rhd_producer_address || ''),
      nrWet: String(settings.rhd_vet_number || ''),
      nrRhd: String(settings.rhd_reg_number || ''),
      uwagi: '',
    });
  }, [batch, recipe, settings, f]);

  if (!batch || !f) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;
  const set = (k: keyof LabelFields, v: string) => setF(prev => prev ? { ...prev, [k]: v } : prev);

  const labelHtml = () => `
    <div class="lbl">
      <div class="hd"><div><div class="nm">${esc(f.nazwa)}</div><div class="rhd">ROLNICZY HANDEL DETALICZNY</div></div></div>
      <table>
        ${f.producent ? `<tr><td>Producent</td><td><b>${esc(f.producent)}</b></td></tr>` : ''}
        ${f.adres ? `<tr><td>Adres</td><td>${esc(f.adres).replace(/\n/g, ', ')}</td></tr>` : ''}
        ${f.masaNetto ? `<tr><td>Masa netto</td><td><b>${esc(f.masaNetto)}</b></td></tr>` : ''}
        <tr><td>Data produkcji</td><td>${fmtD(f.dataProdukcji)}</td></tr>
        <tr><td>${dateLabel(f.typDaty)}</td><td><b>${fmtD(f.dataWaznosci)}</b></td></tr>
        ${f.przechowywanie ? `<tr><td>Przechowywanie</td><td>${esc(f.przechowywanie)}</td></tr>` : ''}
        <tr><td>Partia</td><td>${esc(f.numerPartii)}</td></tr>
        ${f.nrWet ? `<tr><td>Nr wet.</td><td>${esc(f.nrWet)}</td></tr>` : ''}
        ${f.nrRhd ? `<tr><td>Nr RHD</td><td>${esc(f.nrRhd)}</td></tr>` : ''}
      </table>
      ${f.sklad ? `<div class="sk"><b>Skład:</b> ${esc(f.sklad)}</div>` : ''}
      ${f.alergeny ? `<div class="al">${esc(f.alergeny)}</div>` : ''}
      ${f.uwagi ? `<div class="uw">${esc(f.uwagi)}</div>` : ''}
    </div>`;

  const print = () => {
    const n = Math.max(1, Math.min(50, parseInt(copies) || 1));
    const css = `*{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif}
      .lbl{width:10cm;height:7cm;padding:0.5cm;border:1px solid #333;font-size:10px;line-height:1.4;page-break-after:always;overflow:hidden}
      .nm{font-size:15px;font-weight:bold;line-height:1.2}
      .rhd{font-size:9px;color:#555;margin-top:2px}
      table{width:100%;font-size:9px;border-collapse:collapse;margin-top:6px;border-top:1px solid #ccc;padding-top:4px}
      td{padding:1px 0;vertical-align:top} td:first-child{color:#666;width:42%}
      .sk{margin-top:4px;font-size:8px;border-top:1px solid #eee;padding-top:3px}
      .al{font-size:8px;font-weight:bold;margin-top:1px}
      .uw{margin-top:3px;font-size:8px;color:#777}
      @media print{.lbl{border:none}@page{size:10cm 7cm;margin:0}}`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etykieta ${esc(f.numerPartii)}</title><style>${css}</style></head><body>${labelHtml().repeat(n)}<scr` + `ipt>window.onload=()=>window.print()</scr` + `ipt></body></html>`);
    w.document.close();
  };

  const I = (label: string, k: keyof LabelFields, ph?: string) => (
    <div>
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</label>
      <input value={f[k] as string} onChange={e => set(k, e.target.value)} placeholder={ph}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <Link to={`/mleko/partie/${batch.id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Partia</Link>
        <h1 className="text-xl font-bold text-gray-900">🏷️ Etykieta RHD</h1>
      </div>

      {!f.producent && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          ⚠ Uzupełnij <Link to="/ustawienia" className="underline font-medium">dane producenta w Ustawieniach</Link> — pojawią się tu automatycznie.
        </div>
      )}

      {/* Podgląd live */}
      <div className="overflow-x-auto">
        <div style={{ width: '10cm', height: '7cm', padding: '0.5cm', border: '1px solid #333', fontSize: 10, lineHeight: 1.4, background: '#fff', fontFamily: 'Arial, sans-serif' }}
          dangerouslySetInnerHTML={{ __html: `<style>.pv .nm{font-size:15px;font-weight:bold}.pv .rhd{font-size:9px;color:#555}.pv table{width:100%;font-size:9px;border-collapse:collapse;margin-top:6px;border-top:1px solid #ccc;padding-top:4px}.pv td{padding:1px 0;vertical-align:top}.pv td:first-child{color:#666;width:42%}.pv .sk{margin-top:4px;font-size:8px;border-top:1px solid #eee;padding-top:3px}.pv .al{font-size:8px;font-weight:bold}.pv .uw{margin-top:3px;font-size:8px;color:#777}</style><div class="pv">${labelHtml().replace('<div class="lbl">', '<div>').replace(/page-break-after:always/, '')}</div>` }} />
      </div>

      {/* Druk */}
      <div className="flex items-end gap-2">
        <div className="w-28">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ile sztuk</label>
          <input type="number" min="1" max="50" value={copies} onChange={e => setCopies(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <Button className="flex-1" onClick={print}>🖨 Drukuj etykietę ({copies})</Button>
      </div>

      {/* Edycja pól */}
      <Card title="Produkt" padding="md">
        <div className="space-y-3">
          {I('Nazwa', 'nazwa')}
          {I('Masa netto', 'masaNetto', 'np. 0,5 kg')}
          {I('Skład', 'sklad')}
          {I('Alergeny', 'alergeny')}
        </div>
      </Card>

      <Card title="Daty i przechowywanie" padding="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data produkcji</label>
              <input type="date" value={f.dataProdukcji} onChange={e => set('dataProdukcji', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data ważności</label>
              <input type="date" value={f.dataWaznosci} onChange={e => set('dataWaznosci', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Typ daty</label>
            <select value={f.typDaty} onChange={e => set('typDaty', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="minimalnej">Najlepiej spożyć przed (dojrzewające)</option>
              <option value="przydatnosci">Należy spożyć do (świeże)</option>
            </select>
          </div>
          {I('Warunki przechowywania', 'przechowywanie')}
        </div>
      </Card>

      <Card title="Producent i identyfikacja" padding="md">
        <div className="space-y-3">
          {I('Producent', 'producent')}
          {I('Adres', 'adres')}
          {I('Nr weterynaryjny', 'nrWet')}
          {I('Nr RHD', 'nrRhd')}
          {I('Nr partii', 'numerPartii')}
          {I('Uwagi', 'uwagi', 'np. ser z mleka surowego')}
        </div>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Etykieta to pomoc techniczna — za zgodność znakowania z przepisami odpowiada producent. Zweryfikuj u powiatowego lekarza weterynarii.
      </p>
    </div>
  );
}
