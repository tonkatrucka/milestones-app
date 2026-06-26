import { assertEquals } from 'jsr:@std/assert';
import { selectResearchBullets } from './research-selector.ts';

const pool = [
  {
    id: '1',
    age_bracket: 'toddler_early',
    category: 'sleep',
    subtopic: 'naps',
    text: 'UK sleep guidance A',
    source_url: 'https://www.nhs.uk/a',
    source_name: 'NHS',
    source_domain: 'nhs.uk',
    source_tier: 'tier_1',
    source_region: 'UK',
    reviewed_at: '2025-01-01',
    created_at: '2025-01-01',
    active: true,
  },
  {
    id: '2',
    age_bracket: 'toddler_early',
    category: 'sleep',
    subtopic: 'night',
    text: 'US sleep guidance B',
    source_url: 'https://www.cdc.gov/b',
    source_name: 'CDC',
    source_domain: 'cdc.gov',
    source_tier: 'tier_1',
    source_region: 'US',
    reviewed_at: '2025-01-01',
    created_at: '2025-01-01',
    active: true,
  },
  {
    id: '3',
    age_bracket: 'toddler_early',
    category: 'development',
    subtopic: 'motor',
    text: 'Global development C',
    source_url: 'https://www.who.int/c',
    source_name: 'WHO',
    source_domain: 'who.int',
    source_tier: 'tier_1',
    source_region: 'GLOBAL',
    reviewed_at: '2025-06-01',
    created_at: '2025-06-01',
    active: true,
  },
];

Deno.test('selectResearchBullets guarantees unseen when available', () => {
  const selected = selectResearchBullets({
    ageBracket: 'toddler_early',
    categories: ['sleep'],
    userRegion: 'GB',
    shownBulletIds: new Set(['1']),
    shownFirstOn: new Map([['1', '2025-06-01']]),
    pool,
    count: 2,
  });
  assertEquals(selected.some((b) => b.id === '2' || b.id === '3'), true);
  assertEquals(selected.some((b) => b.isNew), true);
});

Deno.test('selectResearchBullets prefers UK region for GB users', () => {
  const selected = selectResearchBullets({
    ageBracket: 'toddler_early',
    categories: ['sleep'],
    userRegion: 'GB',
    shownBulletIds: new Set(),
    shownFirstOn: new Map(),
    pool,
    count: 1,
  });
  assertEquals(selected[0]?.id, '1');
});

Deno.test('selectResearchBullets excludes inactive bullets', () => {
  const inactivePool = [...pool, { ...pool[0], id: 'x', active: false }];
  const selected = selectResearchBullets({
    ageBracket: 'toddler_early',
    categories: ['sleep'],
    userRegion: 'US',
    shownBulletIds: new Set(),
    shownFirstOn: new Map(),
    pool: inactivePool,
    count: 5,
  });
  assertEquals(selected.every((b) => b.id !== 'x'), true);
});
