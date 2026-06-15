import React, { useEffect, useState } from 'react';
import { AskLLM } from '@/components/AskLLM';
import { Link } from 'react-router-dom';
import { dairyService } from '@/services/dairy.service';
import type { MilkSupplier } from '@/models/dairy.model';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

function SupplierForm({
  initial, onSave, onCancel,
}: {
  initial?: MilkSupplier;
  onSave: (data: Omit<MilkSupplier, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,    setName]    = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [pesel,   setPesel]   = useState(initial?.peselOrNip ?? '');
  const [phone,   setPhone]   = useState(initial?.phone ?? '');
  const [notes,   setNotes]   = useState(initial?.notes ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Podaj imię i nazwisko lub nazwę.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({
        name: name.trim(),
        address:    address.trim()  || undefined,
        peselOrNip: pesel.trim()    || undefined,
        phone:      phone.trim()    || undefined,
        notes:      notes.trim()    || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <Input label="Imię i nazwisko / Nazwa *" value={name} onChange={e => setName(e.target.value)} />
      <Input label="Adres" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ulica, miejscowość" />
      <Input label="PESEL / KRUS / NIP" value={pesel} onChange={e => setPesel(e.target.value)} />
      <Input label="Telefon" value={phone} onChange={e => setPhone(e.target.value)} placeholder="np. 500 123 456" />
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder="Opcjonalne uwagi…"
        />
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {error}</p>}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" loading={saving} onClick={handleSubmit}>
          {initial ? 'Zapisz zmiany' : 'Dodaj dostawcę'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Anuluj</Button>
      </div>
    </div>
  );
}

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<MilkSupplier[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [expandId,  setExpandId]  = useState<number | null>(null);

  const load = () =>
    dairyService.getSuppliers().then(s => { setSuppliers(s); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: Omit<MilkSupplier, 'id' | 'createdAt'>) => {
    await dairyService.saveSupplier(data);
    setShowAdd(false);
    load();
  };

  const handleEdit = async (id: number, data: Omit<MilkSupplier, 'id' | 'createdAt'>) => {
    await dairyService.updateSupplier(id, data);
    setEditId(null);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Usunąć tego dostawcę?')) return;
    await dairyService.deleteSupplier(id);
    load();
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/mleko" className="text-gray-400 hover:text-gray-600 text-sm">← Mleko</Link>
          <h1 className="text-xl font-bold text-gray-900">Dostawcy mleka</h1>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Dodaj</Button>
        )}
      </div>

      <div><AskLLM defaultQuery="skup mleka od dostawców rolniczy handel detaliczny przepisy" contextUrl="https://fermly.pl/przewodnik-sery.html" summaryUrl="/przewodnik-sery.summary.txt" /></div>

      {/* Formularz nowego */}
      {showAdd && (
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-1">Nowy dostawca</p>
          <SupplierForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Card>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-8">Ładowanie…</p>}

      {!loading && suppliers.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🚛</div>
          <p className="text-gray-500 text-sm">Brak dostawców.<br />Dodaj pierwszego dostawcę mleka.</p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>+ Dodaj dostawcę</Button>
        </div>
      )}

      <div className="space-y-2">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Nagłówek wiersza */}
            <button
              onClick={() => setExpandId(expandId === s.id ? null : s.id ?? null)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                <div className="text-xs text-gray-400 flex gap-3 mt-0.5">
                  {s.phone && <span>📞 {s.phone}</span>}
                  {s.address && <span className="truncate">📍 {s.address}</span>}
                </div>
              </div>
              <span className="text-gray-300 text-sm">{expandId === s.id ? '▲' : '▼'}</span>
            </button>

            {/* Rozwinięte szczegóły */}
            {expandId === s.id && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                {editId === s.id ? (
                  <SupplierForm
                    initial={s}
                    onSave={data => handleEdit(s.id!, data)}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Dane kontaktowe */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      {s.phone && (
                        <>
                          <span className="text-gray-400 text-xs">Telefon</span>
                          <a href={`tel:${s.phone}`} className="text-brand-600 font-medium hover:underline">{s.phone}</a>
                        </>
                      )}
                      {s.address && (
                        <>
                          <span className="text-gray-400 text-xs">Adres</span>
                          <span className="text-gray-700">{s.address}</span>
                        </>
                      )}
                      {s.peselOrNip && (
                        <>
                          <span className="text-gray-400 text-xs">PESEL / NIP</span>
                          <span className="text-gray-700 font-mono">{s.peselOrNip}</span>
                        </>
                      )}
                      {s.notes && (
                        <>
                          <span className="text-gray-400 text-xs">Uwagi</span>
                          <span className="text-gray-700">{s.notes}</span>
                        </>
                      )}
                    </div>

                    {/* Akcje */}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setEditId(s.id!)}>
                        ✎ Edytuj
                      </Button>
                      {s.phone && (
                        <a href={`tel:${s.phone}`}>
                          <Button size="sm" variant="outline">📞 Zadzwoń</Button>
                        </a>
                      )}
                      <button
                        onClick={() => s.id != null && handleDelete(s.id)}
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
        ))}
      </div>
    </div>
  );
}
