import { supabase } from '@/lib/supabase';
import type { MonthlyRecap } from '@/lib/database.types';

export interface WeeklyNarrativeRow {
  narrative: string;
  weekStart: string;
}

export async function getLatestWeeklyNarrative(
  childId: string,
): Promise<WeeklyNarrativeRow | null> {
  try {
    const { data, error } = await supabase
      .from('child_insights')
      .select('weekly_narrative, weekly_narrative_week')
      .eq('child_id', childId)
      .not('weekly_narrative', 'is', null)
      .order('weekly_narrative_week', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.weekly_narrative) return null;
    return {
      narrative: data.weekly_narrative as string,
      weekStart: (data.weekly_narrative_week as string) ?? '',
    };
  } catch {
    return null;
  }
}

export async function getMonthlyRecaps(childId: string): Promise<MonthlyRecap[]> {
  try {
    const { data, error } = await supabase
      .from('monthly_recaps')
      .select('*')
      .eq('child_id', childId)
      .order('month_key', { ascending: false });
    if (error) return [];
    return (data ?? []) as MonthlyRecap[];
  } catch {
    return [];
  }
}
