import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { settingsService } from '@/services/settings.service';
import type { SettingsKey } from '@/models/settings.model';
import { SETTINGS_DEFAULTS } from '@/models/settings.model';

export function useSettings(): Record<SettingsKey, unknown> {
  return useLiveQuery(async () => {
    return settingsService.getAll();
  }, []) ?? (Object.fromEntries(
    Object.entries(SETTINGS_DEFAULTS).map(([k, v]) => [k, JSON.parse(v)])
  ) as Record<SettingsKey, unknown>);
}

export function useSetting<T>(key: SettingsKey, fallback?: T): T {
  return useLiveQuery(
    () => settingsService.get<T>(key, fallback),
    [key]
  ) ?? (fallback as T);
}
