/**
 * Create GitHub Actions repository secrets from local .env for research cron workflows.
 *
 * Prerequisites:
 *   1. gh auth login
 *   2. Copy .env.example to .env and fill in Supabase values
 *
 * Usage:
 *   npm run setup:github-secrets
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

function gitRemoteRepo(): string | null {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const fileEnv = loadEnvFile(resolve(process.cwd(), '.env'));

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  fileEnv.SUPABASE_URL ??
  fileEnv.EXPO_PUBLIC_SUPABASE_URL ??
  '';

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY ?? '';

const cronSecret = process.env.CRON_SECRET ?? fileEnv.CRON_SECRET ?? '';

const missing: string[] = [];
if (!supabaseUrl || supabaseUrl.includes('your-project')) {
  missing.push('EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)');
}
if (!serviceRoleKey || serviceRoleKey.includes('your-service-role')) {
  missing.push('SUPABASE_SERVICE_ROLE_KEY');
}

if (missing.length > 0) {
  console.error('\nMissing values in .env:\n');
  for (const name of missing) console.error(`  - ${name}`);
  console.error('\nCopy .env.example to .env and fill in real Supabase values.\n');
  process.exit(1);
}

const cronConfigured =
  cronSecret.length > 0 && !cronSecret.includes('your-cron');

const repo = process.env.GITHUB_REPOSITORY ?? gitRemoteRepo();
if (!repo) {
  console.error('\nCould not detect GitHub repo. Set GITHUB_REPOSITORY or run from a git clone.\n');
  process.exit(1);
}

function setSecret(name: string, value: string) {
  execSync(`gh secret set ${name} --repo ${repo} --body ${JSON.stringify(value)}`, {
    stdio: 'inherit',
  });
}

console.log(`\nSetting GitHub Actions secrets on ${repo}...\n`);
setSecret('SUPABASE_URL', supabaseUrl);
setSecret('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey);
if (cronConfigured) {
  setSecret('CRON_SECRET', cronSecret);
} else {
  console.log('Skipping CRON_SECRET (not in .env — keep existing GitHub secret if already set).\n');
}
console.log('\nDone. Re-run failed workflows from GitHub → Actions.\n');
