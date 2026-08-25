import { supabase } from '@/lib/supabase';
import type {
  HealthRecord,
  HealthRecordType,
  HealthRecordMetadata,
} from '@/lib/database.types';

export async function getHealthRecords(childId: string): Promise<HealthRecord[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('child_id', childId)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getHealthRecordsByType(
  childId: string,
  type: HealthRecordType,
): Promise<HealthRecord[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('*')
    .eq('child_id', childId)
    .eq('type', type)
    .order('recorded_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addHealthRecord(params: {
  childId: string;
  type: HealthRecordType;
  recordedAt: Date;
  notes?: string;
  metadata?: HealthRecordMetadata;
  userId: string;
}): Promise<HealthRecord> {
  const { data, error } = await supabase
    .from('health_records')
    .insert({
      child_id: params.childId,
      type: params.type,
      recorded_at: params.recordedAt.toISOString().slice(0, 10),
      notes: params.notes ?? null,
      metadata: params.metadata ?? {},
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateHealthRecord(
  id: string,
  updates: {
    recorded_at?: string;
    notes?: string | null;
    metadata?: HealthRecordMetadata;
  },
): Promise<HealthRecord> {
  const { data, error } = await supabase
    .from('health_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHealthRecord(id: string): Promise<void> {
  const { error } = await supabase.from('health_records').delete().eq('id', id);
  if (error) throw error;
}
