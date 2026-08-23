import { supabase } from '@/lib/supabase';
import type { VaccinationRecord } from '@/lib/database.types';

export async function getVaccinations(childId: string): Promise<VaccinationRecord[]> {
  const { data, error } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('child_id', childId)
    .order('administered_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addVaccination(params: {
  childId: string;
  vaccineCode: string;
  vaccineName: string;
  administeredAt: string;
  doseNumber?: number;
  clinic?: string;
  batchNumber?: string;
  reactionNotes?: string;
  userId: string;
}): Promise<VaccinationRecord> {
  const { data, error } = await supabase
    .from('vaccinations')
    .insert({
      child_id: params.childId,
      vaccine_code: params.vaccineCode,
      vaccine_name: params.vaccineName,
      administered_at: params.administeredAt,
      dose_number: params.doseNumber ?? 1,
      clinic: params.clinic ?? null,
      batch_number: params.batchNumber ?? null,
      reaction_notes: params.reactionNotes ?? null,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVaccination(id: string): Promise<void> {
  const { error } = await supabase.from('vaccinations').delete().eq('id', id);
  if (error) throw error;
}
