-- Etap 3 (warstwa L1): dodatki do sera w trakcie produkcji (orzechy, popiół, wino…).
-- Uruchom w dashboardzie Supabase PRZED deployem. Idempotentne.
--
-- additives = lista dodatków [{ co, atStep, addedAt }] — JSON; dodatek NIE zmienia receptury,
-- ale pozwala nazwać wariant ("Caciotta z orzechami").

ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS additives JSONB;
