/**
 * Zarządzanie przypomnieniami o kopii zapasowej.
 * Przechowuje daty w localStorage (działa zarówno w trybie demo jak i zalogowanym).
 */

const KEY_LAST   = 'fermly_backup_last';
const KEY_SNOOZE = 'fermly_backup_snooze';

export const WARN_AFTER_DAYS = 30;
export const SNOOZE_DAYS     = 7;

/** Zapisz datę backupu (wywoływane po każdym eksporcie) */
export function recordBackup(): void {
  localStorage.setItem(KEY_LAST, new Date().toISOString());
  localStorage.removeItem(KEY_SNOOZE);
}

/** Odłóż przypomnienie o SNOOZE_DAYS dni */
export function snoozeReminder(): void {
  const until = new Date();
  until.setDate(until.getDate() + SNOOZE_DAYS);
  localStorage.setItem(KEY_SNOOZE, until.toISOString());
}

/** Data ostatniego backupu lub null */
export function getLastBackupDate(): Date | null {
  const s = localStorage.getItem(KEY_LAST);
  return s ? new Date(s) : null;
}

/** Ile dni minęło od ostatniego backupu, lub null jeśli nigdy */
export function getDaysSinceBackup(): number | null {
  const last = getLastBackupDate();
  if (!last) return null;
  return Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
}

/** Czy pokazać modal przypomnienia? */
export function shouldShowReminder(): boolean {
  const snooze = localStorage.getItem(KEY_SNOOZE);
  if (snooze && new Date(snooze) > new Date()) return false;

  const days = getDaysSinceBackup();
  if (days === null) return true;           // nigdy nie robiono backupu
  return days >= WARN_AFTER_DAYS;
}
