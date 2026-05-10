import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

/** Zwraca aktualnie zalogowanego użytkownika lub null */
export async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
