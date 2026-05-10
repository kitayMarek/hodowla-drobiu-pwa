-- ============================================================
-- Fermly – schemat bazy danych Supabase
-- Wklej do: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- STADA (Batches)
CREATE TABLE IF NOT EXISTS batches (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  species              TEXT NOT NULL,
  breed                TEXT,
  status               TEXT NOT NULL DEFAULT 'active',
  start_date           TEXT NOT NULL,
  planned_end_date     TEXT,
  actual_end_date      TEXT,
  initial_count        INTEGER NOT NULL,
  initial_weight_grams INTEGER,
  source_type          TEXT,
  chick_cost_per_unit  NUMERIC,
  transport_cost       NUMERIC,
  housing_id           TEXT,
  notes                TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_batches" ON batches FOR ALL USING (auth.uid() = user_id);

-- WPISY DZIENNE (Daily Entries)
CREATE TABLE IF NOT EXISTS daily_entries (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id             INTEGER NOT NULL,
  date                 TEXT NOT NULL,
  dead_count           INTEGER NOT NULL DEFAULT 0,
  culled_count         INTEGER NOT NULL DEFAULT 0,
  feed_consumed_kg     NUMERIC,
  feed_type_id         INTEGER,
  water_liters         NUMERIC,
  eggs_collected       INTEGER,
  eggs_defective       INTEGER,
  sample_weight_grams  NUMERIC,
  sample_size          INTEGER,
  temperature_celsius  NUMERIC,
  humidity             NUMERIC,
  notes                TEXT,
  created_at           TEXT NOT NULL
);
ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_daily_entries" ON daily_entries FOR ALL USING (auth.uid() = user_id);

-- TYPY PASZY (Feed Types)
CREATE TABLE IF NOT EXISTS feed_types (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  phase            TEXT,
  manufacturer     TEXT,
  protein_percent  NUMERIC,
  energy_mj_kg     NUMERIC,
  price_per_kg     NUMERIC NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  recipe_notes     TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
ALTER TABLE feed_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_feed_types" ON feed_types FOR ALL USING (auth.uid() = user_id);

-- DOSTAWY PASZY (Feed Deliveries)
CREATE TABLE IF NOT EXISTS feed_deliveries (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_type_id     INTEGER NOT NULL,
  delivery_date    TEXT NOT NULL,
  quantity_kg      NUMERIC NOT NULL,
  invoice_number   TEXT,
  supplier_name    TEXT,
  total_cost_pln   NUMERIC NOT NULL,
  notes            TEXT,
  created_at       TEXT NOT NULL
);
ALTER TABLE feed_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_feed_deliveries" ON feed_deliveries FOR ALL USING (auth.uid() = user_id);

-- ZUŻYCIE PASZY (Feed Consumptions)
CREATE TABLE IF NOT EXISTS feed_consumptions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id     INTEGER NOT NULL,
  feed_type_id INTEGER NOT NULL,
  date         TEXT NOT NULL,
  consumed_kg  NUMERIC NOT NULL,
  created_at   TEXT NOT NULL
);
ALTER TABLE feed_consumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_feed_consumptions" ON feed_consumptions FOR ALL USING (auth.uid() = user_id);

-- WARUNKI UTRZYMANIA (Housing)
CREATE TABLE IF NOT EXISTS housing (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id          INTEGER NOT NULL,
  record_date       TEXT NOT NULL,
  temperature_min   NUMERIC,
  temperature_max   NUMERIC,
  humidity_percent  NUMERIC,
  ventilation       TEXT,
  lighting_hours    NUMERIC,
  stocking_density  NUMERIC,
  notes             TEXT,
  created_at        TEXT NOT NULL
);
ALTER TABLE housing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_housing" ON housing FOR ALL USING (auth.uid() = user_id);

-- ZDARZENIA ZDROWOTNE (Health Events)
CREATE TABLE IF NOT EXISTS health_events (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id         INTEGER NOT NULL,
  event_date       TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  description      TEXT NOT NULL,
  severity         TEXT,
  affected_count   INTEGER,
  treatment        TEXT,
  cost_pln         NUMERIC,
  vet_name         TEXT,
  created_at       TEXT NOT NULL
);
ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_health_events" ON health_events FOR ALL USING (auth.uid() = user_id);

-- WAŻENIA (Weighings)
CREATE TABLE IF NOT EXISTS weighings (
  id                     BIGSERIAL PRIMARY KEY,
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id               INTEGER NOT NULL,
  weighing_date          TEXT NOT NULL,
  age_at_weighing_days   INTEGER,
  method                 TEXT,
  sample_size            INTEGER,
  average_weight_grams   NUMERIC NOT NULL,
  min_weight_grams       NUMERIC,
  max_weight_grams       NUMERIC,
  notes                  TEXT,
  created_at             TEXT NOT NULL
);
ALTER TABLE weighings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_weighings" ON weighings FOR ALL USING (auth.uid() = user_id);

-- UBÓJ (Slaughter Records)
CREATE TABLE IF NOT EXISTS slaughter_records (
  id                          BIGSERIAL PRIMARY KEY,
  user_id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id                    INTEGER NOT NULL,
  slaughter_date              TEXT NOT NULL,
  birds_slaughtered           INTEGER NOT NULL,
  average_live_weight_grams   NUMERIC,
  average_carcass_weight_grams NUMERIC,
  dressing_percent            NUMERIC,
  slaughter_cost_pln          NUMERIC,
  notes                       TEXT,
  created_at                  TEXT NOT NULL
);
ALTER TABLE slaughter_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_slaughter_records" ON slaughter_records FOR ALL USING (auth.uid() = user_id);

-- SPRZEDAŻ (Sales)
CREATE TABLE IF NOT EXISTS sales (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id          INTEGER NOT NULL,
  sale_date         TEXT NOT NULL,
  sale_type         TEXT NOT NULL,
  eggs_count        INTEGER,
  egg_price_pln     NUMERIC,
  bird_count        INTEGER,
  weight_kg         NUMERIC,
  price_per_kg_pln  NUMERIC,
  total_revenue_pln NUMERIC NOT NULL,
  buyer_name        TEXT,
  invoice_number    TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sales" ON sales FOR ALL USING (auth.uid() = user_id);

-- KOSZTY / WYDATKI (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id     INTEGER,
  expense_date TEXT NOT NULL,
  category     TEXT NOT NULL,
  description  TEXT,
  amount_pln   NUMERIC NOT NULL,
  created_at   TEXT NOT NULL
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_expenses" ON expenses FOR ALL USING (auth.uid() = user_id);

-- INWESTYCJE (Investments)
CREATE TABLE IF NOT EXISTS investments (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL,
  purchase_date        TEXT NOT NULL,
  purchase_price_pln   NUMERIC NOT NULL,
  useful_life_years    INTEGER,
  residual_value_pln   NUMERIC,
  description          TEXT,
  created_at           TEXT NOT NULL
);
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_investments" ON investments FOR ALL USING (auth.uid() = user_id);

-- ZAMÓWIENIA (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id        INTEGER,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT,
  planned_date    TEXT NOT NULL,
  sale_type       TEXT NOT NULL,
  quantity        INTEGER NOT NULL,
  unit            TEXT,
  price_per_unit  NUMERIC,
  status          TEXT NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_orders" ON orders FOR ALL USING (auth.uid() = user_id);

-- WYLĘGARNIA – wsady inkubacji (Incubations)
CREATE TABLE IF NOT EXISTS incubations (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                TEXT NOT NULL,
  start_date          TEXT NOT NULL,
  expected_hatch_date TEXT,
  actual_hatch_date   TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  notes               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
ALTER TABLE incubations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_incubations" ON incubations FOR ALL USING (auth.uid() = user_id);

-- GRUPY JAJ W WYLĘGARNI (Incubation Egg Groups)
CREATE TABLE IF NOT EXISTS incubation_egg_groups (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  incubation_id   INTEGER NOT NULL,
  species         TEXT NOT NULL,
  count           INTEGER NOT NULL,
  fertile_count   INTEGER,
  hatched_count   INTEGER,
  source_batch_id INTEGER,
  created_at      TEXT NOT NULL
);
ALTER TABLE incubation_egg_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_incubation_egg_groups" ON incubation_egg_groups FOR ALL USING (auth.uid() = user_id);

-- PRZESUNIĘCIA PTAKÓW (Bird Transfers)
CREATE TABLE IF NOT EXISTS bird_transfers (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transfer_date   TEXT NOT NULL,
  from_batch_id   INTEGER,
  to_batch_id     INTEGER,
  count           INTEGER NOT NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL
);
ALTER TABLE bird_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_bird_transfers" ON bird_transfers FOR ALL USING (auth.uid() = user_id);

-- MAGAZYN JAJ WYLĘGOWYCH (Hatching Egg Lots)
CREATE TABLE IF NOT EXISTS hatching_egg_lots (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_date            TEXT NOT NULL,
  species               TEXT NOT NULL,
  count                 INTEGER NOT NULL,
  source_type           TEXT NOT NULL,
  source_batch_id       INTEGER,
  egg_hatch_transfer_id INTEGER,
  notes                 TEXT,
  created_at            TEXT NOT NULL
);
ALTER TABLE hatching_egg_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_hatching_egg_lots" ON hatching_egg_lots FOR ALL USING (auth.uid() = user_id);

-- ZAKUPY JAJ (Egg Purchases)
CREATE TABLE IF NOT EXISTS egg_purchases (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  purchase_date TEXT NOT NULL,
  species       TEXT NOT NULL,
  count         INTEGER NOT NULL,
  price_per_egg NUMERIC,
  supplier      TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL
);
ALTER TABLE egg_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_egg_purchases" ON egg_purchases FOR ALL USING (auth.uid() = user_id);

-- PRZEKAZANIA JAJ DO WYLĘGU (Egg Hatch Transfers)
CREATE TABLE IF NOT EXISTS egg_hatch_transfers (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transfer_date         TEXT NOT NULL,
  source_batch_id       INTEGER,
  hatching_egg_lot_id   INTEGER,
  count                 INTEGER NOT NULL,
  notes                 TEXT,
  created_at            TEXT NOT NULL
);
ALTER TABLE egg_hatch_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_egg_hatch_transfers" ON egg_hatch_transfers FOR ALL USING (auth.uid() = user_id);

-- KONTA KASOWE (Cash Accounts)
CREATE TABLE IF NOT EXISTS cash_accounts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  scope           TEXT NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  currency        TEXT NOT NULL DEFAULT 'PLN',
  created_at      TEXT NOT NULL
);
ALTER TABLE cash_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cash_accounts" ON cash_accounts FOR ALL USING (auth.uid() = user_id);

-- TRANSAKCJE KASOWE (Cash Transactions)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id    INTEGER NOT NULL,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL,
  scope         TEXT NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  amount_pln    NUMERIC NOT NULL,
  to_account_id INTEGER,
  notes         TEXT,
  created_at    TEXT NOT NULL
);
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cash_transactions" ON cash_transactions FOR ALL USING (auth.uid() = user_id);

-- KATEGORIE TRANSAKCJI (Cash Categories)
CREATE TABLE IF NOT EXISTS cash_categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT NOT NULL,
  scope      TEXT,
  type       TEXT,
  is_system  BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL
);
ALTER TABLE cash_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cash_categories" ON cash_categories FOR ALL USING (auth.uid() = user_id);

-- ZDARZENIA FINANSOWE (Financial Events)
CREATE TABLE IF NOT EXISTS financial_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        TEXT NOT NULL,
  type        TEXT NOT NULL,
  amount_pln  NUMERIC NOT NULL,
  description TEXT NOT NULL,
  scope       TEXT NOT NULL,
  category    TEXT NOT NULL,
  status      TEXT,
  source_type TEXT,
  source_id   INTEGER,
  created_at  TEXT NOT NULL
);
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_financial_events" ON financial_events FOR ALL USING (auth.uid() = user_id);

-- ZDJĘCIA STAD (Batch Photos)
CREATE TABLE IF NOT EXISTS batch_photos (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id    INTEGER NOT NULL,
  photo_date  TEXT NOT NULL,
  description TEXT,
  data_url    TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
ALTER TABLE batch_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_batch_photos" ON batch_photos FOR ALL USING (auth.uid() = user_id);

-- USTAWIENIA (Settings)
CREATE TABLE IF NOT EXISTS settings (
  id      BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL,
  UNIQUE(user_id, key)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_settings" ON settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Włącz Realtime dla kluczowych tabel
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE batches;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE feed_consumptions;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_categories;
