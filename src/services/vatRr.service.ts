/**
 * Faktura VAT RR — serwis dwutorowy (Supabase gdy zalogowany / Dexie offline).
 *
 * Domena: właściciel = DOSTAWCA (rolnik ryczałtowy) sprzedający czynnemu VAT-owcowi
 * (NABYWCA = odbiorca, reuse dairy_buyers). Fermly generuje PROJEKT — numer faktury
 * nadaje nabywca. Kwoty w GROSZACH (całkowite). Po „opłacone": księgowanie do kasy
 * (przychód) + nadanie numeru we wspólnej rocznej sekwencji RHD.
 */

import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { cashFlowService } from '@/services/cashFlow.service';
import { dairyService } from '@/services/dairy.service';
import { settingsService } from '@/services/settings.service';
import type { VatRrInvoice, VatRrLine } from '@/models/vatRr.model';
import { computeTotals, lineNetGr } from '@/utils/vatRr';

const CASH_SOURCE = 'vat_rr';

// ── snake_case ↔ camelCase mappery ──────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function toInvoice(r: any): VatRrInvoice {
  return {
    id: r.id,
    buyerId: r.buyer_id ?? undefined,
    buyerName: r.buyer_name ?? undefined,
    buyerAddress: r.buyer_address ?? undefined,
    buyerNip: r.buyer_nip ?? undefined,
    docRef: r.doc_ref,
    invoiceNumber: r.invoice_number ?? undefined,
    purchaseDate: r.purchase_date,
    issueDate: r.issue_date ?? undefined,
    netTotalGr: Number(r.net_total_gr ?? 0),
    flatRatePct: Number(r.flat_rate_pct ?? 7),
    flatRateGr: Number(r.flat_rate_gr ?? 0),
    grossTotalGr: Number(r.gross_total_gr ?? 0),
    paymentMethod: r.payment_method ?? 'transfer',
    paidAt: r.paid_at ?? undefined,
    paymentRef: r.payment_ref ?? undefined,
    status: r.status ?? 'draft',
    inRhd: r.in_rhd !== false,
    rhdNumber: r.rhd_number != null ? Number(r.rhd_number) : undefined,
    rhdYear: r.rhd_year != null ? Number(r.rhd_year) : undefined,
    cashAccountId: r.cash_account_id ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
  };
}

function toLine(r: any): VatRrLine {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    position: r.position,
    productId: r.product_id ?? undefined,
    productName: r.product_name,
    qualityClass: r.quality_class ?? undefined,
    unit: r.unit,
    quantityMilli: Number(r.quantity_milli),
    unitPriceGr: Number(r.unit_price_gr),
    netValueGr: Number(r.net_value_gr),
  };
}

function invoiceRow(userId: string, inv: VatRrInvoice) {
  return {
    user_id: userId,
    buyer_id: inv.buyerId ?? null,
    buyer_name: inv.buyerName ?? null,
    buyer_address: inv.buyerAddress ?? null,
    buyer_nip: inv.buyerNip ?? null,
    doc_ref: inv.docRef,
    invoice_number: inv.invoiceNumber ?? null,
    purchase_date: inv.purchaseDate,
    issue_date: inv.issueDate ?? null,
    net_total_gr: inv.netTotalGr,
    flat_rate_pct: inv.flatRatePct,
    flat_rate_gr: inv.flatRateGr,
    gross_total_gr: inv.grossTotalGr,
    payment_method: inv.paymentMethod,
    paid_at: inv.paidAt ?? null,
    payment_ref: inv.paymentRef ?? null,
    status: inv.status,
    in_rhd: inv.inRhd,
    rhd_number: inv.rhdNumber ?? null,
    rhd_year: inv.rhdYear ?? null,
    cash_account_id: inv.cashAccountId ?? null,
    notes: inv.notes ?? null,
  };
}

