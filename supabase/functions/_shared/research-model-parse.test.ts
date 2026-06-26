import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractJsonObject, parseResearchModelResponse } from './research-model-parse.ts';

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
