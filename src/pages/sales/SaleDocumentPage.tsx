import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { saleDocumentService } from '@/services/saleDocument.service';
import { dairyService } from '@/services/dairy.service';
import type { SaleDocumentWithLines } from '@/models/saleDocument.model';
import type { DairyBuyer } from '@/models/dairy.model';
import { PRODUCT_ICONS, UNIT_LABELS } from '@/models/dairy.model';
import { SALE_TYPE_LABELS } from '@/constants/phases';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const fmt  = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

const DROB_ICONS: Record<string, string> = {
  jaja: '🥚', tuszki: '🍗', ptaki_zywe: '🐔', elementy: '🦵',
};

export function SaleDocumentPage() {
  const { id }  = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc,     setDoc]     = useState<SaleDocumentWithLines | null>(null);
  const [buyers,  setBuyers]  = useState<DairyBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Pola edycji nagłówka
  const [editDate,   setEditDate]   = useState('');
  const [editBuyer,  setEditBuyer]  = useState('');
  const [editNotes,  setEditNotes]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const load = async () => {
    if (!id) return;
    const [d, b] = await Promise.all([
      saleDocumentService.getDocumentById(Number(id)),
      dairyService.getBuyers(),
    ]);
    setDoc(d);
    setBuyers(b);
    if (d) { setEditDate(d.docDate); setEditBuyer(d.buyerName ?? ''); setEditNotes(d.notes ?? ''); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveHeader = async () => {
    if (!doc?.id) return;
    setSaving(true);
    try {
      const buyer = buyers.find(b => b.name === editBuyer.trim());
      await saleDocumentService.updateHeader(doc.id, {
        docDate:      editDate,
        buyerName:    editBuyer.trim() || undefined,
        buyerId:      buyer?.id,
        buyerAddress: buyer?.address,
        buyerPhone:   buyer?.phone,
        notes:        editNotes.trim() || undefined,
      });
      setEditing(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDairyLine = async (lineId: number) => {
    if (!doc?.id || !window.confirm('Usunąć tę pozycję?')) return;
    await saleDocumentService.deleteDairyLine(lineId, doc.id);
    await load();
  };

  const handleDeleteDrobLine = async (lineId: number) => {
    if (!doc?.id || !window.confirm('Usunąć tę pozycję?')) return;
    await saleDocumentService.deleteDrobLine(lineId, doc.id);
    await load();
  };

  const handleDeleteDocument = async () => {
    if (!doc?.id || !window.confirm('Usunąć cały dokument sprzedaży wraz ze wszystkimi pozycjami?')) return;
    await saleDocumentService.deleteDocument(doc.id);
    navigate('/sprzedaz');
  };

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">Ładowanie…</p>;
  if (!doc)    return <p className="text-sm text-red-500 text-center py-12">Nie znaleziono dokumentu.</p>;

  const totalLines = doc.dairyLines.length + doc.drobLines.length;

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/sprzedaz" className="text-gray-400 hover:text-gray-600 text-sm">← Sprzedaż</Link>
          <h1 className="text-xl font-bold text-gray-900">Dokument sprzedaży</h1>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>✎ Edytuj</Button>
          )}
          <button onClick={handleDeleteDocument}
            className="text-xs text-gray-300 hover:text-red-400 px-2 py-1">
            🗑 Usuń
          </button>
        </div>
      </div>

      {/* Nagłówek dokumentu */}
      <Card padding="md">
        {editing ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-600 mb-2">Edytuj nagłówek</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nabywca</label>
                <select value={editBuyer} onChange={e => setEditBuyer(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">— bez nabywcy —</option>
                  {buyers.map(b => (
                    <option key={b.id} value={b.name}>{b.isAnonymous ? '🏪' : '👤'} {b.name}</option>
                  ))}
                </select>
                <input type="text" value={editBuyer} onChange={e => setEditBuyer(e.target.value)}
                  placeholder="lub wpisz ręcznie…"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Uwagi</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            </div>
            {error && <p className="text-xs text-red-600">⚠ {error}</p>}
            <div className="flex gap-2">
              <Button size="sm" loading={saving} onClick={handleSaveHeader}>Zapisz zmiany</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setError(''); }}>Anuluj</Button>
            </div>
            <p className="text-xs text-gray-400">
              ℹ Zmiana nabywcy aktualizuje go we wszystkich pozycjach tego dokumentu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-xs text-gray-400 block">Data</span>
              <span className="font-medium text-gray-800">{fmtD(doc.docDate)}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Nabywca</span>
              <span className="font-medium text-gray-800">{doc.buyerName ?? '—'}</span>
              {doc.buyerPhone && (
                <a href={`tel:${doc.buyerPhone}`} className="block text-xs text-brand-600 hover:underline mt-0.5">
                  📞 {doc.buyerPhone}
                </a>
              )}
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Ewidencja</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                doc.inRhd ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {doc.inRhd ? `📋 RHD #${doc.rhdNumber}/${doc.rhdYear}` : '📦 Wewnętrzna'}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Łączna wartość</span>
              <span className="font-bold text-gray-900 text-lg">{fmt(doc.totalValuePln)} zł</span>
            </div>
            {doc.notes && (
              <div className="col-span-2">
                <span className="text-xs text-gray-400 block">Uwagi</span>
                <span className="text-gray-700">{doc.notes}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Pozycje dokumentu */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Pozycje ({totalLines})
          </p>
          <Link to={`/sprzedaz/${doc.id}/dodaj`} className="text-xs text-brand-600 hover:underline">
            + Dodaj pozycję
          </Link>
        </div>

        {/* Linie mleczarskie */}
        {doc.dairyLines.map(line => (
          <div key={`d-${line.id}`}
            className="bg-white rounded-xl border border-brand-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{PRODUCT_ICONS[line.productCategory] ?? '🧀'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">{line.productName}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {line.quantity} {UNIT_LABELS[line.unit as keyof typeof UNIT_LABELS] ?? line.unit}
                {' × '}{fmt(line.unitPricePln)} zł
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-gray-900">{fmt(line.totalValuePln)} zł</div>
              <button onClick={() => line.id && handleDeleteDairyLine(line.id)}
                className="text-xs text-gray-200 hover:text-red-400 mt-0.5">🗑</button>
            </div>
          </div>
        ))}

        {/* Linie drobiowe */}
        {doc.drobLines.map(line => {
          const detail = line.saleType === 'jaja'
            ? `${line.eggsCount?.toLocaleString('pl-PL') ?? 0} szt.`
            : line.weightKg != null
              ? `${line.birdCount ?? '?'} szt. · ${line.weightKg} kg`
              : `${line.birdCount ?? '?'} szt.`;
          return (
            <div key={`s-${line.id}`}
              className="bg-white rounded-xl border border-orange-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{DROB_ICONS[line.saleType] ?? '🐔'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{SALE_TYPE_LABELS[line.saleType]}</div>
                <div className="text-xs text-gray-400 mt-0.5">{detail}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-gray-900">{fmt(line.totalRevenuePln)} zł</div>
                <button onClick={() => line.id && handleDeleteDrobLine(line.id)}
                  className="text-xs text-gray-200 hover:text-red-400 mt-0.5">🗑</button>
              </div>
            </div>
          );
        })}

        {totalLines === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Brak pozycji. Dokument jest pusty.</p>
        )}
      </div>

      {/* Podsumowanie */}
      {totalLines > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Razem {totalLines} {totalLines === 1 ? 'pozycja' : totalLines < 5 ? 'pozycje' : 'pozycji'}</span>
          <span className="text-xl font-bold text-gray-900">{fmt(doc.totalValuePln)} zł</span>
        </div>
      )}
    </div>
  );
}
