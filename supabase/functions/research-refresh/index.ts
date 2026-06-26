import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import {
  createDedupContext,
  recordAccepted,
  validateCandidate,
  type CandidateBullet,
  type StoredBullet,
} from '../_shared/research-dedup.ts';
import { isAuthorizedMaintenanceRequest } from '../_shared/cron-auth.ts';
import {
  parseResearchModelResponse,
  type ModelParseDebug,
} from '../_shared/research-model-parse.ts';
import {
  ageBracketLabel,
  type AgeBracket,
} from '../_shared/insight-stats.ts';
import {
  ALL_AGE_BRACKETS,
  ALL_CATEGORIES,
  categorySearchHint,
  RESEARCH_SYSTEM_INSTRUCTIONS,
  validateSourceUrl,
  type ResearchCategory,
} from '../_shared/research-source-policy.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, x-client-info, apikey, x-cron-secret',
};

type RefreshMode = 'bootstrap' | 'append' | 'hygiene';

interface RequestBody {
  mode: RefreshMode;
  offset?: number;
  limit?: number;
  /** Bootstrap only: 0–2, one subtopic cluster per invocation */
  clusterIndex?: number;
  pack?: { age_bracket: AgeBracket; category: ResearchCategory };
}

const SUBTOPIC_CLUSTERS: Record<ResearchCategory, string[][]> = {
  sleep: [['night_sleep', 'safe_sleep'], ['naps', 'nap_transitions'], ['regressions', 'bedtime']],
  feeding: [['milk', 'bottle'], ['solids', 'appetite'], ['hydration', 'schedules']],
  development: [['motor', 'cognitive'], ['social', 'emotional'], ['play', 'attachment']],
  milestones: [['upcoming', 'variation'], ['encouraging', 'red_flags']],
  regression: [['sleep_regression', 'behaviour'], ['illness', 'recovery']],
  language: [['babbling', 'first_words'], ['comprehension', 'bilingual']],
};

function packsForMode(): { age_bracket: AgeBracket; category: ResearchCategory }[] {
  const all: { age_bracket: AgeBracket; category: ResearchCategory }[] = [];
  for (const age_bracket of ALL_AGE_BRACKETS) {
    for (const category of ALL_CATEGORIES) {
      all.push({ age_bracket, category });
    }
  }
  return all;
}

async function callResearchModel(
  anthropic: Anthropic,
  userPrompt: string,
): Promise<{ bullets: CandidateBullet[]; debug?: ModelParseDebug }> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4000,
    system: [
      {
        type: 'text',
        text: RESEARCH_SYSTEM_INSTRUCTIONS,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{ role: 'user', content: userPrompt }],
  });

  const { bullets, debug } = parseResearchModelResponse(
    response.content as { type: string; text?: string }[],
    response.stop_reason ?? undefined,
  );
  return { bullets, debug };
}

async function loadPackBullets(
  adminDb: ReturnType<typeof createClient>,
  age_bracket: string,
  category: string,
): Promise<StoredBullet[]> {
  const { data } = await adminDb
    .from('research_bullets')
    .select('id, text, content_hash, subtopic, source_url, active')
    .eq('age_bracket', age_bracket)
    .eq('category', category);
  return (data ?? []) as StoredBullet[];
}

async function insertBullets(
  adminDb: ReturnType<typeof createClient>,
  age_bracket: string,
  category: string,
  candidates: CandidateBullet[],
  existing: StoredBullet[],
  options: { skipNetwork?: boolean } = {},
): Promise<{ inserted: number; rejected: string[] }> {
  const ctx = createDedupContext(existing);
  let inserted = 0;
  const rejected: string[] = [];

  for (const candidate of candidates) {
    const result = await validateCandidate(candidate, ctx, options);
    if (!result.ok) {
      rejected.push(`${result.reason}: ${candidate.text.slice(0, 40)}`);
      continue;
    }

    const { error } = await adminDb.from('research_bullets').insert({
      age_bracket,
      category,
      subtopic: candidate.subtopic,
      text: candidate.text,
      source_url: candidate.sourceUrl,
      source_name: candidate.sourceName,
      source_domain: result.domain,
      source_tier: result.tier,
      source_region: result.region,
      content_hash: result.hash,
      reviewed_at: new Date().toISOString(),
      active: true,
    });

    if (error) {
      rejected.push(`db: ${error.message}`);
      continue;
    }

    recordAccepted(ctx, candidate, result.hash);
    inserted++;
  }

  return { inserted, rejected };
}

