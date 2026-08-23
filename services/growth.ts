import { supabase } from '@/lib/supabase';
import type { GrowthEntry } from '@/lib/database.types';

export async function getGrowthEntries(childId: string): Promise<GrowthEntry[]> {
  const { data, error } = await supabase
    .from('growth_entries')
    .select('*')
    .eq('child_id', childId)
    .order('measured_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addGrowthEntry(
  params: {
    childId: string;
    measuredAt: string;
    weightKg?: number;
    heightCm?: number;
    headCm?: number;
    notes?: string;
    userId: string;
  },
): Promise<GrowthEntry> {
  const { data, error } = await supabase
    .from('growth_entries')
    .insert({
      child_id: params.childId,
      measured_at: params.measuredAt,
      weight_kg: params.weightKg ?? null,
      height_cm: params.heightCm ?? null,
      head_cm: params.headCm ?? null,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGrowthEntry(
  id: string,
  updates: {
    measuredAt?: string;
    weightKg?: number | null;
    heightCm?: number | null;
    headCm?: number | null;
    notes?: string | null;
  },
): Promise<GrowthEntry> {
  const { data, error } = await supabase
    .from('growth_entries')
    .update({
      ...(updates.measuredAt !== undefined && { measured_at: updates.measuredAt }),
      ...(updates.weightKg !== undefined && { weight_kg: updates.weightKg }),
      ...(updates.heightCm !== undefined && { height_cm: updates.heightCm }),
      ...(updates.headCm !== undefined && { head_cm: updates.headCm }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGrowthEntry(id: string): Promise<void> {
  const { error } = await supabase.from('growth_entries').delete().eq('id', id);
  if (error) throw error;
}

// ─── WHO LMS percentile calculation (on-device, no API call) ─────────────────
// Simplified LMS approximation for weight-for-age (girls 0–24m).
// In production, use a full WHO LMS table library.
// Returns null if outside supported range.
export function computeWeightPercentile(
  weightKg: number,
  ageMonths: number,
  sex: 'male' | 'female',
): number | null {
  if (ageMonths < 0 || ageMonths > 60) return null;
  // WHO median (M) and SD approximations by age bracket
  // These are simplified; the real LMS method requires the full table.
  const medians: Record<string, Record<number, number>> = {
    female: { 0: 3.2, 1: 4.2, 2: 5.1, 3: 5.8, 4: 6.4, 5: 6.9, 6: 7.3, 9: 8.2, 12: 8.9, 18: 10.2, 24: 11.5 },
    male:   { 0: 3.3, 1: 4.5, 2: 5.6, 3: 6.4, 4: 7.0, 5: 7.5, 6: 7.9, 9: 9.0, 12: 9.7, 18: 11.1, 24: 12.2 },
  };
  const sds: Record<string, number> = { female: 0.9, male: 1.0 };

  const table = medians[sex];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const lower = keys.reduce((acc, k) => (k <= ageMonths ? k : acc), keys[0]);
  const upper = keys.find((k) => k > ageMonths) ?? lower;
  const t = lower === upper ? 0 : (ageMonths - lower) / (upper - lower);
  const median = table[lower] + t * (table[upper] - table[lower]);
  const sd = sds[sex];
  const z = (weightKg - median) / sd;

  // Convert z-score to percentile using standard normal CDF approximation
  return Math.round(normalCDF(z) * 100);
}

export function computeHeightPercentile(
  heightCm: number,
  ageMonths: number,
  sex: 'male' | 'female',
): number | null {
  if (ageMonths < 0 || ageMonths > 60) return null;
  const medians: Record<string, Record<number, number>> = {
    female: { 0: 49.1, 1: 53.7, 2: 57.1, 3: 59.8, 4: 62.1, 5: 64.0, 6: 65.7, 9: 70.1, 12: 74.0, 18: 80.7, 24: 85.7 },
    male:   { 0: 49.9, 1: 54.7, 2: 58.4, 3: 61.4, 4: 63.9, 5: 65.9, 6: 67.6, 9: 72.0, 12: 75.7, 18: 82.3, 24: 87.1 },
  };
  const sds: Record<string, number> = { female: 2.7, male: 2.8 };

  const table = medians[sex];
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const lower = keys.reduce((acc, k) => (k <= ageMonths ? k : acc), keys[0]);
  const upper = keys.find((k) => k > ageMonths) ?? lower;
  const t = lower === upper ? 0 : (ageMonths - lower) / (upper - lower);
  const median = table[lower] + t * (table[upper] - table[lower]);
  const sd = sds[sex];
  const z = (heightCm - median) / sd;
  return Math.round(normalCDF(z) * 100);
}

// Abramowitz & Stegun approximation for the standard normal CDF
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212559 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}
