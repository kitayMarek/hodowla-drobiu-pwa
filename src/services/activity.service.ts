import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { Activity } from '@/models/activity.model';
import { DEFAULT_ACTIVITIES, WIZARD_ACTIVITIES } from '@/models/activity.model';

function rowToActivity(r: Record<string, unknown>): Activity {
  return {
    id:        r.id        as number,
    key:       r.key       as string,
    name:      r.name      as string,
    icon:      r.icon      as string,
    color:     r.color     as Activity['color'],
    isSystem:  r.is_system as boolean,
    isActive:  r.is_active as boolean,
    sortOrder: r.sort_order as number,
    createdAt: r.created_at as string,
  };
}

async function seedIfEmpty(userId: string): Promise<Activity[]> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from('activities').select('id').eq('user_id', userId).limit(1);
  if (existing && existing.length > 0) return [];
  const rows = DEFAULT_ACTIVITIES.map(a => ({
    user_id:    userId,
    key:        a.key,
    name:       a.name,
    icon:       a.icon,
    color:      a.color,
    is_system:  a.isSystem,
    is_active:  a.isActive,
    sort_order: a.sortOrder,
    created_at: now,
  }));
  const { data } = await supabase.from('activities').insert(rows).select('*');
  return (data ?? []).map(rowToActivity);
}

export const activityService = {
  async getAll(): Promise<Activity[]> {
    const user = await getAuthUser();
    if (user) {
      let { data } = await supabase.from('activities').select('*')
        .eq('user_id', user.id).order('sort_order', { ascending: true });
      if (!data || data.length === 0) {
        await seedIfEmpty(user.id);
        const res = await supabase.from('activities').select('*')
          .eq('user_id', user.id).order('sort_order', { ascending: true });
        data = res.data;
      }
      return (data ?? []).map(rowToActivity);
    }
    const all = await db.activities.orderBy('sortOrder').toArray();
    if (all.length === 0) {
      const now = new Date().toISOString();
      const ids = await db.activities.bulkAdd(
        DEFAULT_ACTIVITIES.map(a => ({ ...a, createdAt: now })),
        { allKeys: true }
      );
      return DEFAULT_ACTIVITIES.map((a, i) => ({ ...a, id: ids[i] as number, createdAt: now }));
    }
    return all;
  },

  async create(data: { key: string; name: string; icon: string; color: Activity['color'] }): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    // Generuj klucz z nazwy jeśli nie podano
    const key = data.key || data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const maxOrder = await this._maxSortOrder();
    if (user) {
      const { data: row, error } = await supabase.from('activities').insert({
        user_id:    user.id,
        key,
        name:       data.name,
        icon:       data.icon,
        color:      data.color,
        is_system:  false,
        is_active:  true,
        sort_order: maxOrder + 10,
        created_at: now,
      }).select('id').single();
      if (error) throw error;
      return row.id;
    }
    return db.activities.add({ key, name: data.name, icon: data.icon, color: data.color,
      isSystem: false, isActive: true, sortOrder: maxOrder + 10, createdAt: now });
  },

  async _maxSortOrder(): Promise<number> {
    const all = await this.getAll();
    const filtered = all.filter(a => !a.isSystem);
    return filtered.length > 0 ? Math.max(...filtered.map(a => a.sortOrder)) : 0;
  },

  async setActive(id: number, isActive: boolean): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('activities').update({ is_active: isActive })
        .eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.activities.update(id, { isActive });
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('activities').delete().eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.activities.delete(id);
  },

  /** Sprawdza czy zalogowany użytkownik nie ma jeszcze żadnych działalności (wymaga setup). */
  async isSetupNeeded(): Promise<boolean> {
    const user = await getAuthUser();
    if (!user) return false; // tryb offline – brak wizarda
    const { count } = await supabase
      .from('activities').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    return (count ?? 0) === 0;
  },

  /** Tworzy działalności wybrane w wizardzie + zawsze dodaje 'osobiste'. */
  async completeSetup(selectedKeys: string[]): Promise<void> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    const osobiste = {
      key: 'osobiste', name: 'Osobiste', icon: '🏠', color: 'gray' as Activity['color'],
      isSystem: true, isActive: true, sortOrder: 99,
    };

    const toCreate = [
      ...WIZARD_ACTIVITIES.filter(a => selectedKeys.includes(a.key)),
      osobiste,
    ];

    if (user) {
      await supabase.from('activities').insert(
        toCreate.map((a, i) => ({
          user_id:    user.id,
          key:        a.key,
          name:       a.name,
          icon:       a.icon,
          color:      a.color,
          is_system:  a.isSystem,
          is_active:  true,
          sort_order: a.sortOrder ?? i * 10,
          created_at: now,
        })),
      );
      return;
    }
    // Tryb offline – wstaw do Dexie
    await db.activities.bulkAdd(
      toCreate.map(a => ({
        key: a.key, name: a.name, icon: a.icon, color: a.color,
        isSystem: a.isSystem, isActive: true,
        sortOrder: a.sortOrder ?? 0, createdAt: now,
      })),
    );
  },
};
