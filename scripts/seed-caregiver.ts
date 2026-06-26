/**
 * Creates (or reuses) a caregiver test account linked to Zachary.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed-caregiver.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://sdyfwnpzvlicgwcvksjh.supabase.co';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const CAREGIVER_EMAIL = 'caregiver@milestones.app';
const CAREGIVER_PASSWORD = 'Test1234!';
const CHILD_NAME = 'Zachary';

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY is not set.\n');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveUser(email: string, password: string): Promise<string> {
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const existing = users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data: { user }, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !user) throw new Error(`createUser(${email}): ${error?.message}`);
  return user.id;
}

async function main() {
  console.log(`\n👥  Resolving caregiver ${CAREGIVER_EMAIL} …`);

  const caregiverId = await resolveUser(CAREGIVER_EMAIL, CAREGIVER_PASSWORD);
  console.log(`    ✓  User id: ${caregiverId}`);

  const { data: child, error: childErr } = await admin
    .from('children')
    .select('id, name')
    .eq('name', CHILD_NAME)
    .limit(1)
    .maybeSingle();

  if (childErr) throw new Error(`findChild: ${childErr.message}`);
  if (!child) {
    throw new Error(`No child named "${CHILD_NAME}" found. Run npm run seed first.`);
  }

  const { error: memberErr } = await admin.from('child_members').upsert(
    { child_id: child.id, user_id: caregiverId, role: 'caregiver' },
    { onConflict: 'child_id,user_id' },
  );
  if (memberErr) throw new Error(`upsertMember: ${memberErr.message}`);

  console.log(`    ✓  Linked to ${child.name} (${child.id}) as caregiver`);
  console.log('\n' + '─'.repeat(44));
  console.log('✅  Caregiver account ready');
  console.log('─'.repeat(44));
  console.log(`  Email   : ${CAREGIVER_EMAIL}`);
  console.log(`  Password: ${CAREGIVER_PASSWORD}`);
  console.log('─'.repeat(44) + '\n');
}

main().catch((err) => {
  console.error('\n❌  Failed:', err.message, '\n');
  process.exit(1);
});
