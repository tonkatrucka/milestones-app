import assert from 'node:assert/strict';
import {
  VISIT_SUMMARY_FORMAT,
  VISIT_SUMMARY_SECTION_TITLES,
  buildVisitSummary,
  buildVisitSummaryHtml,
  formatAgeLabel,
  formatAvg,
  formatCm,
  formatHours,
  formatKg,
  formatMl,
  formatSigned,
  formatTempC,
  sortSolidFoodsForVisit,
} from './visit-summary';
import type {
  DailyEvent,
  FirstWord,
  GrowthEntry,
  Milestone,
  SolidFood,
  VaccinationRecord,
} from './database.types';

const NOW = new Date('2026-08-24T12:00:00.000Z');

function event(
  type: DailyEvent['type'],
  occurredAt: string,
  metadata: DailyEvent['metadata'] = {},
  notes: string | null = null,
): DailyEvent {
  return {
    id: `${type}-${occurredAt}`,
    child_id: 'c1',
    type,
    occurred_at: occurredAt,
    notes,
    metadata,
    created_by: null,
    created_at: occurredAt,
  };
}

function growth(partial: Partial<GrowthEntry> & Pick<GrowthEntry, 'id' | 'measured_at'>): GrowthEntry {
  return {
    child_id: 'c1',
    weight_kg: null,
    height_cm: null,
    head_cm: null,
    notes: null,
    created_by: null,
    created_at: partial.measured_at,
    ...partial,
  };
}

function emptyInput() {
  return {
    childName: 'Emma',
    childDob: '2025-08-24',
    events: [] as DailyEvent[],
    growthEntries: [] as GrowthEntry[],
    milestones: [] as Milestone[],
    vaccinations: [] as VaccinationRecord[],
    solidFoods: [] as SolidFood[],
    firstWords: [] as FirstWord[],
    now: NOW,
  };
}

assert.equal(formatKg(7.4), '7.40 kg');
assert.equal(formatCm(68.54), '68.5 cm');
assert.equal(formatTempC(38), '38.0°C');
assert.equal(formatMl(540.4), '540 ml');
assert.equal(formatHours(13.24), '13.2 h');
assert.equal(formatAvg(6.41), '6.4');
assert.equal(formatSigned(0.4, 2, 'kg'), '+0.40 kg');
assert.equal(formatSigned(-0.4, 2, 'kg'), '−0.40 kg');
assert.equal(formatSigned(0, 2, 'kg'), '0.00 kg');

assert.equal(formatAgeLabel('2026-08-20', NOW), '4 days');
assert.equal(formatAgeLabel('2026-07-24', NOW), '1 month');
assert.equal(formatAgeLabel('2025-08-24', NOW), '1 year');
assert.equal(formatAgeLabel('2024-05-24', NOW), '2 years 3 months');

const empty = buildVisitSummary(emptyInput());
assert.deepEqual(
  empty.sections.map((s) => s.title),
  [...VISIT_SUMMARY_SECTION_TITLES],
);
assert.match(empty.metaLines[0], /Date of birth: 24 August 2025/);
assert.match(empty.metaLines[0], /Age: 1 year/);
assert.match(empty.metaLines[1], /Prepared: 24 Aug 2026/);
assert.match(empty.metaLines[1], /No activity logged in the last 30 days/);
assert.equal(empty.sections[1].empty, 'None recorded in Milestones.');
assert.equal(empty.sections[2].empty, 'None recorded in Milestones.');

const newestFirst = [
  event('meal', '2026-08-24T10:00:00.000Z', { mealType: 'breast' }),
  event('meal', '2026-08-01T10:00:00.000Z', { mealType: 'breast' }),
];
const coverage = buildVisitSummary({ ...emptyInput(), events: newestFirst });
assert.match(coverage.metaLines[1], /1 Aug 2026 – 24 Aug 2026/);

const oldestFirst = [...newestFirst].reverse();
const coverageOldest = buildVisitSummary({ ...emptyInput(), events: oldestFirst });
assert.equal(coverage.metaLines[1], coverageOldest.metaLines[1]);

const growthRows = [
  growth({ id: 'g1', measured_at: '2026-08-24', weight_kg: 7.42, height_cm: 68.5, head_cm: 43.2 }),
  growth({ id: 'g2', measured_at: '2026-07-27', weight_kg: 7.02, height_cm: 67.0, head_cm: 42.8, notes: 'clinic' }),
  growth({ id: 'g3', measured_at: '2026-06-01', weight_kg: 6.50 }),
];
const growthModel = buildVisitSummary({ ...emptyInput(), growthEntries: growthRows });
const glance = growthModel.sections[0];
assert.equal(glance.stats?.[0].value, '7.42 kg');
assert.equal(glance.stats?.[1].value, '68.5 cm');
assert.equal(glance.stats?.[2].value, '43.2 cm');
assert.match(growthModel.sections[1].leads?.[0] ?? '', /Latest \(24 Aug 2026\): 7.42 kg · 68.5 cm · HC 43.2 cm/);
assert.match(growthModel.sections[1].leads?.[1] ?? '', /Change since 27 Jul 2026 \(28 days\): \+0.40 kg · \+1.5 cm · HC \+0.4 cm/);
assert.equal(growthModel.sections[1].rows?.[0].cells[0], '1 Jun 2026');
assert.equal(growthModel.sections[1].rows?.[2].emphasis, true);
assert.equal(growthModel.sections[1].rows?.[2].cells[0], '24 Aug 2026');

