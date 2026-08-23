import { supabase } from '@/lib/supabase';
import type { ParentCheckin } from '@/lib/database.types';

export async function getTodayCheckin(
  userId: string,
  childId: string,
): Promise<ParentCheckin | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('parent_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('child_id', childId)
    .eq('checked_in_at', today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentCheckins(
  userId: string,
  childId: string,
  days = 30,
): Promise<ParentCheckin[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('parent_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('child_id', childId)
    .gte('checked_in_at', since.toISOString().split('T')[0])
    .order('checked_in_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertCheckin(params: {
  userId: string;
  childId: string;
  moodScore: number;
  energyScore: number;
  sleepScore: number;
  note?: string;
}): Promise<ParentCheckin> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('parent_checkins')
    .upsert(
      {
        user_id: params.userId,
        child_id: params.childId,
        checked_in_at: today,
        mood_score: params.moodScore,
        energy_score: params.energyScore,
        sleep_score: params.sleepScore,
        note: params.note ?? null,
      },
      { onConflict: 'user_id,child_id,checked_in_at' },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}
