import { supabase } from '@/lib/supabase';
import { notifyTeamOfNewRecord } from '@/services/notify-team';
import type { Memory } from '@/lib/database.types';

export async function getMemories(childId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('child_id', childId)
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getMemory(id: string): Promise<Memory | null> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createMemory(params: {
  childId: string;
  title: string;
  description?: string;
  occurredAt: string;
  mediaUrls?: string[];
  tags?: string[];
  audioUrl?: string;
  isPrivate?: boolean;
  userId?: string;
}): Promise<Memory> {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      child_id: params.childId,
      title: params.title,
      description: params.description ?? null,
      occurred_at: params.occurredAt,
      media_urls: params.mediaUrls ?? [],
      tags: params.tags ?? [],
      audio_url: params.audioUrl ?? null,
      is_private: params.isPrivate ?? false,
      created_by: params.userId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  if (params.userId) {
    void notifyTeamOfNewRecord({
      childId: params.childId,
      recordType: 'memory',
      createdByUserId: params.userId,
      summary: params.title,
      recordId: data.id,
    });
  }

  return data;
}

export async function updateMemory(
  id: string,
  updates: {
    title?: string;
    description?: string | null;
    occurredAt?: string;
    mediaUrls?: string[];
    tags?: string[];
    audioUrl?: string | null;
    isPrivate?: boolean;
  },
): Promise<Memory> {
  const { data, error } = await supabase
    .from('memories')
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.occurredAt !== undefined && { occurred_at: updates.occurredAt }),
      ...(updates.mediaUrls !== undefined && { media_urls: updates.mediaUrls }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.audioUrl !== undefined && { audio_url: updates.audioUrl }),
      ...(updates.isPrivate !== undefined && { is_private: updates.isPrivate }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from('memories').delete().eq('id', id);
  if (error) throw error;
}
