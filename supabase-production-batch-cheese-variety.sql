-- Etap 1 przebudowy mleczarni: odmiana sera na partii produkcyjnej.
-- Uruchom w dashboardzie Supabase PRZED deployem. Idempotentne.
--
-- cheese_variety = slug odmiany z serowarni (np. "caciotta") lub id własnego przepisu
-- cheese_name    = nazwa wyświetlana / własna ("Caciotta", "Caciotta z orzechami")

ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS cheese_variety TEXT;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS cheese_name    TEXT;
