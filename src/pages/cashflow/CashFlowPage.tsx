import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { cashFlowService } from '@/services/cashFlow.service';
import { financialEventService } from '@/services/financialEvent.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';
import type { CashAccount, CashTransaction, CashCategory, TxType, TxScope, AccountType, AccountScope } from '@/models/cashFlow.model';
import type { FinancialEvent } from '@/models/financialEvent.model';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const TX_TYPE_LABELS: Record<TxType, string> = {
  income:   'Wpływ',
  expense:  'Wydatek',
  transfer: 'Przelew',
};

const TX_SCOPE_LABELS: Record<TxScope, string> = {
  drob:          'Drób',
  sery:          'Sery',
  agroturystyka: 'Agroturystyka',
  osobiste:      'Osobiste',
};

const ACCOUNT_SCOPE_LABELS: Record<AccountScope, string> = {
  drob:          'Drób',
  sery:          'Sery',
  agroturystyka: 'Agroturystyka',
  osobiste:      'Osobiste',
  shared:        'Wspólne',
};

const SCOPE_BADGE: Record<AccountScope, 'blue' | 'yellow' | 'green' | 'gray' | 'orange'> = {
  drob:          'blue',
  sery:          'yellow',
  agroturystyka: 'green',
  osobiste:      'gray',
  shared:        'orange',
};

// ─── Pomocnicze ───────────────────────────────────────────────────────────────

