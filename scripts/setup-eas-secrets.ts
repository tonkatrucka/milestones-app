/**
 * Create EAS environment variables from local .env for store builds.
 *
 * Prerequisites:
 *   1. npx eas-cli login
 *   2. npx eas-cli init   (links project; writes extra.eas.projectId to app.json)
 *   3. Copy .env.example to .env and fill in Supabase values
 *
 * Usage:
 *   npm run setup:eas-secrets
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(path)) return vars;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const fileEnv = loadEnvFile(resolve(process.cwd(), '.env'));
const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? fileEnv.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!url || !anonKey) {
  console.error('\nMissing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  console.error('Set them in .env (copy from .env.example) or export before running.\n');
  process.exit(1);
}

function upsertEnv(name: string, value: string) {
  try {
    execSync(
      [
        'npx eas-cli env:create',
        `--name ${name}`,
        `--value ${JSON.stringify(value)}`,
        '--environment preview production',
        '--visibility plaintext',
        '--force',
        '--non-interactive',
      ].join(' '),
      { stdio: 'inherit' },
    );
  } catch {
    process.exit(1);
  }
}

console.log('\nCreating EAS env vars for preview + production builds...\n');
upsertEnv('EXPO_PUBLIC_SUPABASE_URL', url);
upsertEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', anonKey);
console.log('\nDone. Verify on expo.dev → Project → Environment variables.');
console.log('List via CLI: npx eas-cli env:list --environment preview\n');
