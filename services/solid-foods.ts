import { supabase } from '@/lib/supabase';
import type { FoodReaction, SolidFood } from '@/lib/database.types';

export async function getSolidFoods(childId: string): Promise<SolidFood[]> {
  const { data, error } = await supabase
    .from('solid_foods')
    .select('*')
    .eq('child_id', childId)
    .order('introduced_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addSolidFood(params: {
  childId: string;
  foodName: string;
  introducedAt: string;
  isTopAllergen: boolean;
  reaction?: FoodReaction;
  reactionNotes?: string;
  notes?: string;
  userId: string;
}): Promise<SolidFood> {
  const { data, error } = await supabase
    .from('solid_foods')
    .insert({
      child_id: params.childId,
      food_name: params.foodName.trim(),
      introduced_at: params.introducedAt,
      is_top_allergen: params.isTopAllergen,
      reaction: params.reaction ?? null,
      reaction_notes: params.reactionNotes ?? null,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSolidFood(
  id: string,
  updates: {
    reaction?: FoodReaction | null;
    reactionNotes?: string | null;
    notes?: string | null;
    isTopAllergen?: boolean;
  },
): Promise<SolidFood> {
  const { data, error } = await supabase
    .from('solid_foods')
    .update({
      ...(updates.reaction !== undefined && { reaction: updates.reaction }),
      ...(updates.reactionNotes !== undefined && { reaction_notes: updates.reactionNotes }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.isTopAllergen !== undefined && { is_top_allergen: updates.isTopAllergen }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSolidFood(id: string): Promise<void> {
  const { error } = await supabase.from('solid_foods').delete().eq('id', id);
  if (error) throw error;
}

/** Common top-14 allergens (FALCPA + UK/EU additions). */
export const TOP_ALLERGENS = [
  'Milk',
  'Eggs',
  'Peanuts',
  'Tree nuts',
  'Wheat / Gluten',
  'Soy',
  'Fish',
  'Shellfish',
  'Sesame',
  'Lupin',
  'Celery',
  'Mustard',
  'Sulphites',
  'Molluscs',
] as const;
