import { assertEquals } from 'jsr:@std/assert';
import {
  isNearDuplicate,
  jaccardSimilarity,
  normalizeText,
} from './research-dedup.ts';

Deno.test('normalizeText lowercases and strips punctuation', () => {
  assertEquals(normalizeText('Hello, World!'), 'hello world');
});

Deno.test('jaccard detects similar texts', () => {
  const a = 'Most babies sleep twelve hours at night with naps';
  const b = 'Most babies sleep about twelve hours nightly plus naps';
  assertEquals(jaccardSimilarity(a, b) >= 0.65, true);
});

Deno.test('isNearDuplicate rejects substring paraphrase', () => {
  assertEquals(
    isNearDuplicate('babies need regular naps', ['babies need regular naps during the day']),
    true,
  );
});

Deno.test('isNearDuplicate allows distinct facts', () => {
  assertEquals(
    isNearDuplicate(
      'Introducing solids often starts around six months',
      ['Most newborns feed every two to three hours'],
    ),
    false,
  );
});
