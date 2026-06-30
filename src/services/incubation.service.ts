import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Incubation, IncubationEggGroup } from '@/models/incubation.model';
import type { IncubationStatus } from '@/constants/phases';

// Oblicz dzień cyklu (1-based), null jeśli jeszcze nie zaczęto lub zakończono
export function calcIncubationDay(startDate: string, totalDays: number): number {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(diff, totalDays));
}

export function calcKeyDates(startDate: string, totalDays: number, lockdownDay: number) {
  const start = new Date(startDate);
  const lockdown = new Date(start);
  lockdown.setDate(start.getDate() + lockdownDay - 1);
  const hatch = new Date(start);
  hatch.setDate(start.getDate() + totalDays - 1);
  return {
    lockdownDate: lockdown.toISOString().slice(0, 10),
    hatchDate:    hatch.toISOString().slice(0, 10),
  };
}

export function calcFertilityRate(inc: Incubation): number | null {
  if (inc.candlingFertileCount == null) return null;
  const total = (inc.candlingFertileCount ?? 0)
    + (inc.candlingInfertileCount ?? 0)
    + (inc.candlingNotDeveloped ?? 0);
  if (total === 0) return null;
  return (inc.candlingFertileCount / total) * 100;
}

export function calcHatchRate(inc: Incubation): number | null {
  if (inc.totalHatched == null || inc.candlingFertileCount == null) return null;
  if (inc.candlingFertileCount === 0) return null;
  return (inc.totalHatched / inc.candlingFertileCount) * 100;
}

// ── mappers ──────────────────────────────────────────────────────────────────

function rowToInc(r: Record<string, unknown>): Incubation {
  return {
    id:                     r.id as number,
    name:                   r.name as string,
    startDate:              r.start_date as string,
    status:                 r.status as IncubationStatus,
    totalDays:              r.total_days as number,
    lockdownDay:            r.lockdown_day as number,
    incubationTempC:        r.incubation_temp_c as number,
    incubationHumidityPct:  r.incubation_humidity_pct as number,
    lockdownTempC:          r.lockdown_temp_c as number,
    lockdownHumidityPct:    r.lockdown_humidity_pct as number,
    notes:                  r.notes as string | undefined,
    candlingDate:           r.candling_date as string | undefined,
    candlingFertileCount:   r.candling_fertile_count as number | undefined,
    candlingInfertileCount: r.candling_infertile_count as number | undefined,
    candlingNotDeveloped:   r.candling_not_developed as number | undefined,
    hatchDate:              r.hatch_date as string | undefined,
    totalHatched:           r.total_hatched as number | undefined,
    totalUnhatched:         r.total_unhatched as number | undefined,
    resultBatchId:          r.result_batch_id as number | undefined,
    createdAt:              r.created_at as string,
    updatedAt:              r.updated_at as string,
  };
}

function rowToGroup(r: Record<string, unknown>): IncubationEggGroup {
  return {
    id:                    r.id as number,
    incubationId:          r.incubation_id as number,
    species:               r.species as IncubationEggGroup['species'],
    breed:                 r.breed as string | undefined,
    count:                 r.count as number,
    hatchingEggLotId:      r.hatching_egg_lot_id as number | undefined,
    candlingFertile:       r.candling_fertile as number | undefined,
    candlingInfertile:     r.candling_infertile as number | undefined,
    candlingNotDeveloped:  r.candling_not_developed as number | undefined,
    notes:                 r.notes as string | undefined,
    createdAt:             r.created_at as string,
  };
}

// ── service ──────────────────────────────────────────────────────────────────

