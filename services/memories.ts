import { supabase } from '@/lib/supabase';
import type { Memory } from '@/lib/database.types';

export async function getMemory(id: string): Promise<Memory | null> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMemories(childId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('child_id', childId)
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createMemory(params: {
  childId: string;
  title: string;
  description?: string;
  occurredAt: string;
  tags?: string[];
  mediaUrls?: string[];
  userId?: string;
}): Promise<Memory> {
  const { data, error } = await supabase
    .from('memories')
    .insert({
      child_id: params.childId,
      title: params.title,
      description: params.description ?? null,
      occurred_at: params.occurredAt,
      tags: params.tags ?? [],
      media_urls: params.mediaUrls ?? [],
      created_by: params.userId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemory(
  id: string,
  updates: {
    title?: string;
    description?: string;
    occurred_at?: string;
    tags?: string[];
    media_urls?: string[];
  },
): Promise<Memory> {
  const { data, error } = await supabase
    .from('memories')
    .update(updates)
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
