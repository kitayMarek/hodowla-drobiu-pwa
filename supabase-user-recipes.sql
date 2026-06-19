-- Etap 3 (L2): własne przepisy usera — fork z faktycznego przebiegu produkcji.
-- Uruchom w dashboardzie Supabase PRZED deployem. Idempotentne.
--
-- recipe = pełny obiekt przepisu (schemat recipe.schema, zrodlo: 'fermly-spolecznosc')
-- status = prywatny | zgloszony | zatwierdzony | odrzucony (domyślnie prywatny)

CREATE TABLE IF NOT EXISTS user_recipes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prywatny',
  recipe JSONB NOT NULL,
  batch_id INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "user_only" ON user_recipes FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
