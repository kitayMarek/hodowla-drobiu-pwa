import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { cashFlowService } from '@/services/cashFlow.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, todayISO } from '@/utils/date';
import { formatPln } from '@/utils/format';
import type { CashAccount, CashTransaction, TxType, TxScope, AccountType, AccountScope } from '@/models/cashFlow.model';

// ─── Stałe ────────────────────────────────────────────────────────────────────

const TX_TYPE_LABELS: Record<TxType, string> = {
  income:   'Wpływ',
  expense:  'Wydatek',
  transfer: 'Przelew',
};

const TX_SCOPE_LABELS: Record<TxScope, string> = {
  business: 'Firmowe',
  personal: 'Osobiste',
};

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Konto bankowe',
  cash: 'Kasa gotówkowa',
};

const BUSINESS_CATEGORIES = [
  'Sprzedaż', 'Pasza', 'Pisklęta / jaja wylęgowe', 'Pracownicy', 'Paliwo',
  'Weterynarz', 'Leki i szczepienia', 'Naprawa i konserwacja', 'Czynsz / dzierżawa',
  'Energie i media', 'Ubezpieczenie', 'Podatki i składki', 'Inne firmowe',
];

const PERSONAL_CATEGORIES = [
  'Wynagrodzenie właściciela', 'Zakupy osobiste', 'Dom i mieszkanie',
  'Transport prywatny', 'Inne osobiste',
];

// ─── Pomocnicze ───────────────────────────────────────────────────────────────

function calcBalance(account: CashAccount, txs: CashTransaction[]): number {
  return txs
    .filter(t => t.accountId === account.id)
    .reduce((sum, t) => {
      if (t.type === 'income')  return sum + t.amountPln;
      if (t.type === 'expense') return sum - t.amountPln;
      // transfer: sprawdź czy konto jest źródłem czy celem
      if (t.type === 'transfer') {
        return t.toAccountId === account.id ? sum + t.amountPln : sum - t.amountPln;
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
  name: '', type: 'bank', scope: 'business', openingBalance: '0',
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
  scope:       'business',
  category:    '',
  description: '',
  amountPln:   '',
  toAccountId: '',
  notes:       '',
});

// ─── Komponent ────────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [allTxs,   setAllTxs]   = useState<CashTransaction[]>([]);
  const [rev, setRev] = useState(0);
  const reload = useCallback(() => setRev(r => r + 1), []);

  useEffect(() => {
    db.cashAccounts.toArray().then(r => setAccounts(r.sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
    db.cashTransactions.toArray().then(r => setAllTxs(r.sort((a, b) => b.date.localeCompare(a.date)))).catch(() => {});
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
      if (filterAccount && String(t.accountId) !== filterAccount) return false;
      if (filterScope   && t.scope !== filterScope)   return false;
      if (filterType    && t.type  !== filterType)    return false;
      if (filterMonth   && !t.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [allTxs, filterAccount, filterScope, filterType, filterMonth]);

  // ── Sumy ─────────────────────────────────────────────────────────────────
  const totalBalance = accounts.reduce((s, a) => s + calcBalance(a, allTxs), 0);
  const businessBalance = accounts
    .filter(a => a.scope === 'business' || a.scope === 'shared')
    .reduce((s, a) => s + calcBalance(a, allTxs), 0);

  const filteredIncome  = filteredTxs.filter(t => t.type === 'income') .reduce((s, t) => s + t.amountPln, 0);
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

  const txCategories = txForm.scope === 'personal' ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Dziennik Kasowy</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAccountForm(emptyAccountForm()); setShowAccountForm(true); }}>
            + Konto
          </Button>
          <Button size="sm" onClick={() => { setTxForm(emptyTxForm()); setShowTxForm(true); }}
            disabled={accounts.length === 0}>
            + Transakcja
          </Button>
        </div>
      </div>

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
                  <Badge color={acc.scope === 'business' ? 'blue' : acc.scope === 'personal' ? 'gray' : 'yellow'}>
                    {acc.scope === 'business' ? 'Firmowe' : acc.scope === 'personal' ? 'Osobiste' : 'Wspólne'}
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
              <span className="text-xs text-brand-500">Firmowe: {formatPln(businessBalance)}</span>
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
              <option value="">Firmowe + osobiste</option>
              <option value="business">Tylko firmowe</option>
              <option value="personal">Tylko osobiste</option>
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
                const isTransferOut = tx.type === 'transfer' && tx.toAccountId != null;
                return (
                  <div key={tx.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Ikona */}
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      tx.type === 'income'   ? 'bg-green-100'  :
                      tx.type === 'expense'  ? 'bg-red-100'    : 'bg-blue-100'
                    }`}>
                      {tx.type === 'income' ? '▲' : tx.type === 'expense' ? '▼' : '⇄'}
                    </div>

                    {/* Opis */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{tx.description}</span>
                        {tx.category && (
                          <span className="text-xs text-gray-400">{tx.category}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>{formatDate(tx.date)}</span>
                        {acc && <span>{acc.name}</span>}
                        {tx.type === 'transfer' && tx.toAccountId != null && (
                          <span>→ {accountMap.get(tx.toAccountId)?.name ?? '?'}</span>
                        )}
                        <Badge color={tx.scope === 'business' ? 'blue' : 'gray'} className="text-xs">
                          {TX_SCOPE_LABELS[tx.scope]}
                        </Badge>
                      </div>
                      {tx.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{tx.notes}</div>}
                    </div>

                    {/* Kwota + usuń */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${
                        tx.type === 'income'  ? 'text-green-700' :
                        tx.type === 'expense' ? 'text-red-600'   : 'text-blue-700'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : isTransferOut ? '−' : '+'}
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
                <option value="business">Firmowe</option>
                <option value="personal">Osobiste</option>
                <option value="shared">Wspólne</option>
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
                  <option value="business">Firmowe</option>
                  <option value="personal">Osobiste</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategoria</label>
              <select
                value={txForm.category}
                onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Wybierz kategorię —</option>
                {txCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
    </div>
  );
}
