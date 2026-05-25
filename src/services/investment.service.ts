import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import { todayISO } from '@/utils/date';
import type { Investment } from '@/models/investment.model';
import type { InvestmentFormValues } from '@/utils/validation';
import { cashFlowService } from './cashFlow.service';
import { financialEventService } from './financialEvent.service';

function rowToInvestment(r: Record<string, unknown>): Investment {
  return {
    id:              r.id as number,
    purchaseDate:    r.purchase_date as string,
    category:        r.category as Investment['category'],
    name:            r.name as string,
    supplier:        r.supplier as string | undefined,
    invoiceNumber:   r.invoice_number as string | undefined,
    amountPln:       r.amount_pln as number,
    usefulLifeYears: r.useful_life_years as number | undefined,
    notes:           r.notes as string | undefined,
    createdAt:       r.created_at as string,
  };
}

export const investmentService = {
  async getAll(): Promise<Investment[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('investments').select('*')
        .eq('user_id', user.id).order('purchase_date', { ascending: false });
      return (data ?? []).map(rowToInvestment);
    }
    return db.investments.orderBy('purchaseDate').reverse().toArray();
  },

  async create(data: InvestmentFormValues): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('investments').insert({
        user_id: user.id, purchase_date: data.purchaseDate, category: data.category,
        name: data.name, supplier: data.supplier ?? null,
        invoice_number: data.invoiceNumber ?? null, amount_pln: data.amountPln,
        useful_life_years: data.usefulLifeYears ?? null,
        notes: data.notes ?? null, created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.investments.add({
      ...data,
      usefulLifeYears: data.usefulLifeYears ?? undefined,
      createdAt: todayISO(),
    });
  },

  async update(id: number, data: InvestmentFormValues): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('investments').update({
        purchase_date: data.purchaseDate, category: data.category, name: data.name,
        supplier: data.supplier ?? null, invoice_number: data.invoiceNumber ?? null,
        amount_pln: data.amountPln, useful_life_years: data.usefulLifeYears ?? null,
        notes: data.notes ?? null,
      }).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.investments.update(id, {
      ...data,
      usefulLifeYears: data.usefulLifeYears ?? undefined,
    });
  },

  async delete(id: number): Promise<void> {
    // Kaskadowe usunięcie powiązanych transakcji kasowych i zdarzeń finansowych
    await cashFlowService.deleteBySource('investment', id);
    await financialEventService.deleteBySource('investment', id);

    const user = await getAuthUser();
    if (user) {
      await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.investments.delete(id);
  },
};
