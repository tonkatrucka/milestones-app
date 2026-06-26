import { getLocales } from 'expo-localization';
import { supabase } from '@/lib/supabase';

export interface ResearchBullet {
  id: string;
  category: string;
  subtopic: string;
  text: string;
  sourceUrl: string;
  sourceName: string;
  isNew: boolean;
}

export interface InsightsPayload {
  shortInsights: string[];
  longInsights: string[];
  categories: string[];
  researchBullets: ResearchBullet[];
  generatedAt: string;
  insightDate: string;
}

export function localInsightDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveUserRegion(): string {
  const region = getLocales()[0]?.regionCode;
  if (region) return region.toUpperCase();
  return 'GLOBAL';
}

export async function fetchInsights(
  child: { id: string; name: string; date_of_birth: string },
  userRegion: string,
  currentDate: string,
): Promise<InsightsPayload> {
  const { data, error } = await supabase.functions.invoke('insights', {
    body: {
      child,
      currentDate,
      userRegion,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as InsightsPayload;
}
