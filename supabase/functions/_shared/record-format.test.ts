import { assertEquals } from 'jsr:@std/assert';
import {
  buildEventDays,
  formatDaySummary,
  getEventDetail,
  type DailyEvent,
} from './record-format.ts';

const sampleEvents: DailyEvent[] = [
  {
    id: '1',
    child_id: 'c1',
    type: 'meal',
    occurred_at: '2025-06-23T08:00:00.000Z',
    notes: null,
    metadata: { mealType: 'bottle', amountMl: 120 },
    created_by: null,
    created_at: '2025-06-23T08:00:00.000Z',
  },
  {
    id: '2',
    child_id: 'c1',
    type: 'meal',
    occurred_at: '2025-06-23T14:00:00.000Z',
    notes: null,
    metadata: { mealType: 'bottle', amountMl: 90 },
    created_by: null,
    created_at: '2025-06-23T14:00:00.000Z',
  },
  {
    id: '3',
    child_id: 'c1',
    type: 'nappy',
    occurred_at: '2025-06-23T09:00:00.000Z',
    notes: null,
    metadata: { nappyType: 'wet' },
    created_by: null,
    created_at: '2025-06-23T09:00:00.000Z',
  },
  {
    id: '4',
    child_id: 'c1',
    type: 'nappy',
    occurred_at: '2025-06-23T11:00:00.000Z',
    notes: null,
    metadata: { nappyType: 'dirty' },
    created_by: null,
    created_at: '2025-06-23T11:00:00.000Z',
  },
  {
    id: '5',
    child_id: 'c1',
    type: 'sleep',
    occurred_at: '2025-06-23T10:00:00.000Z',
    notes: null,
    metadata: { sleepEnd: '2025-06-23T10:45:00.000Z' },
    created_by: null,
    created_at: '2025-06-23T10:00:00.000Z',
  },
];

Deno.test('buildEventDays aggregates meals, nappies, and sleep', () => {
  const days = buildEventDays(sampleEvents);
  assertEquals(days.length, 1);

  const day = days[0];
  assertEquals(day.counts.meal, 2);
  assertEquals(day.totalMl, 210);
  assertEquals(day.counts.nappy, 2);
  assertEquals(day.nappyByType.wet, 1);
  assertEquals(day.nappyByType.dirty, 1);
  assertEquals(day.totalSleepMins, 45);
});

Deno.test('formatDaySummary matches UI-style output', () => {
  const day = buildEventDays(sampleEvents)[0];
  const summary = formatDaySummary(day);
  assertEquals(summary.includes('2 meals (210ml bottle total)'), true);
  assertEquals(summary.includes('2 nappies'), true);
  assertEquals(summary.includes('45m sleep'), true);
});

Deno.test('getEventDetail formats bottle feed', () => {
  const detail = getEventDetail(sampleEvents[0]);
  assertEquals(detail, 'Bottle · 120ml');
});

Deno.test('parseQueryIntent classifies common questions', async () => {
  const { parseQueryIntent, classifyMessage, parseIntent } = await import('../chat/intent-parser.ts');

  assertEquals(parseQueryIntent('How many nappies today?')?.queryType, 'nappy_count_today');
  assertEquals(parseQueryIntent('How many nappies yesterday?')?.queryType, 'nappy_count_yesterday');
  assertEquals(parseQueryIntent('How many feeds yesterday?')?.queryType, 'meal_count_yesterday');
  assertEquals(parseQueryIntent('When did she last eat?')?.queryType, 'last_meal');
  assertEquals(parseQueryIntent('Is she asleep?')?.queryType, 'is_asleep');
  assertEquals(classifyMessage('Summarise feeding this week'), 'complex_query');
  assertEquals(classifyMessage('120ml'), 'log');
  assertEquals(parseIntent('150ml')?.toolName, 'log_meal');
  assertEquals(parseIntent('bottle')?.input.meal_type, 'bottle');
  assertEquals(parseIntent('solids')?.input.meal_type, 'solid');
  assertEquals(parseIntent('dry nappy')?.input.nappy_type, 'dry');
  assertEquals(parseIntent('both')?.input.nappy_type, 'both');
  assertEquals(parseIntent('nap')?.toolName, 'log_sleep_start');
  assertEquals(parseIntent('fed 90ml')?.input.amount_ml, 90);
});
