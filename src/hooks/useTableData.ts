/**
 * Dual-mode hooks for all major entities.
 * Pattern: useLiveQuery (Dexie) when not logged in, useState+useEffect (Supabase) when logged in.
 * Realtime subscriptions keep Supabase data fresh after mutations.
 */

import { useEffect, useState, useId, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cacheGet, cacheSet } from '@/lib/sessionCache';
import { financeService } from '@/services/finance.service';
import { feedService } from '@/services/feed.service';
import { saleService } from '@/services/sale.service';
import { cashFlowService } from '@/services/cashFlow.service';
import { slaughterService } from '@/services/slaughter.service';
import { weighingService } from '@/services/weighing.service';
import { healthService } from '@/services/health.service';
import { birdTransferService } from '@/services/birdTransfer.service';
import { investmentService } from '@/services/investment.service';
import { orderService } from '@/services/order.service';
import type { Expense } from '@/models/expense.model';
import type { Sale } from '@/models/sale.model';
import type { FeedType, FeedDelivery, FeedConsumption } from '@/models/feed.model';
import type { CashAccount } from '@/models/cashFlow.model';
import type { SlaughterRecord } from '@/models/slaughter.model';
import type { Weighing } from '@/models/weighing.model';
import type { HealthEvent } from '@/models/health.model';
import type { BirdTransfer } from '@/models/birdTransfer.model';
import type { Investment } from '@/models/investment.model';
import type { Order } from '@/models/order.model';
import type { Activity } from '@/models/activity.model';
import { activityService } from '@/services/activity.service';
import type { InternalTransfer } from '@/models/internalTransfer.model';
import { internalTransferService } from '@/services/internalTransfer.service';

// ── Expenses ─────────────────────────────────────────────────

