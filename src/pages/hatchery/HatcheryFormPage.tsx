import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { incubationService } from '@/services/incubation.service';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { INCUBATION_DEFAULTS } from '@/constants/phases';
import { SPECIES_LABELS, SPECIES_EMOJI } from '@/constants/species';
import { todayISO, formatDate } from '@/utils/date';
import type { IncubationEggGroup } from '@/models/incubation.model';
import type { Species } from '@/constants/species';

interface EggGroupDraft {
  hatchingEggLotId: number | null;
  species: Species;
  breed: string;
  count: number;
  maxCount: number;
  notes: string;
  // zachowane przy edycji
  candlingFertile?: number;
  candlingInfertile?: number;
  candlingNotDeveloped?: number;
}

export function HatcheryFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = id != null;

  // Pomocnicze: grupy przy edycji (do wyłączenia z liczenia dostępności)
  // WAŻNE: musi być zadeklarowane PRZED obliczeniem `lots`
  const [groupsFromEdit, setGroupsFromEdit] = React.useState<EggGroupDraft[]>([]);

  // Magazyn jaj wylęgowych z dostępnością
  const lotsRaw   = useLiveQuery(() => db.hatchingEggLots.orderBy('entryDate').reverse().toArray(), []) ?? [];
  const allGroups = useLiveQuery(() => db.incubationEggGroups.toArray(), []) ?? [];

  const lots = lotsRaw.map(lot => {
    const used = allGroups
      .filter(g => {
        // przy edycji: nie licz grup należących do tego wsadu
        if (isEdit) {
          const editedGroupIds = groupsFromEdit.map(eg => eg.hatchingEggLotId).filter((x): x is number => x !== null);
          if (g.hatchingEggLotId === lot.id && editedGroupIds.includes(lot.id!)) return false;
        }
        return g.hatchingEggLotId === lot.id;
      })
      .reduce((s, g) => s + g.count, 0);
    const available = Math.max(0, lot.count - used);
    return { ...lot, usedCount: used, availableCount: available };
  }).filter(l => l.availableCount > 0 || isEdit);

  // Form state
  const [name, setName]         = React.useState('');
  const [startDate, setStartDate] = React.useState(todayISO());
  const [notes, setNotes]       = React.useState('');
  const [totalDays, setTotalDays]               = React.useState(21);
  const [lockdownDay, setLockdownDay]           = React.useState(18);
  const [incTemp, setIncTemp]                   = React.useState(37.5);
  const [incHumidity, setIncHumidity]           = React.useState(55);
  const [lockdownTemp, setLockdownTemp]         = React.useState(37.2);
  const [lockdownHumidity, setLockdownHumidity] = React.useState(70);
  const [groups, setGroups]     = React.useState<EggGroupDraft[]>([]);
  const [saving, setSaving]     = React.useState(false);
  const [error, setError]       = React.useState('');

  // Wczytaj dane przy edycji
  React.useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const inc = await incubationService.getById(Number(id));
      if (!inc) return;
      setName(inc.name);
      setStartDate(inc.startDate);
      setNotes(inc.notes ?? '');
      setTotalDays(inc.totalDays);
      setLockdownDay(inc.lockdownDay);
      setIncTemp(inc.incubationTempC);
      setIncHumidity(inc.incubationHumidityPct);
      setLockdownTemp(inc.lockdownTempC);
      setLockdownHumidity(inc.lockdownHumidityPct);

      const existing = await incubationService.getEggGroups(Number(id));
      const drafts: EggGroupDraft[] = existing.map(g => ({
        hatchingEggLotId: g.hatchingEggLotId ?? null,
        species: g.species,
        breed: g.breed ?? '',
        count: g.count,
        maxCount: 999,
        notes: g.notes ?? '',
        candlingFertile: g.candlingFertile,
        candlingInfertile: g.candlingInfertile,
        candlingNotDeveloped: g.candlingNotDeveloped,
      }));
      setGroups(drafts);
      setGroupsFromEdit(drafts);
    })();
  }, [id, isEdit]);

  // Zaktualizuj maxCount po załadowaniu partii
  React.useEffect(() => {
    if (lots.length === 0) return;
    setGroups(prev => prev.map(g => {
      if (g.hatchingEggLotId == null) return g;
      const lot = lots.find(l => l.id === g.hatchingEggLotId);
      return lot ? { ...g, maxCount: lot.availableCount + g.count } : g;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotsRaw.length, allGroups.length]);

  function applySpeciesDefaults(species: Species) {
    const d = INCUBATION_DEFAULTS[species] ?? INCUBATION_DEFAULTS['nioska'];
    setTotalDays(d.totalDays);
    setLockdownDay(d.lockdownDay);
    setIncTemp(d.incubationTempC);
    setIncHumidity(d.incubationHumidityPct);
    setLockdownTemp(d.lockdownTempC);
    setLockdownHumidity(d.lockdownHumidityPct);
  }

  function addGroupFromLot(lotId: number) {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    if (groups.some(g => g.hatchingEggLotId === lotId)) return;
    const draft: EggGroupDraft = {
      hatchingEggLotId: lotId,
      species: lot.species,
      breed: lot.breed ?? '',
      count: Math.min(lot.availableCount, 12),
      maxCount: lot.availableCount,
      notes: '',
    };
    if (groups.length === 0) applySpeciesDefaults(lot.species);
    setGroups(prev => [...prev, draft]);
  }

  function addManualGroup() {
    setGroups(prev => [...prev, {
      hatchingEggLotId: null,
      species: 'nioska',
      breed: '',
      count: 12,
      maxCount: 120,
      notes: '',
    }]);
  }

  function updateGroup(i: number, patch: Partial<EggGroupDraft>) {
    setGroups(prev => prev.map((g, idx) => {
      if (idx !== i) return g;
      const updated = { ...g, ...patch };
      if (patch.hatchingEggLotId !== undefined && patch.hatchingEggLotId !== null) {
        const lot = lots.find(l => l.id === patch.hatchingEggLotId);
        if (lot) {
          updated.species  = lot.species;
          updated.breed    = lot.breed ?? '';
          updated.maxCount = lot.availableCount + g.count;
          updated.count    = Math.min(updated.count, updated.maxCount);
        }
      }
      return updated;
    }));
  }

  function removeGroup(i: number) {
    setGroups(prev => prev.filter((_, idx) => idx !== i));
  }

  const totalEggs = groups.reduce((s, g) => s + (g.count || 0), 0);

  const availableLots = lots.filter(l => !groups.some(g => g.hatchingEggLotId === l.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Podaj nazwę wsadu'); return; }
    if (groups.length === 0 || totalEggs === 0) { setError('Dodaj co najmniej jedną grupę jaj'); return; }
    if (lockdownDay >= totalDays) { setError('Dzień lockdown musi być wcześniejszy niż koniec cyklu'); return; }

    for (const g of groups) {
      if (g.hatchingEggLotId != null) {
        const lot = lots.find(l => l.id === g.hatchingEggLotId);
        if (lot && g.count > lot.availableCount + (isEdit ? g.count : 0)) {
          setError(`Za mało jaj w partii "${lot.breed ?? SPECIES_LABELS[lot.species]}" (dostępne: ${lot.availableCount})`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const basePayload = {
        name: name.trim(),
        startDate,
        notes: notes.trim() || undefined,
        totalDays,
        lockdownDay,
        incubationTempC: incTemp,
        incubationHumidityPct: incHumidity,
        lockdownTempC: lockdownTemp,
        lockdownHumidityPct: lockdownHumidity,
      };

      const groupPayloads: Omit<IncubationEggGroup, 'id' | 'createdAt'>[] = groups.map(g => ({
        incubationId: 0,
        species: g.species,
        breed: g.breed.trim() || undefined,
        count: g.count,
        hatchingEggLotId: g.hatchingEggLotId ?? undefined,
        notes: g.notes.trim() || undefined,
        candlingFertile: g.candlingFertile,
        candlingInfertile: g.candlingInfertile,
        candlingNotDeveloped: g.candlingNotDeveloped,
      } as any));

      if (isEdit) {
        await incubationService.update(Number(id), basePayload);
        await incubationService.replaceEggGroups(Number(id), groupPayloads.map(g => ({ ...g, incubationId: Number(id) })));
        navigate(`/wyleglarnia/${id}`);
      } else {
        const newId = await incubationService.create({ ...basePayload, status: 'incubating' });
        await incubationService.replaceEggGroups(newId, groupPayloads.map(g => ({ ...g, incubationId: newId })));
        navigate(`/wyleglarnia/${newId}`);
      }
    } catch {
      setError('Błąd zapisu. Spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          ← Wróć
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isEdit ? 'Edytuj wsad' : 'Nowy wsad inkubacji'}
        </h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Podstawowe dane */}
      <Card title="Dane wsadu">
        <div className="space-y-3">
          <Input label="Nazwa wsadu" value={name} onChange={e => setName(e.target.value)}
            placeholder="np. Wylęg kwiecień 2026" required />
          <Input label="Data nałożenia jaj" type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)} required />
          <Textarea label="Uwagi (opcjonalnie)" value={notes}
            onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
      </Card>

      {/* Skład wsadu – z magazynu */}
      <Card title={`Jaja do inkubacji (łącznie: ${totalEggs} szt.)`}>
        <div className="space-y-4">

          {/* Dodaj z magazynu */}
          {availableLots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Dodaj z magazynu jaj wylęgowych</p>
              <div className="space-y-1.5">
                {availableLots.map(lot => (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => addGroupFromLot(lot.id!)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors text-left"
                  >
                    <span className="text-xl">{SPECIES_EMOJI[lot.species]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">
                        {lot.breed ?? SPECIES_LABELS[lot.species]}
                        {lot.breed && <span className="text-gray-400 font-normal ml-1">({SPECIES_LABELS[lot.species]})</span>}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(lot.entryDate)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-green-700">{lot.availableCount} szt.</div>
                      <div className="text-xs text-gray-400">dostępne</div>
                    </div>
                    <span className="text-green-600 font-bold text-lg">+</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {lots.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
              Magazyn jaj wylęgowych jest pusty. Możesz dodać jaja ręcznie lub najpierw uzupełnić magazyn.
            </div>
          )}

          {/* Dodane grupy */}
          {groups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase">Wybrane grupy</p>
              {groups.map((g, i) => {
                const lot = g.hatchingEggLotId != null ? lots.find(l => l.id === g.hatchingEggLotId) : null;
                return (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SPECIES_EMOJI[g.species]}</span>
                        <div>
                          <span className="text-sm font-medium text-gray-800">
                            {g.breed || SPECIES_LABELS[g.species]}
                          </span>
                          {lot && (
                            <span className="text-xs text-gray-400 ml-1">
                              (partia {formatDate(lot.entryDate)}, dostępne: {lot.availableCount})
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeGroup(i)}
                        className="text-xs text-red-400 hover:text-red-600">Usuń</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Liczba jaj</label>
                        <input
                          type="number" min={1}
                          max={lot ? lot.availableCount + g.count : 120}
                          value={g.count}
                          onChange={e => updateGroup(i, { count: Number(e.target.value) })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        {lot && g.count > lot.availableCount && (
                          <p className="text-xs text-red-500 mt-0.5">Max: {lot.availableCount} szt.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Rasa (opcjonalnie)</label>
                        <input
                          type="text"
                          value={g.breed}
                          onChange={e => updateGroup(i, { breed: e.target.value })}
                          placeholder={SPECIES_LABELS[g.species]}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dodaj ręcznie (bez powiązania z magazynem) */}
          <button
            type="button"
            onClick={addManualGroup}
            className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-brand-300 hover:text-brand-700 transition-colors"
          >
            + Dodaj ręcznie (bez magazynu)
          </button>
        </div>
      </Card>

      {/* Parametry inkubacji */}
      <Card title="Parametry inkubatora">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Długość cyklu (dni)" type="number" min={18} max={35}
              value={totalDays} onChange={e => setTotalDays(Number(e.target.value))} />
            <Input label="Lockdown od dnia" type="number" min={14} max={totalDays - 1}
              value={lockdownDay} onChange={e => setLockdownDay(Number(e.target.value))} />
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Etap 1: Inkubacja</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Temperatura (°C)" type="number" step="0.1"
              value={incTemp} onChange={e => setIncTemp(Number(e.target.value))} />
            <Input label="Wilgotność (%)" type="number" min={40} max={90}
              value={incHumidity} onChange={e => setIncHumidity(Number(e.target.value))} />
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase pt-1">Etap 2: Lockdown</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Temperatura (°C)" type="number" step="0.1"
              value={lockdownTemp} onChange={e => setLockdownTemp(Number(e.target.value))} />
            <Input label="Wilgotność (%)" type="number" min={40} max={95}
              value={lockdownHumidity} onChange={e => setLockdownHumidity(Number(e.target.value))} />
          </div>
        </div>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Zapisywanie…' : isEdit ? 'Zapisz zmiany' : 'Utwórz wsad'}
      </Button>
    </form>
  );
}