const manyGrowth = Array.from({ length: 12 }, (_, i) =>
  growth({
    id: `n${i}`,
    measured_at: `2026-08-${String(i + 1).padStart(2, '0')}`,
    weight_kg: 7 + i * 0.01,
  }),
);
const capped = buildVisitSummary({ ...emptyInput(), growthEntries: manyGrowth });
assert.equal(capped.sections[1].rows?.length, VISIT_SUMMARY_FORMAT.growthRows);
assert.match(capped.sections[1].notes?.[0] ?? '', /10 most recent of 12/);

const weekEvents: DailyEvent[] = [
  event('meal', '2026-08-24T08:00:00.000Z', { mealType: 'breast', durationMins: 20 }),
  event('meal', '2026-08-24T12:00:00.000Z', { mealType: 'bottle', amountMl: 150 }),
  event('meal', '2026-08-23T08:00:00.000Z', { mealType: 'breast', durationMins: 16 }),
  event('meal', '2026-08-23T12:00:00.000Z', { mealType: 'bottle', amountMl: 180 }),
  event('meal', '2026-08-23T18:00:00.000Z', { mealType: 'solid', food: 'banana' }),
  event('nappy', '2026-08-24T09:00:00.000Z', { nappyType: 'wet' }),
  event('nappy', '2026-08-24T11:00:00.000Z', { nappyType: 'dirty' }),
  event('nappy', '2026-08-23T09:00:00.000Z', { nappyType: 'both' }),
  event('sleep', '2026-08-23T20:00:00.000Z', { sleepEnd: '2026-08-24T06:00:00.000Z' }),
  event('sleep', '2026-08-24T10:00:00.000Z', { sleepEnd: '2026-08-24T11:30:00.000Z' }),
  event('temperature', '2026-08-22T16:10:00.000Z', { tempC: 38.4, method: 'axillary' }),
  event('temperature', '2026-08-21T09:00:00.000Z', { tempC: 37.1, method: 'ear' }),
  event('medication', '2026-08-22T16:20:00.000Z', { name: 'Paracetamol', doseAmountMl: 2.5 }),
  event('medication', '2026-08-21T16:20:00.000Z', { name: 'Paracetamol', doseAmountMl: 2.5 }),
  event('pump', '2026-08-24T07:00:00.000Z', { amountMl: 80 }),
];
const activity = buildVisitSummary({ ...emptyInput(), events: weekEvents });
const stats = Object.fromEntries((activity.sections[0].stats ?? []).map((s) => [s.label, s]));
assert.equal(stats['Feeds / day'].value, '2.5 / day');
assert.equal(stats['Bottle volume / day'].value, '165 ml / day');
assert.equal(stats['Sleep / day'].value, '5.8 h / day');
assert.equal(stats['Nappies / day'].value, '1.5 / day');
assert.match(stats['Nappies / day'].hint, /wet 1.0 · dirty 1.0 \/ day/);
assert.equal(stats['Highest temperature (14 d)'].value, '38.4°C');
assert.equal(stats['Highest temperature (14 d)'].alert, true);
assert.match(stats['Medicines (14 d)'].value, /Paracetamol \(2 doses\)/);

const sleepSection = activity.sections[5];
assert.match(sleepSection.leads?.[0] ?? '', /Total sleep: 11.5 h in 7 days · 5.8 h \/ day \(range 4.0 h–7.5 h\)/);
assert.match(sleepSection.leads?.[1] ?? '', /Night sleep: 5.0 h \/ day/);
assert.match(sleepSection.leads?.[2] ?? '', /Naps: 1.0 \/ day, 1.5 h \/ day/);
assert.match(sleepSection.leads?.[3] ?? '', /Nappies: 1.5 \/ day over 2 days \(wet 1 · dirty 1 · both 1\)/);

const feeding = activity.sections[3];
assert.match(feeding.leads?.join(' ') ?? '', /Breast: 2 feeds \(1.0 \/ day over 2 days\) · avg 18 min \/ feed/);
assert.match(feeding.leads?.join(' ') ?? '', /Bottle: 2 feeds, 330 ml total \(165 ml \/ day over 2 days\)/);
assert.match(feeding.leads?.join(' ') ?? '', /Solids \/ snacks: 1 meal/);
assert.match(feeding.leads?.join(' ') ?? '', /Expressed milk: 1 session, 80 ml total/);

