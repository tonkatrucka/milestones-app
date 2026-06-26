/**
 * Smoke-test insights edge function caching behaviour.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_USER_JWT=... CHILD_ID=... npx tsx scripts/verify-insights.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const JWT = process.env.TEST_USER_JWT ?? '';
const CHILD_ID = process.env.CHILD_ID ?? '';
const CHILD_NAME = process.env.CHILD_NAME ?? 'Test';
const CHILD_DOB = process.env.CHILD_DOB ?? '2023-06-01';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function invoke() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      child: { id: CHILD_ID, name: CHILD_NAME, date_of_birth: CHILD_DOB },
      currentDate: today(),
      userRegion: 'GB',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY || !JWT || !CHILD_ID) {
    console.log('Skipping live verify — set SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_JWT, CHILD_ID');
    process.exit(0);
  }

  const first = await invoke();
  const second = await invoke();

  if (JSON.stringify(first.shortInsights) !== JSON.stringify(second.shortInsights)) {
    throw new Error('Same-day observations changed between invokes');
  }

  const firstIds = (first.researchBullets ?? []).map((b: { id: string }) => b.id).join(',');
  const secondIds = (second.researchBullets ?? []).map((b: { id: string }) => b.id).join(',');
  if (firstIds !== secondIds) {
    throw new Error('Same-day research selection changed between invokes');
  }

  console.log('verify-insights: same-day cache stable ✓');
  console.log(`  observations: ${first.shortInsights?.length ?? 0} bullets`);
  console.log(`  research: ${first.researchBullets?.length ?? 0} bullets`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
