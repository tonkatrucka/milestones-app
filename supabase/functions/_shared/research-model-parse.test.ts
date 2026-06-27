import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractJsonObject, parseBulletsPayload, parseResearchModelResponse } from './research-model-parse.ts';
import { sanitizeResearchBulletText } from './research-text-sanitize.ts';

Deno.test('extractJsonObject handles fenced json', () => {
  const json = extractJsonObject('Here you go:\n```json\n{"bullets":[{"text":"A","sourceUrl":"https://www.nhs.uk/x"}]}\n```');
  assertEquals(json?.includes('"bullets"'), true);
});

Deno.test('parseResearchModelResponse uses last text block with json', () => {
  const result = parseResearchModelResponse([
    { type: 'text', text: "I'll search for newborn sleep guidance." },
    { type: 'server_tool_use' },
    {
      type: 'text',
      text: '{"bullets":[{"text":"Back sleeping reduces SIDS risk.","sourceUrl":"https://www.nhs.uk/sleep","sourceName":"NHS","sourceTier":"tier_1","subtopic":"safe_sleep"}]}',
    },
  ], 'end_turn');

  assertEquals(result.bullets.length, 1);
  assertEquals(result.bullets[0].subtopic, 'safe_sleep');
});

Deno.test('parseResearchModelResponse reports no_json', () => {
  const result = parseResearchModelResponse([
    { type: 'text', text: 'Still searching, no structured output yet.' },
  ], 'max_tokens');

  assertEquals(result.bullets.length, 0);
  assertEquals(result.debug?.issue, 'no_json');
});

Deno.test('sanitizeResearchBulletText removes cite markup but keeps text', () => {
  const raw =
    '<cite index="1">Babies should sleep on their back</cite> for safer sleep.';
  assertEquals(
    sanitizeResearchBulletText(raw),
    'Babies should sleep on their back for safer sleep.',
  );
});

Deno.test('parseBulletsPayload strips cite tags from bullet text', () => {
  const bullets = parseBulletsPayload({
    bullets: [{
      text: '<cite index="2">Most babies need regular naps.</cite>',
      sourceUrl: 'https://www.nhs.uk/example',
      sourceName: 'NHS',
      subtopic: 'naps',
    }],
  });
  assertEquals(bullets[0]?.text, 'Most babies need regular naps.');
});