const outsideWindow = buildVisitSummary({
  ...emptyInput(),
  events: [event('meal', '2026-07-01T12:00:00.000Z', { mealType: 'bottle', amountMl: 120 })],
});
assert.equal(outsideWindow.sections[0].stats?.find((s) => s.label === 'Feeds / day')?.value, '—');

const foods: SolidFood[] = [
  {
    id: 'f1',
    child_id: 'c1',
    food_name: 'Banana',
    introduced_at: '2026-08-20',
    is_top_allergen: false,
    reaction: 'none',
    reaction_notes: null,
    notes: null,
    created_by: null,
    created_at: '2026-08-20',
  },
  {
    id: 'f2',
    child_id: 'c1',
    food_name: 'Peanut',
    introduced_at: '2026-08-10',
    is_top_allergen: true,
    reaction: 'severe',
    reaction_notes: 'hives',
    notes: null,
    created_by: null,
    created_at: '2026-08-10',
  },
  {
    id: 'f3',
    child_id: 'c1',
    food_name: 'Egg',
    introduced_at: '2026-08-18',
    is_top_allergen: true,
    reaction: 'mild',
    reaction_notes: null,
    notes: null,
    created_by: null,
    created_at: '2026-08-18',
  },
];
assert.deepEqual(
  sortSolidFoodsForVisit(foods).map((f) => f.food_name),
  ['Peanut', 'Egg', 'Banana'],
);
const foodModel = buildVisitSummary({ ...emptyInput(), solidFoods: foods });
assert.match(foodModel.sections[3].leads?.[0] ?? '', /Peanut · Severe \(10 Aug 2026\) — hives/);
assert.equal(foodModel.sections[3].rows?.[0].alert, true);
assert.equal(foodModel.sections[3].rows?.[0].cells[2], 'Top allergen');

const milestones: Milestone[] = [
  {
    id: 'm1',
    child_id: 'c1',
    category: 'language',
    title: 'First smile',
    description: 'At grandad',
    achieved_at: '2026-08-01',
    media_urls: [],
    audio_url: null,
    is_private: false,
    created_by: null,
    created_at: '2026-08-01',
  },
  {
    id: 'm2',
    child_id: 'c1',
    category: 'movement',
    title: 'Rolled over',
    description: null,
    achieved_at: '2026-07-01',
    media_urls: [],
    audio_url: null,
    is_private: true,
    created_by: null,
    created_at: '2026-07-01',
  },
];
const words: FirstWord[] = [
  {
    id: 'w1',
    child_id: 'c1',
    word: 'mama',
    phonetic: 'mah-mah',
    said_at: '2026-08-12',
    notes: null,
    created_by: null,
    created_at: '2026-08-12',
  },
];
const development = buildVisitSummary({
  ...emptyInput(),
  milestones,
  firstWords: words,
});
assert.equal(development.sections[4].groups?.length, 1);
assert.match(development.sections[4].groups?.[0].heading ?? '', /Language \(1\)/);
assert.match(development.sections[4].groups?.[0].items[0] ?? '', /1 Aug 2026 — First smile. At grandad/);
assert.match(development.sections[4].notes?.join(' ') ?? '', /Private milestones are excluded/);
assert.equal(development.sections[4].rows?.[0].cells[1], 'mama');

const vaccines: VaccinationRecord[] = [
  {
    id: 'v1',
    child_id: 'c1',
    vaccine_code: '6in1',
    vaccine_name: '6-in-1',
    administered_at: '2026-06-01',
    dose_number: 1,
    clinic: 'GP',
    batch_number: 'AB12',
    reaction_notes: 'grizzly',
    created_by: null,
    created_at: '2026-06-01',
  },
];
const vax = buildVisitSummary({ ...emptyInput(), vaccinations: vaccines });
assert.deepEqual(vax.sections[2].rows?.[0].cells, [
  '1 Jun 2026',
  '6-in-1',
  'Dose 1',
  'GP',
  'AB12',
  'grizzly',
]);

const concerns = activity.sections[6];
assert.equal(concerns.rows?.[0].alert, true);
assert.equal(concerns.rows?.[0].cells[2], '38.4°C');
assert.match(concerns.rows?.find((r) => r.cells[1] === 'Paracetamol')?.cells[2] ?? '', /2.5 ml/);

const html = buildVisitSummaryHtml({ ...emptyInput(), growthEntries: growthRows, events: weekEvents });
for (const title of VISIT_SUMMARY_SECTION_TITLES) {
  assert.match(html, new RegExp(title));
}
assert.match(html, /1\.<\/span> At a glance/);
assert.match(html, /7\.<\/span> Recent illness and medicines/);
assert.doesNotMatch(html, /Activity log/);
assert.match(html, /tr class="latest"/);
assert.match(html, /38.4°C/);

console.log('visit-summary tests passed');
