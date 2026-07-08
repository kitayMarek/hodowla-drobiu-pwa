import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { vatRrService } from '@/services/vatRr.service';
import { cashFlowService } from '@/services/cashFlow.service';
import type { VatRrInvoice } from '@/models/vatRr.model';
import { VAT_RR_STATUS_LABELS, VAT_RR_STATUS_COLORS, OSWIADCZENIE_ROLNIKA } from '@/models/vatRr.model';
import type { CashAccount } from '@/models/cashFlow.model';
import { UNIT_LABELS } from '@/models/dairy.model';
import { useSettings } from '@/hooks/useSettings';
import { grToPln, kwotaSlownie } from '@/utils/vatRr';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtD = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pl-PL') : '');
const qty = (milli: number) => (milli / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 3 });

export function VatRrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const settings = useSettings();
  const [inv, setInv] = useState<VatRrInvoice | null>(null);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);

  // panele
  const [numForm, setNumForm] = useState({ number: '', issueDate: new Date().toISOString().slice(0, 10) });
  const [payForm, setPayForm] = useState({ accountId: '' as number | '', paidAt: new Date().toISOString().slice(0, 10), ref: '' });
  const [busy, setBusy] = useState(false);

  const load = () => { if (id) vatRrService.getInvoiceById(Number(id)).then(v => setInv(v ?? null)); };
  useEffect(() => { load(); cashFlowService.getActiveAccounts().then(setAccounts); }, [id]);

  useEffect(() => {
    if (inv) {
      setNumForm(f => ({ ...f, number: inv.invoiceNumber || '', issueDate: inv.issueDate || f.issueDate }));
      setPayForm(f => ({ ...f, accountId: inv.cashAccountId ?? f.accountId }));
    }
  }, [inv?.id]);

  if (!inv) return <p className="text-sm text-gray-400 p-4">Ładowanie…</p>;

  const supplier = {
    name: String(settings.rhd_producer_name || ''),
    address: String(settings.rhd_producer_address || ''),
    taxId: String(settings.vat_rr_supplier_tax_id || ''),
    taxType: String(settings.vat_rr_supplier_tax_id_type || 'pesel') === 'nip' ? 'NIP' : 'PESEL',
    bank: String(settings.vat_rr_bank_account || ''),
    rhd: String(settings.rhd_reg_number || ''),
    vet: String(settings.rhd_vet_number || ''),
  };
  const supplierMissing = !supplier.name || !supplier.taxId || !supplier.bank;
  const isDraft = !inv.invoiceNumber;
  const lines = inv.lines ?? [];

  // ── Wydruk A4 ──────────────────────────────────────────────
  const buildDoc = (copyLabel: string) => {
    const projektBanner = isDraft
      ? `<div class="proj">PROJEKT — numer i datę nadaje nabywca</div>` : '';
    const rows = lines.map(l => `
      <tr>
        <td class="c">${l.position}</td>
        <td>${esc(l.productName)}</td>
        <td>${esc(l.qualityClass || '—')}</td>
        <td class="c">${esc(UNIT_LABELS[l.unit] || l.unit)}</td>
        <td class="r">${qty(l.quantityMilli)}</td>
        <td class="r">${grToPln(l.unitPriceGr)}</td>
        <td class="r">${grToPln(l.netValueGr)}</td>
      </tr>`).join('');
    const transferTitle = inv.invoiceNumber
      ? `Faktura VAT RR nr ${esc(inv.invoiceNumber)} z dnia ${fmtD(inv.issueDate)}`
      : `Faktura VAT RR nr ……………… z dnia ………………`;
    return `
    <div class="page">
      ${projektBanner}
      <div class="ti">FAKTURA VAT RR</div>
      <div class="meta">
        <div>Nr faktury: <b>${inv.invoiceNumber ? esc(inv.invoiceNumber) : '……………………………'}</b> ${isDraft ? '<span class="mut">(wypełnia nabywca)</span>' : ''}</div>
        <div>Data wystawienia: <b>${inv.issueDate ? fmtD(inv.issueDate) : '……………………'}</b> ${isDraft ? '<span class="mut">(wypełnia nabywca)</span>' : ''}</div>
        <div>Data dokonania nabycia: <b>${fmtD(inv.purchaseDate)}</b></div>
        <div class="mut">Nr wewnętrzny dostawcy: ${esc(inv.docRef)} (referencja pomocnicza, nie jest numerem faktury)</div>
      </div>
      <div class="parties">
        <div class="party">
          <div class="ph">DOSTAWCA (rolnik ryczałtowy)</div>
          <b>${esc(supplier.name) || '—'}</b><br>
          ${esc(supplier.address).replace(/\n/g, '<br>')}<br>
          ${supplier.taxType}: ${esc(supplier.taxId) || '—'}<br>
          ${supplier.bank ? `Rachunek: ${esc(supplier.bank)}` : ''}
          ${supplier.rhd ? `<br>RHD ${esc(supplier.rhd)}` : ''}${supplier.vet ? ` · WNL ${esc(supplier.vet)}` : ''}
        </div>
        <div class="party">
          <div class="ph">NABYWCA (czynny podatnik VAT)</div>
          <b>${esc(inv.buyerName || '')}</b><br>
          ${esc(inv.buyerAddress || '')}<br>
          NIP: ${esc(inv.buyerNip || '—')}
        </div>
      </div>
      <table>
        <thead><tr><th>Lp</th><th>Nazwa produktu rolnego</th><th>Klasa / jakość</th><th>J.m.</th><th>Ilość</th><th>Cena netto</th><th>Wartość netto</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sums">
        <div><span>Wartość netto:</span><b>${grToPln(inv.netTotalGr)}</b></div>
        <div><span>Stawka zryczałtowanego zwrotu:</span><b>${inv.flatRatePct}%</b></div>
        <div><span>Kwota zryczałtowanego zwrotu:</span><b>${grToPln(inv.flatRateGr)}</b></div>
        <div class="tot"><span>DO ZAPŁATY:</span><b>${grToPln(inv.grossTotalGr)}</b></div>
      </div>
      <div class="slownie">Słownie do zapłaty: <i>${kwotaSlownie(inv.grossTotalGr)}</i></div>
      <div class="slownie">Zryczałtowany zwrot słownie: <i>${kwotaSlownie(inv.flatRateGr)}</i></div>
      <div class="pay">Płatność: <b>${inv.paymentMethod === 'transfer' ? 'przelew' : 'gotówka'}</b>. Sugerowany tytuł przelewu: „${transferTitle}"</div>
      <div class="osw"><b>OŚWIADCZENIE DOSTAWCY</b><br>${esc(OSWIADCZENIE_ROLNIKA)}</div>
      <div class="sig">
        <div><div class="line"></div>podpis osoby uprawnionej do wystawienia<br>(nabywca)</div>
        <div><div class="line"></div>podpis osoby uprawnionej do otrzymania<br>(dostawca)</div>
      </div>
      <div class="copy">${copyLabel}</div>
    </div>`;
  };

  const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#111;font-size:11px}
    .page{width:210mm;min-height:297mm;padding:15mm;page-break-after:always}
    .proj{border:2px dashed #b45309;color:#b45309;font-weight:bold;text-align:center;padding:5px;margin-bottom:8px;letter-spacing:1px}
    .ti{font-size:22px;font-weight:bold;text-align:center;margin:6px 0 12px}
    .meta{font-size:11px;line-height:1.6;margin-bottom:10px}
    .mut{color:#666}
    .parties{display:flex;gap:12px;margin:10px 0}
    .party{flex:1;border:1px solid #ccc;padding:8px;line-height:1.5}
    .ph{font-size:9px;color:#666;letter-spacing:0.5px;margin-bottom:3px}
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10px}
    th,td{border:1px solid #999;padding:4px 6px}
    th{background:#f0f0f0;text-align:left;font-size:9px}
    td.c{text-align:center}td.r{text-align:right}
    .sums{margin-left:auto;width:60%}
    .sums div{display:flex;justify-content:space-between;padding:2px 0}
    .sums .tot{border-top:2px solid #333;margin-top:3px;padding-top:5px;font-size:14px}
    .slownie{font-size:10px;margin-top:3px}
    .pay{font-size:10px;margin-top:8px;color:#333}
    .osw{border:1px solid #333;padding:8px;margin:12px 0;font-size:10px;line-height:1.5}
    .sig{display:flex;gap:40px;margin-top:30px}
    .sig>div{flex:1;text-align:center;font-size:9px;color:#444}
    .sig .line{border-top:1px solid #333;margin-bottom:4px;height:1px}
    .copy{text-align:right;font-size:9px;color:#888;margin-top:14px}
    @media print{@page{size:A4;margin:0}.page{margin:0}}`;

  const doPrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const body = buildDoc('Oryginał — dla dostawcy') + buildDoc('Kopia — dla nabywcy');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Faktura VAT RR ${esc(inv.invoiceNumber || inv.docRef)}</title><style>${CSS}</style></head><body>${body}<scr` + `ipt>window.onload=()=>window.print()</scr` + `ipt></body></html>`);
    w.document.close();
    if (inv.status === 'draft') vatRrService.setStatus(inv.id!, 'printed').then(load);
  };

  // ── Akcje ──────────────────────────────────────────────
  const saveNumber = async () => {
    if (!numForm.number.trim()) return;
    setBusy(true);
    await vatRrService.updateInvoice(inv.id!, { invoiceNumber: numForm.number.trim(), issueDate: numForm.issueDate, status: 'numbered' });
    setBusy(false); load();
  };
  const doPay = async () => {
    setBusy(true);
    await vatRrService.markPaid(inv.id!, {
      cashAccountId: payForm.accountId !== '' ? payForm.accountId : undefined,
      paidAt: payForm.paidAt, paymentRef: payForm.ref.trim() || undefined,
    });
    setBusy(false); load();
  };
  const doVoid = async () => {
    if (!confirm('Anulować dokument (void)? Nie zostanie usunięty — pozostaje w archiwum (retencja 5 lat).')) return;
    await vatRrService.voidInvoice(inv.id!); load();
  };
  const doDelete = async () => {
    if (!confirm('Usunąć projekt na stałe?')) return;
    try { await vatRrService.deleteDraft(inv.id!); navigate('/vat-rr'); }
    catch (e) { alert(e instanceof Error ? e.message : 'Błąd'); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/vat-rr" className="text-gray-400 hover:text-gray-600 text-sm">← Faktury</Link>
          <h1 className="text-xl font-bold text-gray-900">🧾 {inv.invoiceNumber || inv.docRef}</h1>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VAT_RR_STATUS_COLORS[inv.status]}`}>
          {VAT_RR_STATUS_LABELS[inv.status]}
        </span>
      </div>

      {supplierMissing && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
          ⚠ Uzupełnij <Link to="/ustawienia" className="underline font-medium">dane dostawcy w Ustawieniach</Link> (nazwa, PESEL/NIP, rachunek) — trafią na fakturę.
        </div>
      )}

      {/* Podsumowanie */}
      <Card padding="md">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Nabywca</span><span className="font-medium text-right">{inv.buyerName}<br /><span className="text-xs text-gray-400">NIP {inv.buyerNip}</span></span></div>
          <div className="flex justify-between"><span className="text-gray-500">Data nabycia</span><span>{fmtD(inv.purchaseDate)}</span></div>
          <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Wartość netto</span><span>{grToPln(inv.netTotalGr)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Zryczałtowany zwrot ({inv.flatRatePct}%)</span><span>{grToPln(inv.flatRateGr)}</span></div>
          <div className="flex justify-between text-base font-bold"><span className="text-brand-700">Do zapłaty</span><span className="text-brand-800">{grToPln(inv.grossTotalGr)}</span></div>
          <div className="text-xs text-gray-400">Słownie: {kwotaSlownie(inv.grossTotalGr)}</div>
          {inv.rhdNumber && <div className="text-xs text-green-600 pt-1">✓ RHD #{inv.rhdNumber}/{inv.rhdYear}</div>}
        </div>
      </Card>

      {inv.status !== 'void' && (
        <Button className="w-full" onClick={doPrint}>🖨 Drukuj (Oryginał + Kopia)</Button>
      )}

      {/* Nabywca nadał numer */}
      {inv.status !== 'void' && inv.status !== 'paid' && (
        <Card title="Nabywca nadał numer faktury" padding="md">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Numer faktury</label>
                <input value={numForm.number} onChange={e => setNumForm(f => ({ ...f, number: e.target.value }))} placeholder="np. FV/RR/12/2026"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data wystawienia</label>
                <input type="date" value={numForm.issueDate} onChange={e => setNumForm(f => ({ ...f, issueDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <Button size="sm" variant="outline" loading={busy} disabled={!numForm.number.trim()} onClick={saveNumber}>Zapisz numer nabywcy</Button>
          </div>
        </Card>
      )}

      {/* Zaksięguj wpłatę */}
      {inv.status !== 'void' && inv.status !== 'paid' && (
        <Card title="Zaksięguj wpłatę (→ przychód + RHD)" padding="md">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data wpłaty</label>
                <input type="date" value={payForm.paidAt} onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Konto</label>
                <select value={payForm.accountId} onChange={e => setPayForm(f => ({ ...f, accountId: e.target.value ? Number(e.target.value) : '' }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">— nie księguj —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.type === 'bank' ? '🏦' : '💵'} {a.name}</option>)}
                </select>
              </div>
            </div>
            <Button size="sm" loading={busy} onClick={doPay}>Oznacz jako opłaconą</Button>
            <p className="text-xs text-gray-400">Zaksięguje przychód (brutto) w kasie i nada numer RHD ze wspólnej rocznej sekwencji.</p>
          </div>
        </Card>
      )}

      {/* Uwagi */}
      {inv.notes && <Card padding="md"><p className="text-sm text-gray-600 whitespace-pre-wrap">{inv.notes}</p></Card>}

      {/* Akcje destrukcyjne */}
      <div className="flex gap-3 pb-4">
        {inv.status === 'draft' && <Button variant="outline" onClick={doDelete}>Usuń projekt</Button>}
        {inv.status !== 'void' && inv.status !== 'draft' && <Button variant="outline" onClick={doVoid}>Anuluj (void)</Button>}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Dokument to pomoc techniczna. Formalnym wystawcą faktury VAT RR jest nabywca (art. 116 ust. 1). Za zgodność znakowania i rozliczeń odpowiada wystawca — w razie wątpliwości skonsultuj z doradcą podatkowym. Fermly nie doradza podatkowo.
      </p>
    </div>
  );
}