function calcBalance(account: CashAccount, txs: CashTransaction[]): number {
  // Przelew to JEDEN rekord: accountId=źródło, toAccountId=cel.
  // Wypływ: t.accountId === account.id AND type=transfer → minus
  // Wpływ:  t.toAccountId === account.id AND type=transfer → plus
  return txs.reduce((sum, t) => {
    if (t.accountId === account.id) {
      if (t.type === 'income')   return sum + t.amountPln;
      if (t.type === 'expense')  return sum - t.amountPln;
      if (t.type === 'transfer') return sum - t.amountPln; // wypływ
    } else if (t.type === 'transfer' && t.toAccountId === account.id) {
      return sum + t.amountPln; // wpływ
    }
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

const emptyAccountForm = (): AccountFormState => ({
  name: '', type: 'bank', scope: 'drob', openingBalance: '0',
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

const emptyTxForm = (defaultAccountId?: number): TxFormState => ({
  accountId:   defaultAccountId != null ? String(defaultAccountId) : '',
  date:        todayISO(),
  type:        'expense',
  scope:       'drob',
  category:    '',
  description: '',
  amountPln:   '',
  toAccountId: '',
  notes:       '',
});

// ─── Komponent ────────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const [activeTab, setActiveTab] = useState<'dziennik' | 'rozliczenia'>('dziennik');
  const [accounts,   setAccounts]   = useState<CashAccount[]>([]);
  const [allTxs,     setAllTxs]     = useState<CashTransaction[]>([]);
  const [pending,    setPending]    = useState<FinancialEvent[]>([]);
  const [categories, setCategories] = useState<CashCategory[]>([]);
  const [rev, setRev] = useState(0);
  const reload = useCallback(() => setRev(r => r + 1), []);

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
    db.cashAccounts.toArray().then(r => setAccounts(r.sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
    db.cashTransactions.toArray().then(r => setAllTxs(r.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => {});
    db.financialEvents.where('status').equals('pending').toArray()
      .then(r => setPending(r.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => {});
    db.cashCategories.toArray().then(r => setCategories(r.sort((a, b) => a.name.localeCompare(b.name, 'pl')))).catch(() => {});
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

  // ── Sumy ─────────────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + calcBalance(a, allTxs), 0);
  const drobBalance = accounts
    .filter(a => a.scope === 'drob' || a.scope === 'shared')
    .reduce((s, a) => s + calcBalance(a, allTxs), 0);

  const filteredIncome  = filteredTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amountPln, 0);
  const filteredExpense = filteredTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountPln, 0);

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
    setAccountForm(emptyAccountForm());
    reload();
  };

  // ── Zapis transakcji ───────────────────────────────────────────────────────
  const onSaveTx = async () => {
    if (!txForm.accountId || !txForm.description.trim() || !txForm.amountPln) return;
    setSaving(true);
    const amount = parseFloat(txForm.amountPln);
    if (isNaN(amount) || amount <= 0) { setSaving(false); return; }

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
    setTxForm(emptyTxForm());
    reload();
  };

  const accountMap = new Map(accounts.map(a => [a.id!, a]));

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
          <Button variant="outline" size="sm" onClick={() => { setAccountForm(emptyAccountForm()); setShowAccountForm(true); }}>
            + Konto
          </Button>
          <Button size="sm" onClick={() => { setTxForm(emptyTxForm()); setShowTxForm(true); }}
            disabled={accounts.length === 0}>
            + Transakcja
          </Button>
        </div>
      </div>

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

      {/* Karty kont */}
      {accounts.length === 0 ? (
        <EmptyState
          icon="💳"
          title="Brak kont"
          description='Dodaj pierwsze konto bankowe lub kasę, klikając "+ Konto"'
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {accounts.map(acc => {
            const bal = calcBalance(acc, allTxs);
            return (
              <div key={acc.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">{acc.name}</span>
                  <span className="text-xs">{acc.type === 'bank' ? '🏦' : '💵'}</span>
                </div>
                <div className={`text-lg font-bold ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatPln(bal)}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge color={SCOPE_BADGE[acc.scope] ?? 'gray'}>
                    {ACCOUNT_SCOPE_LABELS[acc.scope] ?? acc.scope}
                  </Badge>
                </div>
              </div>
            );
          })}

          {/* Podsumowanie */}
          {accounts.length > 1 && (
            <div className="bg-brand-50 rounded-xl border border-brand-200 p-4 flex flex-col gap-1 shadow-sm">
              <span className="text-xs text-brand-600 font-medium">Razem wszystkie</span>
              <div className={`text-lg font-bold ${totalBalance < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                {formatPln(totalBalance)}
              </div>
              <span className="text-xs text-brand-500">Drób: {formatPln(drobBalance)}</span>
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
              <option value="drob">Drób</option>
              <option value="sery">Sery</option>
              <option value="agroturystyka">Agroturystyka</option>
              <option value="osobiste">Osobiste</option>
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
          {(filteredIncome > 0 || filteredExpense > 0) && (
            <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
              {filteredIncome > 0  && <span className="text-green-700">▲ Wpływy: <strong>{formatPln(filteredIncome)}</strong></span>}
              {filteredExpense > 0 && <span className="text-red-600">▼ Wydatki: <strong>{formatPln(filteredExpense)}</strong></span>}
              {filteredIncome > 0 && filteredExpense > 0 && (
                <span className={`font-semibold ${filteredIncome - filteredExpense >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  = {formatPln(filteredIncome - filteredExpense)}
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Lista transakcji */}
      {accounts.length > 0 && (
        filteredTxs.length === 0 ? (
          <EmptyState icon="📋" title="Brak transakcji" description="Dodaj pierwszą transakcję klikając &quot;+ Transakcja&quot;" />
        ) : (
          <Card>
            <div className="divide-y divide-gray-100">
              {filteredTxs.map(tx => {
                const acc = accountMap.get(tx.accountId);
                // Czy w kontekście filtra to jest wpływ na konto?
                const isIncomingTransfer = tx.type === 'transfer' && filterAccount
                  ? String(tx.toAccountId) === filterAccount
                  : false;
                return (
                  <div key={tx.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Ikona */}
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      tx.type === 'income'                      ? 'bg-green-100' :
                      tx.type === 'expense'                     ? 'bg-red-100'   :
                      isIncomingTransfer                        ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {tx.type === 'income'   ? '▲' :
                       tx.type === 'expense'  ? '▼' :
                       isIncomingTransfer     ? '▲' : '▼'}
                    </div>

                    {/* Opis */}
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
                          <span>
                            {accountMap.get(tx.accountId)?.name ?? '?'} → {accountMap.get(tx.toAccountId!)?.name ?? '?'}
                          </span>
                        ) : (
                          acc && <span>{acc.name}</span>
                        )}
                        {tx.type !== 'transfer' && (
                          <Badge color={SCOPE_BADGE[tx.scope] ?? 'gray'} className="text-xs">
                            {TX_SCOPE_LABELS[tx.scope] ?? tx.scope}
                          </Badge>
                        )}
                      </div>
                      {tx.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{tx.notes}</div>}
                    </div>

                    {/* Kwota + usuń */}
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
                <option value="drob">🐔 Drób</option>
                <option value="sery">🧀 Sery</option>
                <option value="agroturystyka">🏡 Agroturystyka</option>
                <option value="osobiste">👤 Osobiste</option>
                <option value="shared">🔗 Wspólne</option>
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
      <Modal open={showTxForm} onClose={() => setShowTxForm(false)} title="Nowa transakcja" size="md">
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
                  <option value="drob">🐔 Drób</option>
                  <option value="sery">🧀 Sery</option>
                  <option value="agroturystyka">🏡 Agroturystyka</option>
                  <option value="osobiste">👤 Osobiste</option>
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
                  onClick={() => { setShowTxForm(false); setShowCatModal(true); }}
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

          <div className="flex gap-3 pt-1">
            <Button className="flex-1" loading={saving} onClick={onSaveTx}>Dodaj transakcję</Button>
            <Button variant="outline" onClick={() => setShowTxForm(false)}>Anuluj</Button>
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

      {/* ── Modal: zarządzanie kategoriami ───────────────────────────────── */}
      <Modal open={showCatModal} onClose={() => setShowCatModal(false)} title="Kategorie transakcji" size="md">
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
                  <option value="drob">🐔 Drób</option>
                  <option value="sery">🧀 Sery</option>
                  <option value="agroturystyka">🏡 Agroturystyka</option>
                  <option value="osobiste">👤 Osobiste</option>
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
                          {TX_SCOPE_LABELS[cat.scope]}
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
    </div>
  );
}
