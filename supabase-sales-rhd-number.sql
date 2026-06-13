-- ============================================================
-- MIGRACJA: numeracja RHD dla tabeli `sales` (drób + inne)
--
-- Uruchom to w Supabase SQL Editor (jednorazowo).
-- Wszystkie polecenia są idempotentne – bezpieczne do ponownego uruchomienia.
--
-- Co to dodaje:
-- 1. Kolumny rhd_number / rhd_year w tabeli `sales` — kolejny numer
--    wpisu w rocznej ewidencji RHD (wspólna sekwencja z dairy_sales
--    i sale_documents, nadawana przez aplikację przy zapisie).
-- 2. Indeks dla zapytań o max numer w roku.
-- ============================================================

-- ── 1. Kolumny numeracji RHD w tabeli sales ─────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS rhd_number INT,
  ADD COLUMN IF NOT EXISTS rhd_year   INT;

-- ── 2. Indeks dla wydajności (wyznaczanie kolejnego numeru) ─
CREATE INDEX IF NOT EXISTS idx_sales_rhd
  ON sales(user_id, rhd_year, in_rhd);
