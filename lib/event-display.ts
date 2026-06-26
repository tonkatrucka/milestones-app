import { differenceInMinutes, format } from 'date-fns';
import type { DailyEvent, EventType, MealMetadata, NappyMetadata, SleepMetadata } from '@/lib/database.types';

export const EVENT_LABELS: Record<EventType, string> = {
  nappy: 'Nappy',
  meal: 'Meal',
  sleep: 'Sleep',
};

export const EVENT_EMOJIS: Record<EventType, string> = {
  nappy: '🧷',
  meal: '🍼',
  sleep: '😴',
};

export const QUICK_LOG_EMOJIS: Record<EventType, string> = {
  nappy: '👶',
  meal: '🍼',
  sleep: '😴',
};

export function getEventDetail(event: DailyEvent): string {
  const meta = event.metadata as Record<string, unknown>;
  switch (event.type) {
    case 'nappy': {
      const m = meta as Partial<NappyMetadata>;
      return m.nappyType ? m.nappyType.charAt(0).toUpperCase() + m.nappyType.slice(1) : '';
    }
    case 'meal': {
      const m = meta as Partial<MealMetadata>;
      const parts: string[] = [];
      if (m.mealType) parts.push(m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1));
      if (m.amountMl) parts.push(`${m.amountMl}ml`);
      if (m.food) parts.push(m.food);
      return parts.join(' · ');
    }
    case 'sleep': {
      const m = meta as Partial<SleepMetadata>;
      if (m.sleepEnd) {
        const mins = Math.max(0, differenceInMinutes(new Date(m.sleepEnd), new Date(event.occurred_at)));
        if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`.trim();
        return `${mins}m`;
      }
      return 'Ongoing';
    }
    default:
      return '';
  }
}

export function formatEventSummary(event: DailyEvent): string {
  const label = EVENT_LABELS[event.type as EventType];
  const detail = getEventDetail(event);
  return detail ? `${label} · ${detail}` : label;
}

export function formatEventTime(event: DailyEvent): string {
  return format(new Date(event.occurred_at), 'h:mm a');
}
