import { db } from '@/db/database';
import { supabase, getAuthUser } from '@/lib/supabase';
import type { FeedRecipe } from '@/models/feedRecipe.model';

function rowToRecipe(r: Record<string, unknown>): FeedRecipe {
  return {
    id:          r.id as number,
    name:        r.name as string,
    birdType:    r.bird_type as string,
    period:      r.period as string,
    ingredients: (r.ingredients ?? []) as FeedRecipe['ingredients'],
    costPerKg:   r.cost_per_kg as number | undefined,
    notes:       r.notes as string | undefined,
    isPublic:    r.is_public as boolean,
    authorName:  r.author_name as string | undefined,
    createdAt:   r.created_at as string,
  };
}

export const feedRecipeService = {

  // ── Moje receptury ─────────────────────────────────────────────────────────

  async getMy(): Promise<FeedRecipe[]> {
    const user = await getAuthUser();
    if (user) {
      const { data } = await supabase
        .from('feed_recipes').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return (data ?? []).map(rowToRecipe);
    }
    const all = await db.feedRecipes.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(recipe: Omit<FeedRecipe, 'id' | 'createdAt'>): Promise<number> {
    const user = await getAuthUser();
    const now = new Date().toISOString();
    if (user) {
      const { data, error } = await supabase.from('feed_recipes').insert({
        user_id:     user.id,
        name:        recipe.name,
        bird_type:   recipe.birdType,
        period:      recipe.period,
        ingredients: recipe.ingredients,
        cost_per_kg: recipe.costPerKg ?? null,
        notes:       recipe.notes ?? null,
        is_public:   recipe.isPublic,
        author_name: recipe.authorName ?? null,
        created_at:  now,
      }).select('id').single();
      if (error) throw error;
      return data.id;
    }
    return db.feedRecipes.add({ ...recipe, createdAt: now });
  },

  async update(id: number, recipe: Partial<FeedRecipe>): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      const row: Record<string, unknown> = {};
      if (recipe.name        !== undefined) row.name        = recipe.name;
      if (recipe.birdType    !== undefined) row.bird_type   = recipe.birdType;
      if (recipe.period      !== undefined) row.period      = recipe.period;
      if (recipe.ingredients !== undefined) row.ingredients = recipe.ingredients;
      if (recipe.costPerKg   !== undefined) row.cost_per_kg = recipe.costPerKg;
      if (recipe.notes       !== undefined) row.notes       = recipe.notes;
      if (recipe.isPublic    !== undefined) row.is_public   = recipe.isPublic;
      await supabase.from('feed_recipes').update(row)
        .eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.feedRecipes.update(id, recipe);
  },

  async delete(id: number): Promise<void> {
    const user = await getAuthUser();
    if (user) {
      await supabase.from('feed_recipes').delete()
        .eq('id', id).eq('user_id', user.id);
      return;
    }
    await db.feedRecipes.delete(id);
  },

  async togglePublic(id: number, isPublic: boolean): Promise<void> {
    return this.update(id, { isPublic });
  },

  // ── Społeczność – publiczne receptury ─────────────────────────────────────

  async getCommunity(): Promise<FeedRecipe[]> {
    const user = await getAuthUser();
    if (!user) return []; // społeczność tylko dla zalogowanych
    const { data } = await supabase
      .from('feed_recipes').select('*')
      .eq('is_public', true)
      .neq('user_id', user.id)   // nie pokazuj własnych
      .order('created_at', { ascending: false });
    return (data ?? []).map(rowToRecipe);
  },

  /** Kopiuje cudzą recepturę do własnych (bez flagi public). */
  async copyFromCommunity(recipe: FeedRecipe): Promise<number> {
    return this.create({
      name:        `${recipe.name} (kopia)`,
      birdType:    recipe.birdType,
      period:      recipe.period,
      ingredients: recipe.ingredients,
      costPerKg:   recipe.costPerKg,
      notes:       recipe.notes,
      isPublic:    false,
      authorName:  undefined,
    });
  },
};
