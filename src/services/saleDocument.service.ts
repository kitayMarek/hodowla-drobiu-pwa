import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { cashFlowService } from '@/services/cashFlow.service';
import { dairyService } from '@/services/dairy.service';
import { saleService } from '@/services/sale.service';
import { slaughterService } from '@/services/slaughter.service';
import { batchService } from '@/services/batch.service';
import type { SaleDocument, SaleDocumentWithLines } from '@/models/saleDocument.model';
import type { DairyBuyer, DairyProduct } from '@/models/dairy.model';
import type { SaleType } from '@/constants/phases';
import { SALE_TYPE_LABELS } from '@/constants/phases';

// ── Linia formularza ─────────────────────────────────────────────

export interface FormLine {
  key: string;
  activity: 'drob' | 'sery' | 'inne';
  // drob
  drobSaleType: SaleType;
  drobBatchId: string;
  drobBirdCount: string;
  drobWeightKg: string;
  drobEggsCount: string;
  // dairy
  dairyProductId: string;
  // inne (produkty niestandardowe: miód, przetwory, świece, rozsady itp.)
  inneName: string;     // np. "Miód lipowy"
  inneUnit: string;     // np. "sł.", "kg", "szt."
  inneQuantity: string; // liczba jednostek
  // wspólne
  quantity: string;
  unitPrice: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function docToRow(r: Record<string, unknown>): SaleDocument {
  return {
    id:             r.id as number,
    docDate:        r.doc_date as string,
    buyerName:      r.buyer_name  as string | undefined,
    buyerId:        r.buyer_id    != null ? Number(r.buyer_id)   : undefined,
    buyerAddress:   r.buyer_address  as string | undefined,
    buyerPhone:     r.buyer_phone    as string | undefined,
    inRhd:          r.in_rhd !== false,
    rhdNumber:      r.rhd_number  != null ? Number(r.rhd_number) : undefined,
    rhdYear:        r.rhd_year    != null ? Number(r.rhd_year)   : undefined,
    cashAccountId:  r.cash_account_id != null ? Number(r.cash_account_id) : undefined,
    totalValuePln:  Number(r.total_value_pln ?? 0),
    notes:          r.notes as string | undefined,
    createdAt:      r.created_at as string,
    updatedAt:      r.updated_at as string,
  };
}

export function lineTotal(l: FormLine): number {
  if (l.activity === 'sery') return (parseFloat(l.quantity)||0) * (parseFloat(l.unitPrice)||0);
  if (l.activity === 'inne') return (parseFloat(l.inneQuantity)||0) * (parseFloat(l.unitPrice)||0);
  if (l.drobSaleType === 'jaja') return (parseInt(l.drobEggsCount)||0) * (parseFloat(l.unitPrice)||0);
  if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy')
    return (parseFloat(l.drobWeightKg)||0) * (parseFloat(l.unitPrice)||0);
  return (parseInt(l.drobBirdCount)||0) * (parseFloat(l.unitPrice)||0);
}

// ── Service ──────────────────────────────────────────────────────

export const saleDocumentService = {

  // ── Pobieranie ───────────────────────────────────────────────

  async getDocuments(year?: number): Promise<SaleDocument[]> {
    const user = await getAuthUser();
    if (user) {
      let q = supabase.from('sale_documents').select('*').eq('user_id', user.id);
      if (year) q = q.eq('rhd_year', year);
      else if (year === undefined) {
        // brak filtra roku — weź wszystkie
      }
      const { data } = await q.order('doc_date', { ascending: false });
      return (data ?? []).map(docToRow);
    }
    let col = db.saleDocuments.orderBy('docDate').reverse();
    if (year) return (await col.toArray()).filter(d => d.rhdYear === year || new Date(d.docDate).getFullYear() === year);
    return col.toArray();
  },

  async getDocumentById(id: number): Promise<SaleDocumentWithLines | null> {
    const user = await getAuthUser();
    let doc: SaleDocument | undefined;

    if (user) {
      const { data } = await supabase.from('sale_documents').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      if (!data) return null;
      doc = docToRow(data);
    } else {
      doc = await db.saleDocuments.get(id);
      if (!doc) return null;
    }

    const [dairyLines, drobLines] = await Promise.all([
      dairyService.getSalesByDocument(id),
      saleService.getByDocument(id),
    ]);

    return { ...doc, dairyLines, drobLines };
  },

  // ── Tworzenie dokumentu ze wszystkimi liniami ────────────────

  async createDocument(
    header: Omit<SaleDocument, 'id' | 'createdAt' | 'updatedAt' | 'totalValuePln'>,
    lines: FormLine[],
    products: DairyProduct[],
    buyer?: DairyBuyer,
  ): Promise<number> {
    const user  = await getAuthUser();
    const now   = new Date().toISOString();
    const year  = header.rhdYear ?? new Date(header.docDate).getFullYear();
    const total = lines.reduce((s, l) => s + lineTotal(l), 0);

    // Numer RHD
    let rhdNumber = header.rhdNumber;
    if (header.inRhd && !rhdNumber) {
      try {
        const stats = await dairyService.getRhdStats(year);
        rhdNumber = stats.nextNumber;
      } catch { rhdNumber = 1; }
    }

    const docData = {
      ...header,
      totalValuePln: total,
      rhdNumber,
      rhdYear: year,
      updatedAt: now,
    };

    let docId: number;

    if (user) {
      const { data, error } = await supabase.from('sale_documents').insert({
        user_id:          user.id,
        doc_date:         docData.docDate,
        buyer_name:       docData.buyerName ?? null,
        buyer_id:         docData.buyerId   ?? null,
        buyer_address:    docData.buyerAddress ?? null,
        buyer_phone:      docData.buyerPhone   ?? null,
        in_rhd:           docData.inRhd,
        rhd_number:       docData.rhdNumber ?? null,
        rhd_year:         docData.rhdYear   ?? null,
        ...(docData.cashAccountId != null ? { cash_account_id: docData.cashAccountId } : {}),
        total_value_pln:  docData.totalValuePln,
        notes:            docData.notes ?? null,
        created_at:       now,
        updated_at:       now,
      }).select('id').single();
      if (error) throw error;
      docId = data.id;
    } else {
      docId = await db.saleDocuments.add({ ...docData, createdAt: now });
    }

    // Zapisz linie
    const effectiveBuyer = docData.buyerName ?? 'Nabywca detaliczny';
    for (const l of lines) {
      if (lineTotal(l) <= 0) continue;

      if (l.activity === 'sery') {
        const prod = products.find(p => p.id === Number(l.dairyProductId));
        if (!prod) continue;
        const qty = parseFloat(l.quantity) || 0;
        const prc = parseFloat(l.unitPrice) || 0;
        await dairyService.saveSale({
          saleDate:        docData.docDate,
          productId:       prod.id!,
          productName:     prod.name,
          productCategory: prod.category,
          unit:            prod.unit,
          quantity:        qty,
          unitPricePln:    prc,
          totalValuePln:   qty * prc,
          buyerId:         buyer?.id,
          buyerName:       effectiveBuyer,
          buyerAddress:    buyer?.address,
          inRhd:           docData.inRhd,
          rhdNumber,
          rhdYear:         year,
          saleDocumentId:  docId,
        } as Parameters<typeof dairyService.saveSale>[0]);
      }

      if (l.activity === 'drob') {
        const batchId = l.drobBatchId ? Number(l.drobBatchId) : undefined;
        const total   = lineTotal(l);
        const saleData: Parameters<typeof saleService.create>[0] = {
          batchId:         batchId ?? 0,
          saleDate:        docData.docDate,
          saleType:        l.drobSaleType,
          totalRevenuePln: total,
          buyerName:       docData.buyerName,
          inRhd:           docData.inRhd,
          saleDocumentId:  docId,
        } as Parameters<typeof saleService.create>[0];

        if (l.drobSaleType === 'jaja') {
          saleData.eggsCount   = parseInt(l.drobEggsCount) || 0;
          saleData.eggPricePln = parseFloat(l.unitPrice) || 0;
        } else if (l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') {
          saleData.birdCount      = parseInt(l.drobBirdCount) || 0;
          saleData.weightKg       = parseFloat(l.drobWeightKg) || 0;
          saleData.pricePerKgPln  = parseFloat(l.unitPrice) || 0;
        } else {
          saleData.birdCount     = parseInt(l.drobBirdCount) || 0;
          saleData.pricePerKgPln = parseFloat(l.unitPrice) || 0;
        }

        await saleService.create(saleData);

        if ((l.drobSaleType === 'tuszki' || l.drobSaleType === 'elementy') &&
            batchId && (parseInt(l.drobBirdCount) || 0) > 0) {
          const existing = await slaughterService.getByBatch(batchId);
          if (!existing.some(s => s.slaughterDate === docData.docDate)) {
            await slaughterService.create({
              batchId, slaughterDate: docData.docDate,
              birdsSlaughtered: parseInt(l.drobBirdCount) || 0,
              liveWeightTotalKg: 0, carcassWeightTotalKg: parseFloat(l.drobWeightKg) || 0,
            });
          }
        }
        if (batchId && (l.drobSaleType === 'ptaki_zywe' || l.drobSaleType === 'tuszki')) {
          await batchService.checkAndAutoClose(batchId);
        }
      }

      // Inne produkty (miód, przetwory, świece, rozsady itp.)
      if (l.activity === 'inne') {
        const qty   = parseFloat(l.inneQuantity) || 0;
        const prc   = parseFloat(l.unitPrice) || 0;
        const inneTotal = qty * prc;
        if (inneTotal > 0) {
          const notesDesc = [l.inneName.trim(), qty ? `${qty} ${l.inneUnit}`.trim() : ''].filter(Boolean).join(' · ');
          await saleService.create({
            batchId:         0,
            saleDate:        docData.docDate,
            saleType:        'inne',
            totalRevenuePln: inneTotal,
            buyerName:       docData.buyerName,
            notes:           notesDesc || undefined,
            inRhd:           docData.inRhd,
            saleDocumentId:  docId,
          });
        }
      }
    }

    // Transakcja kasowa
    if (docData.cashAccountId && total > 0) {
      const scope = lines.some(l => l.activity === 'drob') ? 'drob'
                  : lines.some(l => l.activity === 'sery') ? 'sery'
                  : 'drob';
      const desc    = [...new Set(lines.map(l =>
        l.activity === 'sery'
          ? (products.find(p => p.id === Number(l.dairyProductId))?.name ?? 'produkt')
          : l.activity === 'inne'
          ? (l.inneName.trim() || 'Inne produkty')
          : SALE_TYPE_LABELS[l.drobSaleType]
      ))].join(', ');
      await cashFlowService.createTransaction({
        accountId:   docData.cashAccountId,
        date:        docData.docDate,
        type:        'income',
        scope,
        category:    scope === 'sery' ? 'Sprzedaż serów' : 'Sprzedaż drobiu',
        description: `${desc}${effectiveBuyer !== 'Nabywca detaliczny' ? ` — ${effectiveBuyer}` : ''}`,
        amountPln:   total,
        sourceType:  'sale_document',
        sourceId:    docId,
      });
    }

    return docId;
  },

  // ── Aktualizacja nagłówka ────────────────────────────────────

  async updateHeader(id: number, updates: Partial<Omit<SaleDocument, 'id' | 'createdAt'>>): Promise<void> {
    const user = await getAuthUser();
    const now  = new Date().toISOString();
    if (user) {
      const row: Record<string, unknown> = { updated_at: now };
      if (updates.docDate       !== undefined) row.doc_date        = updates.docDate;
      if (updates.buyerName     !== undefined) row.buyer_name      = updates.buyerName ?? null;
      if (updates.buyerId       !== undefined) row.buyer_id        = updates.buyerId   ?? null;
      if (updates.buyerAddress  !== undefined) row.buyer_address   = updates.buyerAddress ?? null;
      if (updates.buyerPhone    !== undefined) row.buyer_phone     = updates.buyerPhone   ?? null;
      if (updates.inRhd         !== undefined) row.in_rhd          = updates.inRhd;
      if (updates.notes         !== undefined) row.notes           = updates.notes ?? null;
      if (updates.totalValuePln !== undefined) row.total_value_pln = updates.totalValuePln;
      await supabase.from('sale_documents').update(row).eq('id', id).eq('user_id', user.id);
      // Jeśli zmienił się nabywca, aktualizuj też linie
      if (updates.buyerName !== undefined) {
        await supabase.from('dairy_sales').update({ buyer_name: updates.buyerName ?? null })
          .eq('sale_document_id', id).eq('user_id', user.id);
        await supabase.from('sales').update({ buyer_name: updates.buyerName ?? null })
          .eq('sale_document_id', id).eq('user_id', user.id);
      }
      return;
    }
    await db.saleDocuments.update(id, { ...updates, updatedAt: now });
    if (updates.buyerName !== undefined) {
      await db.dairySales.where('saleDocumentId').equals(id)
        .modify({ buyerName: updates.buyerName });
      await db.sales.where('saleDocumentId').equals(id)
        .modify({ buyerName: updates.buyerName });
    }
  },

  // ── Przelicz i zaktualizuj sumę dokumentu ────────────────────

  async recalcTotal(id: number): Promise<number> {
    const [dairyLines, drobLines] = await Promise.all([
      dairyService.getSalesByDocument(id),
      saleService.getByDocument(id),
    ]);
    const total = dairyLines.reduce((s, l) => s + l.totalValuePln, 0)
                + drobLines.reduce((s, l) => s + l.totalRevenuePln, 0);
    await this.updateHeader(id, { totalValuePln: total });
    return total;
  },

  // ── Usuwanie ─────────────────────────────────────────────────

  async deleteDairyLine(saleId: number, documentId: number): Promise<void> {
    await dairyService.deleteSale(saleId);
    await this.recalcTotal(documentId);
  },

  async deleteDrobLine(saleId: number, documentId: number): Promise<void> {
    await saleService.delete(saleId);
    await this.recalcTotal(documentId);
  },

  async deleteDocument(id: number): Promise<void> {
    // Usuń powiązane transakcje kasowe
    await cashFlowService.deleteBySource('sale_document', id);

    const [dairyLines, drobLines] = await Promise.all([
      dairyService.getSalesByDocument(id),
      saleService.getByDocument(id),
    ]);
    for (const l of dairyLines) if (l.id) await dairyService.deleteSale(l.id);
    for (const l of drobLines)  if (l.id) await saleService.delete(l.id);

    const user = await getAuthUser();
    if (user) {
      await supabase.from('sale_documents').delete().eq('id', id).eq('user_id', user.id);
    } else {
      await db.saleDocuments.delete(id);
    }
  },
};
