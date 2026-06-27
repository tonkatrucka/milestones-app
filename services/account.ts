import { supabase } from '@/lib/supabase';

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');

  if (error) throw error;
}
