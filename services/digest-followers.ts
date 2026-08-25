import { supabase } from '@/lib/supabase';
import type { DigestFollower } from '@/lib/database.types';

export async function getDigestFollowers(childId: string): Promise<DigestFollower[]> {
  const { data, error } = await supabase
    .from('digest_followers')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addDigestFollower(params: {
  childId: string;
  email: string;
  displayName?: string;
  frequency?: 'weekly' | 'monthly';
  contentFilter?: 'all' | 'milestones_only' | 'no_photos';
  addedBy: string;
}): Promise<DigestFollower> {
  const { data, error } = await supabase
    .from('digest_followers')
    .insert({
      child_id: params.childId,
      email: params.email.trim().toLowerCase(),
      display_name: params.displayName?.trim() ?? null,
      frequency: params.frequency ?? 'weekly',
      content_filter: params.contentFilter ?? 'all',
      added_by: params.addedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDigestFollower(
  id: string,
  updates: {
    isActive?: boolean;
    frequency?: 'weekly' | 'monthly';
    contentFilter?: 'all' | 'milestones_only' | 'no_photos';
    displayName?: string | null;
  },
): Promise<DigestFollower> {
  const { data, error } = await supabase
    .from('digest_followers')
    .update({
      ...(updates.isActive !== undefined && { is_active: updates.isActive }),
      ...(updates.frequency !== undefined && { frequency: updates.frequency }),
      ...(updates.contentFilter !== undefined && { content_filter: updates.contentFilter }),
      ...(updates.displayName !== undefined && { display_name: updates.displayName }),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeDigestFollower(id: string): Promise<void> {
  const { error } = await supabase.from('digest_followers').delete().eq('id', id);
  if (error) throw error;
}
