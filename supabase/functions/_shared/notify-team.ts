export type TeamNotificationRecordType = 'activity' | 'memory' | 'milestone';

export interface NotifyTeamParams {
  childId: string;
  recordType: TeamNotificationRecordType;
  createdByUserId: string | null;
  summary: string;
  recordId?: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
}

// deno-lint-ignore no-explicit-any
type AdminDb = any;

function preferenceColumn(recordType: TeamNotificationRecordType): string {
  switch (recordType) {
    case 'activity':
      return 'notify_activities';
    case 'memory':
      return 'notify_memories';
    case 'milestone':
      return 'notify_milestones';
  }
}

function notificationTitle(childName: string, recordType: TeamNotificationRecordType): string {
  switch (recordType) {
    case 'activity':
      return `New activity · ${childName}`;
    case 'memory':
      return `New memory · ${childName}`;
    case 'milestone':
      return `New milestone · ${childName}`;
  }
}

export async function notifyTeamMembers(
  adminDb: AdminDb,
  params: NotifyTeamParams,
): Promise<{ sent: number }> {
  if (!params.createdByUserId) {
    return { sent: 0 };
  }

  const { data: child, error: childError } = await adminDb
    .from('children')
    .select('name')
    .eq('id', params.childId)
    .maybeSingle();

  if (childError || !child?.name) {
    console.error('[notify-team] child lookup failed:', childError?.message);
    return { sent: 0 };
  }

  const { data: members, error: membersError } = await adminDb
    .from('child_members')
    .select('user_id')
    .eq('child_id', params.childId)
    .neq('user_id', params.createdByUserId);

  if (membersError) {
    console.error('[notify-team] members lookup failed:', membersError.message);
    return { sent: 0 };
  }

  const recipientIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (recipientIds.length === 0) {
    return { sent: 0 };
  }

  const prefColumn = preferenceColumn(params.recordType);
  const { data: prefs, error: prefsError } = await adminDb
    .from('notification_preferences')
    .select(`user_id, ${prefColumn}`)
    .in('user_id', recipientIds);

  if (prefsError) {
    console.error('[notify-team] preferences lookup failed:', prefsError.message);
    return { sent: 0 };
  }

  const enabledUserIds = new Set(
    (prefs ?? [])
      .filter((row: Record<string, unknown>) => row[prefColumn] === true)
      .map((row: { user_id: string }) => row.user_id),
  );

  if (enabledUserIds.size === 0) {
    return { sent: 0 };
  }

  const { data: tokens, error: tokensError } = await adminDb
    .from('push_tokens')
    .select('expo_push_token, user_id')
    .in('user_id', [...enabledUserIds]);

  if (tokensError) {
    console.error('[notify-team] tokens lookup failed:', tokensError.message);
    return { sent: 0 };
  }

  const uniqueTokens = [
    ...new Set(
      (tokens ?? []).map((row: { expo_push_token: string }) => row.expo_push_token),
    ),
  ];

  if (uniqueTokens.length === 0) {
    return { sent: 0 };
  }

  const title = notificationTitle(child.name, params.recordType);
  const messages: ExpoPushMessage[] = uniqueTokens.map((token) => ({
    to: token,
    title,
    body: params.summary,
    sound: 'default',
    data: {
      childId: params.childId,
      recordType: params.recordType,
      ...(params.recordId ? { recordId: params.recordId } : {}),
    },
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[notify-team] Expo push failed:', response.status, text);
    return { sent: 0 };
  }

  return { sent: messages.length };
}
