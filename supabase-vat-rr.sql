-- ============================================================
-- Fermly – Faktura VAT RR (vat_rr_invoices + vat_rr_lines)
-- Uruchom w Supabase SQL Editor PRZED deployem.
--
-- Model domenowy: rolnik ryczałtowy (właściciel gospodarstwa = DOSTAWCA)
-- sprzedaje produkty rolne czynnemu podatnikowi VAT (NABYWCA = odbiorca,
-- reuse `dairy_buyers`). Fermly generuje PROJEKT dokumentu — numer faktury
-- nadaje nabywca. Dane dostawcy pochodzą z `settings` (klucze vat_rr_*).
-- Kwoty pieniężne przechowywane w GROSZACH jako BIGINT (arytmetyka całkowita).
-- Faktura po opłaceniu wpina się we wspólną roczną numerację RHD.
-- ============================================================

-- 1. Nagłówki faktur ------------------------------------------------
CREATE TABLE IF NOT EXISTS vat_rr_invoices (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  buyer_id         INT,                    -- reuse dairy_buyers (nabywca), FK opcjonalny
  buyer_name       TEXT,                   -- snapshot na moment wystawienia
  buyer_address    TEXT,
  buyer_nip        TEXT,

  doc_ref          TEXT NOT NULL,          -- wewnętrzna referencja dostawcy, np. RR/2026/0007
  invoice_number   TEXT,                   -- NUMER FAKTURY nadaje NABYWCA; NULL = projekt
  purchase_date    DATE NOT NULL,          -- data dokonania nabycia
  issue_date       DATE,                   -- data wystawienia (nadaje nabywca)

  net_total_gr     BIGINT NOT NULL DEFAULT 0,   -- grosze
  flat_rate_pct    NUMERIC(4,2) NOT NULL DEFAULT 7.00,
  flat_rate_gr     BIGINT NOT NULL DEFAULT 0,    -- zryczałtowany zwrot, grosze
  gross_total_gr   BIGINT NOT NULL DEFAULT 0,    -- grosze

  payment_method   TEXT NOT NULL DEFAULT 'transfer'
                   CHECK (payment_method IN ('transfer','cash')),
  paid_at          DATE,
  payment_ref      TEXT,

  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','printed','numbered','paid','void')),

  in_rhd           BOOLEAN NOT NULL DEFAULT TRUE,
  rhd_number       INT,
  rhd_year         INT,
  cash_account_id  INT,

  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vat_rr_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON vat_rr_invoices;
CREATE POLICY "user_only" ON vat_rr_invoices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vat_rr_invoices_user_date
  ON vat_rr_invoices(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_vat_rr_invoices_rhd
  ON vat_rr_invoices(user_id, rhd_year, in_rhd);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_rr_invoices_ref
  ON vat_rr_invoices(user_id, doc_ref);

-- 2. Pozycje faktury -----------------------------------------------
CREATE TABLE IF NOT EXISTS vat_rr_lines (
  id             SERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id     INT NOT NULL REFERENCES vat_rr_invoices(id) ON DELETE CASCADE,
  position       INT NOT NULL,
  product_id     INT,                      -- opcjonalny prefill z dairy_products
  product_name   TEXT NOT NULL,
  quality_class  TEXT,                     -- opis klasy lub jakości (art. 116 ust. 2)
  unit           TEXT NOT NULL,            -- 'kg' | 'szt' | 'L' | 'opak'
  quantity_milli BIGINT NOT NULL,          -- ilość × 1000
  unit_price_gr  BIGINT NOT NULL,          -- cena netto w groszach
  net_value_gr   BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vat_rr_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON vat_rr_lines;
CREATE POLICY "user_only" ON vat_rr_lines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vat_rr_lines_invoice ON vat_rr_lines(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_rr_lines_invoice_pos
  ON vat_rr_lines(invoice_id, position);
