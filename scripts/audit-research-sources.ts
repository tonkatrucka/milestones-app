/**
 * Reports research_bullets by domain and flags rows outside the allowlist.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/audit-research-sources.ts
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './load-env.ts';
import {
  isDomainOnAllowlist,
  TRUSTED_RESEARCH_SOURCES,
} from '../supabase/functions/_shared/research-sources-registry.ts';

loadEnvFile();

function isAllowed(domain: string): boolean {
  return isDomainOnAllowlist(domain);
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const db = createClient(url, key);
  const { data, error } = await db.from('research_bullets').select('source_domain, source_tier, active');
  if (error) throw error;

  const byDomain = new Map<string, number>();
  let tier3b = 0;
  let active = 0;
  const violations: string[] = [];

  for (const row of data ?? []) {
    if (!row.active) continue;
    active++;
    byDomain.set(row.source_domain, (byDomain.get(row.source_domain) ?? 0) + 1);
    if (row.source_tier === 'tier_3b') tier3b++;
    if (!isAllowed(row.source_domain)) violations.push(row.source_domain);
  }

  console.log(`Active bullets: ${active}`);
  console.log(`tier_3b share: ${active ? ((tier3b / active) * 100).toFixed(1) : 0}%`);
  console.log(`Allowlist size: ${TRUSTED_RESEARCH_SOURCES.length} domains + suffix wildcards`);
  console.log('\nBy domain:');
  for (const [domain, count] of [...byDomain.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${domain}: ${count}`);
  }

  if (violations.length) {
    console.error('\nAllowlist violations:', [...new Set(violations)]);
    process.exit(1);
  }
  console.log('\nAll domains within allowlist.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