async function processBootstrapPack(
  anthropic: Anthropic,
  adminDb: ReturnType<typeof createClient>,
  age_bracket: AgeBracket,
  category: ResearchCategory,
  clusterIndex?: number,
): Promise<{ inserted: number; rejected: string[]; clustersDone: number; modelDebug?: ModelParseDebug }> {
  const existing = await loadPackBullets(adminDb, age_bracket, category);
  const ageLabel = ageBracketLabel(age_bracket);
  const clusters = SUBTOPIC_CLUSTERS[category];
  const clusterSlice = clusterIndex !== undefined
    ? clusters.slice(clusterIndex, clusterIndex + 1)
    : clusters;
  let totalInserted = 0;
  const allRejected: string[] = [];
  let modelDebug: ModelParseDebug | undefined;

  for (const cluster of clusterSlice) {
    const subtopics = cluster.join(', ');
    const prompt = `Research ${category} guidance for children aged ${ageLabel}.
Focus subtopics: ${subtopics}.
Search hint: ${categorySearchHint(category, ageLabel)}
Return 8-10 bullets as a single JSON object { "bullets": [...] } with no other text after searching.
Existing bullets to avoid duplicating:
${existing.map((b) => `- ${b.text}`).slice(0, 30).join('\n')}`;

    try {
      const { bullets: candidates, debug } = await callResearchModel(anthropic, prompt);
      if (debug) modelDebug = debug;
      if (candidates.length === 0) {
        allRejected.push(
          `model_empty: ${debug?.issue ?? 'unknown'}${debug?.stopReason ? ` (stop=${debug.stopReason})` : ''}`,
        );
        continue;
      }
      const { inserted, rejected } = await insertBullets(
        adminDb,
        age_bracket,
        category,
        candidates,
        existing,
        { skipNetwork: true },
      );
      totalInserted += inserted;
      allRejected.push(...rejected);
      existing.push(
        ...candidates.slice(0, inserted).map((c, i) => ({
          id: `new-${i}`,
          text: c.text,
          content_hash: '',
          subtopic: c.subtopic,
          source_url: c.sourceUrl,
          active: true,
        })),
      );
    } catch (e) {
      allRejected.push(`cluster error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { inserted: totalInserted, rejected: allRejected, clustersDone: clusterSlice.length, modelDebug };
}

async function processAppendPack(
  anthropic: Anthropic,
  adminDb: ReturnType<typeof createClient>,
  age_bracket: AgeBracket,
  category: ResearchCategory,
): Promise<{ inserted: number; rejected: string[] }> {
  const existing = await loadPackBullets(adminDb, age_bracket, category);
  const ageLabel = ageBracketLabel(age_bracket);
  const subtopicCounts = new Map<string, number>();
  for (const b of existing) {
    subtopicCounts.set(b.subtopic, (subtopicCounts.get(b.subtopic) ?? 0) + 1);
  }
  const gaps = [...subtopicCounts.entries()].filter(([, n]) => n < 3).map(([t]) => t);

  const prompt = `Research 5 NEW ${category} insights for children aged ${ageLabel}.
Prioritise under-covered subtopics: ${gaps.join(', ') || 'any new angle'}.
Search hint: ${categorySearchHint(category, ageLabel)}
Do not repeat these existing insights:
${existing.map((b) => b.text).join('\n')}
Return JSON { "bullets": [...] } with exactly 5 new bullets.`;

  const { bullets: candidates } = await callResearchModel(anthropic, prompt);
  return insertBullets(adminDb, age_bracket, category, candidates, existing);
}

const STALE_MONTHS: Record<ResearchCategory, number> = {
  sleep: 6,
  feeding: 6,
  development: 12,
  milestones: 12,
  regression: 12,
  language: 12,
};

interface StaleBullet {
  id: string;
  age_bracket: string;
  category: string;
  subtopic: string;
  text: string;
  source_url: string;
  reviewed_at: string;
}

function isStale(category: string, reviewedAt: string): boolean {
  const months = STALE_MONTHS[category as ResearchCategory] ?? 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return new Date(reviewedAt) < cutoff;
}

async function auditUrls(
  adminDb: ReturnType<typeof createClient>,
  offset: number,
  limit: number,
): Promise<{ checked: number; deactivated: number; refreshed: number }> {
  const { data: bullets } = await adminDb
    .from('research_bullets')
    .select('id, source_url')
    .eq('active', true)
    .order('id')
    .range(offset, offset + limit - 1);

  let deactivated = 0;
  let refreshed = 0;
  for (const b of bullets ?? []) {
    const check = await validateSourceUrl(b.source_url, undefined, { skipNetwork: false });
    if (!check.ok) {
      await adminDb.from('research_bullets').update({ active: false }).eq('id', b.id);
      deactivated++;
    } else {
      await adminDb
        .from('research_bullets')
        .update({ reviewed_at: new Date().toISOString() })
        .eq('id', b.id);
      refreshed++;
    }
  }
  return { checked: bullets?.length ?? 0, deactivated, refreshed };
}

async function reviewStaleBullets(
  adminDb: ReturnType<typeof createClient>,
  offset: number,
  limit: number,
): Promise<{ reviewed: number; deactivated: number; stillValid: number }> {
  const { data: bullets } = await adminDb
    .from('research_bullets')
    .select('id, category, source_url, reviewed_at')
    .eq('active', true);

  const stale = (bullets ?? []).filter((b: { category: string; reviewed_at: string }) =>
    isStale(b.category, b.reviewed_at)
  ).slice(offset, offset + limit);

  let deactivated = 0;
  let stillValid = 0;
  for (const b of stale) {
    const check = await validateSourceUrl(b.source_url, undefined, { skipNetwork: false });
    if (!check.ok) {
      await adminDb.from('research_bullets').update({ active: false }).eq('id', b.id);
      deactivated++;
    } else {
      await adminDb
        .from('research_bullets')
        .update({ reviewed_at: new Date().toISOString() })
        .eq('id', b.id);
      stillValid++;
    }
  }
  return { reviewed: stale.length, deactivated, stillValid };
}

async function replaceStalePack(
  anthropic: Anthropic,
  adminDb: ReturnType<typeof createClient>,
  age_bracket: AgeBracket,
  category: ResearchCategory,
  staleBullets: StaleBullet[],
): Promise<{ replaced: number; rejected: string[] }> {
  const existing = await loadPackBullets(adminDb, age_bracket, category);
  const ageLabel = ageBracketLabel(age_bracket);

  const prompt = `Review these ${category} research bullets for children aged ${ageLabel}.
Use web search to verify each claim is still accurate.
For any outdated bullet, provide ONE replacement in JSON format:
{ "replacements": [{ "oldText": "...", "bullet": { "text", "sourceUrl", "sourceName", "sourceTier", "subtopic" } }] }
Only include bullets that need replacing. If all are still valid, return { "replacements": [] }.

Bullets to review:
${staleBullets.map((b) => `- [${b.subtopic}] ${b.text} (${b.source_url})`).join('\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 3000,
    system: [{ type: 'text', text: RESEARCH_SYSTEM_INSTRUCTIONS }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return { replaced: 0, rejected: [] };

  const match = textBlock.text.match(/\{[\s\S]*\}/);
  if (!match) return { replaced: 0, rejected: ['no json'] };

  const parsed = JSON.parse(match[0]);
  const replacements = (parsed.replacements ?? []) as {
    oldText?: string;
    bullet?: CandidateBullet;
  }[];

  let replaced = 0;
  const rejected: string[] = [];
  const ctx = createDedupContext(existing);

  for (const item of replacements) {
    const candidate = item.bullet;
    if (!candidate?.text || !candidate.sourceUrl) continue;

    const stale = staleBullets.find((b) => b.text === item.oldText);
    if (!stale) continue;

    const result = await validateCandidate(candidate, ctx);
    if (!result.ok) {
      rejected.push(`${result.reason}: ${candidate.text.slice(0, 40)}`);
      continue;
    }

    const { data: inserted, error } = await adminDb
      .from('research_bullets')
      .insert({
        age_bracket,
        category,
        subtopic: candidate.subtopic,
        text: candidate.text,
        source_url: candidate.sourceUrl,
        source_name: candidate.sourceName,
        source_domain: result.domain,
        source_tier: result.tier,
        source_region: result.region,
        content_hash: result.hash,
        reviewed_at: new Date().toISOString(),
        active: true,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      rejected.push(`db: ${error?.message}`);
      continue;
    }

    await adminDb
      .from('research_bullets')
      .update({ active: false, superseded_by_id: inserted.id })
      .eq('id', stale.id);

    recordAccepted(ctx, candidate, result.hash);
    replaced++;
  }

  return { replaced, rejected };
}

async function processStaleReplacements(
  anthropic: Anthropic,
  adminDb: ReturnType<typeof createClient>,
  offset: number,
  limit: number,
): Promise<{ packs: number; replaced: number; rejected: string[] }> {
  const { data: bullets } = await adminDb
    .from('research_bullets')
    .select('id, age_bracket, category, subtopic, text, source_url, reviewed_at')
    .eq('active', true);

  const staleByPack = new Map<string, StaleBullet[]>();
  for (const b of (bullets ?? []) as StaleBullet[]) {
    if (!isStale(b.category, b.reviewed_at)) continue;
    const key = `${b.age_bracket}:${b.category}`;
    if (!staleByPack.has(key)) staleByPack.set(key, []);
    staleByPack.get(key)!.push(b);
  }

  const packKeys = [...staleByPack.keys()].slice(offset, offset + limit);
  let replaced = 0;
  const rejected: string[] = [];

  for (const key of packKeys) {
    const [age_bracket, category] = key.split(':') as [AgeBracket, ResearchCategory];
    const staleList = staleByPack.get(key)!.slice(0, 5);
    const { replaced: n, rejected: r } = await replaceStalePack(
      anthropic,
      adminDb,
      age_bracket,
      category,
      staleList,
    );
    replaced += n;
    rejected.push(...r);
  }

  return { packs: packKeys.length, replaced, rejected };
}

async function rebalanceDepletedPacks(
  anthropic: Anthropic,
  adminDb: ReturnType<typeof createClient>,
  offset: number,
  limit: number,
): Promise<{ appended: number }> {
  const packs = packsForMode().slice(offset, offset + limit);
  let appended = 0;

  for (const pack of packs) {
    const { data: active } = await adminDb
      .from('research_bullets')
      .select('subtopic')
      .eq('age_bracket', pack.age_bracket)
      .eq('category', pack.category)
      .eq('active', true);

    const counts = new Map<string, number>();
    for (const row of active ?? []) {
      counts.set(row.subtopic, (counts.get(row.subtopic) ?? 0) + 1);
    }
    const depleted = [...counts.entries()].some(([, n]) => n < 2) || (active ?? []).length < 5;
    if (!depleted) continue;

    const { inserted } = await processAppendPack(anthropic, adminDb, pack.age_bracket, pack.category);
    appended += inserted;
  }

  return { appended };
}

async function runHygiene(
  anthropic: Anthropic | null,
  adminDb: ReturnType<typeof createClient>,
  offset: number,
  limit: number,
): Promise<Record<string, unknown>> {
  const urlAudit = await auditUrls(adminDb, offset, limit);
  const staleReview = await reviewStaleBullets(adminDb, offset, limit);

  let replacements = { packs: 0, replaced: 0, rejected: [] as string[] };
  let rebalance = { appended: 0 };

  if (anthropic) {
    replacements = await processStaleReplacements(anthropic, adminDb, offset, limit);
    rebalance = await rebalanceDepletedPacks(anthropic, adminDb, offset, limit);
  }

  return { mode: 'hygiene', offset, limit, urlAudit, staleReview, replacements, rebalance };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const headerSecret = req.headers.get('x-cron-secret') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    const authorized = isAuthorizedMaintenanceRequest(
      authHeader,
      cronSecret,
      headerSecret,
      serviceRoleKey,
    );

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const body: RequestBody = await req.json();
    const mode = body.mode ?? 'append';
    const offset = body.offset ?? 0;
    const limit = mode === 'bootstrap' ? (body.limit ?? 1) : (body.limit ?? 5);
    const clusterIndex = body.clusterIndex;

    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    if (mode === 'hygiene') {
      const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
      const result = await runHygiene(anthropic, adminDb, offset, limit);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const packs = body.pack
      ? [body.pack]
      : packsForMode().slice(offset, offset + limit);

    const results = [];
    for (const pack of packs) {
      const result = mode === 'bootstrap'
        ? await processBootstrapPack(
          anthropic,
          adminDb,
          pack.age_bracket,
          pack.category,
          clusterIndex,
        )
        : await processAppendPack(anthropic, adminDb, pack.age_bracket, pack.category);
      results.push({ pack, clusterIndex: clusterIndex ?? null, ...result });
    }

    return new Response(JSON.stringify({ mode, offset, limit, clusterIndex: clusterIndex ?? null, results }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('research-refresh error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
