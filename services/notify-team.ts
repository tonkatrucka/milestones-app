import { supabase } from '@/lib/supabase';

export type TeamNotificationRecordType = 'activity' | 'memory' | 'milestone';

export async function notifyTeamOfNewRecord(params: {
  childId: string;
  recordType: TeamNotificationRecordType;
  createdByUserId: string;
  summary: string;
  recordId?: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-record', {
      body: params,
    });
    if (error) {
      console.warn('[notifyTeamOfNewRecord]', error.message);
    }
  } catch (e) {
    console.warn('[notifyTeamOfNewRecord]', e);
  }
}
