import { supabase } from '@/lib/supabase';
import type { Child } from '@/lib/database.types';

export async function updateChild(
  childId: string,
  updates: { name?: string; date_of_birth?: string; avatar_url?: string | null },
): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .update(updates)
    .eq('id', childId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteChild(childId: string): Promise<void> {
  const { error } = await supabase.from('children').delete().eq('id', childId);

  if (error) throw error;
}
