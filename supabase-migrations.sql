-- ============================================================
-- Fermly – migracje uzupełniające (uruchom po supabase-schema.sql)
-- Wszystkie polecenia są idempotentne (IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. UBÓJ – slaughter_records
--    Schemat bazowy ma inne nazwy kolumn niż oczekuje serwis.
--    Dodajemy brakujące kolumny.
-- ────────────────────────────────────────────────────────────
ALTER TABLE slaughter_records
  ADD COLUMN IF NOT EXISTS age_at_slaughter_days     INTEGER,
  ADD COLUMN IF NOT EXISTS live_weight_total_kg      NUMERIC,
  ADD COLUMN IF NOT EXISTS carcass_weight_total_kg   NUMERIC,
  ADD COLUMN IF NOT EXISTS condemned_count           INTEGER,
  ADD COLUMN IF NOT EXISTS condemned_weight_kg       NUMERIC,
  ADD COLUMN IF NOT EXISTS slaughter_house_id        TEXT,
  ADD COLUMN IF NOT EXISTS price_per_kg_pln          NUMERIC,
  ADD COLUMN IF NOT EXISTS total_revenue_pln         NUMERIC;

-- ────────────────────────────────────────────────────────────
-- 2. SPRZEDAŻ – sales
--    Dodaj in_rhd, source_type, source_id
-- ────────────────────────────────────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS in_rhd      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id   INTEGER;

-- ────────────────────────────────────────────────────────────
-- 3. TRANSAKCJE KASOWE – cash_transactions
--    Dodaj source_type, source_id (do deleteBySource)
-- ────────────────────────────────────────────────────────────
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id   INTEGER;

-- ────────────────────────────────────────────────────────────
-- 4. ZDARZENIA FINANSOWE – financial_events
--    Dodaj cash_transaction_id (do kaskadowego usuwania)
-- ────────────────────────────────────────────────────────────
ALTER TABLE financial_events
  ADD COLUMN IF NOT EXISTS cash_transaction_id INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at          TEXT;

-- ────────────────────────────────────────────────────────────
-- 5. SPRZEDAŻ – sales (Realtime policy)
--    Polityka bazowa nie ma WITH CHECK – poprawka
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_sales" ON sales;
CREATE POLICY "own_sales" ON sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_slaughter_records" ON slaughter_records;
CREATE POLICY "own_slaughter_records" ON slaughter_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_cash_transactions" ON cash_transactions;
CREATE POLICY "own_cash_transactions" ON cash_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_financial_events" ON financial_events;
CREATE POLICY "own_financial_events" ON financial_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 6. DZIAŁALNOŚCI – activities (dodana w v16 Dexie, może nie istnieć)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key        TEXT NOT NULL,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  is_system  BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(user_id, key)
);
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_activities" ON activities;
CREATE POLICY "own_activities" ON activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 7. PRZESUNIĘCIA WEWNĘTRZNE – internal_transfers (v17 Dexie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_transfers (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        TEXT NOT NULL,
  from_scope  TEXT NOT NULL,
  to_scope    TEXT NOT NULL,
  amount_pln  NUMERIC NOT NULL,
  description TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);
ALTER TABLE internal_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_internal_transfers" ON internal_transfers;
CREATE POLICY "own_internal_transfers" ON internal_transfers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 8. RECEPTURY PASZ – feed_recipes (v15 Dexie)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_recipes (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  bird_type    TEXT,
  ingredients  TEXT,
  notes        TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT false,
  created_at   TEXT NOT NULL
);
ALTER TABLE feed_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_feed_recipes" ON feed_recipes;
CREATE POLICY "own_feed_recipes" ON feed_recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
