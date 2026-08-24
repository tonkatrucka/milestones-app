import assert from 'node:assert/strict';
import {
  buildLocalMonthlyRecap,
  buildLocalWeeklyNarrative,
  currentMonthKey,
  formatMonthKeyLabel,
} from './local-narrative';
import type { DailyEvent } from './database.types';

function event(type: DailyEvent['type']): DailyEvent {
  return {
    id: type,
    child_id: 'c1',
    type,
    occurred_at: '2026-08-24T10:00:00.000Z',
    notes: null,
    metadata: {},
    created_by: null,
    created_at: '2026-08-24T10:00:00.000Z',
  };
}

assert.equal(buildLocalWeeklyNarrative('Emma', []), null);
assert.match(
  buildLocalWeeklyNarrative('Emma', [event('meal'), event('meal'), event('nappy')]) ?? '',
  /Emma had 2 feeds and 1 nappy/,
);

assert.equal(buildLocalMonthlyRecap('Emma', 'August 2026', [], []), null);
assert.match(
  buildLocalMonthlyRecap(
    'Emma',
    'August 2026',
    [{ title: 'First smile' }],
    [{ title: 'Beach day' }],
  ) ?? '',
  /First smile/,
);

const key = currentMonthKey(new Date('2026-08-24T00:00:00'));
assert.equal(key, '2026-08');
assert.equal(formatMonthKeyLabel('2026-08'), 'August 2026');

console.log('local-narrative tests passed');
