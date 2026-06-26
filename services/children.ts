import { supabase } from '@/lib/supabase';
import type { Child } from '@/lib/database.types';

export async function updateChild(
  childId: string,
  updates: { name?: string; date_of_birth?: string },
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
