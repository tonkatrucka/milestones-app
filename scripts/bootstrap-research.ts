/**
 * Invokes research-refresh in bootstrap mode across all packs (staggered).
 *
 * Usage:
 *   npm run bootstrap:research              # one pack cluster (~1–3 min)
 *   npm run bootstrap:research -- --all     # full bank (~2–4 hours)
 *
 * Requires in `.env` (or shell):
 *   EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY — Dashboard → Project Settings → API → service_role
 *
 * Optional:
 *   CRON_SECRET — if set on the edge function, send the same value locally
 *
 * Options:
 *   --offset 0 --limit 1       pack slice (bootstrap defaults: limit 1)
 *   --cluster 0                subtopic cluster 0–2 (default 0)
 *   --all                      run all 42 packs × 3 clusters sequentially
 *   --mode append|hygiene
 */

import { loadEnvFile } from './load-env.ts';

loadEnvFile();

const PACK_COUNT = 42;
const CLUSTERS_PER_PACK = 3;

const SUPABASE_URL = (
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  ''
).trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();
const ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ''
).trim();

function jwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { role?: string };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let offset = 0;
  let limit = 1;
  let clusterIndex = 0;
  let all = false;
  let mode: 'bootstrap' | 'append' | 'hygiene' = 'bootstrap';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--offset') offset = Number(args[++i] ?? 0);
    if (args[i] === '--limit') limit = Number(args[++i] ?? 1);
    if (args[i] === '--cluster') clusterIndex = Number(args[++i] ?? 0);
    if (args[i] === '--mode') mode = (args[++i] as typeof mode) ?? 'bootstrap';
    if (args[i] === '--all') all = true;
  }
  return { offset, limit, clusterIndex, all, mode };
}

function fail(message: string): never {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CRON_SECRET) {
    headers['x-cron-secret'] = CRON_SECRET;
    headers.Authorization = `Bearer ${SERVICE_KEY || ANON_KEY}`;
    if (SERVICE_KEY || ANON_KEY) headers.apikey = SERVICE_KEY || ANON_KEY;
  } else {
    headers.Authorization = `Bearer ${SERVICE_KEY}`;
    headers.apikey = SERVICE_KEY;
  }
  return headers;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invoke(params: {
  mode: 'bootstrap' | 'append' | 'hygiene';
  offset: number;
  limit: number;
  clusterIndex?: number;
}) {
  const url = `${SUPABASE_URL}/functions/v1/research-refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { res, json };
}

function printBootstrapNext(offset: number, clusterIndex: number) {
  const nextCluster = clusterIndex + 1;
  if (nextCluster < CLUSTERS_PER_PACK) {
    console.log(
      `\nNext: npm run bootstrap:research -- --offset ${offset} --cluster ${nextCluster}`,
    );
    return;
  }
  const nextOffset = offset + 1;
  if (nextOffset < PACK_COUNT) {
    console.log(`\nNext: npm run bootstrap:research -- --offset ${nextOffset} --cluster 0`);
    return;
  }
  console.log('\nBootstrap complete for all 42 packs.');
}

async function main() {
  if (!SUPABASE_URL) {
    fail(
      'Missing Supabase URL.\n' +
        'Add EXPO_PUBLIC_SUPABASE_URL to .env or set SUPABASE_URL in your shell.',
    );
  }

  if (!SERVICE_KEY && !CRON_SECRET) {
    fail(
      'Missing credentials.\n' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard → Project Settings → API → service_role),\n' +
        'or set CRON_SECRET if you configured it on the edge function.',
    );
  }

  const role = SERVICE_KEY ? jwtRole(SERVICE_KEY) : null;
  if (SERVICE_KEY && role && role !== 'service_role') {
    fail(
      `SUPABASE_SERVICE_ROLE_KEY looks like a "${role}" key, not service_role.\n` +
        'Copy the service_role secret from Dashboard → Project Settings → API.',
    );
  }

  const { offset, limit, clusterIndex, all, mode } = parseArgs();

  if (all && mode !== 'bootstrap') {
    fail('--all is only supported for bootstrap mode.');
  }

  if (all) {
    console.log(
      `Running full bootstrap: ${PACK_COUNT} packs × ${CLUSTERS_PER_PACK} clusters ` +
        `(~2–4 hours). Deploy research-refresh first.\n`,
    );
    for (let pack = 0; pack < PACK_COUNT; pack++) {
      for (let cluster = 0; cluster < CLUSTERS_PER_PACK; cluster++) {
        const label = `pack ${pack + 1}/${PACK_COUNT}, cluster ${cluster + 1}/${CLUSTERS_PER_PACK}`;
        console.log(`\n▶ ${label}…`);
        const { res, json } = await invoke({
          mode: 'bootstrap',
          offset: pack,
          limit: 1,
          clusterIndex: cluster,
        });
        console.log(JSON.stringify(json, null, 2));
        if (!res.ok) {
          if (res.status === 401) {
            fail(
              'Unauthorized — check SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET in .env.',
            );
          }
          fail(`Failed on ${label}. Fix the error above, then resume with:\n` +
            `  npm run bootstrap:research -- --offset ${pack} --cluster ${cluster}`);
        }
        await sleep(2000);
      }
    }
    console.log('\nBootstrap complete.');
    return;
  }

  const { res, json } = await invoke({
    mode,
    offset,
    limit,
    ...(mode === 'bootstrap' ? { clusterIndex } : {}),
  });

  console.log(JSON.stringify(json, null, 2));

  if (!res.ok) {
    if (res.status === 401) {
      fail(
        'Unauthorized — credentials did not match the deployed research-refresh function.\n' +
          '1. Confirm SUPABASE_SERVICE_ROLE_KEY is the service_role secret (not anon).\n' +
          '2. Confirm EXPO_PUBLIC_SUPABASE_URL matches the project where you deployed functions.\n' +
          '3. Redeploy: npx supabase functions deploy research-refresh\n' +
          '4. If you set CRON_SECRET on Supabase, add the same value to .env',
      );
    }
    if (String((json as { code?: string }).code) === 'WORKER_RESOURCE_LIMIT') {
      fail(
        'Edge function ran out of compute. Redeploy research-refresh, then retry with:\n' +
          '  npm run bootstrap:research -- --limit 1 --cluster 0\n' +
        'Or run the full bank overnight:\n' +
          '  npm run bootstrap:research -- --all',
      );
    }
    process.exitCode = 1;
    return;
  }

  if (mode === 'bootstrap') {
    printBootstrapNext(offset, clusterIndex);
  } else if (mode === 'append' && offset + limit < PACK_COUNT) {
    console.log(`\nNext: npm run bootstrap:research -- --mode append --offset ${offset + limit} --limit ${limit}`);
  } else if (mode === 'hygiene' && offset + limit < 50) {
    console.log(
      `\nNext: npm run bootstrap:research -- --mode hygiene --offset ${offset + limit} --limit ${limit}`,
    );
  }
}

main().catch((e) => {
  if (!process.exitCode) process.exitCode = 1;
  if (e instanceof Error && e.message) return;
  console.error(e);
});