export function useAllExpenses(): Expense[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.expenses.orderBy('expenseDate').reverse().toArray() : Promise.resolve([] as Expense[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Expense[]>(() =>
    user ? (cacheGet<Expense[]>(`expenses_all_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    financeService.getAllExpenses().then(data => { setSb(data); cacheSet(`expenses_all_${user.id}`, data); });
    const ch = supabase.channel(`expenses-all-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' },
        () => financeService.getAllExpenses().then(data => { setSb(data); cacheSet(`expenses_all_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

export function useExpensesByBatch(batchId: number): Expense[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => !user ? db.expenses.where('batchId').equals(batchId).toArray() : Promise.resolve([] as Expense[]),
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<Expense[]>(() =>
    user ? (cacheGet<Expense[]>(`expenses_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    financeService.getExpensesByBatch(batchId).then(data => { setSb(data); cacheSet(`expenses_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`expenses-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' },
        () => financeService.getExpensesByBatch(batchId).then(data => { setSb(data); cacheSet(`expenses_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

// ── Sales ────────────────────────────────────────────────────

export function useAllSales(): Sale[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.sales.orderBy('saleDate').reverse().toArray() : Promise.resolve([] as Sale[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Sale[]>(() =>
    user ? (cacheGet<Sale[]>(`sales_all_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    saleService.getAll().then(data => { setSb(data); cacheSet(`sales_all_${user.id}`, data); });
    const ch = supabase.channel(`sales-all-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' },
        () => saleService.getAll().then(data => { setSb(data); cacheSet(`sales_all_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

export function useSalesByBatch(batchId: number): Sale[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => !user ? db.sales.where('batchId').equals(batchId).sortBy('saleDate') : Promise.resolve([] as Sale[]),
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<Sale[]>(() =>
    user ? (cacheGet<Sale[]>(`sales_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    saleService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`sales_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`sales-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' },
        () => saleService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`sales_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

// ── Feed Types ───────────────────────────────────────────────

export function useFeedTypes(): FeedType[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.feedTypes.orderBy('name').toArray() : Promise.resolve([] as FeedType[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<FeedType[]>(() =>
    user ? (cacheGet<FeedType[]>(`feed_types_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    feedService.getAllTypes().then(data => { setSb(data); cacheSet(`feed_types_${user.id}`, data); });
    const ch = supabase.channel(`feed-types-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_types' },
        () => feedService.getAllTypes().then(data => { setSb(data); cacheSet(`feed_types_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Feed Deliveries ──────────────────────────────────────────

export function useAllFeedDeliveries(): FeedDelivery[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.feedDeliveries.orderBy('deliveryDate').reverse().toArray() : Promise.resolve([] as FeedDelivery[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<FeedDelivery[]>(() =>
    user ? (cacheGet<FeedDelivery[]>(`feed_deliveries_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    feedService.getAllDeliveries().then(data => { setSb(data); cacheSet(`feed_deliveries_${user.id}`, data); });
    const ch = supabase.channel(`feed-deliveries-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_deliveries' },
        () => feedService.getAllDeliveries().then(data => { setSb(data); cacheSet(`feed_deliveries_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Feed Consumptions ────────────────────────────────────────

export function useAllFeedConsumptions(): FeedConsumption[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.feedConsumptions.toArray() : Promise.resolve([] as FeedConsumption[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<FeedConsumption[]>(() =>
    user ? (cacheGet<FeedConsumption[]>(`feed_consumptions_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    feedService.getAllConsumptions().then(data => { setSb(data); cacheSet(`feed_consumptions_${user.id}`, data); });
    const ch = supabase.channel(`feed-consumptions-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_consumptions' },
        () => feedService.getAllConsumptions().then(data => { setSb(data); cacheSet(`feed_consumptions_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Cash Accounts ────────────────────────────────────────────

export function useActiveCashAccounts(): CashAccount[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.cashAccounts.filter(a => a.isActive).toArray() : Promise.resolve([] as CashAccount[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<CashAccount[]>(() =>
    user ? (cacheGet<CashAccount[]>(`cash_accounts_active_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    cashFlowService.getActiveAccounts().then(data => { setSb(data); cacheSet(`cash_accounts_active_${user.id}`, data); });
    const ch = supabase.channel(`cash-accounts-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_accounts' },
        () => cashFlowService.getActiveAccounts().then(data => { setSb(data); cacheSet(`cash_accounts_active_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

export function useAllCashAccounts(): CashAccount[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.cashAccounts.toArray() : Promise.resolve([] as CashAccount[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<CashAccount[]>(() =>
    user ? (cacheGet<CashAccount[]>(`cash_accounts_all_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    cashFlowService.getAccounts().then(data => { setSb(data); cacheSet(`cash_accounts_all_${user.id}`, data); });
    const ch = supabase.channel(`cash-accounts-all-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_accounts' },
        () => cashFlowService.getAccounts().then(data => { setSb(data); cacheSet(`cash_accounts_all_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Slaughter Records ────────────────────────────────────────

export function useSlaughterByBatch(batchId: number): SlaughterRecord[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => !user ? db.slaughterRecords.where('batchId').equals(batchId).sortBy('slaughterDate') : Promise.resolve([] as SlaughterRecord[]),
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<SlaughterRecord[]>(() =>
    user ? (cacheGet<SlaughterRecord[]>(`slaughter_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    slaughterService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`slaughter_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`slaughter-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slaughter_records' },
        () => slaughterService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`slaughter_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

export function useAllSlaughter(): SlaughterRecord[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.slaughterRecords.toArray() : Promise.resolve([] as SlaughterRecord[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<SlaughterRecord[]>(() =>
    user ? (cacheGet<SlaughterRecord[]>(`slaughter_all_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    slaughterService.getAll().then(data => { setSb(data); cacheSet(`slaughter_all_${user.id}`, data); });
    const ch = supabase.channel(`slaughter-all-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slaughter_records' },
        () => slaughterService.getAll().then(data => { setSb(data); cacheSet(`slaughter_all_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Weighings ────────────────────────────────────────────────

export function useWeighingsByBatch(batchId: number): Weighing[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => !user ? db.weighings.where('batchId').equals(batchId).sortBy('weighingDate') : Promise.resolve([] as Weighing[]),
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<Weighing[]>(() =>
    user ? (cacheGet<Weighing[]>(`weighings_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    weighingService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`weighings_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`weighings-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weighings' },
        () => weighingService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`weighings_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

export function useAllWeighings(): Weighing[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.weighings.toArray() : Promise.resolve([] as Weighing[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Weighing[]>(() =>
    user ? (cacheGet<Weighing[]>(`weighings_all_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    weighingService.getAll().then(data => { setSb(data); cacheSet(`weighings_all_${user.id}`, data); });
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Health Events ────────────────────────────────────────────

export function useHealthEventsByBatch(batchId: number): HealthEvent[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => !user ? db.healthEvents.where('batchId').equals(batchId).sortBy('eventDate') : Promise.resolve([] as HealthEvent[]),
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<HealthEvent[]>(() =>
    user ? (cacheGet<HealthEvent[]>(`health_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    healthService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`health_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`health-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_events' },
        () => healthService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`health_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

// ── Bird Transfers ───────────────────────────────────────────

export function useBirdTransfersByBatch(batchId: number): BirdTransfer[] {
  const { user } = useAuth();
  const uid = useId();
  const dexie = useLiveQuery(
    () => {
      if (user) return Promise.resolve([] as BirdTransfer[]);
      return Promise.all([
        db.birdTransfers.where('fromBatchId').equals(batchId).toArray(),
        db.birdTransfers.where('toBatchId').equals(batchId).toArray(),
      ]).then(([out, inn]) => [...out, ...inn].sort((a, b) => b.transferDate.localeCompare(a.transferDate)));
    },
    [!!user, batchId]
  ) ?? [];
  const [sb, setSb] = useState<BirdTransfer[]>(() =>
    user ? (cacheGet<BirdTransfer[]>(`transfers_${batchId}_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    birdTransferService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`transfers_${batchId}_${user.id}`, data); });
    const ch = supabase.channel(`transfers-${batchId}-${user.id}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bird_transfers' },
        () => birdTransferService.getByBatch(batchId).then(data => { setSb(data); cacheSet(`transfers_${batchId}_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, batchId]);
  return user ? sb : dexie;
}

// ── Investments ──────────────────────────────────────────────

export function useInvestments(): Investment[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.investments.orderBy('purchaseDate').reverse().toArray() : Promise.resolve([] as Investment[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Investment[]>(() =>
    user ? (cacheGet<Investment[]>(`investments_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    investmentService.getAll().then(data => { setSb(data); cacheSet(`investments_${user.id}`, data); });
    const ch = supabase.channel(`investments-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' },
        () => investmentService.getAll().then(data => { setSb(data); cacheSet(`investments_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Orders ───────────────────────────────────────────────────

export function useOrders(): Order[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.orders.orderBy('plannedDate').toArray() : Promise.resolve([] as Order[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Order[]>(() =>
    user ? (cacheGet<Order[]>(`orders_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    orderService.getAll().then(data => { setSb(data); cacheSet(`orders_${user.id}`, data); });
    const ch = supabase.channel(`orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
        () => orderService.getAll().then(data => { setSb(data); cacheSet(`orders_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

// ── Activities ───────────────────────────────────────────────

export function useActivities(): Activity[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.activities.orderBy('sortOrder').toArray() : Promise.resolve([] as Activity[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Activity[]>(() =>
    user ? (cacheGet<Activity[]>(`activities_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    activityService.getAll().then(data => { setSb(data); cacheSet(`activities_${user.id}`, data); });
    const ch = supabase.channel(`activities-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' },
        () => activityService.getAll().then(data => { setSb(data); cacheSet(`activities_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}

/**
 * Wariant z jawnym `refresh()` — do użycia tam, gdzie mutujemy działalności
 * „w miejscu" (Ustawienia) i nie chcemy polegać wyłącznie na Supabase Realtime,
 * który bywa wyłączony dla tej tabeli. Po każdej mutacji wywołaj `refresh()`.
 */
export function useActivitiesManaged(): { activities: Activity[]; refresh: () => void } {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.activities.orderBy('sortOrder').toArray() : Promise.resolve([] as Activity[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<Activity[]>(() =>
    user ? (cacheGet<Activity[]>(`activities_${user.id}`) ?? []) : []
  );
  const refresh = useCallback(() => {
    if (!user) return; // demo (Dexie) odświeża się sam przez useLiveQuery
    activityService.getAll().then(data => { setSb(data); cacheSet(`activities_${user.id}`, data); });
  }, [user?.id]);
  useEffect(() => {
    if (!user) { setSb([]); return; }
    refresh();
    const ch = supabase.channel(`activities-managed-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refresh]);
  return { activities: user ? sb : dexie, refresh };
}

// ── Internal Transfers ───────────────────────────────────────

export function useInternalTransfers(): InternalTransfer[] {
  const { user } = useAuth();
  const dexie = useLiveQuery(
    () => !user ? db.internalTransfers.orderBy('date').reverse().toArray() : Promise.resolve([] as InternalTransfer[]),
    [!!user]
  ) ?? [];
  const [sb, setSb] = useState<InternalTransfer[]>(() =>
    user ? (cacheGet<InternalTransfer[]>(`internal_transfers_${user.id}`) ?? []) : []
  );
  useEffect(() => {
    if (!user) { setSb([]); return; }
    internalTransferService.getAll().then(data => { setSb(data); cacheSet(`internal_transfers_${user.id}`, data); });
    const ch = supabase.channel(`internal-transfers-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_transfers' },
        () => internalTransferService.getAll().then(data => { setSb(data); cacheSet(`internal_transfers_${user.id}`, data); }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);
  return user ? sb : dexie;
}
