import React from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import {
  incubationService,
  calcIncubationDay,
  calcKeyDates,
  calcFertilityRate,
  calcHatchRate,
} from '@/services/incubation.service';
import { batchService } from '@/services/batch.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { INCUBATION_STATUS_LABELS, INCUBATION_STATUS_COLORS } from '@/constants/phases';
import { SPECIES_LABELS, SPECIES_EMOJI, ACTIVE_SPECIES } from '@/constants/species';
import { formatDate, todayISO } from '@/utils/date';
import type { Species } from '@/constants/species';
import type { IncubationEggGroup } from '@/models/incubation.model';

// ── Sekcja: Postęp inkubacji ────────────────────────────────────────────────
function ProgressSection({ inc }: { inc: NonNullable<Awaited<ReturnType<typeof incubationService.getById>>> }) {
  if (inc.status === 'completed' || inc.status === 'cancelled') return null;
  const day = calcIncubationDay(inc.startDate, inc.totalDays);
  const pct = Math.round((day / inc.totalDays) * 100);
  const lockdownPct = Math.round((inc.lockdownDay / inc.totalDays) * 100);
  const isLockdown = day >= inc.lockdownDay;
  const { lockdownDate, hatchDate } = calcKeyDates(inc.startDate, inc.totalDays, inc.lockdownDay);

  return (
    <Card title="Postęp">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-3xl font-bold text-gray-900">Dzień {day}</div>
          <span className="text-sm text-gray-500">z {inc.totalDays}</span>
        </div>
        <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-400 z-10"
            style={{ left: `${lockdownPct}%` }}
          />
          <div
            className={`h-full rounded-full transition-all ${isLockdown ? 'bg-orange-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
          <div>
            <div className="font-semibold text-gray-700">{formatDate(inc.startDate)}</div>
            <div>Nałożenie</div>
          </div>
          <div>
            <div className={`font-semibold ${isLockdown ? 'text-orange-600' : 'text-gray-700'}`}>
              {formatDate(lockdownDate)}
            </div>
            <div>Lockdown (dzień {inc.lockdownDay})</div>
          </div>
          <div>
            <div className="font-semibold text-green-700">{formatDate(hatchDate)}</div>
            <div>Klujenie</div>
          </div>
        </div>

        {/* Aktualne parametry */}
        <div className={`rounded-lg p-3 ${isLockdown ? 'bg-orange-50 border border-orange-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="text-xs font-semibold text-gray-600 mb-1.5">
            {isLockdown ? 'Parametry LOCKDOWN' : 'Parametry INKUBACJI'}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Temperatura:</span>{' '}
              <span className="font-semibold">
                {isLockdown ? inc.lockdownTempC : inc.incubationTempC} °C
              </span>
            </div>
            <div>
              <span className="text-gray-500">Wilgotność:</span>{' '}
              <span className="font-semibold">
                {isLockdown ? inc.lockdownHumidityPct : inc.incubationHumidityPct}%
              </span>
            </div>
          </div>
          {!isLockdown && (
            <div className="mt-1.5 text-xs text-amber-700">
              Za {inc.lockdownDay - day} dni zmień na: {inc.lockdownTempC} °C / {inc.lockdownHumidityPct}% wilg. i zatrzymaj obracanie
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Sekcja: Grupy jaj ────────────────────────────────────────────────────────
function EggGroupsSection({ incubationId }: { incubationId: number }) {
  const groups = useLiveQuery(
    () => db.incubationEggGroups.where('incubationId').equals(incubationId).toArray(),
    [incubationId]
  ) ?? [];
  const lots = useLiveQuery(() => db.hatchingEggLots.toArray(), []) ?? [];

  const total = groups.reduce((s, g) => s + g.count, 0);

  if (groups.length === 0) return null;

  return (
    <Card title={`Skład wsadu – ${total} jaj`} padding="none">
      <div className="divide-y divide-gray-50">
        {groups.map(g => {
          const lot = (g as any).hatchingEggLotId
            ? lots.find(l => l.id === (g as any).hatchingEggLotId)
            : null;
          return (
            <div key={g.id} className="px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{SPECIES_EMOJI[g.species]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {g.breed ?? SPECIES_LABELS[g.species]}
                  <span className="text-gray-400 font-normal ml-1">({SPECIES_LABELS[g.species]})</span>
                </div>
                {lot && (
                  <div className="text-xs text-gray-400">
                    Partia: {formatDate(lot.entryDate)}
                    {lot.supplierName ? ` · ${lot.supplierName}` : ''}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-700">{g.count} szt.</div>
                {lot?.pricePerEgg != null && (
                  <div className="text-xs text-gray-400">{lot.pricePerEgg.toFixed(2)} PLN/szt.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Modal: Wyniki świetlenia ─────────────────────────────────────────────────
interface CandlingModalProps {
  incubationId: number;
  groups: IncubationEggGroup[];
  initialDate?: string;
  onClose: () => void;
}
function CandlingModal({ incubationId, groups, initialDate, onClose }: CandlingModalProps) {
  type GroupResult = { fertile: number; infertile: number; notDeveloped: number };

  const [date, setDate] = React.useState(initialDate ?? todayISO());
  const [results, setResults] = React.useState<Record<number, GroupResult>>(() => {
    const init: Record<number, GroupResult> = {};
    for (const g of groups) {
      if (g.id != null) {
        init[g.id] = {
          fertile:     g.candlingFertile     ?? 0,
          infertile:   g.candlingInfertile   ?? 0,
          notDeveloped: g.candlingNotDeveloped ?? 0,
        };
      }
    }
    return init;
  });
  const [saving, setSaving] = React.useState(false);

  const totals = Object.values(results).reduce(
    (acc, r) => ({
      fertile:      acc.fertile      + r.fertile,
      infertile:    acc.infertile    + r.infertile,
      notDeveloped: acc.notDeveloped + r.notDeveloped,
    }),
    { fertile: 0, infertile: 0, notDeveloped: 0 }
  );
  const totalChecked = totals.fertile + totals.infertile + totals.notDeveloped;
  const fertilePct = totalChecked > 0 ? Math.round((totals.fertile / totalChecked) * 100) : null;

  function setResult(groupId: number, field: keyof GroupResult, value: number) {
    setResults(prev => ({ ...prev, [groupId]: { ...prev[groupId], [field]: value } }));
  }

  async function save() {
    setSaving(true);
    for (const g of groups) {
      if (g.id != null) {
        const r = results[g.id] ?? { fertile: 0, infertile: 0, notDeveloped: 0 };
        await incubationService.updateEggGroup(g.id, {
          candlingFertile:      r.fertile,
          candlingInfertile:    r.infertile,
          candlingNotDeveloped: r.notDeveloped,
        });
      }
    }
    await incubationService.update(incubationId, {
      candlingDate:           date,
      candlingFertileCount:   totals.fertile,
      candlingInfertileCount: totals.infertile,
      candlingNotDeveloped:   totals.notDeveloped,
    });
    setSaving(false);
    onClose();
  }

  const multiGroup = groups.length > 1;

  return (
    <Modal open title="Wyniki świetlenia" onClose={onClose}>
      <div className="space-y-3">
        <Input label="Data świetlenia" type="date" value={date} onChange={e => setDate(e.target.value)} />

        {multiGroup ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Wyniki per grupa</p>
            {groups.map(g => {
              if (g.id == null) return null;
              const r = results[g.id] ?? { fertile: 0, infertile: 0, notDeveloped: 0 };
              return (
                <div key={g.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{SPECIES_EMOJI[g.species]}</span>
                    <span className="text-sm font-medium text-gray-800">
                      {g.breed ?? SPECIES_LABELS[g.species]}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">{g.count} jaj</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Zapłodnione" type="number" min={0} value={r.fertile}
                      onChange={e => setResult(g.id!, 'fertile', Number(e.target.value))} />
                    <Input label="Niezapłodnione" type="number" min={0} value={r.infertile}
                      onChange={e => setResult(g.id!, 'infertile', Number(e.target.value))} />
                    <Input label="Zat. rozwój" type="number" min={0} value={r.notDeveloped}
                      onChange={e => setResult(g.id!, 'notDeveloped', Number(e.target.value))} />
                  </div>
                </div>
              );
            })}
            {totalChecked > 0 && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-600 grid grid-cols-3 gap-2 text-center">
                <div><span className="font-semibold text-green-700">{totals.fertile}</span><br />łącznie zapł.</div>
                <div><span className="font-semibold text-red-600">{totals.infertile}</span><br />łącznie niezapł.</div>
                <div><span className="font-semibold text-gray-600">{totals.notDeveloped}</span><br />łącznie zat.</div>
              </div>
            )}
          </div>
        ) : groups[0]?.id != null ? (
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const g = groups[0];
              const r = results[g.id!] ?? { fertile: 0, infertile: 0, notDeveloped: 0 };
              return (
                <>
                  <Input label="Zapłodnione" type="number" min={0} value={r.fertile}
                    onChange={e => setResult(g.id!, 'fertile', Number(e.target.value))} />
                  <Input label="Niezapłodnione" type="number" min={0} value={r.infertile}
                    onChange={e => setResult(g.id!, 'infertile', Number(e.target.value))} />
                  <Input label="Zat. rozwój" type="number" min={0} value={r.notDeveloped}
                    onChange={e => setResult(g.id!, 'notDeveloped', Number(e.target.value))} />
                </>
              );
            })()}
          </div>
        ) : null}

        {fertilePct !== null && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            Łączny wskaźnik zapłodnienia: <strong>{fertilePct}%</strong> ({totals.fertile} z {totalChecked} sztuk)
          </div>
        )}
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz wyniki'}
        </Button>
      </div>
    </Modal>
  );
}

// ── Modal: Zakończenie wylęgu → nowe stado ───────────────────────────────────
interface CompleteModalProps {
  incubationId: number;
  incubationName: string;
  groups: { species: Species; breed?: string; count: number; hatchingEggLotId?: number }[];
  onClose: () => void;
  onDone: (batchId: number) => void;
}
function CompleteModal({ incubationId, incubationName, groups, onClose, onDone }: CompleteModalProps) {
  const [hatchDate, setHatchDate]       = React.useState(todayISO());
  const [hatched, setHatched]           = React.useState(0);
  const [unhatched, setUnhatched]       = React.useState(0);
  const [batchName, setBatchName]       = React.useState(`${incubationName} – pisklęta`);
  const [dominantSpecies, setDominant]  = React.useState<Species>(groups[0]?.species ?? 'nioska');
  const [saving, setSaving]             = React.useState(false);

  // Pobierz partie jaj wylęgowych powiązane z tym wsadem
  const allLots = useLiveQuery(() => db.hatchingEggLots.toArray(), []) ?? [];

  const speciesOptions = [...new Set(groups.map(g => g.species))];

  // Oblicz łączną wartość jaj wstawionych do wsadu
  const totalEggValue = React.useMemo(() => {
    return groups.reduce((sum, g) => {
      if (!g.hatchingEggLotId) return sum;
      const lot = allLots.find(l => l.id === g.hatchingEggLotId);
      if (!lot) return sum;
      const costPerEgg = lot.pricePerEgg ?? (lot.totalCostPln && lot.count > 0 ? lot.totalCostPln / lot.count : 0);
      return sum + costPerEgg * g.count;
    }, 0);
  }, [groups, allLots]);

  const chickCostPerUnit = hatched > 0 && totalEggValue > 0
    ? Math.round((totalEggValue / hatched) * 10000) / 10000
    : undefined;

  async function save() {
    if (!batchName.trim() || hatched === 0) return;
    setSaving(true);
    // Utwórz nowe stado z kosztem pisklęcia obliczonym z wartości jaj
    const batchId = await batchService.create({
      name: batchName.trim(),
      species: dominantSpecies,
      status: 'active',
      startDate: hatchDate,
      initialCount: hatched,
      sourceType: 'wlasny_wyleg',
      chick_cost_per_unit: chickCostPerUnit,
      notes: `Wylęg z inkubacji: ${incubationName}`,
    });
    // Zakończ inkubację
    await incubationService.update(incubationId, {
      status: 'completed',
      hatchDate,
      totalHatched: hatched,
      totalUnhatched: unhatched,
      resultBatchId: batchId,
    });
    setSaving(false);
    onDone(batchId);
  }

  return (
    <Modal open title="Zakończ wylęg i utwórz stado" onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Data klujenia"
          type="date"
          value={hatchDate}
          onChange={e => setHatchDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Wyklute pisklęta"
            type="number" min={0} value={hatched}
            onChange={e => setHatched(Number(e.target.value))}
          />
          <Input
            label="Niezakluté jaja"
            type="number" min={0} value={unhatched}
            onChange={e => setUnhatched(Number(e.target.value))}
          />
        </div>

        {/* Podsumowanie kosztu pisklęcia */}
        {totalEggValue > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 space-y-0.5">
            <div>Wartość jaj w wsadzie: <strong>{totalEggValue.toFixed(2)} PLN</strong></div>
            {chickCostPerUnit != null && (
              <div>Koszt pisklęcia: <strong>{chickCostPerUnit.toFixed(4)} PLN/szt.</strong>
                <span className="text-amber-600"> ({hatched} szt. × {chickCostPerUnit.toFixed(4)} = {(chickCostPerUnit * hatched).toFixed(2)} PLN)</span>
              </div>
            )}
            {hatched === 0 && <div className="text-amber-600">Podaj liczbę wyklutych piskląt, aby obliczyć koszt.</div>}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Nowe stado</p>
          <Input
            label="Nazwa stada"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
          />
          {speciesOptions.length > 1 && (
            <Select
              label="Dominujący gatunek"
              value={dominantSpecies}
              onChange={e => setDominant(e.target.value as Species)}
              options={speciesOptions.map(s => ({ value: s, label: SPECIES_LABELS[s] }))}
              className="mt-3"
            />
          )}
        </div>

        <Button className="w-full" onClick={save} disabled={saving || hatched === 0}>
          {saving ? 'Tworzenie…' : 'Utwórz stado i zakończ'}
        </Button>
      </div>
    </Modal>
  );
}

// ── Główna strona ─────────────────────────────────────────────────────────────
export function HatcheryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const incId = Number(id);

  const inc    = useLiveQuery(() => db.incubations.get(incId),      [incId]);
  const groups = useLiveQuery(() => db.incubationEggGroups.where('incubationId').equals(incId).toArray(), [incId]) ?? [];

  const [showCandling, setShowCandling]   = React.useState(false);
  const [showComplete, setShowComplete]   = React.useState(false);
  const [showCancel, setShowCancel]       = React.useState(false);

  // Synchronizuj status przy wejściu
  React.useEffect(() => {
    if (incId) incubationService.syncStatus(incId);
  }, [incId]);

  if (inc === undefined) return <div className="p-4 text-gray-400">Ładowanie…</div>;
  if (inc === null) return <div className="p-4 text-red-500">Wsad nie istnieje.</div>;

  const fertilityRate = calcFertilityRate(inc);
  const hatchRate     = calcHatchRate(inc);
  const totalEggs     = groups.reduce((s, g) => s + g.count, 0);
  const isActive      = inc.status === 'incubating' || inc.status === 'lockdown';

  return (
    <div className="space-y-4">
      {/* Nagłówek */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 mt-0.5">
          ← Wróć
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">{inc.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INCUBATION_STATUS_COLORS[inc.status]}`}>
              {INCUBATION_STATUS_LABELS[inc.status]}
            </span>
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            Nałożono: {formatDate(inc.startDate)} · {totalEggs} jaj
          </div>
        </div>
        {isActive && (
          <Link to={`/wyleglarnia/${id}/edytuj`} className="text-sm text-brand-700 hover:underline">
            Edytuj
          </Link>
        )}
      </div>

      {/* Postęp */}
      <ProgressSection inc={inc} />

      {/* Grupy jaj */}
      <EggGroupsSection incubationId={incId} />

      {/* Wyniki świetlenia */}
      <Card title="Świetlenie jaj (ok. 7. dnia)">
        {inc.candlingDate ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 mb-2">{formatDate(inc.candlingDate)}</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-green-50 p-2">
                <div className="text-xl font-bold text-green-700">{inc.candlingFertileCount ?? 0}</div>
                <div className="text-xs text-gray-500">Zapłodnione</div>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <div className="text-xl font-bold text-red-600">{inc.candlingInfertileCount ?? 0}</div>
                <div className="text-xs text-gray-500">Niezapłodnione</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <div className="text-xl font-bold text-gray-600">{inc.candlingNotDeveloped ?? 0}</div>
                <div className="text-xs text-gray-500">Zat. rozwój</div>
              </div>
            </div>
            {fertilityRate !== null && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                Wskaźnik zapłodnienia: <strong>{fertilityRate.toFixed(1)}%</strong>
              </div>
            )}
            {/* Podział per-rasa (gdy wiele grup i mają wyniki) */}
            {groups.length > 1 && groups.some(g => (g.candlingFertile ?? 0) + (g.candlingInfertile ?? 0) + (g.candlingNotDeveloped ?? 0) > 0) && (
              <div className="border-t border-gray-100 pt-2 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Wg ras</p>
                {groups.map(g => {
                  const fertile = g.candlingFertile ?? 0;
                  const infertile = g.candlingInfertile ?? 0;
                  const notDev = g.candlingNotDeveloped ?? 0;
                  const total = fertile + infertile + notDev;
                  if (total === 0) return null;
                  const pct = Math.round((fertile / total) * 100);
                  return (
                    <div key={g.id} className="flex items-center gap-2 text-xs">
                      <span>{SPECIES_EMOJI[g.species]}</span>
                      <span className="flex-1 text-gray-600 truncate">{g.breed ?? SPECIES_LABELS[g.species]}</span>
                      <span className="text-green-600 font-medium">{fertile}z</span>
                      <span className="text-red-500">{infertile}n</span>
                      <span className="text-gray-400">{notDev}zr</span>
                      <span className="text-gray-700 font-semibold w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            {isActive && (
              <button
                onClick={() => setShowCandling(true)}
                className="text-xs text-brand-700 hover:underline"
              >
                Popraw wyniki
              </button>
            )}
          </div>
        ) : isActive ? (
          <div className="text-center py-3">
            <p className="text-sm text-gray-500 mb-3">Świetlenie zalecane ok. 7. dnia inkubacji</p>
            <Button size="sm" variant="secondary" onClick={() => setShowCandling(true)}>
              Wprowadź wyniki świetlenia
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Brak wyników świetlenia.</p>
        )}
      </Card>

      {/* Wyniki wylęgu */}
      {inc.status === 'completed' && (
        <Card title="Wyniki wylęgu">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <div className="text-2xl font-bold text-green-700">{inc.totalHatched ?? 0}</div>
                <div className="text-xs text-gray-500">Wyklutych</div>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <div className="text-2xl font-bold text-red-600">{inc.totalUnhatched ?? 0}</div>
                <div className="text-xs text-gray-500">Niezaklutych</div>
              </div>
            </div>
            {hatchRate !== null && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                Wylęg z zapłodnionych: <strong>{hatchRate.toFixed(1)}%</strong>
              </div>
            )}
            {totalEggs > 0 && inc.totalHatched != null && (
              <div className="text-xs text-gray-500 text-center">
                Całkowita wydajność: {Math.round((inc.totalHatched / totalEggs) * 100)}% z {totalEggs} jaj
              </div>
            )}
            {inc.resultBatchId && (
              <Link
                to={`/stada/${inc.resultBatchId}`}
                className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 hover:bg-green-100"
              >
                <span>🐣</span>
                <span>Stado z wylęgu →</span>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Parametry (podgląd) */}
      <Card title="Parametry inkubatora">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Inkubacja</p>
            <p>Temp: <span className="font-medium">{inc.incubationTempC} °C</span></p>
            <p>Wilg: <span className="font-medium">{inc.incubationHumidityPct}%</span></p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Lockdown</p>
            <p>Temp: <span className="font-medium">{inc.lockdownTempC} °C</span></p>
            <p>Wilg: <span className="font-medium">{inc.lockdownHumidityPct}%</span></p>
          </div>
        </div>
      </Card>

      {inc.notes && (
        <Card title="Uwagi">
          <p className="text-sm text-gray-700">{inc.notes}</p>
        </Card>
      )}

      {/* Akcje */}
      {isActive && (
        <div className="space-y-2 pt-1">
          <Button className="w-full" onClick={() => setShowComplete(true)}>
            🐣 Zakończ wylęg i utwórz stado
          </Button>
          <button
            onClick={() => setShowCancel(true)}
            className="w-full py-2 text-sm text-red-500 hover:text-red-700"
          >
            Anuluj wsad
          </button>
        </div>
      )}

      {/* Modale */}
      {showCandling && (
        <CandlingModal
          incubationId={incId}
          groups={groups}
          initialDate={inc.candlingDate}
          onClose={() => setShowCandling(false)}
        />
      )}
      {showComplete && (
        <CompleteModal
          incubationId={incId}
          incubationName={inc.name}
          groups={groups}
          onClose={() => setShowComplete(false)}
          onDone={batchId => navigate(`/stada/${batchId}`)}
        />
      )}
      {showCancel && (
        <Modal open title="Anuluj wsad" onClose={() => setShowCancel(false)}>
          <p className="text-sm text-gray-600 mb-4">
            Czy na pewno chcesz anulować wsad <strong>{inc.name}</strong>? Dane zostaną zachowane.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCancel(false)}
            >
              Wróć
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={async () => {
                await incubationService.update(incId, { status: 'cancelled' });
                setShowCancel(false);
              }}
            >
              Anuluj wsad
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
