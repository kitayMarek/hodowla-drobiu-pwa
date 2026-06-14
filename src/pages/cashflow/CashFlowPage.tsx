import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AskLLM } from '@/components/AskLLM';
import { db } from '@/db/database';
import { cashFlowService } from '@/services/cashFlow.service';
import { financialEventService } from '@/services/financialEvent.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SimpleArea, MultiBar } from '@/components/charts/TrendChart';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';
import type { CashAccount, CashTransaction, CashCategory, TxType, TxScope, AccountType, AccountScope } from '@/models/cashFlow.model';
import type { FinancialEvent } from '@/models/financialEvent.model';
import type { InternalTransfer } from '@/models/internalTransfer.model';
import { useActivities, useInternalTransfers } from '@/hooks/useTableData';
import { internalTransferService } from '@/services/internalTransfer.service';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const TX_TYPE_LABELS: Record<TxType, string> = {
  income:   'Wpływ',
  expense:  'Wydatek',
  transfer: 'Przelew',
};

// ─── Pomocnicze ───────────────────────────────────────────────────────────────

function calcBalance(account: CashAccount, txs: CashTransaction[]): number {
  // Obsługuje DWA formaty przelewów:
  // A) Stary: dwa symetryczne rekordy (T1: A→B + T2: B→A) – para jest liczona JEDEN raz
  // B) Nowy:  jeden rekord (accountId=źródło, toAccountId=cel)
  const handled = new Set<number>();

  return txs.reduce((sum, t) => {
    if (t.type !== 'transfer') {
      if (t.accountId !== account.id) return sum;
      return t.type === 'income' ? sum + t.amountPln : sum - t.amountPln;
    }

    if (t.id != null && handled.has(t.id)) return sum;

    // Szukaj lustra: t2 ma odwrócone accountId ↔ toAccountId, tę samą datę i kwotę
    const mirror = txs.find(m =>
      m.type === 'transfer' &&
      m.id !== t.id &&
      (m.id == null || !handled.has(m.id)) &&
      m.accountId   === t.toAccountId &&
      m.toAccountId === t.accountId &&
      m.date        === t.date &&
      m.amountPln   === t.amountPln
    );

    if (mirror) {
      // Para – liczymy JEDEN raz; niższy id = oryginalny "source → dest"
      const orig = (t.id ?? 0) < (mirror.id ?? 0) ? t : mirror;
      if (t.id    != null) handled.add(t.id);
      if (mirror.id != null) handled.add(mirror.id);
      if (orig.accountId   === account.id) return sum - t.amountPln; // konto źródłowe
      if (orig.toAccountId === account.id) return sum + t.amountPln; // konto docelowe
      return sum; // konto niezaangażowane
    }

    // Jeden rekord (nowy format)
    if (t.id != null) handled.add(t.id);
    if (t.accountId   === account.id) return sum - t.amountPln; // wypływ
    if (t.toAccountId === account.id) return sum + t.amountPln; // wpływ
    return sum;
  }, account.openingBalance);
}

// ─── Formularz konta ─────────────────────────────────────────────────────────

interface AccountFormState {
  name:           string;
  type:           AccountType;
  scope:          AccountScope;
  openingBalance: string;
}

const emptyAccountForm = (defaultScope = 'osobiste'): AccountFormState => ({
  name: '', type: 'bank', scope: defaultScope, openingBalance: '0',
});

// ─── Formularz transakcji ────────────────────────────────────────────────────

interface TxFormState {
  accountId:   string;
  date:        string;
  type:        TxType;
  scope:       TxScope;
  category:    string;
  description: string;
  amountPln:   string;
  toAccountId: string;
  notes:       string;
}

const emptyTxForm = (defaultAccountId?: number, defaultScope = 'osobiste'): TxFormState => ({
  accountId:   defaultAccountId != null ? String(defaultAccountId) : '',
  date:        todayISO(),
  type:        'expense',
  scope:       defaultScope,
  category:    '',
  description: '',
  amountPln:   '',
  toAccountId: '',
  notes:       '',
});

// ─── Formularz paragonu (wiele pozycji) ──────────────────────────────────────

interface ReceiptLine {
  key:         string;
  scope:       string;
  category:    string;
  amountPln:   string;
  description: string;
}

interface ReceiptFormState {
  date:      string;
  accountId: string;
  store:     string;
  lines:     ReceiptLine[];
}

function newReceiptLine(scope: string): ReceiptLine {
  return { key: Math.random().toString(36).slice(2), scope, category: '', amountPln: '', description: '' };
}

const emptyReceiptForm = (defaultScope = 'osobiste'): ReceiptFormState => ({
  date: todayISO(), accountId: '', store: '',
  lines: [newReceiptLine(defaultScope)],
});

// ─── Stałe ────────────────────────────────────────────────────────────────────

const ONBOARD_KEY = 'fermly_cash_onboarded'; // localStorage — pierwsze wejście

