import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/database.types';

export const MAX_CHAT_PHOTOS = 5;

export function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayStartIso(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function dayEndIso(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number);
  // Day + 1, JS Date normalises month rollover automatically
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
}

export async function getChatMessagesForDay(childId: string, date: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('child_id', childId)
    .gte('created_at', dayStartIso(date))
    .lt('created_at', dayEndIso(date))
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Returns the created_at timestamp of the most recent message before the start of `localDate`, or null if none. */
export async function getOldestMsgBeforeDay(
  childId: string,
  localDate: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('child_id', childId)
    .lt('created_at', dayStartIso(localDate))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.created_at ?? null;
}

/** Returns the N most recent messages in chronological order — for Claude API context only. */
export async function getRecentChatContext(
  childId: string,
  limit = 10,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}

export async function saveChatMessage(
  childId: string,
  role: 'user' | 'assistant',
  content: string,
  mediaUrls: string[] = [],
): Promise<ChatMessage> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw authError ?? new Error('Not signed in');

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      child_id: childId,
      user_id: user.id,
      role,
      content,
      media_urls: mediaUrls,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
