import { supabase } from '@/lib/supabase';
import type { TimeCapsule } from '@/lib/database.types';

export async function getTimeCapsules(childId: string): Promise<TimeCapsule[]> {
  const { data, error } = await supabase
    .from('time_capsules')
    .select('*')
    .eq('child_id', childId)
    .order('unlock_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTimeCapsule(params: {
  childId: string;
  title: string;
  body: string;
  unlockAt: string;
  mediaUrls?: string[];
  audioUrl?: string;
  userId: string;
}): Promise<TimeCapsule> {
  const { data, error } = await supabase
    .from('time_capsules')
    .insert({
      child_id: params.childId,
      title: params.title.trim(),
      body: params.body.trim(),
      unlock_at: params.unlockAt,
      media_urls: params.mediaUrls ?? [],
      audio_url: params.audioUrl ?? null,
      created_by: params.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markTimeCapsuleOpened(id: string): Promise<TimeCapsule> {
  const { data, error } = await supabase
    .from('time_capsules')
    .update({ unlocked_at: new Date().toISOString() })
    .eq('id', id)
    .is('unlocked_at', null)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimeCapsule(id: string): Promise<void> {
  const { error } = await supabase.from('time_capsules').delete().eq('id', id);
  if (error) throw error;
}
