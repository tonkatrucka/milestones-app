import { supabase } from '@/lib/supabase';
import type { DevChecklistEntry, DevChecklistStatus } from '@/lib/database.types';

export async function getDevChecklist(childId: string): Promise<DevChecklistEntry[]> {
  const { data, error } = await supabase
    .from('dev_checklist')
    .select('*')
    .eq('child_id', childId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertChecklistEntry(params: {
  childId: string;
  checkpointId: string;
  status: DevChecklistStatus;
  notes?: string;
}): Promise<DevChecklistEntry> {
  const { data, error } = await supabase
    .from('dev_checklist')
    .upsert(
      {
        child_id: params.childId,
        checkpoint_id: params.checkpointId,
        status: params.status,
        noted_at: new Date().toISOString().split('T')[0],
        notes: params.notes ?? null,
      },
      { onConflict: 'child_id,checkpoint_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