export const incubationService = {
  async getAll(): Promise<Incubation[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('incubations').select('*')
        .eq('user_id', user.id).order('start_date', { ascending: false });
      return (data ?? []).map(rowToInc);
    }
    return db.incubations.orderBy('startDate').reverse().toArray();
  },

  async getActive(): Promise<Incubation[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('incubations').select('*')
        .eq('user_id', user.id).in('status', ['incubating', 'lockdown']);
      return (data ?? []).map(rowToInc);
    }
    return db.incubations.where('status').anyOf('incubating', 'lockdown').toArray();
  },

  async getById(id: number): Promise<Incubation | undefined> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('incubations').select('*')
        .eq('user_id', user.id).eq('id', id).single();
      return data ? rowToInc(data) : undefined;
    }
    return db.incubations.get(id);
  },

  async create(data: Omit<Incubation, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('incubations').insert({
        user_id: user.id,
        name: data.name,
        start_date: data.startDate,
        status: data.status,
        total_days: data.totalDays,
        lockdown_day: data.lockdownDay,
        incubation_temp_c: data.incubationTempC,
        incubation_humidity_pct: data.incubationHumidityPct,
        lockdown_temp_c: data.lockdownTempC,
        lockdown_humidity_pct: data.lockdownHumidityPct,
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.incubations.add({ ...data, createdAt: now, updatedAt: now });
  },

  async update(id: number, data: Partial<Omit<Incubation, 'id' | 'createdAt'>>): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const patch: Record<string, unknown> = { updated_at: now };
      if (data.name !== undefined)                  patch.name = data.name;
      if (data.startDate !== undefined)              patch.start_date = data.startDate;
      if (data.status !== undefined)                 patch.status = data.status;
      if (data.totalDays !== undefined)              patch.total_days = data.totalDays;
      if (data.lockdownDay !== undefined)            patch.lockdown_day = data.lockdownDay;
      if (data.incubationTempC !== undefined)        patch.incubation_temp_c = data.incubationTempC;
      if (data.incubationHumidityPct !== undefined)  patch.incubation_humidity_pct = data.incubationHumidityPct;
      if (data.lockdownTempC !== undefined)          patch.lockdown_temp_c = data.lockdownTempC;
      if (data.lockdownHumidityPct !== undefined)    patch.lockdown_humidity_pct = data.lockdownHumidityPct;
      if (data.notes !== undefined)                  patch.notes = data.notes ?? null;
      if (data.candlingDate !== undefined)           patch.candling_date = data.candlingDate ?? null;
      if (data.candlingFertileCount !== undefined)   patch.candling_fertile_count = data.candlingFertileCount ?? null;
      if (data.candlingInfertileCount !== undefined) patch.candling_infertile_count = data.candlingInfertileCount ?? null;
      if (data.candlingNotDeveloped !== undefined)   patch.candling_not_developed = data.candlingNotDeveloped ?? null;
      if (data.hatchDate !== undefined)              patch.hatch_date = data.hatchDate ?? null;
      if (data.totalHatched !== undefined)           patch.total_hatched = data.totalHatched ?? null;
      if (data.totalUnhatched !== undefined)         patch.total_unhatched = data.totalUnhatched ?? null;
      if (data.resultBatchId !== undefined)          patch.result_batch_id = data.resultBatchId ?? null;
      const { error } = await supabase.from('incubations').update(patch).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      return;
    }
    await db.incubations.update(id, { ...data, updatedAt: now });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('incubation_egg_groups').delete().eq('incubation_id', id).eq('user_id', user.id);
      await supabase.from('incubations').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.transaction('rw', [db.incubations, db.incubationEggGroups], async () => {
      await db.incubationEggGroups.where('incubationId').equals(id).delete();
      await db.incubations.delete(id);
    });
  },

  async syncStatus(id: number): Promise<void> {
    const inc = await this.getById(id);
    if (!inc || inc.status === 'completed' || inc.status === 'cancelled') return;
    const day = calcIncubationDay(inc.startDate, inc.totalDays);
    let newStatus: IncubationStatus = inc.status;
    if (day >= inc.totalDays)       newStatus = 'completed';
    else if (day >= inc.lockdownDay) newStatus = 'lockdown';
    else                             newStatus = 'incubating';
    if (newStatus !== inc.status) await this.update(id, { status: newStatus });
  },

  // ── Grupy jaj ────────────────────────────────────────────────────────────

  async getEggGroups(incubationId: number): Promise<IncubationEggGroup[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('incubation_egg_groups').select('*')
        .eq('user_id', user.id).eq('incubation_id', incubationId);
      return (data ?? []).map(rowToGroup);
    }
    return db.incubationEggGroups.where('incubationId').equals(incubationId).toArray();
  },

  /** Wszystkie grupy jaj użytkownika (do listy wsadów). */
  async getAllEggGroups(): Promise<IncubationEggGroup[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase.from('incubation_egg_groups').select('*')
        .eq('user_id', user.id);
      return (data ?? []).map(rowToGroup);
    }
    return db.incubationEggGroups.toArray();
  },

  async addEggGroup(data: Omit<IncubationEggGroup, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data: row, error } = await supabase.from('incubation_egg_groups').insert({
        user_id: user.id,
        incubation_id: data.incubationId,
        species: data.species,
        breed: data.breed ?? null,
        count: data.count,
        hatching_egg_lot_id: data.hatchingEggLotId ?? null,
        candling_fertile: data.candlingFertile ?? null,
        candling_infertile: data.candlingInfertile ?? null,
        candling_not_developed: data.candlingNotDeveloped ?? null,
        notes: data.notes ?? null,
        created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.incubationEggGroups.add({ ...data, createdAt: now });
  },

  async updateEggGroup(id: number, data: Partial<Omit<IncubationEggGroup, 'id' | 'createdAt'>>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const patch: Record<string, unknown> = {};
      if (data.species !== undefined)              patch.species = data.species;
      if (data.breed !== undefined)                patch.breed = data.breed ?? null;
      if (data.count !== undefined)                patch.count = data.count;
      if (data.candlingFertile !== undefined)      patch.candling_fertile = data.candlingFertile ?? null;
      if (data.candlingInfertile !== undefined)    patch.candling_infertile = data.candlingInfertile ?? null;
      if (data.candlingNotDeveloped !== undefined) patch.candling_not_developed = data.candlingNotDeveloped ?? null;
      if (data.notes !== undefined)                patch.notes = data.notes ?? null;
      await supabase.from('incubation_egg_groups').update(patch).eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.incubationEggGroups.update(id, data);
  },

  async deleteEggGroup(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('incubation_egg_groups').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.incubationEggGroups.delete(id);
  },

  async replaceEggGroups(incubationId: number, groups: Omit<IncubationEggGroup, 'id' | 'createdAt'>[]): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { error: delError } = await supabase.from('incubation_egg_groups').delete()
        .eq('incubation_id', incubationId).eq('user_id', user.id);
      if (delError) throw delError;
      if (groups.length > 0) {
        const { error: insError } = await supabase.from('incubation_egg_groups').insert(
          groups.map(g => ({
            user_id: user.id,
            incubation_id: incubationId,
            species: g.species,
            breed: g.breed ?? null,
            count: g.count,
            hatching_egg_lot_id: g.hatchingEggLotId ?? null,
            candling_fertile: g.candlingFertile ?? null,
            candling_infertile: g.candlingInfertile ?? null,
            candling_not_developed: g.candlingNotDeveloped ?? null,
            notes: g.notes ?? null,
            created_at: now,
          }))
        );
        if (insError) throw insError;
      }
      return;
    }
    await db.transaction('rw', [db.incubationEggGroups], async () => {
      await db.incubationEggGroups.where('incubationId').equals(incubationId).delete();
      for (const g of groups) {
        await db.incubationEggGroups.add({ ...g, createdAt: now });
      }
    });
  },

  async getUpcomingLockdowns(withinDays = 3): Promise<Incubation[]> {
    const active = await this.getActive();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return active.filter(inc => {
      if (inc.status !== 'incubating') return false;
      const { lockdownDate } = calcKeyDates(inc.startDate, inc.totalDays, inc.lockdownDay);
      const ld = new Date(lockdownDate);
      ld.setHours(0, 0, 0, 0);
      const daysUntil = Math.floor((ld.getTime() - today.getTime()) / 86_400_000);
      return daysUntil >= 0 && daysUntil <= withinDays;
    });
  },
};
