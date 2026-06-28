import type { DailyEvent, EventMetadata, EventType, BreastSide } from '@/lib/database.types';
import { formatBreastSide } from '@/lib/meal-format';
import { logEvent, updateEvent } from '@/services/events';
import { startSleepTimer, stopSleepTimer } from '@/services/sleep-timer';
import { supabase } from '@/lib/supabase';

export type QuickLogAction =
  | { type: 'nappy'; nappyType: 'wet' | 'dirty' | 'both' | 'dry' }
  | {
      type: 'meal';
      mealType: 'breast' | 'bottle' | 'solid' | 'snack';
      amountMl?: number;
      durationMins?: number;
      breastSide?: BreastSide;
      food?: string;
    }
  | { type: 'sleep_start' }
  | { type: 'sleep_end' };

/** Chip labels from ChatInput — logged locally without calling the chat edge function. */
const QUICK_CHIP_ACTIONS: Record<string, QuickLogAction> = {
  'Wet nappy': { type: 'nappy', nappyType: 'wet' },
  'Dirty nappy': { type: 'nappy', nappyType: 'dirty' },
  'Nap started': { type: 'sleep_start' },
  'Woke up': { type: 'sleep_end' },
};

export function resolveQuickLogAction(text: string): QuickLogAction | null {
  return QUICK_CHIP_ACTIONS[text.trim()] ?? null;
}

async function findOpenSleepSession(childId: string): Promise<DailyEvent | null> {
  const { data, error } = await supabase
    .from('daily_events')
    .select('*')
    .eq('child_id', childId)
    .eq('type', 'sleep')
    .order('occurred_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (
    (data ?? []).find((e) => !(e.metadata as { sleepEnd?: string })?.sleepEnd) ?? null
  );
}

function formatConfirmation(action: QuickLogAction): string {
  switch (action.type) {
    case 'nappy': {
      const labels: Record<string, string> = {
        wet: 'wet nappy change',
        dirty: 'dirty nappy change',
        both: 'wet & dirty nappy change',
        dry: 'dry nappy check',
      };
      const label = labels[action.nappyType] ?? 'nappy change';
      return `Logged a ${label} to today's activities.`;
    }
    case 'meal': {
      const types: Record<string, string> = {
        breast: 'breastfeed',
        bottle: 'bottle feed',
        solid: 'solid meal',
        snack: 'snack',
      };
      const meal = types[action.mealType] ?? 'meal';
      let detail = '';
      if (action.mealType === 'breast') {
        const parts: string[] = [];
        const side = formatBreastSide(action.breastSide);
        if (side) parts.push(side);
        if (action.durationMins != null) parts.push(`${action.durationMins}m`);
        else if (action.amountMl != null) parts.push(`${action.amountMl}ml`);
        detail = parts.length ? ` (${parts.join(' · ')})` : '';
      } else if (action.amountMl != null) {
        detail = ` (${action.amountMl}ml)`;
      } else if (action.food) {
        detail = ` (${action.food})`;
      }
      return `Logged a ${meal}${detail} to today's activities.`;
    }
    case 'sleep_start':
      return "Logged nap/sleep start to today's activities.";
    case 'sleep_end':
      return "Logged wake-up to today's activities.";
  }
}

export function formatQuickLogAssistantReply(confirmation: string): string {
  return `Done! ${confirmation}`;
}

export type QuickLogResult =
  | { ok: true; event: DailyEvent; confirmation: string; assistantReply: string }
  | { ok: false; confirmation: string; assistantReply: string };

export async function executeQuickLog(
  action: QuickLogAction,
  childId: string,
  userId: string,
): Promise<QuickLogResult> {
  if (action.type === 'sleep_end') {
    const openSleep = await findOpenSleepSession(childId);
    if (!openSleep) {
      const confirmation = 'No open sleep session found to close.';
      return { ok: false, confirmation, assistantReply: confirmation };
    }
    const meta = openSleep.metadata as Record<string, unknown>;
    const updated = await updateEvent(openSleep.id, {
      metadata: { ...meta, sleepEnd: new Date().toISOString() },
    });
    await stopSleepTimer();
    const confirmation = formatConfirmation(action);
    return {
      ok: true,
      event: updated,
      confirmation,
      assistantReply: formatQuickLogAssistantReply(confirmation),
    };
  }

  if (action.type === 'sleep_start') {
    const event = await logEvent({
      childId,
      type: 'sleep',
      userId,
      metadata: {},
    });
    await startSleepTimer(childId, event.id, event.occurred_at);
    const confirmation = formatConfirmation(action);
    return {
      ok: true,
      event,
      confirmation,
      assistantReply: formatQuickLogAssistantReply(confirmation),
    };
  }

  if (action.type === 'nappy') {
    const metadata: EventMetadata = { nappyType: action.nappyType };
    const event = await logEvent({
      childId,
      type: 'nappy',
      userId,
      metadata,
    });
    const confirmation = formatConfirmation(action);
    return {
      ok: true,
      event,
      confirmation,
      assistantReply: formatQuickLogAssistantReply(confirmation),
    };
  }

  const metadata: EventMetadata = {
    mealType: action.mealType,
    ...(action.amountMl != null ? { amountMl: action.amountMl } : {}),
    ...(action.durationMins != null ? { durationMins: action.durationMins } : {}),
    ...(action.breastSide ? { breastSide: action.breastSide } : {}),
    ...(action.food ? { food: action.food } : {}),
  };
  const event = await logEvent({
    childId,
    type: 'meal' as EventType,
    userId,
    metadata,
  });
  const confirmation = formatConfirmation(action);
  return {
    ok: true,
    event,
    confirmation,
    assistantReply: formatQuickLogAssistantReply(confirmation),
  };
}
