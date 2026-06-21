import { supabase } from '@/lib/supabase';
import type { DailyEvent, EventType, EventMetadata } from '@/lib/database.types';

export async function getTodayEvents(childId: string, daysBack = 0): Promise<DailyEvent[]> {
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setDate(end.getDate() - daysBack);
  // For today cap at now; for past days use end-of-day
  if (daysBack === 0) {
    // already set to now
  } else {
    end.setHours(23, 59, 59, 999);
  }

  const { data, error } = await supabase
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .gte('occurred_at', start.toISOString())
    .lte('occurred_at', end.toISOString())
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getLastEventByType(
  childId: string,
  type: EventType,
): Promise<DailyEvent | null> {
  const { data, error } = await supabase
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .eq('type', type)
    // Only past events — prevents future-dated seed rows showing "in X hours"
    .lte('occurred_at', new Date().toISOString())
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function logEvent(params: {
  childId: string;
  type: EventType;
  occurredAt?: Date;
  notes?: string;
  metadata?: EventMetadata;
  userId: string;
}): Promise<DailyEvent> {
  const { data, error } = await supabase
    .from('daily_events')
    .insert({
      child_id: params.childId,
      type: params.type,
      occurred_at: (params.occurredAt ?? new Date()).toISOString(),
      notes: params.notes ?? null,
      metadata: params.metadata ?? {},
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(
  id: string,
  updates: { notes?: string | null; metadata?: EventMetadata; occurred_at?: string },
): Promise<DailyEvent> {
  const { data, error } = await supabase
    .from('daily_events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('daily_events').delete().eq('id', id);
  if (error) throw error;
}

export async function getRecentEvents(
  childId: string,
  days = 7,
): Promise<DailyEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
