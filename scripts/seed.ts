/**
 * Seed script — creates a realistic test parent + child + data.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed
 *
 * Get the service role key from:
 *   Supabase dashboard → Project Settings → API → service_role secret
 *
 * The script is idempotent: re-running it deletes the child's existing
 * events and milestones then re-inserts fresh data.
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://sdyfwnpzvlicgwcvksjh.supabase.co';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY is not set.\n');
  console.error(
    '    Get it from: Supabase dashboard → Project Settings → API → service_role',
  );
  console.error(
    '    Usage: SUPABASE_SERVICE_ROLE_KEY=your_key npm run seed\n',
  );
  process.exit(1);
}

const TEST_EMAIL = 'test@milestones.app';
const TEST_PASSWORD = 'Test1234!';

const CHILD = {
  name: 'Zachary',
  date_of_birth: '2024-07-28', // ~22 months old as of June 2026
};

// ─── Supabase admin client (bypasses RLS) ────────────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns an ISO timestamp for N days ago at the given hours:minutes (local). */
function ts(daysBack: number, hours: number, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// ─── Event generators ────────────────────────────────────────────────────────

type EventRow = {
  child_id: string;
  type: 'nappy' | 'meal' | 'sleep';
  occurred_at: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
};

// Age-appropriate food options for an 18–22 month toddler
const BREAKFASTS = [
  'porridge with banana', 'scrambled eggs on toast', 'weetbix & milk',
  'yoghurt & blueberries', 'toast with Vegemite', 'fruit & cheese',
];
const LUNCHES = [
  'cheese & crackers', 'chicken & avocado sandwich', 'pasta with veg sauce',
  'pumpkin soup & bread', 'rice & chicken pieces', 'mini quiche bites',
];
const DINNERS = [
  'pasta bolognese', 'grilled fish & steamed veg', 'chicken & sweet potato',
  'lamb & potato mash', 'beef rissoles & salad', 'vegetable frittata',
];
const SNACKS = [
  'banana slices', 'cheese cubes', 'rice crackers', 'apple & peanut butter',
  'yoghurt pouch', 'sultanas & crackers',
];

// Deterministic jitter: shifts a time by ±maxMins based on the day index
// so consecutive days feel natural without true randomness
function jitter(daysBack: number, seed: number, maxMins: number): number {
  return ((daysBack * seed + seed) % (maxMins * 2 + 1)) - maxMins;
}

function dayEvents(childId: string, userId: string, daysBack: number): EventRow[] {
  const d = daysBack;
  const e: EventRow[] = [];

  const row = (
    type: EventRow['type'],
    hours: number,
    minutes: number,
    metadata: Record<string, unknown>,
    notes: string | null = null,
  ): EventRow => ({
    child_id: childId,
    type,
    occurred_at: ts(d, hours, minutes),
    notes,
    metadata,
    created_by: userId,
  });

  // ── Research basis (18–22 months) ─────────────────────────────────────
  // Sleep:   1 night (~10–11 h) + 1 afternoon nap (~1.5–2 h) = 2/day
  // Nappies: 3–4/day  (morning, pre-nap/post-nap, pre-bed)
  // Meals:   3 mains + 1–2 snacks + 1–2 milk drinks = 5–7/day
  // Total:   ~10–12 events/day

  // ── Night sleep (previous evening → this morning) ────────────────────
  // Wake time varies 6:00–6:30 am
  const wakeMin = 15 + jitter(d, 3, 15);          // 6:00–6:30 am
  e.push(row('sleep', 19, 30, { sleepEnd: ts(d - 1, 6, wakeMin) }));

  // ── Morning milk (sippy cup / bottle) ────────────────────────────────
  const morningMlOptions = [150, 180, 200];
  e.push(row('meal', 6, 30 + jitter(d, 5, 10), {
    mealType: 'bottle',
    amountMl: morningMlOptions[d % morningMlOptions.length],
  }));

  // ── Morning nappy ─────────────────────────────────────────────────────
  // Post-breakfast dirty nappy on ~40 % of days (d % 5 < 2), otherwise wet
  const morningNappyType = (d % 5 < 2) ? pick(['dirty', 'both'], d) : 'wet';
  e.push(row('nappy', 7, 30 + jitter(d, 7, 10), { nappyType: morningNappyType }));

  // ── Breakfast ─────────────────────────────────────────────────────────
  e.push(row('meal', 8, 0 + jitter(d, 11, 10), {
    mealType: 'solid',
    food: pick(BREAKFASTS, d),
  }));

  // ── Morning snack (~60 % of days) ────────────────────────────────────
  if (d % 5 < 3) {
    e.push(row('meal', 10, 0 + jitter(d, 13, 15), {
      mealType: 'snack',
      food: pick(SNACKS, d + 1),
    }));
  }

  // ── Pre-lunch nappy ───────────────────────────────────────────────────
  const preLunchNappyType = (d % 4 === 0) ? pick(['dirty', 'both'], d) : 'wet';
  e.push(row('nappy', 11, 30 + jitter(d, 17, 10), { nappyType: preLunchNappyType }));

  // ── Lunch ─────────────────────────────────────────────────────────────
  e.push(row('meal', 12, 0 + jitter(d, 19, 10), {
    mealType: 'solid',
    food: pick(LUNCHES, d),
  }));

  // ── Afternoon nap (~1.5–2 h; 18–22 months = one nap per day) ─────────
  const napStartMin = 30 + jitter(d, 23, 15);     // 12:15–12:45 pm start
  const napDurMins  = 90 + (d % 4) * 15;          // 90, 105, 120, or 135 min
  const napEndMins  = napStartMin + napDurMins;
  const napEndH     = 12 + Math.floor(napEndMins / 60);
  const napEndM     = napEndMins % 60;
  e.push(row('sleep', 12, napStartMin, { sleepEnd: ts(d, napEndH, napEndM) }));

  // ── Post-nap nappy (~65 % of days) ───────────────────────────────────
  if (d % 3 !== 2) {
    e.push(row('nappy', napEndH, napEndM + 10, { nappyType: 'wet' }));
  }

  // ── Afternoon snack (~75 % of days) ──────────────────────────────────
  if (d % 4 !== 0) {
    e.push(row('meal', 15, 0 + jitter(d, 29, 15), {
      mealType: 'snack',
      food: pick(SNACKS, d + 3),
    }));
  }

  // ── Dinner ────────────────────────────────────────────────────────────
  e.push(row('meal', 17, 30 + jitter(d, 31, 15), {
    mealType: 'solid',
    food: pick(DINNERS, d),
  }));

  // ── Evening milk ──────────────────────────────────────────────────────
  const eveningMl = [150, 180, 200][d % 3];
  e.push(row('meal', 18, 45 + jitter(d, 37, 10), {
    mealType: 'bottle',
    amountMl: eveningMl,
  }));

  // ── Pre-bed nappy (always) ────────────────────────────────────────────
  const bedNappyType = (d % 3 === 0) ? 'both' : 'wet';
  e.push(row('nappy', 19, 10 + jitter(d, 41, 5), { nappyType: bedNappyType }));

  return e;
}

// ─── Milestones ──────────────────────────────────────────────────────────────

type MilestoneRow = {
  child_id: string;
  category: 'word' | 'steps' | 'physical' | 'custom';
  title: string;
  description: string;
  achieved_at: string;
  media_urls: string[];
  created_by: string;
};

function milestones(childId: string, userId: string): MilestoneRow[] {
  const m = (
    category: MilestoneRow['category'],
    title: string,
    description: string,
    achieved_at: string,
  ): MilestoneRow => ({
    child_id: childId,
    category,
    title,
    description,
    achieved_at,
    media_urls: [],
    created_by: userId,
  });

  // Zachary DOB: 2024-07-28  (~22 months old as of June 2026)
  // Dates are grounded in WHO/CDC developmental milestone schedules
  return [
    // ── 0–1 month ─────────────────────────────────────────────────────────────
    m('custom', 'Welcome to the world',
      'Zachary arrived safe and healthy at 3.4 kg. First cuddles on the chest — nothing in the world like it.',
      '2024-07-28'),

    // ── ~6 weeks ──────────────────────────────────────────────────────────────
    m('physical', 'First social smile',
      'Looked right at us during a nappy change and gave the biggest gummy grin. Heart completely melted.',
      '2024-09-06'),

    // ── ~2 months ─────────────────────────────────────────────────────────────
    m('word', 'First coos',
      'Started making soft "ooh" and "aah" vowel sounds — his first attempt at conversation.',
      '2024-09-28'),
    m('physical', 'Holds head steady',
      'During tummy time he lifted his head to 45° and held it for a solid 10 seconds. Little neck muscles are working!',
      '2024-10-05'),

    // ── ~3 months ─────────────────────────────────────────────────────────────
    m('physical', 'First laugh',
      'A proper belly giggle triggered by blowing raspberries on his tummy. We did it about 40 times in a row.',
      '2024-10-28'),

    // ── ~4 months ─────────────────────────────────────────────────────────────
    m('physical', 'Rolls tummy to back',
      'Completely surprised himself — looked around as if to say "how did I get here?" Classic.',
      '2024-11-22'),
    m('physical', 'Reaches and grabs',
      'Deliberately batted at a hanging toy and then grabbed it. Concentrating so hard his tongue was out.',
      '2024-12-01'),

    // ── ~5 months ─────────────────────────────────────────────────────────────
    m('physical', 'Rolls back to tummy',
      'Completes the full roll now — can get himself into any position he wants during floor time.',
      '2024-12-28'),

    // ── ~6 months ─────────────────────────────────────────────────────────────
    m('custom', 'First solid food',
      'Tried baby rice cereal mixed with breast milk, then puréed sweet potato. Made the most dramatic face, then opened his mouth for more.',
      '2025-01-28'),
    m('physical', 'Sits with support',
      'Sits confidently in the highchair and between cushions on the floor — loves being upright to see the world.',
      '2025-02-03'),

    // ── ~7 months ─────────────────────────────────────────────────────────────
    m('physical', 'Sits independently',
      'Balanced on his own for a full minute without toppling. Immediately celebrated by grabbing his foot.',
      '2025-02-28'),

    // ── ~8 months ─────────────────────────────────────────────────────────────
    m('word', 'Babbling begins',
      'Streams of "ba-ba-ba", "da-da-da" and "ma-ma-ma" — no meaning yet but very opinionated about the volume.',
      '2025-03-20'),
    m('physical', 'First crawl',
      'Started with an army-crawl drag, then figured out proper hands-and-knees crawling within a week. Nothing is safe now.',
      '2025-03-28'),

    // ── ~9 months ─────────────────────────────────────────────────────────────
    m('physical', 'Pincer grasp',
      'Picks up individual peas and blueberries with thumb and forefinger. Very pleased with himself.',
      '2025-04-15'),
    m('physical', 'Pulls to stand',
      'Grabbed the edge of the coffee table and hauled himself upright — then looked around proudly for applause.',
      '2025-04-28'),
    m('physical', 'Claps hands',
      'Started clapping during a round of pat-a-cake. Now claps for himself after every achievement, big or small.',
      '2025-05-10'),

    // ── ~10 months ────────────────────────────────────────────────────────────
    m('physical', 'Cruises furniture',
      'Shuffles sideways along the couch and coffee table — doing laps of the living room.',
      '2025-05-28'),
    m('word', 'Says "dada"',
      'Said "dada" clearly while reaching up toward his dad. Dad may have shed a tear or two.',
      '2025-06-12'),

    // ── ~11 months ────────────────────────────────────────────────────────────
    m('word', 'Says "mama"',
      'Looked right at mum and said "mama" with full eye contact. The best word in the English language.',
      '2025-07-04'),
    m('steps', 'First independent steps',
      'Three glorious wobbly steps from the couch to the armchair. We cheered so loud he sat down in fright, then grinned.',
      '2025-07-20'),

    // ── 12 months / First birthday ────────────────────────────────────────────
    m('custom', 'First birthday! 🎂',
      'One whole year of Zachary. Cake was demolished with impressive commitment. Walking is the new thing.',
      '2025-07-28'),
    m('physical', 'Waves bye-bye',
      'Consistent wave whenever someone leaves — including waving at his own reflection in the mirror.',
      '2025-08-05'),

    // ── ~13 months ────────────────────────────────────────────────────────────
    m('steps', 'Walking confidently',
      'Crawling is officially retired. He toddles everywhere with arms out wide for balance — like a tiny penguin.',
      '2025-08-28'),
    m('word', 'Says "ball"',
      'First clear word beyond mama and dada. Points at every round object and announces "ball!" with great satisfaction.',
      '2025-09-10'),

    // ── ~14 months ────────────────────────────────────────────────────────────
    m('physical', 'Climbs onto furniture',
      'Scales the couch entirely independently. We have learned to keep the cushions on the floor.',
      '2025-09-28'),

    // ── ~15 months ────────────────────────────────────────────────────────────
    m('word', '10-word vocabulary',
      '"mama", "dada", "ball", "dog", "no", "more", "up", "bye", "uh-oh", "yeah" — and adding one or two new words a week.',
      '2025-10-28'),
    m('physical', 'Stacks blocks',
      'Built a tower of four blocks before gleefully knocking it over. Repeat indefinitely.',
      '2025-11-10'),

    // ── ~16 months ────────────────────────────────────────────────────────────
    m('custom', 'Pretend play begins',
      'Picked up a toy phone and held it to his ear babbling away. Then offered it to us. Pretending is the new reality.',
      '2025-11-28'),
    m('physical', 'Uses a spoon',
      'Insists on self-feeding with a spoon. Yoghurt ends up everywhere except his mouth, but the determination is incredible.',
      '2025-12-05'),

    // ── ~17 months ────────────────────────────────────────────────────────────
    m('word', 'First 2-word phrase',
      'Said "more milk" clearly at dinner while pointing at his cup. Two-word combinations arriving fast now.',
      '2025-12-28'),
    m('steps', 'Running!',
      'Not just walking — full running with arms flapping for balance. Mostly laughing while doing it.',
      '2026-01-10'),

    // ── ~18 months ────────────────────────────────────────────────────────────
    m('physical', 'Kicks a ball',
      'Deliberately lines up a kick and boots the ball across the garden. Celebrates every single time.',
      '2026-01-28'),
    m('word', '20+ word vocabulary',
      'Language is exploding — car, bird, hot, wet, shoe, hat, eat, sleep, down, mine, ta, again…',
      '2026-02-10'),

    // ── ~19 months ────────────────────────────────────────────────────────────
    m('physical', 'Jumps with both feet',
      'First proper two-footed jump off the bottom step. Demands we watch every single jump. Forever.',
      '2026-02-28'),
    m('word', 'Uses "no" deliberately',
      'Vigorously shakes head and says "no!" with great emphasis. An important developmental milestone, apparently.',
      '2026-03-15'),

    // ── ~20 months ────────────────────────────────────────────────────────────
    m('word', 'Names body parts',
      'Points to and correctly names eyes, nose, mouth, ears, tummy and toes on request. Very proud of his toes.',
      '2026-03-28'),
    m('custom', 'Empathy emerging',
      'When his cousin cried, he toddled over, patted her back and said "oh no". Tiny but huge.',
      '2026-04-12'),

    // ── ~21 months ────────────────────────────────────────────────────────────
    m('word', 'Regular 2-word sentences',
      '"Daddy go", "more biscuit", "big dog", "Zac sit" — stringing two words together constantly now.',
      '2026-04-28'),
    m('physical', 'Navigates playground independently',
      'Climbs the small slide ladder, sits at the top, and slides down all by himself. Pure joy.',
      '2026-05-20'),

    // ── ~22 months ────────────────────────────────────────────────────────────
    m('word', '50+ word vocabulary',
      'Language explosion in full swing — new words appearing every single day. We have stopped trying to count.',
      '2026-06-10'),
    m('physical', 'Throws overhand',
      'Proper overhand throw — winds his whole little body up first. Future cricket star, obviously.',
      '2026-06-15'),
  ];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  Starting seed…\n');

  // ── Step 1: User ──────────────────────────────────────────────────────────
  console.log(`👤  Resolving user ${TEST_EMAIL} …`);

  const { data: { users: allUsers }, error: listErr } =
    await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const existing = allUsers.find(u => u.email === TEST_EMAIL);
  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`    ↩  Already exists — reusing ${userId}`);
  } else {
    const { data: { user }, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error || !user) throw new Error(`createUser: ${error?.message}`);
    userId = user.id;
    console.log(`    ✓  Created ${userId}`);
  }

  // ── Step 2: Child ─────────────────────────────────────────────────────────
  console.log(`\n👶  Resolving child "${CHILD.name}" …`);

  const { data: existingChildren, error: childListErr } = await admin
    .from('children')
    .select('id')
    .eq('created_by', userId);
  if (childListErr) throw new Error(`listChildren: ${childListErr.message}`);

  let childId: string;

  if (existingChildren && existingChildren.length > 0) {
    childId = existingChildren[0].id;
    console.log(`    ↩  Already exists — reusing ${childId}`);

    // Always sync name + DOB to match current CHILD config (handles renames).
    const { error: updateErr } = await admin
      .from('children')
      .update({ name: CHILD.name, date_of_birth: CHILD.date_of_birth })
      .eq('id', childId);
    if (updateErr) throw new Error(`updateChild: ${updateErr.message}`);
    console.log(`    ✓  Updated name="${CHILD.name}" dob="${CHILD.date_of_birth}"`);

    // Guarantee the owner membership row exists (trigger may have been
    // missed if the child was inserted via service role on a previous run).
    const { error: memberErr } = await admin
      .from('child_members')
      .upsert({ child_id: childId, user_id: userId, role: 'owner' }, { onConflict: 'child_id,user_id' });
    if (memberErr) throw new Error(`upsertMember: ${memberErr.message}`);
    console.log(`    ✓  child_members owner row confirmed`);
  } else {
    const { data: child, error } = await admin
      .from('children')
      .insert({ ...CHILD, created_by: userId })
      .select('id')
      .single();
    if (error || !child) throw new Error(`insertChild: ${error?.message}`);
    childId = child.id;
    console.log(`    ✓  Created ${childId}`);
  }

  // ── Step 3: Daily events ──────────────────────────────────────────────────
  console.log(`\n📅  Generating daily events (90 days) …`);

  const { error: delEventsErr } = await admin
    .from('daily_events')
    .delete()
    .eq('child_id', childId);
  if (delEventsErr) throw new Error(`deleteEvents: ${delEventsErr.message}`);

  // Today: morning events only — no future timestamps
  // Mirrors the new realistic schedule (morning milk → nappy → breakfast)
  const todayEvents: EventRow[] = [
    { child_id: childId, type: 'meal',  occurred_at: ts(0, 6, 30), notes: null, metadata: { mealType: 'bottle', amountMl: 180 },           created_by: userId },
    { child_id: childId, type: 'nappy', occurred_at: ts(0, 7, 30), notes: null, metadata: { nappyType: 'wet' },                             created_by: userId },
    { child_id: childId, type: 'meal',  occurred_at: ts(0, 8,  0), notes: null, metadata: { mealType: 'solid', food: 'porridge with banana' }, created_by: userId },
  ];

  // Full days for days 1–13
  const pastEvents: EventRow[] = [];
  for (let day = 1; day <= 89; day++) {
    pastEvents.push(...dayEvents(childId, userId, day));
  }

  const allEvents = [...todayEvents, ...pastEvents];

  const { error: insertEventsErr } = await admin
    .from('daily_events')
    .insert(allEvents);
  if (insertEventsErr) throw new Error(`insertEvents: ${insertEventsErr.message}`);
  console.log(`    ✓  Inserted ${allEvents.length} events`);

  // ── Step 4: Milestones ────────────────────────────────────────────────────
  console.log(`\n🏆  Generating milestones …`);

  const { error: delMilestonesErr } = await admin
    .from('milestones')
    .delete()
    .eq('child_id', childId);
  if (delMilestonesErr) throw new Error(`deleteMilestones: ${delMilestonesErr.message}`);

  const ms = milestones(childId, userId);
  const { error: insertMilestonesErr } = await admin
    .from('milestones')
    .insert(ms);
  if (insertMilestonesErr) throw new Error(`insertMilestones: ${insertMilestonesErr.message}`);
  console.log(`    ✓  Inserted ${ms.length} milestones`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(44));
  console.log('✅  Seed complete!');
  console.log('─'.repeat(44));
  console.log(`  Email     : ${TEST_EMAIL}`);
  console.log(`  Password  : ${TEST_PASSWORD}`);
  console.log(`  Child     : ${CHILD.name}  (DOB ${CHILD.date_of_birth})`);
  console.log(`  Events    : ${allEvents.length}`);
  console.log(`  Milestones: ${ms.length}`);
  console.log('─'.repeat(44) + '\n');
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message, '\n');
  process.exit(1);
});
