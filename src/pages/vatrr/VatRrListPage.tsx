import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vatRrService } from '@/services/vatRr.service';
import type { VatRrInvoice } from '@/models/vatRr.model';
import { VAT_RR_STATUS_LABELS, VAT_RR_STATUS_COLORS } from '@/models/vatRr.model';
import { grToPln } from '@/utils/vatRr';
import { Button } from '@/components/ui/Button';

const fmtD = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pl-PL') : '—');

export function VatRrListPage() {
  const [invoices, setInvoices] = useState<VatRrInvoice[] | null>(null);

  useEffect(() => { vatRrService.getInvoices().then(setInvoices); }, []);

  const drafts = (invoices ?? []).filter(i => i.status === 'draft').length;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleczarnia</Link>
          <h1 className="text-xl font-bold text-gray-900">🧾 Faktury VAT RR</h1>
        </div>
        <Link to="/vat-rr/nowa"><Button size="sm">+ Nowy projekt</Button></Link>
      </div>

      <p className="text-sm text-gray-500">
        Projekty faktur VAT RR dla nabywców będących czynnymi podatnikami VAT. <strong>Numer faktury nadaje nabywca</strong> —
        Fermly generuje gotowy dokument z auto-doliczeniem 7% zryczałtowanego zwrotu i oświadczeniem rolnika ryczałtowego.
      </p>

      {drafts > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm text-gray-600">
          📝 Projekty oczekujące: <strong>{drafts}</strong>
        </div>
      )}

      {!invoices && <p className="text-sm text-gray-400">Ładowanie…</p>}

      {invoices && invoices.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🧾</div>
          <p className="text-gray-500 text-sm mb-4">Brak faktur VAT RR.</p>
          <Link to="/vat-rr/nowa"><Button>+ Utwórz pierwszy projekt</Button></Link>
        </div>
      )}

      {invoices && invoices.length > 0 && (
        <div className="space-y-2">
          {invoices.map(inv => (
            <Link key={inv.id} to={`/vat-rr/${inv.id}`}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors">
              <span className="text-2xl">🧾</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {inv.invoiceNumber || inv.docRef}
                  {!inv.invoiceNumber && <span className="text-xs font-normal text-gray-400"> · projekt</span>}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {inv.buyerName || '—'} · nabycie {fmtD(inv.purchaseDate)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold text-gray-800">{grToPln(inv.grossTotalGr)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${VAT_RR_STATUS_COLORS[inv.status]}`}>
                  {VAT_RR_STATUS_LABELS[inv.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Dokument to <strong>projekt</strong> — formalnym wystawcą faktury VAT RR pozostaje nabywca (art. 116 ust. 1 ustawy o VAT).
        Za zgodność odpowiada wystawca. Zweryfikuj wątpliwości u doradcy.
      </p>
    </div>
  );
}
