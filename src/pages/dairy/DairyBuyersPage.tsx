import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { DairyBuyer } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

function BuyerForm({
  initial, onSave, onCancel,
}: {
  initial?: DairyBuyer;
  onSave: (data: Omit<DairyBuyer, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,        setName]        = useState(initial?.name ?? '');
  const [isAnonymous, setIsAnonymous] = useState(initial?.isAnonymous ?? false);
  const [address,     setAddress]     = useState(initial?.address ?? '');
  const [phone,       setPhone]       = useState(initial?.phone ?? '');
  const [nip,         setNip]         = useState(initial?.nip ?? '');
  const [notes,       setNotes]       = useState(initial?.notes ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Podaj nazwę nabywcy.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        name: name.trim(),
        isAnonymous,
        address:  address.trim()  || undefined,
        phone:    phone.trim()    || undefined,
        nip:      nip.trim()      || undefined,
        notes:    notes.trim()    || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Typ nabywcy */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsAnonymous(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
            !isAnonymous
              ? 'bg-brand-50 border-brand-300 text-brand-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          👤 Osoba / Firma
        </button>
        <button
          onClick={() => setIsAnonymous(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
            isAnonymous
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          🏪 Targ / Wystawa
        </button>
      </div>

      <Input
        label={isAnonymous ? 'Nazwa miejsca / wydarzenia *' : 'Imię i nazwisko / Firma *'}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={isAnonymous ? 'np. Targ środowy, Festiwal Smaku' : 'np. Jan Kowalski'}
      />

      {!isAnonymous && (
        <>
          <Input
            label="Adres"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Ulica, miejscowość"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefon"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="500 123 456"
            />
            <Input
              label="NIP / PESEL"
              value={nip}
              onChange={e => setNip(e.target.value)}
            />
          </div>
        </>
      )}

      {isAnonymous && (
        <Input
          label="Adres / Lokalizacja"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="np. Rynek Główny, Kraków"
        />
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Opcjonalne uwagi…"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {error}</p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" loading={saving} onClick={handleSubmit}>
          {initial ? 'Zapisz zmiany' : 'Dodaj nabywcę'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

export function DairyBuyersPage() {
  const [buyers,   setBuyers]   = useState<DairyBuyer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [expandId, setExpandId] = useState<number | null>(null);

  const load = () =>
    dairyService.getBuyers().then(b => { setBuyers(b); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: Omit<DairyBuyer, 'id' | 'createdAt'>) => {
    await dairyService.saveBuyer(data);
    setShowAdd(false);
    load();
  };

  const handleEdit = async (id: number, data: Omit<DairyBuyer, 'id' | 'createdAt'>) => {
    await dairyService.updateBuyer(id, data);
    setEditId(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Usunąć tego nabywcę?')) return;
    await dairyService.deleteBuyer(id);
    load();
  };

  const persons   = buyers.filter(b => !b.isAnonymous);
  const anonymous = buyers.filter(b => b.isAnonymous);

  const BuyerCard = ({ b }: { b: DairyBuyer }) => (
    <div key={b.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpandId(expandId === b.id ? null : b.id ?? null)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
          b.isAnonymous ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700 font-bold'
        }`}>
          {b.isAnonymous ? '🏪' : b.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800">{b.name}</div>
          <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
            {b.phone && <span>📞 {b.phone}</span>}
            {b.address && <span className="truncate">📍 {b.address}</span>}
            {b.isAnonymous && !b.phone && !b.address && <span>Sprzedaż anonimowa</span>}
          </div>
        </div>
        <span className="text-gray-300 text-sm">{expandId === b.id ? '▲' : '▼'}</span>
      </button>

      {expandId === b.id && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          {editId === b.id ? (
            <BuyerForm
              initial={b}
              onSave={data => handleEdit(b.id!, data)}
              onCancel={() => setEditId(null)}
            />
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-gray-400 text-xs">Typ</span>
                <span className="text-gray-700">{b.isAnonymous ? '🏪 Targ / Wystawa' : '👤 Osoba / Firma'}</span>
                {b.phone && (
                  <>
                    <span className="text-gray-400 text-xs">Telefon</span>
                    <a href={`tel:${b.phone}`} className="text-brand-600 font-medium hover:underline">{b.phone}</a>
                  </>
                )}
                {b.address && (
                  <>
                    <span className="text-gray-400 text-xs">Adres</span>
                    <span className="text-gray-700">{b.address}</span>
                  </>
                )}
                {b.nip && (
                  <>
                    <span className="text-gray-400 text-xs">NIP / PESEL</span>
                    <span className="text-gray-700 font-mono">{b.nip}</span>
                  </>
                )}
                {b.notes && (
                  <>
                    <span className="text-gray-400 text-xs">Uwagi</span>
                    <span className="text-gray-700">{b.notes}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditId(b.id!)}>✎ Edytuj</Button>
                {b.phone && (
                  <a href={`tel:${b.phone}`}>
                    <Button size="sm" variant="outline">📞 Zadzwoń</Button>
                  </a>
                )}
                <button
                  onClick={() => b.id != null && handleDelete(b.id)}
                  className="ml-auto text-xs text-gray-300 hover:text-red-400 px-2"
                >
                  🗑 Usuń
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
          <h1 className="text-xl font-bold text-gray-900">Nabywcy</h1>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Dodaj</Button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Zapisuj nabywców aby szybko wybierać przy sprzedaży. Osoby i firmy wymagają danych do ewidencji RHD.
        Targi i wystawy to sprzedaż anonimowa — wystarczy nazwa miejsca.
      </p>

      {showAdd && (
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-2">Nowy nabywca</p>
          <BuyerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Card>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && buyers.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-gray-500 text-sm">Brak nabywców.<br />Dodaj pierwszego nabywcę.</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>+ Dodaj nabywcę</Button>
        </div>
      )}

      {persons.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
            👤 Osoby i firmy ({persons.length})
          </p>
          {persons.map(b => <BuyerCard key={b.id} b={b} />)}
        </div>
      )}

      {anonymous.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
            🏪 Targi i wystawy ({anonymous.length})
          </p>
          {anonymous.map(b => <BuyerCard key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}
