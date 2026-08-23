import { supabase } from '@/lib/supabase';
import type { FirstWord } from '@/lib/database.types';

export async function getFirstWords(childId: string): Promise<FirstWord[]> {
  const { data, error } = await supabase
    .from('first_words')
    .select('*')
    .eq('child_id', childId)
    .order('said_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addFirstWord(params: {
  childId: string;
  word: string;
  phonetic?: string;
  saidAt?: string;
  notes?: string;
  userId: string;
}): Promise<FirstWord> {
  const { data, error } = await supabase
    .from('first_words')
    .insert({
      child_id: params.childId,
      word: params.word.trim(),
      phonetic: params.phonetic?.trim() ?? null,
      said_at: params.saidAt ?? new Date().toISOString().split('T')[0],
      notes: params.notes?.trim() ?? null,
      created_by: params.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFirstWord(id: string): Promise<void> {
  const { error } = await supabase.from('first_words').delete().eq('id', id);
  if (error) throw error;
}
