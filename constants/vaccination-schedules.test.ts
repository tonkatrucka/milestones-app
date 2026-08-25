import assert from 'node:assert/strict';
import { getScheduleWithDates, NIP_CHILDHOOD_SCHEDULE } from './vaccination-schedules';

assert.ok(NIP_CHILDHOOD_SCHEDULE.every((v) => v.atMonths >= 0));
assert.equal(NIP_CHILDHOOD_SCHEDULE.filter((v) => v.code === 'DTPa-hepB-IPV-Hib').length, 3);
assert.equal(NIP_CHILDHOOD_SCHEDULE.filter((v) => v.code === 'PCV13').length, 3);
assert.equal(NIP_CHILDHOOD_SCHEDULE.filter((v) => v.code === 'Rotavirus').length, 2);

const dated = getScheduleWithDates('2024-01-15');
const byKey = new Map(dated.map((v) => [`${v.code}-${v.doseNumber}`, v]));

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

assert.equal(ymd(byKey.get('HepB-1')!.dueDate), '2024-01-15');
assert.equal(ymd(byKey.get('DTPa-hepB-IPV-Hib-1')!.dueDate), '2024-03-15');
assert.equal(ymd(byKey.get('DTPa-hepB-IPV-Hib-2')!.dueDate), '2024-05-15');
assert.equal(ymd(byKey.get('DTPa-hepB-IPV-Hib-3')!.dueDate), '2024-07-15');
assert.equal(ymd(byKey.get('MenACWY-1')!.dueDate), '2025-01-15');
assert.equal(ymd(byKey.get('Hib-1')!.dueDate), '2025-07-15');
assert.equal(ymd(byKey.get('DTPa-IPV-1')!.dueDate), '2028-01-15');

console.log('vaccination-schedules tests passed');
