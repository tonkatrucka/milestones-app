import { differenceInMinutes, format } from 'date-fns';
import type {
  DailyEvent,
  EventType,
  MealMetadata,
  MedicationMetadata,
  NappyMetadata,
  PumpMetadata,
  SleepMetadata,
  TemperatureMetadata,
} from '@/lib/database.types';
import { formatMealDetailParts } from '@/lib/meal-format';

export const EVENT_LABELS: Record<EventType, string> = {
  nappy: 'Nappy',
  meal: 'Meal',
  sleep: 'Sleep',
  pump: 'Pump',
  temperature: 'Temperature',
  medication: 'Medication',
};

export const EVENT_EMOJIS: Record<EventType, string> = {
  nappy: '🧷',
  meal: '🍼',
  sleep: '😴',
  pump: '🤱',
  temperature: '🌡️',
  medication: '💊',
};

export const QUICK_LOG_EMOJIS: Record<EventType, string> = {
  nappy: '👶',
  meal: '🍼',
  sleep: '😴',
  pump: '🤱',
  temperature: '🌡️',
  medication: '💊',
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
      return formatMealDetailParts(m).join(' · ');
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
    case 'pump': {
      const m = meta as Partial<PumpMetadata>;
      const parts: string[] = [];
      if (m.breastSide) parts.push(m.breastSide.charAt(0).toUpperCase() + m.breastSide.slice(1));
      if (m.amountMl != null) parts.push(`${m.amountMl}ml`);
      if (m.durationMins != null) parts.push(`${m.durationMins}m`);
      return parts.join(' · ') || 'Pumping session';
    }
    case 'temperature': {
      const m = meta as Partial<TemperatureMetadata>;
      if (m.tempC != null) return `${m.tempC.toFixed(1)}°C`;
      return '';
    }
    case 'medication': {
      const m = meta as Partial<MedicationMetadata>;
      if (!m.name) return 'Medication';
      const parts: string[] = [m.name];
      if (m.doseAmountMl != null) parts.push(`${m.doseAmountMl}ml`);
      return parts.join(' · ');
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
