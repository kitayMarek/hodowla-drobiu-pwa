import { supabase, getAuthUser } from '@/lib/supabase';
import type {
  FeedIngredient,
  FeedIngredientInsert,
  FeedIngredientUpdate,
  BirdType,
} from '@/types/feedIngredient';

export const feedIngredientService = {
  async getAll(): Promise<FeedIngredient[]> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FeedIngredient[];
  },

  async getAllIncludingInactive(): Promise<FeedIngredient[]> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FeedIngredient[];
  },

  async getByBirdType(birdType: BirdType): Promise<FeedIngredient[]> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .select('*')
      .eq('is_active', true)
      .filter('recommended_for', 'cs', `["${birdType}"]`)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as FeedIngredient[];
  },

  async getById(id: string): Promise<FeedIngredient> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as FeedIngredient;
  },

  async create(ingredient: FeedIngredientInsert): Promise<FeedIngredient> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .insert(ingredient)
      .select()
      .single();
    if (error) throw error;
    return data as FeedIngredient;
  },

  async update(id: string, updates: FeedIngredientUpdate): Promise<FeedIngredient> {
    const { data, error } = await supabase
      .from('feed_ingredients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FeedIngredient;
  },

  /** Soft delete — ustawia is_active = false */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('feed_ingredients')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  /** Hard delete — usuwa wiersz z bazy */
  async hardDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('feed_ingredients')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Przywróć składnik po soft delete */
  async restore(id: string): Promise<void> {
    const { error } = await supabase
      .from('feed_ingredients')
      .update({ is_active: true })
      .eq('id', id);
    if (error) throw error;
  },
};
