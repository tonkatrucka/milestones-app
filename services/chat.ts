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

/** Fetch specific chat messages by id, in chronological order. */
export async function getChatMessagesByIds(
  childId: string,
  ids: string[],
): Promise<ChatMessage[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('child_id', childId)
    .in('id', ids)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface SendChatMessageArgs {
  childId: string;
  childName: string;
  childDob: string;
  message: string;
}

export interface SendChatMessageResult {
  content: string | null;
  loggedEvents: Record<string, unknown>[];
}

/**
 * One-shot send used by the quick voice/text log sheet. Unlike `useChat`, this
 * does not batch or stream — it persists the exchange and returns the reply.
 */
export async function sendChatMessage({
  childId,
  childName,
  childDob,
  message,
}: SendChatMessageArgs): Promise<SendChatMessageResult> {
  await saveChatMessage(childId, 'user', message, []);

  const contextMessages = await getRecentChatContext(childId, 10).catch(() => []);

  const { data, error } = await supabase.functions.invoke('chat', {
    body: {
      messages: [{ role: 'user', content: message }],
      contextMessages: contextMessages
        .filter((m) => m.content !== message)
        .map((m) => ({ role: m.role, content: m.content })),
      attachedMediaUrls: [],
      child: { id: childId, name: childName, date_of_birth: childDob },
      currentDate: localDateString(),
    },
  });

  if (error) throw error;

  const content: string | null = data?.content ?? null;
  if (content) {
    await saveChatMessage(childId, 'assistant', content, []).catch(() => {});
  }

  return {
    content,
    loggedEvents: (data?.loggedEvents ?? []) as Record<string, unknown>[],
  };
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
