/**
 * Verifies shared record-format aggregation matches client timeline-sections logic.
 * Run: npx tsx scripts/verify-chat-records.ts
 */
import { buildActivitiesSections } from '../lib/timeline-sections';
import type { DailyEvent } from '../lib/database.types';
import {
  buildEventDays,
  formatDaySummary,
  getEventDetail,
} from '../supabase/functions/_shared/record-format.ts';
import {
  classifyMessage,
  parseQueryIntent,
} from '../supabase/functions/chat/intent-parser.ts';

const sampleEvents: DailyEvent[] = [
  {
    id: '1',
    child_id: 'c1',
    type: 'meal',
    occurred_at: '2025-06-23T10:00:00.000Z',
    notes: null,
    metadata: { mealType: 'bottle', amountMl: 120 },
    created_by: null,
    created_at: '2025-06-23T10:00:00.000Z',
  },
  {
    id: '2',
    child_id: 'c1',
    type: 'meal',
    occurred_at: '2025-06-23T16:00:00.000Z',
    notes: null,
    metadata: { mealType: 'bottle', amountMl: 90 },
    created_by: null,
    created_at: '2025-06-23T16:00:00.000Z',
  },
  {
    id: '3',
    child_id: 'c1',
    type: 'nappy',
    occurred_at: '2025-06-23T11:00:00.000Z',
    notes: null,
    metadata: { nappyType: 'wet' },
    created_by: null,
    created_at: '2025-06-23T11:00:00.000Z',
  },
  {
    id: '4',
    child_id: 'c1',
    type: 'sleep',
    occurred_at: '2025-06-23T12:00:00.000Z',
    notes: null,
    metadata: { sleepEnd: '2025-06-23T12:45:00.000Z' },
    created_by: null,
    created_at: '2025-06-23T12:00:00.000Z',
  },
];

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
}

const sharedDay = buildEventDays(sampleEvents)[0];
const uiDay = buildActivitiesSections(sampleEvents, '2024-01-01')[0]?.eventDays[0];

assert(sharedDay.counts.meal === uiDay.counts.meal, 'meal counts match');
assert(sharedDay.totalMl === uiDay.totalMl, 'total ml matches');
assert(sharedDay.counts.nappy === uiDay.counts.nappy, 'nappy counts match');
assert(sharedDay.totalSleepMins === uiDay.totalSleepMins, 'sleep minutes match');

const summary = formatDaySummary(sharedDay);
assert(summary.includes(`${sharedDay.totalMl}ml`), 'summary includes total ml');
assert(
  sharedDay.totalSleepMins === 0 || summary.includes('sleep'),
  'summary includes sleep when logged',
);

assert(getEventDetail(sampleEvents[0]) === 'Bottle · 120ml', 'event detail matches UI formatter');

assert(parseQueryIntent('How many nappies today?')?.queryType === 'nappy_count_today', 'nappy query parsed');
assert(parseQueryIntent('When did she last eat?')?.queryType === 'last_meal', 'last meal query parsed');
assert(classifyMessage('Summarise feeding this week') === 'complex_query', 'complex query classified');
assert(classifyMessage('120ml') === 'log', 'log message classified');

console.log('\nAll parity checks passed.');
