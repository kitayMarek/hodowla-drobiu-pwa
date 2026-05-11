/**
 * Thin sessionStorage cache (SWR / stale-while-revalidate helper).
 *
 * Data is stored only for the duration of the browser tab — so it never
 * goes stale across logins and doesn't persist sensitive info to disk.
 *
 * Usage in a hook:
 *   const [sb, setSb] = useState<T[]>(() => cacheGet<T[]>(key) ?? []);
 *   …after fetch… setSb(data); cacheSet(key, data);
 */

const PREFIX = 'fermly_sc_';

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // sessionStorage can be full or unavailable in some private-browsing configs
  }
}

export function cacheClear(key: string): void {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch { /* noop */ }
}
