-- ============================================================
-- Fermly – Moduł Przetwórstwo Mleka (v2 — pełna migracja)
-- Uruchom całość w Supabase SQL Editor
-- ============================================================

-- 1. Dostawcy mleka
CREATE TABLE IF NOT EXISTS milk_suppliers (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT,
  pesel_or_nip  TEXT,
  phone         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Przyjęcia mleka
CREATE TABLE IF NOT EXISTS milk_receptions (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('own','purchase')),
  quantity_liters  NUMERIC(10,2) NOT NULL,
  temperature_c    NUMERIC(5,1),
  fat_percent      NUMERIC(5,2),
  supplier_id      INT REFERENCES milk_suppliers(id) ON DELETE SET NULL,
  supplier_name    TEXT,
  price_per_liter  NUMERIC(10,4),
  total_price_pln  NUMERIC(10,2),
  invoice_number   TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Alokacje (rozlew mleka na produkty)
CREATE TABLE IF NOT EXISTS milk_allocations (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reception_id      INT NOT NULL REFERENCES milk_receptions(id) ON DELETE CASCADE,
  product_type      TEXT NOT NULL,
  liters_allocated  NUMERIC(10,2) NOT NULL,
  batch_id          INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Partie produkcyjne
CREATE TABLE IF NOT EXISTS production_batches (
  id                     SERIAL PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_number           TEXT NOT NULL,
  product_type           TEXT NOT NULL,
  milk_liters            NUMERIC(10,2) NOT NULL,
  expected_yield_kg      NUMERIC(10,3) NOT NULL,
  actual_yield_kg        NUMERIC(10,3),
  status                 TEXT NOT NULL DEFAULT 'w_produkcji'
                           CHECK (status IN ('w_produkcji','dojrzewa','gotowy','sprzedany','wycofany')),
  production_date        DATE NOT NULL,
  expiry_date            DATE NOT NULL,
  quantity_remaining_kg  NUMERIC(10,3) NOT NULL,
  aging_days             INT,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Kroki workflow
CREATE TABLE IF NOT EXISTS production_steps (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id          INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  step_type         TEXT NOT NULL,
  label             TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_minutes  INT,
  temperature_c     NUMERIC(5,1),
  notes             TEXT
);

-- 6. Serwatka
CREATE TABLE IF NOT EXISTS whey_byproducts (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id          INT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  quantity_liters   NUMERIC(10,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'skarmianie'
                      CHECK (status IN ('na_rikotte','skarmianie','utylizacja')),
  ricotta_batch_id  INT,
  date              DATE NOT NULL,
  notes             TEXT
);

-- 7. Sprzedaż mleczarska (nowa struktura)
CREATE TABLE IF NOT EXISTS dairy_sales (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_date         DATE NOT NULL,
  -- Produkt (denormalizacja)
  product_id        INT,
  product_name      TEXT,
  product_category  TEXT,
  unit              TEXT NOT NULL DEFAULT 'kg',
  quantity          NUMERIC(10,3),
  unit_price_pln    NUMERIC(10,4),
  total_value_pln   NUMERIC(10,2),
  -- Nabywca (denormalizacja)
  buyer_id          INT,
  buyer_name        TEXT,
  buyer_address     TEXT,
  -- Ewidencja
  in_rhd            BOOLEAN NOT NULL DEFAULT TRUE,
  rhd_number        INT,
  rhd_year          INT,
  -- Inne
  batch_id          INT,
  invoice_number    TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Katalog produktów mleczarskich
CREATE TABLE IF NOT EXISTS dairy_products (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  unit              TEXT NOT NULL DEFAULT 'kg',
  default_price_pln NUMERIC(10,4) NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Nabywcy
CREATE TABLE IF NOT EXISTS dairy_buyers (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
  address       TEXT,
  phone         TEXT,
  nip           TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE milk_suppliers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_receptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_steps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whey_byproducts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dairy_sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dairy_products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dairy_buyers       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_only" ON milk_suppliers;
DROP POLICY IF EXISTS "user_only" ON milk_receptions;
DROP POLICY IF EXISTS "user_only" ON milk_allocations;
DROP POLICY IF EXISTS "user_only" ON production_batches;
DROP POLICY IF EXISTS "user_only" ON production_steps;
DROP POLICY IF EXISTS "user_only" ON whey_byproducts;
DROP POLICY IF EXISTS "user_only" ON dairy_sales;
DROP POLICY IF EXISTS "user_only" ON dairy_products;
DROP POLICY IF EXISTS "user_only" ON dairy_buyers;

CREATE POLICY "user_only" ON milk_suppliers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON milk_receptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON milk_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON production_batches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON production_steps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON whey_byproducts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON dairy_sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON dairy_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_only" ON dairy_buyers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indeksy dla wydajności
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_milk_receptions_user_date      ON milk_receptions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_production_batches_user_status ON production_batches(user_id, status);
CREATE INDEX IF NOT EXISTS idx_production_steps_batch         ON production_steps(batch_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_whey_byproducts_batch          ON whey_byproducts(batch_id);
CREATE INDEX IF NOT EXISTS idx_dairy_sales_user_date          ON dairy_sales(user_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_dairy_sales_rhd                ON dairy_sales(user_id, rhd_year, in_rhd);
CREATE INDEX IF NOT EXISTS idx_dairy_products_user            ON dairy_products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_dairy_buyers_user              ON dairy_buyers(user_id, name);
