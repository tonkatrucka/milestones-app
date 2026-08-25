import assert from 'node:assert/strict';
import { attachMonthlyRecaps, buildJourneySections } from './timeline-sections';
import type { Memory, Milestone } from './database.types';

const childDob = '2025-08-01';

function milestone(id: string, achievedAt: string, title: string): Milestone {
  return {
    id,
    child_id: 'c1',
    title,
    category: 'development',
    description: null,
    achieved_at: achievedAt,
    media_urls: [],
    audio_url: null,
    is_private: false,
    created_by: null,
    created_at: achievedAt,
  };
}

function memory(id: string, occurredAt: string, title: string): Memory {
  return {
    id,
    child_id: 'c1',
    title,
    description: null,
    occurred_at: occurredAt,
    tags: [],
    media_urls: [],
    audio_url: null,
    is_private: false,
    created_by: null,
    created_at: occurredAt,
  };
}

const sections = buildJourneySections(
  [milestone('m1', '2026-08-10', 'First smile')],
  [memory('mem1', '2026-06-04', 'Beach day')],
  childDob,
);

assert.equal(sections[0]?.recap, null);

const attached = attachMonthlyRecaps(
  sections,
  [
    { month_key: '2026-08', narrative: 'August brought a first smile.' },
    { month_key: '2026-05', narrative: 'May was quiet and full of cuddles.' },
  ],
  childDob,
);

const august = attached.find((s) => s.monthKey === '2026-08');
const june = attached.find((s) => s.monthKey === '2026-06');
const may = attached.find((s) => s.monthKey === '2026-05');

assert.equal(august?.recap, 'August brought a first smile.');
assert.equal(june?.recap, null);
assert.equal(may?.recap, 'May was quiet and full of cuddles.');
assert.equal(may?.entries.length, 0);
assert.deepEqual(
  attached.map((s) => s.monthKey),
  ['2026-08', '2026-06', '2026-05'],
);

console.log('timeline-sections recap tests passed');
