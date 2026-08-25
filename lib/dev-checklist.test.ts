import assert from 'node:assert/strict';
import {
  CHECK_AGES,
  checklistProgress,
  currentCheckAge,
  checkpointsForBand,
  formatCheckAgeLabel,
  isActEarly,
} from './dev-checklist';

assert.equal(formatCheckAgeLabel(6), '6 mo');
assert.equal(currentCheckAge(0), 2);
assert.equal(currentCheckAge(2), 2);
assert.equal(currentCheckAge(5), 4);
assert.equal(currentCheckAge(12), 12);
assert.equal(currentCheckAge(30), 24);
assert.deepEqual([...CHECK_AGES], [2, 4, 6, 9, 12, 15, 18, 24]);

const sixMonth = checkpointsForBand(6);
assert.ok(sixMonth.length > 0);
assert.ok(sixMonth.every((c) => c.byAgeMonths === 6));
assert.equal(checkpointsForBand(3).length, 0);

const sample = sixMonth[0];
assert.equal(isActEarly(sample, 'yes', 20), false);
assert.equal(isActEarly(sample, 'not_yet', 4), false);
assert.equal(isActEarly(sample, 'not_yet', sample.actEarlyIfMissedBy ?? 99), true);
assert.equal(isActEarly(sample, undefined, sample.actEarlyIfMissedBy ?? 99), true);

assert.deepEqual(
  checklistProgress(sixMonth, { [sixMonth[0].id]: 'yes', [sixMonth[1].id]: 'not_yet' }),
  { observed: 1, total: sixMonth.length },
);

console.log('dev-checklist tests passed');
