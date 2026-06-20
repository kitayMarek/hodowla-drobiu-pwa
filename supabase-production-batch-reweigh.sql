-- Etap 4: dojrzewalnia = magazyn, stan szacunkowy wagi + przeważanie.
-- Uruchom w dashboardzie Supabase PRZED deployem. Idempotentne.
--
-- last_weighed_at / last_weighed_kg = ostatnie realne przeważenie partii w dojrzewalni;
-- od tego momentu stan szacunkowy liczony jest dalej krzywą ubytku wagi.

ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS last_weighed_at DATE;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS last_weighed_kg NUMERIC;