// ─── Komponent ────────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const [activeTab, setActiveTab] = useState<'dziennik' | 'rozliczenia'>('dziennik');
  const [accounts,   setAccounts]   = useState<CashAccount[]>([]);
  const [allTxs,     setAllTxs]     = useState<CashTransaction[]>([]);
  const [pending,    setPending]    = useState<FinancialEvent[]>([]);
  const [categories, setCategories] = useState<CashCategory[]>([]);
  const [rev, setRev] = useState(0);
  const reload = useCallback(() => setRev(r => r + 1), []);

  // ── Ładowanie ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // ── Onboarding (pierwsze wejście) ─────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Dynamiczne działalności ───────────────────────────────────────────────
  const activities = useActivities();
  const businessActivities = useMemo(
    () => activities.filter(a => a.isActive && a.key !== 'shared'),
    [activities],
  );
  const scopeLabel = useMemo(
    () => Object.fromEntries([
      ...activities.map(a => [a.key, `${a.icon} ${a.name}`]),
      ['shared', '🔀 Wspólne'],
    ]),
    [activities],
  );
  const scopeBadge = useMemo(
    () => Object.fromEntries([
      ...activities.map(a => [a.key, a.color]),
      ['shared', 'orange'],
    ]) as Record<string, 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray'>,
    [activities],
  );
  // Domyślny zakres nowych wpisów: pierwsza aktywna działalność,
  // w trybie finansowym (bez produkcji) — 'osobiste'.
  const defaultScope = businessActivities[0]?.key ?? 'osobiste';

  // ── Noty wewnętrzne ───────────────────────────────────────────────────────
  const allInternalTransfers = useInternalTransfers();
  const [showTransferForm,  setShowTransferForm]  = useState(false);
  const [transferForm,      setTransferForm]      = useState({
    date: todayISO(), fromScope: 'sery', toScope: 'agroturystyka',
    amountPln: '', description: '', notes: '',
  });
  const [savingTransfer,    setSavingTransfer]    = useState(false);
  const [transferError,     setTransferError]     = useState('');
  const [deleteTransfer,    setDeleteTransfer]    = useState<InternalTransfer | null>(null);

  const onSaveTransfer = async () => {
    const amount = parseFloat(transferForm.amountPln);
    if (!amount || !transferForm.description.trim()) return;
    if (transferForm.fromScope === transferForm.toScope) {
      setTransferError('Działalność źródłowa i docelowa muszą być różne.');
      return;
    }
    setSavingTransfer(true);
    setTransferError('');
    try {
      await internalTransferService.create({
        date:        transferForm.date,
        fromScope:   transferForm.fromScope,
        toScope:     transferForm.toScope,
        amountPln:   amount,
        description: transferForm.description.trim(),
        notes:       transferForm.notes.trim() || undefined,
      });
      setTransferForm({ date: todayISO(), fromScope: 'sery', toScope: 'agroturystyka',
        amountPln: '', description: '', notes: '' });
      setShowTransferForm(false);
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setSavingTransfer(false);
    }
  };

  // Stan zarządzania kategoriami
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [newCatName,    setNewCatName]    = useState('');
  const [newCatScope,   setNewCatScope]   = useState<TxScope | ''>('');
  const [newCatType,    setNewCatType]    = useState<TxType | ''>('');
  const [savingCat,     setSavingCat]     = useState(false);
  const [deleteCat,     setDeleteCat]     = useState<CashCategory | null>(null);

  // Stan modalu rozliczenia
  const [settleTarget,    setSettleTarget]    = useState<FinancialEvent | null>(null);
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleDate,      setSettleDate]      = useState(todayISO());
  const [settling,        setSettling]        = useState(false);
  const [deleteEvent,     setDeleteEvent]     = useState<FinancialEvent | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      cashFlowService.getAccounts(),
      cashFlowService.getTransactions(),
      financialEventService.getPending(),
      cashFlowService.getAllCategories(),
    ]).then(([accs, txs, evts, cats]) => {
      setAccounts(accs.sort((a, b) => a.name.localeCompare(b.name)));
      setAllTxs(txs.sort((a, b) => b.date.localeCompare(a.date)));
      setPending(evts.sort((a, b) => b.date.localeCompare(a.date)));
      setCategories(cats.sort((a, b) => a.name.localeCompare(b.name, 'pl')));
      setIsLoading(false);
      // Pokaż onboarding tylko przy pustej bazie i pierwszym wejściu
      if (accs.length === 0 && !localStorage.getItem(ONBOARD_KEY)) {
        setShowOnboarding(true);
      }
    }).catch(() => setIsLoading(false));
  }, [rev]);

  // Filtry
  const [filterAccount, setFilterAccount] = useState<string>('');
  const [filterScope,   setFilterScope]   = useState<string>('');
  const [filterType,    setFilterType]    = useState<string>('');
  const [filterMonth,   setFilterMonth]   = useState<string>('');

  // Modale
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showTxForm,      setShowTxForm]      = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<CashTransaction | null>(null);
  const [accountForm,     setAccountForm]     = useState<AccountFormState>(emptyAccountForm());
  const [txForm,          setTxForm]          = useState<TxFormState>(emptyTxForm());
  const [saving,          setSaving]          = useState(false);
  const [txDuplicates,    setTxDuplicates]    = useState<CashTransaction[]>([]);

  // ── Paragon ───────────────────────────────────────────────────────────────
  const [showReceiptForm,  setShowReceiptForm]  = useState(false);
  const [receiptForm,      setReceiptForm]      = useState<ReceiptFormState>(emptyReceiptForm());
  const [savingReceipt,    setSavingReceipt]    = useState(false);
  const [receiptError,     setReceiptError]     = useState('');

  // ── Przefiltrowane transakcje ─────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    return allTxs.filter(t => {
      // Filtr konta: pokaż transakcję jeśli konto jest źródłem LUB celem przelewu
      if (filterAccount) {
        const isOwn      = String(t.accountId)   === filterAccount;
        const isIncoming = t.type === 'transfer' && String(t.toAccountId) === filterAccount;
        if (!isOwn && !isIncoming) return false;
      }
      if (filterScope && t.scope !== filterScope) return false;
      if (filterType  && t.type  !== filterType)  return false;
      if (filterMonth && !t.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [allTxs, filterAccount, filterScope, filterType, filterMonth]);

  // ── Noty wewnętrzne – filtr ────────────────────────────────────────────
  const filteredTransfers = useMemo(() => {
    return allInternalTransfers.filter(t => {
      if (filterScope && t.fromScope !== filterScope && t.toScope !== filterScope) return false;
      if (filterMonth && !t.date.startsWith(filterMonth)) return false;
      if (filterAccount) return false; // noty nie mają konta
      return true;
    });
  }, [allInternalTransfers, filterScope, filterMonth, filterAccount]);

  // ── Dziennik: połączona lista transakcji + not ─────────────────────────
  const journalItems = useMemo(() => {
    const txItems       = filteredTxs.map(tx => ({ kind: 'tx'   as const, date: tx.date, tx }));
    const notaItems     = filteredTransfers.map(t  => ({ kind: 'nota' as const, date: t.date,  nota: t }));
    return [...txItems, ...notaItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredTxs, filteredTransfers]);

  // ── Sumy ─────────────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + calcBalance(a, allTxs), 0);
  const drobBalance = accounts
    .filter(a => a.scope === 'drob' || a.scope === 'shared')
    .reduce((s, a) => s + calcBalance(a, allTxs), 0);

  // Noty wewnętrzne wpływają na P&L per działalność (ale nie na saldo kont):
  //   fromScope = przychód wewnętrzny (odzysk kosztu)
  //   toScope   = koszt wewnętrzny (zużycie surowca)
  const transferIncomeAdj = filteredTransfers
    .filter(t => !filterScope || t.fromScope === filterScope)
    .reduce((s, t) => s + t.amountPln, 0);
  const transferExpenseAdj = filteredTransfers
    .filter(t => !filterScope || t.toScope === filterScope)
    .reduce((s, t) => s + t.amountPln, 0);

  // Wpływy i wydatki GOTÓWKOWE (bez not wewnętrznych – nie są przepływem kasowym)
  const filteredIncome  = filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amountPln, 0);
  const filteredExpense = filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountPln, 0);
  // Noty wewnętrzne – osobna linia (memoriał, bez gotówki)
  const filteredNotaTotal = filteredTransfers.reduce((s, t) => s + t.amountPln, 0);

  // ── Zapis konta ────────────────────────────────────────────────────────────
  const onSaveAccount = async () => {
    if (!accountForm.name.trim()) return;
    setSaving(true);
    await cashFlowService.createAccount({
      name:           accountForm.name.trim(),
      type:           accountForm.type,
      scope:          accountForm.scope,
      openingBalance: parseFloat(accountForm.openingBalance) || 0,
      isActive:       true,
    });
    setSaving(false);
    setShowAccountForm(false);
    setAccountForm(emptyAccountForm(defaultScope));
    reload();
  };

  // ── Wykrywanie duplikatów – tylko ręczne wpisy (bez sourceType) ──────────
  function findManualDuplicates(form: TxFormState, txs: CashTransaction[]): CashTransaction[] {
    if (form.type === 'transfer') return [];
    const amount = parseFloat(form.amountPln);
    if (isNaN(amount) || amount <= 0 || !form.accountId) return [];
    // okno ±2 dni
    const dates = new Set(
      [-2, -1, 0, 1, 2].map(delta => {
        const d = new Date(form.date);
        d.setDate(d.getDate() + delta);
        return d.toISOString().slice(0, 10);
      }),
    );
    return txs.filter(t =>
      !t.sourceType &&                             // tylko ręczne
      t.accountId === Number(form.accountId) &&
      t.type      === form.type &&
      Math.abs(t.amountPln - amount) < 0.01 &&
      dates.has(t.date),
    );
  }

  // ── Zapis transakcji ───────────────────────────────────────────────────────
  const onSaveTx = async (force = false) => {
    if (!txForm.accountId || !txForm.description.trim() || !txForm.amountPln) return;
    const amount = parseFloat(txForm.amountPln);
    if (isNaN(amount) || amount <= 0) return;

    // Sprawdź duplikaty przed zapisem (tylko ręczne wpisy)
    if (!force && txForm.type !== 'transfer') {
      const dupes = findManualDuplicates(txForm, allTxs);
      if (dupes.length > 0) {
        setTxDuplicates(dupes);
        return;
      }
    }
    setTxDuplicates([]);
    setSaving(true);

    if (txForm.type === 'transfer') {
      if (!txForm.toAccountId) { setSaving(false); return; }
      await cashFlowService.createTransfer(
        Number(txForm.accountId),
        Number(txForm.toAccountId),
        txForm.date,
        amount,
        txForm.description.trim(),
      );
    } else {
      await cashFlowService.createTransaction({
        accountId:   Number(txForm.accountId),
        date:        txForm.date,
        type:        txForm.type,
        scope:       txForm.scope,
        category:    txForm.category,
        description: txForm.description.trim(),
        amountPln:   amount,
        notes:       txForm.notes.trim() || undefined,
      });
    }
    setSaving(false);
    setShowTxForm(false);
    setTxForm(emptyTxForm(undefined, defaultScope));
    setTxDuplicates([]);
    reload();
  };

  // ── Zapis paragonu ────────────────────────────────────────────────────────
  const onSaveReceipt = async () => {
    setReceiptError('');
    const validLines = receiptForm.lines.filter(l => {
      const v = parseFloat(l.amountPln);
      return !isNaN(v) && v > 0;
    });
    if (!receiptForm.accountId)       { setReceiptError('Wybierz konto.'); return; }
    if (!receiptForm.store.trim())    { setReceiptError('Podaj nazwę sklepu / kontrahenta.'); return; }
    if (validLines.length === 0)      { setReceiptError('Dodaj co najmniej jedną pozycję z kwotą.'); return; }

    setSavingReceipt(true);
    try {
      for (const line of validLines) {
        const desc = line.description.trim()
          ? `${receiptForm.store.trim()} – ${line.description.trim()}`
          : receiptForm.store.trim();
        await cashFlowService.createTransaction({
          accountId:   Number(receiptForm.accountId),
          date:        receiptForm.date,
          type:        'expense',
          scope:       line.scope,
          category:    line.category,
          description: desc,
          amountPln:   parseFloat(line.amountPln),
        });
      }
      setShowReceiptForm(false);
      setReceiptForm(emptyReceiptForm(defaultScope));
      reload();
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSavingReceipt(false);
    }
  };

  const accountMap = new Map(accounts.map(a => [a.id!, a]));

  // ── Wykres salda konta ─────────────────────────────────────────────────────
  const [chartAccount,  setChartAccount]  = useState<CashAccount | null>(null);
  const [showAllChart,  setShowAllChart]  = useState(false);

  const accountChartData = useMemo(() => {
    if (!chartAccount) return { balanceHistory: [], monthlyBars: [] };
    const id = chartAccount.id!;

    // Transakcje tego konta posortowane po dacie rosnąco
    const accTxs = [...allTxs]
      .filter(t => t.accountId === id || t.toAccountId === id)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Historia salda (running balance)
    let bal = chartAccount.openingBalance;
    const seen = new Set<number>();
    const balanceHistory: { date: string; value: number }[] = [];

    for (const tx of accTxs) {
      if (tx.id != null && seen.has(tx.id)) continue;
      if (tx.id != null) seen.add(tx.id);

      if (tx.type === 'income'  && tx.accountId === id) bal += tx.amountPln;
      else if (tx.type === 'expense' && tx.accountId === id) bal -= tx.amountPln;
      else if (tx.type === 'transfer') {
        if (tx.accountId === id)   bal -= tx.amountPln;
        if (tx.toAccountId === id) bal += tx.amountPln;
      }
      balanceHistory.push({ date: tx.date, value: Math.round(bal * 100) / 100 });
    }

    // Miesięczne wpływy vs wydatki (ostatnie 6 miesięcy)
    const now = new Date();
    const months: Record<string, { month: string; income: number; cost: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { month: d.toLocaleDateString('pl-PL', { month: 'short' }), income: 0, cost: 0 };
    }
    for (const tx of accTxs) {
      const m = tx.date.slice(0, 7);
      if (!months[m]) continue;
      if (tx.type === 'income'  && tx.accountId === id) months[m].income += tx.amountPln;
      if (tx.type === 'expense' && tx.accountId === id) months[m].cost   += tx.amountPln;
    }
    return { balanceHistory, monthlyBars: Object.values(months) };
  }, [chartAccount, allTxs]);

  // ── Dane wykresu zbiorczego (wszystkie konta) ────────────────────────────
  const allChartData = useMemo(() => {
    if (!showAllChart && accounts.length === 0) return null;

    const sorted = [...allTxs].sort((a, b) => a.date.localeCompare(b.date));

    // Bieżące saldo = suma sald otwarcia
    let running = accounts.reduce((s, a) => s + a.openingBalance, 0);
    const seen = new Set<number>();
    const balanceHistory: { date: string; value: number }[] = [];

    for (const tx of sorted) {
      if (tx.id != null && seen.has(tx.id)) continue;
      if (tx.id != null) seen.add(tx.id);
      // Transfery wewnętrzne niwelują się (wychodzi z A, wchodzi do B)
      if (tx.type === 'income')  running += tx.amountPln;
      if (tx.type === 'expense') running -= tx.amountPln;
      balanceHistory.push({ date: tx.date, value: Math.round(running * 100) / 100 });
    }

    // Ostatnie 12 miesięcy — wpływy vs wydatki
    const now = new Date();
    const monthMap12: Record<string, { month: string; income: number; cost: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap12[key] = {
        month: d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
        income: 0, cost: 0,
      };
    }
    for (const tx of sorted) {
      if (tx.type === 'transfer') continue;
      const m = tx.date.slice(0, 7);
      if (!monthMap12[m]) continue;
      if (tx.type === 'income')  monthMap12[m].income += tx.amountPln;
      if (tx.type === 'expense') monthMap12[m].cost   += tx.amountPln;
    }
    const monthlyBars = Object.values(monthMap12);

    // Ostatnie 6 miesięcy — przychody per działalność
    const scopes = [...new Set(allTxs.filter(t => t.type === 'income').map(t => t.scope))];
    const SCOPE_COLORS: Record<string, string> = {
      drob: '#f97316', sery: '#8b5cf6', kiszonki: '#22c55e',
      agroturystyka: '#06b6d4', osobiste: '#64748b',
    };
    const monthMap6: Record<string, Record<string, unknown> & { month: string }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry: Record<string, unknown> & { month: string } = {
        month: d.toLocaleDateString('pl-PL', { month: 'short' }),
      };
      scopes.forEach(sc => { entry[sc] = 0; });
      monthMap6[key] = entry;
    }
    for (const tx of sorted) {
      if (tx.type !== 'income') continue;
      const m = tx.date.slice(0, 7);
      if (!monthMap6[m]) continue;
      const prev = (monthMap6[m][tx.scope] as number | undefined) ?? 0;
      monthMap6[m][tx.scope] = prev + tx.amountPln;
    }
    const activityBars = Object.values(monthMap6);
    const activitySeries = scopes
      .filter(sc => activityBars.some(m => ((m[sc] as number | undefined) ?? 0) > 0))
      .map(sc => ({
        key: sc,
        label: sc.charAt(0).toUpperCase() + sc.slice(1),
        color: SCOPE_COLORS[sc] ?? '#94a3b8',
      }));

    // Bieżący miesiąc
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthIncome  = monthlyBars.find(m => Object.keys(monthMap12).includes(thisMonthKey) &&
      m.month === monthMap12[thisMonthKey]?.month)?.income ?? 0;
    const thisMonthExpense = monthlyBars.find(m => Object.keys(monthMap12).includes(thisMonthKey) &&
      m.month === monthMap12[thisMonthKey]?.month)?.cost ?? 0;

    return { balanceHistory, monthlyBars, activityBars, activitySeries,
             currentTotal: running, thisMonthIncome, thisMonthExpense };
  }, [showAllChart, accounts, allTxs]);

  // ── Miesiące do filtra ─────────────────────────────────────────────────────
  const months = useMemo(() => {
    const set = new Set<string>();
    allTxs.forEach(t => set.add(t.date.substring(0, 7)));
    return [...set].sort().reverse();
  }, [allTxs]);

  // Kategorie dla formularza transakcji: pasujące do zakresu + ogólne (scope=null)
  const txCategories = useMemo(() => {
    const scope = txForm.scope as TxScope;
    const type  = txForm.type !== 'transfer' ? txForm.type as TxType : undefined;
    return categories.filter(c => {
      if (c.scope != null && c.scope !== scope) return false;
      if (type && c.type != null && c.type !== type) return false;
      return true;
    });
  }, [categories, txForm.scope, txForm.type]);

  // ── Obsługa kategorii ─────────────────────────────────────────────────────
  const onAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    await cashFlowService.createCategory(
      newCatName,
      newCatScope || undefined,
      newCatType  || undefined,
    );
    setSavingCat(false);
    setNewCatName('');
    reload();
  };

  const onDeleteCat = async () => {
    if (deleteCat?.id) { await cashFlowService.deleteCategory(deleteCat.id); reload(); }
    setDeleteCat(null);
  };

  const onSettle = async () => {
    if (!settleTarget || !settleAccountId) return;
    setSettling(true);
    await financialEventService.settle(settleTarget.id!, Number(settleAccountId), settleDate);
    setSettling(false);
    setSettleTarget(null);
    setSettleAccountId('');
    setSettleDate(todayISO());
    reload();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dziennik Kasowy</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCatModal(true)}>
            + Kategoria
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAccountForm(emptyAccountForm(defaultScope)); setShowAccountForm(true); }}>
            + Konto
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const first  = businessActivities[0]?.key ?? 'drob';
            const second = businessActivities[1]?.key ?? first;
            setTransferForm(f => ({ ...f, fromScope: first, toScope: second }));
            setTransferError('');
            setShowTransferForm(true);
          }} disabled={businessActivities.length < 2}>
            ↔ Nota
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => {
              setReceiptForm(emptyReceiptForm(defaultScope));
              setReceiptError('');
              setShowReceiptForm(true);
            }}
            disabled={accounts.length === 0}>
            📄 Paragon
          </Button>
          <Button size="sm" onClick={() => { setTxForm(emptyTxForm(undefined, defaultScope)); setShowTxForm(true); }}
            disabled={accounts.length === 0}>
            + Transakcja
          </Button>
        </div>
      </div>

      <div><AskLLM defaultQuery="jak prowadzić kasę i bank w gospodarstwie rolnym ewidencja kosztów" contextUrl="https://fermly.pl/przewodnik-kasa-bank.html" /></div>

      {/* ── Zakładki ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setActiveTab('dziennik')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dziennik' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          💳 Dziennik kasowy
        </button>
        <button onClick={() => setActiveTab('rozliczenia')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'rozliczenia' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          📅 Do rozliczenia
          {pending.length > 0 && (
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeTab === 'rozliczenia' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
              {pending.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DZIENNIK KASOWY
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dziennik' && (<>

      {/* Karty kont — skeleton podczas ładowania */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        /* ── Guided EmptyState ───────────────────────────────────────── */
        <div className="max-w-md mx-auto py-6 px-2 text-center space-y-6">
          <div className="text-5xl">💳</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Zacznij śledzić swoje finanse</h3>
            <p className="text-sm text-gray-500">Trzy proste kroki i masz pełną kontrolę nad przepływem pieniędzy.</p>
          </div>

          {/* Kroki */}
          <div className="space-y-3 text-left">
            {[
              { n: '1', icon: '🏦', label: 'Dodaj konto', desc: 'Konto bankowe lub gotówkę — ile masz teraz' },
              { n: '2', icon: '➕', label: 'Wpisz transakcję', desc: 'Wpływ ze sprzedaży lub wydatek na paszę' },
              { n: '3', icon: '📊', label: 'Analizuj przepływy', desc: 'Wykresy, filtry i zestawienia zawsze pod ręką' },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {s.n}
                </div>
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={() => setShowAccountForm(true)}>
            🏦 Dodaj pierwsze konto →
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {accounts.map(acc => {
            const bal       = calcBalance(acc, allTxs);
            const isActive  = filterAccount === String(acc.id);
            return (
              <div
                key={acc.id}
                className={`text-left rounded-xl border p-4 flex flex-col gap-1 shadow-sm transition-all active:scale-[0.98] hover:shadow-md ${
                  isActive
                    ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate flex-1 cursor-pointer"
                    onClick={() => setFilterAccount(isActive ? '' : String(acc.id))}>{acc.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setChartAccount(acc); }}
                      className="text-gray-300 hover:text-brand-500 transition-colors p-0.5"
                      title="Wykres salda"
                    >📊</button>
                    <span className="text-xs">{acc.type === 'bank' ? '🏦' : '💵'}</span>
                  </div>
                </div>
                <div
                  className={`text-lg font-bold cursor-pointer ${bal < 0 ? 'text-red-600' : isActive ? 'text-brand-700' : 'text-gray-900'}`}
                  onClick={() => setFilterAccount(isActive ? '' : String(acc.id))}
                >
                  {formatPln(bal)}
                </div>
                <div className="flex items-center justify-between gap-1"
                  onClick={() => setFilterAccount(isActive ? '' : String(acc.id))}
                  style={{ cursor: 'pointer' }}>
                  <Badge color={scopeBadge[acc.scope] ?? 'gray'}>
                    {scopeLabel[acc.scope] ?? acc.scope}
                  </Badge>
                  {isActive && <span className="text-xs text-brand-500 font-medium">filtruje →</span>}
                </div>
              </div>
            );
          })}

          {/* Podsumowanie */}
          {accounts.length > 1 && (
            <div
              className={`text-left rounded-xl border p-4 flex flex-col gap-1 shadow-sm transition-all hover:shadow-md ${
                filterAccount === ''
                  ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-300'
                  : 'bg-brand-50 border-brand-200 hover:border-brand-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setFilterAccount('')} className="text-xs text-brand-600 font-medium">
                  Razem wszystkie
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setShowAllChart(true); }}
                  className="text-gray-400 hover:text-brand-600 transition-colors p-0.5"
                  title="Wykres przepływu pieniędzy"
                >📊</button>
              </div>
              <button onClick={() => setFilterAccount('')}
                className={`text-lg font-bold text-left ${totalBalance < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                {formatPln(totalBalance)}
              </button>
              <span className="text-xs text-brand-500">🐔 Drób: {formatPln(drobBalance)}</span>
            </div>
          )}
        </div>
      )}

      {/* Filtry */}
      {accounts.length > 0 && (
        <Card>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Wszystkie konta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <select
              value={filterScope}
              onChange={e => setFilterScope(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Wszystkie działalności</option>
              {activities.filter(a => a.isActive).map(a => (
                <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Wpływy i wydatki</option>
              <option value="income">Tylko wpływy</option>
              <option value="expense">Tylko wydatki</option>
              <option value="transfer">Tylko przelewy</option>
            </select>

            {months.length > 0 && (
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Wszystkie miesiące</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>

          {/* Suma przefiltrowanych */}
          {(filteredIncome > 0 || filteredExpense > 0 || filteredNotaTotal > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-sm">
              {filteredIncome > 0  && <span className="text-green-700">▲ Wpływy: <strong>{formatPln(filteredIncome)}</strong></span>}
              {filteredExpense > 0 && <span className="text-red-600">▼ Wydatki: <strong>{formatPln(filteredExpense)}</strong></span>}
              {filteredIncome > 0 && filteredExpense > 0 && (
                <span className={`font-semibold ${filteredIncome - filteredExpense >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  = {formatPln(filteredIncome - filteredExpense)}
                </span>
              )}
              {filteredNotaTotal > 0 && (
                <span className="text-purple-600">↔ Noty wewnętrzne: <strong>{formatPln(filteredNotaTotal)}</strong> <span className="font-normal opacity-70">(bez gotówki)</span></span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Lista transakcji + not wewnętrznych */}
      {isLoading && (
        <Card>
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      )}
      {!isLoading && accounts.length > 0 && (
        journalItems.length === 0 ? (
          <EmptyState icon="📋" title="Brak transakcji" description="Dodaj pierwszą transakcję klikając &quot;+ Transakcja&quot;" />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {journalItems.map((item, idx) => {

                /* ── Nota wewnętrzna ── */
                if (item.kind === 'nota') {
                  const nota = item.nota;
                  return (
                    <div key={`nota-${nota.id}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 bg-purple-100 text-purple-700">
                        ↔
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{nota.description}</span>
                          <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">Nota wewnętrzna</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                          <span>{formatDate(nota.date)}</span>
                          <span>
                            <Badge color={scopeBadge[nota.fromScope] ?? 'gray'}>{scopeLabel[nota.fromScope] ?? nota.fromScope}</Badge>
                            {' → '}
                            <Badge color={scopeBadge[nota.toScope] ?? 'gray'}>{scopeLabel[nota.toScope] ?? nota.toScope}</Badge>
                          </span>
                        </div>
                        {nota.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{nota.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-purple-700">↔ {formatPln(nota.amountPln)}</span>
                        <button
                          onClick={() => setDeleteTransfer(nota)}
                          className="text-gray-300 hover:text-red-400 transition-colors p-1"
                          title="Usuń"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                }

                /* ── Transakcja gotówkowa ── */
                const tx = item.tx;
                const acc = accountMap.get(tx.accountId);
                let isIncomingTransfer = false;
                if (tx.type === 'transfer') {
                  if (filterAccount) {
                    isIncomingTransfer = String(tx.toAccountId) === filterAccount;
                  } else {
                    const mirror = filteredTxs.find(m =>
                      m.type === 'transfer' && m.id !== tx.id &&
                      m.accountId === tx.toAccountId && m.toAccountId === tx.accountId &&
                      m.date === tx.date && m.amountPln === tx.amountPln
                    );
                    if (mirror) isIncomingTransfer = (tx.id ?? 0) > (mirror.id ?? 0);
                  }
                }
                return (
                  <div key={`tx-${tx.id ?? idx}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      tx.type === 'income'   ? 'bg-green-100' :
                      tx.type === 'expense'  ? 'bg-red-100'   :
                      isIncomingTransfer     ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {tx.type === 'income'   ? '▲' :
                       tx.type === 'expense'  ? '▼' :
                       isIncomingTransfer     ? '▲' : '▼'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{tx.description}</span>
                        {tx.category && tx.category !== 'transfer' && (
                          <span className="text-xs text-gray-400">{tx.category}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>{formatDate(tx.date)}</span>
                        {tx.type === 'transfer' ? (
                          <span>{accountMap.get(tx.accountId)?.name ?? '?'} → {accountMap.get(tx.toAccountId!)?.name ?? '?'}</span>
                        ) : (
                          acc && <span>{acc.name}</span>
                        )}
                        {tx.type !== 'transfer' && (
                          <Badge color={scopeBadge[tx.scope] ?? 'gray'} className="text-xs">
                            {scopeLabel[tx.scope] ?? tx.scope}
                          </Badge>
                        )}
                      </div>
                      {tx.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{tx.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${
                        tx.type === 'income'   ? 'text-green-700' :
                        tx.type === 'expense'  ? 'text-red-600'   :
                        isIncomingTransfer     ? 'text-green-700' : 'text-blue-700'
                      }`}>
                        {tx.type === 'income'  ? '+' :
                         tx.type === 'expense' ? '−' :
                         isIncomingTransfer    ? '+' : '−'}
                        {formatPln(tx.amountPln)}
                      </span>
                      <button
                        onClick={() => setDeleteTarget(tx)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1"
                        title="Usuń"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}

      </>)} {/* koniec TAB: dziennik */}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DO ROZLICZENIA
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'rozliczenia' && (
        <div className="space-y-4">
          {pending.length === 0 ? (
            <EmptyState
              icon="✅"
              title="Wszystko rozliczone"
              description="Żadnych oczekujących płatności. Dodaj sprzedaż lub wydatek z opcją &quot;Do rozliczenia&quot;."
            />
          ) : (
            <>
              <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                💡 Poniżej są faktury i operacje, które zostały zarejestrowane, ale pieniądze jeszcze nie wpłynęły / nie wyszły z konta.
                Kliknij <strong>Rozlicz</strong> gdy płatność zostanie zrealizowana.
              </div>

              {/* Należności (income) */}
              {pending.filter(e => e.type === 'income').length > 0 && (
                <Card title={`📥 Należności – do otrzymania (${pending.filter(e => e.type === 'income').length})`} padding="none">
                  <div className="divide-y divide-gray-50">
                    {pending.filter(e => e.type === 'income').map(ev => (
                      <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{ev.description}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {formatDate(ev.date)}
                            <span className="ml-2">
                              {ev.sourceType === 'sale' ? '🛒 Sprzedaż' : ev.sourceType === 'expense' ? '💸 Wydatek' : '🌾 Dostawa pasz'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-green-700 text-sm">+{formatPln(ev.amountPln)}</span>
                          <button
                            onClick={() => { setSettleTarget(ev); setSettleDate(todayISO()); setSettleAccountId(''); }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
                          >
                            Rozlicz
                          </button>
                          <button onClick={() => setDeleteEvent(ev)} className="text-gray-300 hover:text-red-400 text-xs p-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 bg-green-50 border-t border-green-100 text-xs text-green-700 font-medium">
                    Do otrzymania: {formatPln(pending.filter(e => e.type === 'income').reduce((s, e) => s + e.amountPln, 0))}
                  </div>
                </Card>
              )}

              {/* Zobowiązania (expense) */}
              {pending.filter(e => e.type === 'expense').length > 0 && (
                <Card title={`📤 Zobowiązania – do zapłaty (${pending.filter(e => e.type === 'expense').length})`} padding="none">
                  <div className="divide-y divide-gray-50">
                    {pending.filter(e => e.type === 'expense').map(ev => (
                      <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{ev.description}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {formatDate(ev.date)}
                            <span className="ml-2">
                              {ev.sourceType === 'sale' ? '🛒 Sprzedaż' : ev.sourceType === 'expense' ? '💸 Wydatek' : '🌾 Dostawa pasz'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-red-600 text-sm">−{formatPln(ev.amountPln)}</span>
                          <button
                            onClick={() => { setSettleTarget(ev); setSettleDate(todayISO()); setSettleAccountId(''); }}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
                          >
                            Rozlicz
                          </button>
                          <button onClick={() => setDeleteEvent(ev)} className="text-gray-300 hover:text-red-400 text-xs p-1">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700 font-medium">
                    Do zapłaty: {formatPln(pending.filter(e => e.type === 'expense').reduce((s, e) => s + e.amountPln, 0))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal rozliczenia ────────────────────────────────────────────── */}
      <Modal open={settleTarget != null} onClose={() => setSettleTarget(null)}
        title={settleTarget?.type === 'income' ? '💰 Rozlicz należność' : '💸 Rozlicz zobowiązanie'} size="sm">
        {settleTarget && (
          <div className="space-y-4">
            <div className={`rounded-xl px-4 py-3 ${settleTarget.type === 'income' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
              <div className="text-sm font-medium text-gray-800">{settleTarget.description}</div>
              <div className={`text-xl font-bold mt-1 ${settleTarget.type === 'income' ? 'text-green-700' : 'text-red-600'}`}>
                {settleTarget.type === 'income' ? '+' : '−'}{formatPln(settleTarget.amountPln)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Zarejestrowano: {formatDate(settleTarget.date)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {settleTarget.type === 'income' ? 'Pieniądze wpłynęły na konto' : 'Płatność wyszła z konta'}
              </label>
              <select value={settleAccountId} onChange={e => setSettleAccountId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">— Wybierz konto —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data rozliczenia</label>
              <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="flex gap-3 pt-1">
              <Button className="flex-1" loading={settling} disabled={!settleAccountId} onClick={onSettle}>
                ✓ Zatwierdź rozliczenie
              </Button>
              <Button variant="outline" onClick={() => setSettleTarget(null)}>Anuluj</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteEvent != null}
        onClose={() => setDeleteEvent(null)}
        onConfirm={async () => {
          if (deleteEvent?.id) { await financialEventService.delete(deleteEvent.id); reload(); }
        }}
        title="Usuń dokument"
        message={`Usunąć "${deleteEvent?.description}"?`}
        confirmLabel="Usuń"
        danger
      />

      {/* ── Modal: nowe konto ─────────────────────────────────────────────── */}
      <Modal open={showAccountForm} onClose={() => setShowAccountForm(false)} title="Nowe konto" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa konta</label>
            <input
              type="text"
              value={accountForm.name}
              onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
              placeholder="np. Konto firmowe PKO"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
              <select
                value={accountForm.type}
                onChange={e => setAccountForm(f => ({ ...f, type: e.target.value as AccountType }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="bank">🏦 Konto bankowe</option>
                <option value="cash">💵 Kasa gotówkowa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Przeznaczenie</label>
              <select
                value={accountForm.scope}
                onChange={e => setAccountForm(f => ({ ...f, scope: e.target.value as AccountScope }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {activities.filter(a => a.isActive).map(a => (
                  <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                ))}
                <option value="shared">🔀 Wspólne</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo otwarcia (PLN)</label>
            <input
              type="number"
              step="0.01"
              value={accountForm.openingBalance}
              onChange={e => setAccountForm(f => ({ ...f, openingBalance: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button className="flex-1" loading={saving} onClick={onSaveAccount}>Dodaj konto</Button>
            <Button variant="outline" onClick={() => setShowAccountForm(false)}>Anuluj</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: nowa transakcja ────────────────────────────────────────── */}
      <Modal open={showTxForm} onClose={() => { setShowTxForm(false); setTxDuplicates([]); }} title="Nowa transakcja" size="md">
        <div className="space-y-4">

          {/* Typ + zakres */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj</label>
              <select
                value={txForm.type}
                onChange={e => setTxForm(f => ({ ...f, type: e.target.value as TxType, toAccountId: '' }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="income">▲ Wpływ</option>
                <option value="expense">▼ Wydatek</option>
                <option value="transfer">⇄ Przelew między kontami</option>
              </select>
            </div>
            {txForm.type !== 'transfer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rozliczenie</label>
                <select
                  value={txForm.scope}
                  onChange={e => setTxForm(f => ({ ...f, scope: e.target.value as TxScope, category: '' }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {businessActivities.map(a => (
                    <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Konto źródłowe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {txForm.type === 'transfer' ? 'Z konta' : 'Konto'}
            </label>
            <select
              value={txForm.accountId}
              onChange={e => setTxForm(f => ({ ...f, accountId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Wybierz konto —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Konto docelowe (tylko przelew) */}
          {txForm.type === 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Na konto</label>
              <select
                value={txForm.toAccountId}
                onChange={e => setTxForm(f => ({ ...f, toAccountId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Wybierz konto docelowe —</option>
                {accounts.filter(a => String(a.id) !== txForm.accountId).map(a =>
                  <option key={a.id} value={a.id}>{a.name}</option>
                )}
              </select>
            </div>
          )}

          {/* Data + kwota */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                value={txForm.date}
                onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kwota (PLN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={txForm.amountPln}
                onChange={e => setTxForm(f => ({ ...f, amountPln: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Kategoria (nie dla przelewu) */}
          {txForm.type !== 'transfer' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Kategoria</label>
                <button
                  type="button"
                  onClick={() => setShowCatModal(true)}
                  className="text-xs text-brand-600 hover:text-brand-700 underline"
                >
                  ⚙ Zarządzaj
                </button>
              </div>
              <select
                value={txForm.category}
                onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Wybierz kategorię —</option>
                {txCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Opis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
            <input
              type="text"
              value={txForm.description}
              onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
              placeholder="np. Faktura za paszę, wypłata"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Uwagi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi (opcjonalne)</label>
            <textarea
              value={txForm.notes}
              onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* ── Ostrzeżenie o duplikacie ── */}
          {txDuplicates.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
              <div className="text-sm font-semibold text-amber-800">⚠ Możliwy duplikat</div>
              <div className="space-y-1">
                {txDuplicates.map(t => (
                  <div key={t.id} className="text-xs text-amber-700 bg-white border border-amber-100 rounded-lg px-3 py-1.5 flex justify-between gap-2">
                    <span className="truncate">{t.description}</span>
                    <span className="shrink-0 font-medium">{formatDate(t.date)} · {formatPln(t.amountPln)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-amber-600">Znaleziono podobną transakcję w ciągu ±2 dni. Czy to ta sama operacja?</div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {txDuplicates.length > 0 ? (
              <>
                <Button className="flex-1" loading={saving} onClick={() => onSaveTx(true)}>
                  Zapisz mimo to
                </Button>
                <Button variant="outline" onClick={() => setTxDuplicates([])}>
                  ← Wróć
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1" loading={saving} onClick={() => onSaveTx()}>Dodaj transakcję</Button>
                <Button variant="outline" onClick={() => { setShowTxForm(false); setTxDuplicates([]); }}>Anuluj</Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Potwierdzenie usunięcia ───────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget?.id != null) { cashFlowService.deleteTransaction(deleteTarget.id).then(reload); } }}
        title="Usuń transakcję"
        message={`Czy usunąć "${deleteTarget?.description}" (${deleteTarget ? formatPln(deleteTarget.amountPln) : ''})?`}
        confirmLabel="Usuń"
        danger
      />

      {/* ── Modal: paragon / zakup wielopozycyjny ────────────────────────── */}
      <Modal
        open={showReceiptForm}
        onClose={() => { setShowReceiptForm(false); setReceiptError(''); }}
        title="📄 Paragon / Zakup"
        size="md"
      >
        <div className="space-y-4">
          {/* Nagłówek paragonu */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                value={receiptForm.date}
                onChange={e => setReceiptForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konto</label>
              <select
                value={receiptForm.accountId}
                onChange={e => setReceiptForm(f => ({ ...f, accountId: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Wybierz —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sklep / Kontrahent</label>
            <input
              type="text"
              value={receiptForm.store}
              onChange={e => setReceiptForm(f => ({ ...f, store: e.target.value }))}
              placeholder="np. Agro-Wikt, Castorama, OBI…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Pozycje paragonu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Pozycje zakupu</label>
              <span className="text-xs text-gray-400">{receiptForm.lines.length} poz.</span>
            </div>

            <div className="space-y-2">
              {receiptForm.lines.map((line, idx) => {
                const lineCats = categories.filter(c => {
                  if (c.scope != null && c.scope !== line.scope) return false;
                  if (c.type  != null && c.type  !== 'expense')  return false;
                  return true;
                });
                return (
                  <div key={line.key} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Dział</label>
                        <select
                          value={line.scope}
                          onChange={e => setReceiptForm(f => ({
                            ...f,
                            lines: f.lines.map((l, i) => i === idx ? { ...l, scope: e.target.value, category: '' } : l),
                          }))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {businessActivities.map(a => (
                            <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Kwota (PLN)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amountPln}
                          onChange={e => setReceiptForm(f => ({
                            ...f,
                            lines: f.lines.map((l, i) => i === idx ? { ...l, amountPln: e.target.value } : l),
                          }))}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Kategoria</label>
                        <select
                          value={line.category}
                          onChange={e => setReceiptForm(f => ({
                            ...f,
                            lines: f.lines.map((l, i) => i === idx ? { ...l, category: e.target.value } : l),
                          }))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="">— Kategoria —</option>
                          {lineCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opis pozycji (opcj.)</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={e => setReceiptForm(f => ({
                            ...f,
                            lines: f.lines.map((l, i) => i === idx ? { ...l, description: e.target.value } : l),
                          }))}
                          placeholder="np. karma dla kur"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    {receiptForm.lines.length > 1 && (
                      <button
                        onClick={() => setReceiptForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        ✕ Usuń pozycję
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                const lastScope = receiptForm.lines[receiptForm.lines.length - 1]?.scope
                  ?? businessActivities[0]?.key ?? 'drob';
                setReceiptForm(f => ({ ...f, lines: [...f.lines, newReceiptLine(lastScope)] }));
              }}
              className="mt-2 w-full rounded-lg border-2 border-dashed border-gray-200 py-2 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
            >
              + Dodaj pozycję
            </button>
          </div>

          {/* Podsumowanie */}
          {(() => {
            const total = receiptForm.lines.reduce((s, l) => {
              const v = parseFloat(l.amountPln);
              return s + (isNaN(v) ? 0 : v);
            }, 0);
            return total > 0 ? (
              <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                <span className="text-sm text-gray-600">
                  Łącznie · {receiptForm.lines.filter(l => parseFloat(l.amountPln) > 0).length} poz.
                </span>
                <span className="text-lg font-bold text-red-600">−{formatPln(total)}</span>
              </div>
            ) : null;
          })()}

          {receiptError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠ {receiptError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button className="flex-1" loading={savingReceipt} onClick={onSaveReceipt}>
              Zapisz paragon
            </Button>
            <Button variant="outline" onClick={() => { setShowReceiptForm(false); setReceiptError(''); }}>
              Anuluj
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: zarządzanie kategoriami ───────────────────────────────── */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title="Kategorie transakcji" size="md" level={2}>
        <div className="space-y-4">
          {/* Formularz nowej kategorii */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">Dodaj nową kategorię</div>
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Nazwa kategorii"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              onKeyDown={e => e.key === 'Enter' && onAddCategory()}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Działalność (opcjonalne)</label>
                <select
                  value={newCatScope}
                  onChange={e => setNewCatScope(e.target.value as TxScope | '')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Wszystkie</option>
                  {businessActivities.map(a => (
                    <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rodzaj (opcjonalne)</label>
                <select
                  value={newCatType}
                  onChange={e => setNewCatType(e.target.value as TxType | '')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Wpływ i wydatek</option>
                  <option value="income">▲ Wpływ</option>
                  <option value="expense">▼ Wydatek</option>
                </select>
              </div>
            </div>
            <Button size="sm" loading={savingCat} onClick={onAddCategory} disabled={!newCatName.trim()}>
              + Dodaj kategorię
            </Button>
          </div>

          {/* Lista kategorii */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
            {categories.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">Brak kategorii</div>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">{cat.name}</span>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {cat.scope && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {scopeLabel[cat.scope] ?? cat.scope}
                        </span>
                      )}
                      {cat.type && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${cat.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {cat.type === 'income' ? '▲ Wpływ' : '▼ Wydatek'}
                        </span>
                      )}
                      {cat.isSystem && (
                        <span className="text-xs text-gray-300 italic">systemowa</span>
                      )}
                    </div>
                  </div>
                  {!cat.isSystem && (
                    <button
                      onClick={() => setDeleteCat(cat)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"
                      title="Usuń kategorię"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <Button variant="outline" className="w-full" onClick={() => setShowCatModal(false)}>Zamknij</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteCat != null}
        onClose={() => setDeleteCat(null)}
        onConfirm={onDeleteCat}
        title="Usuń kategorię"
        message={`Usunąć kategorię "${deleteCat?.name}"?`}
        confirmLabel="Usuń"
        danger
      />

      {/* ── Modal: nota wewnętrzna ────────────────────────────────────────── */}
      <Modal open={showTransferForm} onClose={() => setShowTransferForm(false)} title="↔ Nota wewnętrzna" size="sm">
        <div className="space-y-4">
          <div className="text-xs text-gray-500 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
            Nota przenosi koszt między działalnościami bez przepływu gotówki. Zwiększa przychód źródła i koszt celu.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Źródło (sprzedaje)</label>
              <select
                value={transferForm.fromScope}
                onChange={e => setTransferForm(f => ({ ...f, fromScope: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {businessActivities.map(a => (
                  <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cel (kupuje)</label>
              <select
                value={transferForm.toScope}
                onChange={e => setTransferForm(f => ({ ...f, toScope: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {businessActivities.map(a => (
                  <option key={a.key} value={a.key}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                value={transferForm.date}
                onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kwota (PLN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={transferForm.amountPln}
                onChange={e => setTransferForm(f => ({ ...f, amountPln: e.target.value }))}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
            <input
              type="text"
              value={transferForm.description}
              onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))}
              placeholder="np. Sery dostarczone na śniadania gości"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uwagi (opcjonalne)</label>
            <textarea
              value={transferForm.notes}
              onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {transferError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠ {transferError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              className="flex-1"
              loading={savingTransfer}
              disabled={!transferForm.description.trim() || !transferForm.amountPln || transferForm.fromScope === transferForm.toScope}
              onClick={onSaveTransfer}
            >
              Zapisz notę
            </Button>
            <Button variant="outline" onClick={() => setShowTransferForm(false)}>Anuluj</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal onboardingu (pierwsze wejście) ──────────────────────────── */}
      <Modal
        open={showOnboarding}
        onClose={() => { localStorage.setItem(ONBOARD_KEY, '1'); setShowOnboarding(false); }}
        title="👋 Witaj w Kasie i Banku"
        size="md"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Tu będziesz śledzić wszystkie przepływy pieniężne — wpływy ze sprzedaży,
            wydatki na paszę, leki, faktury. Zacznij od trzech kroków:
          </p>

          <div className="space-y-3">
            {[
              {
                n: '1', icon: '🏦', color: 'bg-blue-100 text-blue-700',
                label: 'Dodaj konto',
                desc: 'Konto bankowe z aktualnym saldem lub portfel z gotówką. Możesz mieć kilka kont dla różnych działalności.',
              },
              {
                n: '2', icon: '⬆️', color: 'bg-green-100 text-green-700',
                label: 'Wpisz wpływ',
                desc: 'Sprzedaż drobiu, serów, jaj — każdy przychód na odpowiednie konto z kategorią.',
              },
              {
                n: '3', icon: '⬇️', color: 'bg-red-100 text-red-600',
                label: 'Wpisz wydatek',
                desc: 'Pasza, leki, faktura — wydatki odejmują się automatycznie od salda konta.',
              },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className={`w-7 h-7 rounded-full ${s.color} flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}>
                  {s.n}
                </div>
                <span className="text-xl shrink-0">{s.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-xs text-brand-700">
            💡 <strong>Wskazówka:</strong> Sprzedaż zarejestrowana w module Sprzedaży trafia do kasy automatycznie — wybierz konto w formularzu sprzedaży.
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                localStorage.setItem(ONBOARD_KEY, '1');
                setShowOnboarding(false);
                setShowAccountForm(true);
              }}
            >
              🏦 Dodaj pierwsze konto →
            </Button>
            <Button
              variant="outline"
              onClick={() => { localStorage.setItem(ONBOARD_KEY, '1'); setShowOnboarding(false); }}
            >
              Może później
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal wykresu salda konta ─────────────────────────────────────── */}
      <Modal
        open={chartAccount != null}
        onClose={() => setChartAccount(null)}
        title={chartAccount ? `📊 ${chartAccount.name}` : ''}
        size="md"
      >
        {chartAccount && (() => {
          const { balanceHistory, monthlyBars } = accountChartData;
          const currentBal = calcBalance(chartAccount, allTxs);
          const hasHistory  = balanceHistory.length >= 2;
          const hasMonthly  = monthlyBars.some(m => m.income > 0 || m.cost > 0);
          return (
            <div className="space-y-5">
              {/* Aktualne saldo */}
              <div className={`rounded-xl px-4 py-3 text-center ${currentBal < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="text-xs text-gray-500 mb-1">Aktualne saldo</div>
                <div className={`text-3xl font-bold ${currentBal < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatPln(currentBal)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Saldo otwarcia: {formatPln(chartAccount.openingBalance)} · {chartAccount.type === 'bank' ? '🏦 Konto bankowe' : '💵 Kasa gotówkowa'}
                </div>
              </div>

              {/* Historia salda */}
              {hasHistory ? (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historia salda</div>
                  <SimpleArea
                    data={balanceHistory}
                    label="Saldo (PLN)"
                    color={currentBal >= 0 ? '#16a34a' : '#dc2626'}
                    height={150}
                    formatValue={v => `${(v / 1000).toFixed(1)}k`}
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-3">
                  Brak historii transakcji — dodaj transakcje aby zobaczyć wykres.
                </div>
              )}

              {/* Miesięczne wpływy vs wydatki */}
              {hasMonthly && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Wpływy vs Wydatki – ostatnie 6 miesięcy</div>
                  <MultiBar
                    data={monthlyBars}
                    xKey="month"
                    bars={[
                      { key: 'income', label: 'Wpływy',  color: '#16a34a' },
                      { key: 'cost',   label: 'Wydatki', color: '#dc2626' },
                    ]}
                    formatValue={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))}
                    height={140}
                  />
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => setChartAccount(null)}>Zamknij</Button>
            </div>
          );
        })()}
      </Modal>

      {/* ── Modal wykresu zbiorczego — wszystkie konta ───────────────────── */}
      <Modal
        open={showAllChart}
        onClose={() => setShowAllChart(false)}
        title="📊 Przepływ pieniędzy — wszystkie konta"
        size="lg"
      >
        {showAllChart && allChartData && (() => {
          const { balanceHistory, monthlyBars, activityBars, activitySeries, currentTotal } = allChartData;
          const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
          const hasBal = balanceHistory.length >= 2;
          const hasMonthly = monthlyBars.some(m => m.income > 0 || m.cost > 0);
          const hasActivity = activitySeries.length > 0;

          const thisM = new Date();
          const thisKey = `${thisM.getFullYear()}-${String(thisM.getMonth() + 1).padStart(2, '0')}`;
          const thisMBar = monthlyBars[monthlyBars.length - 1];
          const thisIncome  = thisMBar?.income  ?? 0;
          const thisExpense = thisMBar?.cost ?? 0;
          const netThisMonth = thisIncome - thisExpense;

          return (
            <div className="space-y-6">

              {/* KPI – trzy karty */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl px-3 py-3 text-center ${currentTotal < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-xs text-gray-500 mb-1">Łączne saldo</div>
                  <div className={`text-2xl font-bold ${currentTotal < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatPln(currentTotal)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{accounts.length} kont</div>
                </div>
                <div className="rounded-xl px-3 py-3 text-center bg-blue-50">
                  <div className="text-xs text-gray-500 mb-1">Wpływy (bm)</div>
                  <div className="text-2xl font-bold text-blue-700">{formatPln(thisIncome)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{thisM.toLocaleDateString('pl-PL', { month: 'long' })}</div>
                </div>
                <div className={`rounded-xl px-3 py-3 text-center ${netThisMonth < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-xs text-gray-500 mb-1">Wynik (bm)</div>
                  <div className={`text-2xl font-bold ${netThisMonth < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {netThisMonth >= 0 ? '+' : ''}{formatPln(netThisMonth)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">po {formatPln(thisExpense)} wydatków</div>
                </div>
              </div>

              {/* Historia salda */}
              {hasBal ? (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Historia łącznego salda
                  </div>
                  <SimpleArea
                    data={balanceHistory}
                    label="Saldo łączne (PLN)"
                    color={currentTotal >= 0 ? '#16a34a' : '#dc2626'}
                    height={160}
                    formatValue={fmt}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Za mało transakcji — historia salda pojawi się po dodaniu wpisów.
                </p>
              )}

              {/* Wpływy vs Wydatki — 12 miesięcy */}
              {hasMonthly && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Wpływy vs Wydatki — ostatnie 12 miesięcy
                  </div>
                  <MultiBar
                    data={monthlyBars}
                    xKey="month"
                    bars={[
                      { key: 'income', label: 'Wpływy',  color: '#22c55e' },
                      { key: 'cost',   label: 'Wydatki', color: '#f87171' },
                    ]}
                    formatValue={fmt}
                    height={160}
                  />
                </div>
              )}

              {/* Przychody per działalność */}
              {hasActivity && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Przychody per działalność — ostatnie 6 miesięcy
                  </div>
                  <MultiBar
                    data={activityBars}
                    xKey="month"
                    bars={activitySeries}
                    formatValue={fmt}
                    height={160}
                  />
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => setShowAllChart(false)}>
                Zamknij
              </Button>
            </div>
          );
        })()}
      </Modal>

      {/* ── Potwierdzenie usunięcia noty ─────────────────────────────────── */}
      <ConfirmDialog
        open={deleteTransfer != null}
        onClose={() => setDeleteTransfer(null)}
        onConfirm={async () => {
          if (deleteTransfer?.id != null) {
            await internalTransferService.delete(deleteTransfer.id);
          }
          setDeleteTransfer(null);
        }}
        title="Usuń notę wewnętrzną"
        message={`Usunąć notę "${deleteTransfer?.description}" (${deleteTransfer ? formatPln(deleteTransfer.amountPln) : ''})?`}
        confirmLabel="Usuń"
        danger
      />
    </div>
  );
}
