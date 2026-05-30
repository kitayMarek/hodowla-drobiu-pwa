-- ============================================================
-- Fermly – Dokumenty sprzedaży (sale_documents)
-- Uruchom w Supabase SQL Editor
-- ============================================================

-- 1. Tabela nagłówków dokumentów sprzedaży
CREATE TABLE IF NOT EXISTS sale_documents (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_date        DATE NOT NULL,
  buyer_name      TEXT,
  buyer_id        INT,
  buyer_address   TEXT,
  buyer_phone     TEXT,
  in_rhd          BOOLEAN NOT NULL DEFAULT TRUE,
  rhd_number      INT,
  rhd_year        INT,
  cash_account_id INT,
  total_value_pln NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sale_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_only" ON sale_documents;
CREATE POLICY "user_only" ON sale_documents
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sale_documents_user_date
  ON sale_documents(user_id, doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_documents_rhd
  ON sale_documents(user_id, rhd_year, in_rhd);

-- 2. Powiąż istniejące tabele z dokumentem
ALTER TABLE dairy_sales ADD COLUMN IF NOT EXISTS sale_document_id INT REFERENCES sale_documents(id) ON DELETE CASCADE;
ALTER TABLE sales        ADD COLUMN IF NOT EXISTS sale_document_id INT REFERENCES sale_documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dairy_sales_document ON dairy_sales(sale_document_id);
CREATE INDEX IF NOT EXISTS idx_sales_document        ON sales(sale_document_id);
