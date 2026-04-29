import { db } from '@/db/database';
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

// Oblicz oczekiwaną datę lockdown i wylęgu
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

// Wskaźnik zapłodnienia z wyników świetlenia
export function calcFertilityRate(inc: Incubation): number | null {
  if (inc.candlingFertileCount == null) return null;
  const total = (inc.candlingFertileCount ?? 0)
    + (inc.candlingInfertileCount ?? 0)
    + (inc.candlingNotDeveloped ?? 0);
  if (total === 0) return null;
  return (inc.candlingFertileCount / total) * 100;
}

// Wskaźnik wylęgu (z jaj zapłodnionych)
export function calcHatchRate(inc: Incubation): number | null {
  if (inc.totalHatched == null || inc.candlingFertileCount == null) return null;
  if (inc.candlingFertileCount === 0) return null;
  return (inc.totalHatched / inc.candlingFertileCount) * 100;
}

export const incubationService = {
  async getAll(): Promise<Incubation[]> {
    return db.incubations.orderBy('startDate').reverse().toArray();
  },

  async getActive(): Promise<Incubation[]> {
    return db.incubations
      .where('status').anyOf('incubating', 'lockdown')
      .toArray();
  },

  async getById(id: number): Promise<Incubation | undefined> {
    return db.incubations.get(id);
  },

  async create(data: Omit<Incubation, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    return db.incubations.add({ ...data, createdAt: now, updatedAt: now });
  },

  async update(id: number, data: Partial<Omit<Incubation, 'id' | 'createdAt'>>): Promise<void> {
    await db.incubations.update(id, { ...data, updatedAt: new Date().toISOString() });
  },

  async delete(id: number): Promise<void> {
    await db.transaction('rw', [db.incubations, db.incubationEggGroups], async () => {
      await db.incubationEggGroups.where('incubationId').equals(id).delete();
      await db.incubations.delete(id);
    });
  },

  // Automatyczna zmiana statusu na lockdown/completed na podstawie dnia cyklu
  async syncStatus(id: number): Promise<void> {
    const inc = await db.incubations.get(id);
    if (!inc || inc.status === 'completed' || inc.status === 'cancelled') return;
    const day = calcIncubationDay(inc.startDate, inc.totalDays);
    let newStatus: IncubationStatus = inc.status;
    if (day >= inc.totalDays) {
      newStatus = 'completed';
    } else if (day >= inc.lockdownDay) {
      newStatus = 'lockdown';
    } else {
      newStatus = 'incubating';
    }
    if (newStatus !== inc.status) {
      await db.incubations.update(id, { status: newStatus, updatedAt: new Date().toISOString() });
    }
  },

  // Grupy jaj
  async getEggGroups(incubationId: number): Promise<IncubationEggGroup[]> {
    return db.incubationEggGroups.where('incubationId').equals(incubationId).toArray();
  },

  async addEggGroup(data: Omit<IncubationEggGroup, 'id' | 'createdAt'>): Promise<number> {
    return db.incubationEggGroups.add({ ...data, createdAt: new Date().toISOString() });
  },

  async updateEggGroup(id: number, data: Partial<Omit<IncubationEggGroup, 'id' | 'createdAt'>>): Promise<void> {
    await db.incubationEggGroups.update(id, data);
  },

  async deleteEggGroup(id: number): Promise<void> {
    await db.incubationEggGroups.delete(id);
  },

  async replaceEggGroups(incubationId: number, groups: Omit<IncubationEggGroup, 'id' | 'createdAt'>[]): Promise<void> {
    await db.transaction('rw', [db.incubationEggGroups], async () => {
      await db.incubationEggGroups.where('incubationId').equals(incubationId).delete();
      const now = new Date().toISOString();
      for (const g of groups) {
        await db.incubationEggGroups.add({ ...g, createdAt: now });
      }
    });
  },

  // Wsady wchodzące w lockdown za ≤ 3 dni (alert na pulpicie)
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
