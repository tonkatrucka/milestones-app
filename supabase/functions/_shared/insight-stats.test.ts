import { assertEquals } from 'jsr:@std/assert';
import { resolveAgeBracket, ageMonthsFromDob } from './insight-stats.ts';

Deno.test('resolveAgeBracket maps months correctly', () => {
  assertEquals(resolveAgeBracket('2025-04-01', '2025-04-15'), 'newborn');
  assertEquals(resolveAgeBracket('2024-10-01', '2025-04-01'), 'infant_early');
  assertEquals(resolveAgeBracket('2024-07-01', '2025-04-01'), 'infant_late');
  assertEquals(resolveAgeBracket('2023-10-01', '2025-04-01'), 'toddler_early');
  assertEquals(resolveAgeBracket('2022-01-01', '2025-04-01'), 'toddler_late');
});

Deno.test('ageMonthsFromDob returns non-negative months', () => {
  assertEquals(ageMonthsFromDob('2024-01-01', '2024-06-01'), 5);
});
