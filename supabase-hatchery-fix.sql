-- ============================================================
-- FIX WYLĘGARNIA — uzupełnia kolumny, których wymaga kod
-- Uruchom w Supabase SQL Editor (idempotentne — ADD COLUMN IF NOT EXISTS).
--
-- Przyczyna: tabele incubations i incubation_egg_groups powstały
-- ze starego schematu (supabase-schema.sql), a kod wylęgarni
-- zapisuje bogatszy zestaw pól (parametry inkubacji, świetlenie,
-- wyniki wylęgu, powiązanie z magazynem jaj i ze stadem).
-- Brak kolumn → PostgREST odrzuca INSERT → „Błąd zapisu".
-- ============================================================

-- ── Tabela: incubations ──────────────────────────────────────
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS total_days              INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS lockdown_day            INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS incubation_temp_c       NUMERIC;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS incubation_humidity_pct NUMERIC;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS lockdown_temp_c         NUMERIC;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS lockdown_humidity_pct   NUMERIC;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS candling_date           TEXT;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS candling_fertile_count   INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS candling_infertile_count INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS candling_not_developed   INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS hatch_date              TEXT;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS total_hatched           INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS total_unhatched         INTEGER;
ALTER TABLE incubations ADD COLUMN IF NOT EXISTS result_batch_id         INTEGER;

-- ── Tabela: incubation_egg_groups ────────────────────────────
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS breed                  TEXT;
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS hatching_egg_lot_id    INTEGER;
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS candling_fertile       INTEGER;
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS candling_infertile     INTEGER;
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS candling_not_developed INTEGER;
ALTER TABLE incubation_egg_groups ADD COLUMN IF NOT EXISTS notes                  TEXT;

-- ── Przeładuj cache schematu PostgREST ───────────────────────
NOTIFY pgrst, 'reload schema';

-- ── Weryfikacja (opcjonalnie) ────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'incubations' ORDER BY column_name;
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'incubation_egg_groups' ORDER BY column_name;
