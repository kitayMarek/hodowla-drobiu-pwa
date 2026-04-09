import { db } from '@/db/database';
import type { SettingsKey } from '@/models/settings.model';
import { SETTINGS_DEFAULTS } from '@/models/settings.model';

export const settingsService = {
  async get<T>(key: SettingsKey, fallback?: T): Promise<T> {
    const record = await db.settings.where('key').equals(key).first();
    if (record) {
      return JSON.parse(record.value) as T;
    }
    const defaultVal = SETTINGS_DEFAULTS[key];
    return (defaultVal !== undefined ? JSON.parse(defaultVal) : fallback) as T;
  },

  async set(key: SettingsKey, value: unknown): Promise<void> {
    const existing = await db.settings.where('key').equals(key).first();
    const now = new Date().toISOString();
    if (existing?.id != null) {
      await db.settings.update(existing.id, { value: JSON.stringify(value), updatedAt: now });
    } else {
      await db.settings.add({ key, value: JSON.stringify(value), updatedAt: now });
    }
  },

  async getAll(): Promise<Record<SettingsKey, unknown>> {
    const all = await db.settings.toArray();
    const result = {} as Record<SettingsKey, unknown>;
    for (const record of all) {
      result[record.key] = JSON.parse(record.value);
    }
    // Fill defaults
    for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) {
      if (!(k in result)) {
        result[k as SettingsKey] = JSON.parse(v);
      }
    }
    return result;
  },
};
