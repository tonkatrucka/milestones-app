import { supabase } from '@/lib/supabase';
import { updateMemory } from '@/services/memories';
import { updateMilestone } from '@/services/milestones';
import { MAX_CHAT_PHOTOS } from '@/services/chat';

const LINK_WINDOW_MS = 2 * 60_000;
const BACKFILL_WINDOW_MS = 5 * 60_000;

/** Collect public photo URLs from batch user chat messages. */
export function photoUrlsFromBatchMessages(
  messages: { role: string; media_urls: string[] }[],
): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .flatMap((m) => m.media_urls)
    .filter(Boolean)
    .slice(0, MAX_CHAT_PHOTOS);
}

/**
 * After the chat edge function runs, attach batch photos to the most recently
 * created memory/milestone if it was saved without media (safety net when the
 * deployed function hasn't picked up batchMediaUrls yet).
 */
export async function linkChatPhotosToRecentRecords(
  childId: string,
  photoUrls: string[],
): Promise<void> {
  if (photoUrls.length === 0) return;

  const since = new Date(Date.now() - LINK_WINDOW_MS).toISOString();
  const urls = photoUrls.slice(0, MAX_CHAT_PHOTOS);

  const [{ data: memory }, { data: milestone }] = await Promise.all([
    supabase
      .from('memories')
      .select('id, media_urls')
      .eq('child_id', childId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('milestones')
      .select('id, media_urls')
      .eq('child_id', childId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (memory && memory.media_urls.length === 0) {
    await updateMemory(memory.id, { media_urls: urls });
  }
  if (milestone && milestone.media_urls.length === 0) {
    await updateMilestone(milestone.id, { media_urls: urls });
  }
}

async function findChatPhotoNear(
  childId: string,
  anchorIso: string,
): Promise<string[] | null> {
  const anchor = new Date(anchorIso).getTime();
  const windowStart = new Date(anchor - BACKFILL_WINDOW_MS).toISOString();
  const windowEnd = new Date(anchor + BACKFILL_WINDOW_MS).toISOString();

  const { data: chatMsgs } = await supabase
    .from('chat_messages')
    .select('media_urls, created_at')
    .eq('child_id', childId)
    .eq('role', 'user')
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd);

  if (!chatMsgs?.length) return null;

  let best: { urls: string[]; delta: number } | null = null;
  for (const msg of chatMsgs) {
    if (!msg.media_urls?.length) continue;
    const delta = Math.abs(new Date(msg.created_at).getTime() - anchor);
    if (!best || delta < best.delta) {
      best = { urls: msg.media_urls.slice(0, MAX_CHAT_PHOTOS), delta: delta };
    }
  }
  return best?.urls ?? null;
}

/**
 * Repair memories/milestones that were created via chat but saved with empty
 * media_urls while the photo still exists on the matching chat message.
 */
export async function backfillChatPhotosForRecords(childId: string): Promise<void> {
  const [{ data: memories }, { data: milestones }] = await Promise.all([
    supabase
      .from('memories')
      .select('id, created_at, media_urls')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('milestones')
      .select('id, created_at, media_urls')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const updates: Promise<unknown>[] = [];

  for (const memory of memories ?? []) {
    if (memory.media_urls.length > 0) continue;
    const urls = await findChatPhotoNear(childId, memory.created_at);
    if (urls?.length) {
      updates.push(updateMemory(memory.id, { media_urls: urls }));
    }
  }

  for (const milestone of milestones ?? []) {
    if (milestone.media_urls.length > 0) continue;
    const urls = await findChatPhotoNear(childId, milestone.created_at);
    if (urls?.length) {
      updates.push(updateMilestone(milestone.id, { media_urls: urls }));
    }
  }

  await Promise.all(updates);
}
