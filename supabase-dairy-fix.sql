-- ============================================================
-- Fermly – naprawa dairy_sales i powiązanych tabel
-- Uruchom jeśli zapis sprzedaży mleczarskiej nie działa.
-- Wszystkie polecenia są idempotentne (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── 1. dairy_sales – dodaj brakujące kolumny ────────────────
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS product_id        INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS product_name      TEXT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS product_category  TEXT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS unit              TEXT DEFAULT 'kg';
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS quantity          NUMERIC(10,3);
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS unit_price_pln    NUMERIC(10,4);
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS total_value_pln   NUMERIC(10,2);
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS buyer_id          INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS buyer_name        TEXT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS buyer_address     TEXT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS rhd_number        INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS rhd_year          INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS batch_id          INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS cash_account_id   INT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS invoice_number    TEXT;
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS notes             TEXT;

-- ── 2. dairy_sales – usuń NOT NULL z batch_id jeśli istnieje ──
-- (stara wersja migracji miała batch_id NOT NULL, nowa go nie wymaga)
DO $$
BEGIN
  ALTER TABLE dairy_sales ALTER COLUMN batch_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;  -- ignoruj jeśli już nullable
END $$;

-- Usuń też klucz obcy na batch_id jeśli istnieje (batch jest opcjonalny)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT constraint_name INTO cname
  FROM information_schema.table_constraints
  WHERE table_name = 'dairy_sales'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%batch%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dairy_sales DROP CONSTRAINT ' || cname;
  END IF;
END $$;

-- ── 3. Katalog produktów mleczarskich ───────────────────────
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
ALTER TABLE dairy_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON dairy_products;
CREATE POLICY "user_only" ON dairy_products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 4. Nabywcy ───────────────────────────────────────────────
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
ALTER TABLE dairy_buyers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON dairy_buyers;
CREATE POLICY "user_only" ON dairy_buyers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 5. RLS na dairy_sales ────────────────────────────────────
ALTER TABLE dairy_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON dairy_sales;
CREATE POLICY "user_only" ON dairy_sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 6. Indeksy ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dairy_sales_rhd
  ON dairy_sales(user_id, rhd_year, in_rhd);
CREATE INDEX IF NOT EXISTS idx_dairy_products_user
  ON dairy_products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_dairy_buyers_user
  ON dairy_buyers(user_id, name);
