-- Etap 2 przebudowy mleczarni: okno produkcji (runner) + kroki z przepisu serowarni.
-- Uruchom w dashboardzie Supabase PRZED deployem. Idempotentne.
--
-- description        = pełny opis kroku (z przepisu)
-- hint               = wskazówka „co pilnować"
-- end_condition      = warunek końca kroku po STANIE (np. „pH 6,1", „czysty rozłam")
-- started_at         = kiedy serowar kliknął „Start" (timer)
-- actual_duration_min = faktyczny czas trwania kroku (pod fork do własnego przepisu, Etap 3)

ALTER TABLE production_steps ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE production_steps ADD COLUMN IF NOT EXISTS hint                TEXT;
ALTER TABLE production_steps ADD COLUMN IF NOT EXISTS end_condition       TEXT;
ALTER TABLE production_steps ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;
ALTER TABLE production_steps ADD COLUMN IF NOT EXISTS actual_duration_min INT;