function lineRow(userId: string, invoiceId: number, l: VatRrLine) {
  return {
    user_id: userId,
    invoice_id: invoiceId,
    position: l.position,
    product_id: l.productId ?? null,
    product_name: l.productName,
    quality_class: l.qualityClass ?? null,
    unit: l.unit,
    quantity_milli: l.quantityMilli,
    unit_price_gr: l.unitPriceGr,
    net_value_gr: l.netValueGr,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Przelicza netto pozycji i sumy dokumentu z pozycji (źródło prawdy = grosze). */
export function recomputeInvoice(inv: VatRrInvoice, lines: VatRrLine[]): { inv: VatRrInvoice; lines: VatRrLine[] } {
  const normLines = lines.map((l, i) => ({
    ...l,
    position: i + 1,
    netValueGr: lineNetGr(l.quantityMilli, l.unitPriceGr),
  }));
  const totals = computeTotals(normLines.map(l => l.netValueGr), inv.flatRatePct ?? 7);
  return {
    inv: { ...inv, netTotalGr: totals.netTotalGr, flatRateGr: totals.flatRateGr, grossTotalGr: totals.grossTotalGr },
    lines: normLines,
  };
}

export const vatRrService = {
  /** Kolejny numer wewnętrznej referencji dostawcy (PREFIX/RRRR/NNNN) dla danego roku. */
  async nextDocRef(year: number): Promise<string> {
    const prefix = String(await settingsService.get('vat_rr_prefix', 'RR') || 'RR');
    const user = await getAuthUser();
    let maxSeq = 0;
    const re = /\/(\d+)$/;
    if (user) {
      const { data } = await supabase.from('vat_rr_invoices')
        .select('doc_ref').eq('user_id', user.id).eq('rhd_year', year);
      maxSeq = (data ?? []).reduce((m, r) => {
        const mt = re.exec(String(r.doc_ref ?? '')); return mt ? Math.max(m, Number(mt[1])) : m;
      }, 0);
    } else {
      const rows = await db.vatRrInvoices.filter(v => (v.rhdYear ?? new Date(v.purchaseDate).getFullYear()) === year).toArray();
      maxSeq = rows.reduce((m, r) => {
        const mt = re.exec(r.docRef ?? ''); return mt ? Math.max(m, Number(mt[1])) : m;
      }, 0);
    }
    return `${prefix}/${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  },

  async getInvoices(year?: number): Promise<VatRrInvoice[]> {
    const user = await getAuthUser();
    if (user) {
      let q = supabase.from('vat_rr_invoices').select('*').eq('user_id', user.id);
      if (year) q = q.eq('rhd_year', year);
      const { data } = await q.order('purchase_date', { ascending: false });
      return (data ?? []).map(toInvoice);
    }
    const all = await db.vatRrInvoices.orderBy('purchaseDate').reverse().toArray();
    return year ? all.filter(v => (v.rhdYear ?? new Date(v.purchaseDate).getFullYear()) === year) : all;
  },

  async getInvoiceById(id: number): Promise<VatRrInvoice | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('vat_rr_invoices').select('*').eq('id', id).eq('user_id', user.id).single();
      if (!data) return undefined;
      const inv = toInvoice(data);
      const { data: lines } = await supabase.from('vat_rr_lines').select('*').eq('invoice_id', id).order('position');
      inv.lines = (lines ?? []).map(toLine);
      return inv;
    }
    const inv = await db.vatRrInvoices.get(id);
    if (!inv) return undefined;
    inv.lines = await db.vatRrLines.where('invoiceId').equals(id).sortBy('position');
    return inv;
  },

  /** Tworzy nowy dokument (status 'draft', bez numeru faktury) wraz z pozycjami. */
  async createInvoice(
    input: Omit<VatRrInvoice, 'id' | 'createdAt' | 'docRef' | 'netTotalGr' | 'flatRateGr' | 'grossTotalGr' | 'lines'>,
    lines: VatRrLine[],
  ): Promise<number> {
    const now = new Date().toISOString();
    const year = input.rhdYear ?? new Date(input.purchaseDate).getFullYear();
    const docRef = await this.nextDocRef(year);
    const base: VatRrInvoice = { ...input, docRef, rhdYear: year, netTotalGr: 0, flatRateGr: 0, grossTotalGr: 0, createdAt: now };
    const { inv, lines: normLines } = recomputeInvoice(base, lines);

    const user = await getAuthUser();
    if (user) {
      const { data, error } = await supabase.from('vat_rr_invoices')
        .insert({ ...invoiceRow(user.id, inv), created_at: now, updated_at: now }).select('id').single();
      if (error) throw error;
      const invoiceId = data.id;
      if (normLines.length) {
        const { error: le } = await supabase.from('vat_rr_lines').insert(normLines.map(l => lineRow(user.id, invoiceId, l)));
        if (le) throw le;
      }
      return invoiceId;
    }
    const invoiceId = await db.vatRrInvoices.add({ ...inv, updatedAt: now });
    if (normLines.length) await db.vatRrLines.bulkAdd(normLines.map(l => ({ ...l, invoiceId })));
    return invoiceId;
  },

  /** Nadpisuje nagłówek + pozycje (pełne zapisanie edytowanego dokumentu). */
  async updateInvoice(id: number, patch: Partial<VatRrInvoice>, lines?: VatRrLine[]): Promise<void> {
    const existing = await this.getInvoiceById(id);
    if (!existing) return;
    const merged = { ...existing, ...patch };
    const finalLines = lines ?? existing.lines ?? [];
    const { inv, lines: normLines } = recomputeInvoice(merged, finalLines);
    const now = new Date().toISOString();

    const user = await getAuthUser();
    if (user) {
      await supabase.from('vat_rr_invoices').update({ ...invoiceRow(user.id, inv), updated_at: now }).eq('id', id).eq('user_id', user.id);
      if (lines) {
        await supabase.from('vat_rr_lines').delete().eq('invoice_id', id);
        if (normLines.length) await supabase.from('vat_rr_lines').insert(normLines.map(l => lineRow(user.id, id, l)));
      }
      return;
    }
    await db.vatRrInvoices.update(id, { ...inv, updatedAt: now });
    if (lines) {
      await db.vatRrLines.where('invoiceId').equals(id).delete();
      if (normLines.length) await db.vatRrLines.bulkAdd(normLines.map(l => ({ ...l, invoiceId: id })));
    }
  },

  /** Zmiana statusu bez skutków księgowych (np. draft → printed). */
  async setStatus(id: number, status: VatRrInvoice['status']): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      await supabase.from('vat_rr_invoices').update({ status, updated_at: now }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.vatRrInvoices.update(id, { status, updatedAt: now });
  },

  /**
   * Oznacza fakturę jako opłaconą: nadaje numer RHD (wspólna roczna sekwencja),
   * księguje przychód do kasy i ustawia status 'paid'.
   */
  async markPaid(id: number, opts: { cashAccountId?: number; paidAt: string; paymentRef?: string }): Promise<void> {
    const inv = await this.getInvoiceById(id);
    if (!inv || inv.status === 'void') return;
    const year = inv.rhdYear ?? new Date(inv.purchaseDate).getFullYear();

    let rhdNumber = inv.rhdNumber;
    if (inv.inRhd && !rhdNumber) {
      try { rhdNumber = (await dairyService.getRhdStats(year)).nextNumber; }
      catch { rhdNumber = 1; }
    }

    const grossPln = inv.grossTotalGr / 100;
    const now = new Date().toISOString();
    const user = await getAuthUser();

    if (user) {
      await supabase.from('vat_rr_invoices').update({
        status: 'paid', paid_at: opts.paidAt, payment_ref: opts.paymentRef ?? null,
        rhd_number: rhdNumber ?? null, rhd_year: year,
        cash_account_id: opts.cashAccountId ?? null, updated_at: now,
      }).eq('id', id).eq('user_id', user.id);
    } else {
      await db.vatRrInvoices.update(id, {
        status: 'paid', paidAt: opts.paidAt, paymentRef: opts.paymentRef,
        rhdNumber, rhdYear: year, cashAccountId: opts.cashAccountId, updatedAt: now,
      });
    }

    if (opts.cashAccountId) {
      await cashFlowService.createTransaction({
        accountId: opts.cashAccountId,
        date: opts.paidAt,
        type: 'income',
        scope: 'sery',
        category: 'Sprzedaż (VAT RR)',
        description: `Faktura VAT RR ${inv.invoiceNumber || inv.docRef} — ${inv.buyerName ?? ''}`.trim(),
        amountPln: grossPln,
        sourceType: CASH_SOURCE,
        sourceId: id,
      });
    }
  },

  /** Anuluje dokument (void — nie usuwamy, retencja min. 5 lat) + cofa wpis w kasie. */
  async voidInvoice(id: number): Promise<void> {
    await cashFlowService.deleteBySource(CASH_SOURCE, id);
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      await supabase.from('vat_rr_invoices').update({ status: 'void', updated_at: now }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.vatRrInvoices.update(id, { status: 'void', updatedAt: now });
  },

  /** Trwałe usunięcie — tylko dla dokumentów 'draft' (przed wydrukiem). */
  async deleteDraft(id: number): Promise<void> {
    const inv = await this.getInvoiceById(id);
    if (!inv || inv.status !== 'draft') throw new Error('Usunąć można tylko projekt (draft). Opłacony dokument anuluj (void).');
    await cashFlowService.deleteBySource(CASH_SOURCE, id);
    const user = await getAuthUser();
    if (user) {
      await supabase.from('vat_rr_lines').delete().eq('invoice_id', id);
      await supabase.from('vat_rr_invoices').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.vatRrLines.where('invoiceId').equals(id).delete();
    await db.vatRrInvoices.delete(id);
  },
};
