import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import {
  fetchMemories,
  fetchMilestones,
  fetchRecentEvents,
} from '../_shared/child-data.ts';
import { buildInsightDigest } from '../_shared/insight-stats.ts';
import { selectResearchBullets } from '../_shared/research-selector.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

const OBSERVATION_SYSTEM = `You help parents understand their child's week — warm, clear, and honest.

AUDIENCE: Everyday parents. Not data analysts.

Return ONLY valid JSON:
{ "shortInsights": string[], "longInsights": string[], "categories": string[] }

VOICE — write about the child, not abstract numbers:
- Use the child's first name regularly, or natural third person (she/he/they, her/his/their).
- Sound like a thoughtful friend who knows the family — not a dashboard summary.
  BAD: "Feeds picked up — about one more meal per day than last week."
  BAD: "Sleep looked a bit longer overall."
  GOOD: "Emma's feeds picked up — about one extra meal a day compared to last week."
  GOOD: "She slept a bit longer overall this week (~11h vs ~9h), which might help her afternoons."
  GOOD: "His nappies were about the same as last week — nothing out of the ordinary."
- Avoid "you logged" / "your tracking" as the subject; centre the child instead.
- If gender is unknown, use they/their or the child's name.

CORE RULE — every observation must add insight, not just count:
- NEVER write a line that only states a total, count, or average.
  BAD: "6 feeds this week." / "11 hours of sleep." / "4 nappies per day."
- ALWAYS pair numbers with at least one of: (1) change vs last week, (2) what it might mean, (3) age-appropriate context.
  GOOD: "Mia had roughly one more feed per day than last week — a gentle step up."
  GOOD: "James's sleep ran a bit longer than last week; that steadier rest may show up in his mood."
  GOOD: "Ava's nappies stayed about the same as last week — all fairly routine."

shortInsights (2–4 items):
- One comparative or meaningful point per line, always personably about the child.
- Plain words. No jargon (metric, trend, dataset, logged, prior period).
- Skip categories where nothing meaningful changed — do not pad with bare stats.

longInsights (1–2 items):
- Deeper week-over-week context in the same personable voice (name or she/he/they).
- Still follow the core rule: no paragraphs that are only a list of totals.
- Gentle interpretation is fine ("It looks like…", "That might mean…").

SHARED RULES:
- Only use facts from the digest. Never invent events or milestones.
- If data is thin, say so kindly about the child — do not fill space with standalone numbers.
- No medical diagnoses. Suggest a doctor or health visitor only for clear health concerns.
- categories: 1–3 from: sleep, feeding, development, milestones, regression, language.`;

interface RequestBody {
  child: { id: string; name: string; date_of_birth: string };
  currentDate: string;
  userRegion?: string;
}

interface ChildInsightsRow {
  child_id: string;
  insight_date: string;
  short_insights: string[] | null;
  long_insights: string[] | null;
  categories: string[];
  selected_research_by_region: Record<string, string[]>;
  generated_at: string;
}

interface ResearchBulletPayload {
  id: string;
  category: string;
  subtopic: string;
  text: string;
  sourceUrl: string;
  sourceName: string;
  isNew: boolean;
}

function calculateAge(dob: string, today: string): string {
  const birth = new Date(dob);
  const now = new Date(today);
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'a newborn';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''} old`;
}

function parseObservations(text: string): {
  shortInsights: string[];
  longInsights: string[];
  categories: string[];
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in observation response');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    shortInsights: Array.isArray(parsed.shortInsights)
      ? parsed.shortInsights.map(String).slice(0, 4)
      : [],
    longInsights: Array.isArray(parsed.longInsights)
      ? parsed.longInsights.map(String).slice(0, 2)
      : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories.map(String) : [],
  };
}

async function generateObservations(
  anthropic: Anthropic,
  childName: string,
  age: string,
  digest: string,
): Promise<{ shortInsights: string[]; longInsights: string[]; categories: string[] }> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 650,
    system: [
      {
        type: 'text',
        text: OBSERVATION_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `The child's first name is ${childName} (${age}). Refer to ${childName} by name or with she/he/they in every shortInsight and longInsight.`,
      },
    ],
    messages: [
      {
        role: 'user',
        content: digest,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Empty observation response');
  return parseObservations(block.text);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userDb.auth.getUser();
    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    const { child, currentDate } = body;
    const userRegion = (body.userRegion ?? 'GLOBAL').toUpperCase();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: member } = await userDb
      .from('child_members')
      .select('role')
      .eq('child_id', child.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const { data: existingRow } = await adminDb
      .from('child_insights')
      .select('*')
      .eq('child_id', child.id)
      .eq('insight_date', currentDate)
      .maybeSingle();

    const existing = existingRow as ChildInsightsRow | null;
    const regionMap: Record<string, string[]> =
      (existing?.selected_research_by_region as Record<string, string[]>) ?? {};

    let shortInsights = existing?.short_insights ?? null;
    let longInsights = existing?.long_insights ?? null;
    let categories = existing?.categories ?? [];
    let generatedAt = existing?.generated_at ?? new Date().toISOString();

    const needsObservations = !shortInsights || shortInsights.length === 0;
    const needsResearch = !regionMap[userRegion] || regionMap[userRegion].length === 0;

    if (needsObservations) {
      const { data: obsCheck } = await adminDb
        .from('child_insights')
        .select('short_insights, long_insights, categories, generated_at')
        .eq('child_id', child.id)
        .eq('insight_date', currentDate)
        .maybeSingle();

      if (obsCheck?.short_insights?.length) {
        shortInsights = obsCheck.short_insights;
        longInsights = obsCheck.long_insights;
        categories = obsCheck.categories ?? [];
        generatedAt = obsCheck.generated_at;
      } else {
      const [events, milestones, memories] = await Promise.all([
        fetchRecentEvents(adminDb, child.id, 90),
        fetchMilestones(adminDb, child.id, { limit: 50 }),
        fetchMemories(adminDb, child.id, { limit: 20 }),
      ]);

      const digest = buildInsightDigest(
        child.name,
        child.date_of_birth,
        currentDate,
        events,
        milestones,
        memories,
      );

      if (!anthropicKey) {
        return new Response(JSON.stringify({ error: 'AI not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const age = calculateAge(child.date_of_birth, currentDate);

      try {
        const obs = await generateObservations(anthropic, child.name, age, digest.text);
        shortInsights = obs.shortInsights;
        longInsights = obs.longInsights;
        categories = obs.categories;
        generatedAt = new Date().toISOString();
      } catch (genErr) {
        // Concurrent race — re-read cache
        const { data: raced } = await adminDb
          .from('child_insights')
          .select('*')
          .eq('child_id', child.id)
          .eq('insight_date', currentDate)
          .maybeSingle();
        if (raced?.short_insights?.length) {
          shortInsights = raced.short_insights;
          longInsights = raced.long_insights;
          categories = raced.categories ?? [];
          generatedAt = raced.generated_at;
        } else {
          throw genErr;
        }
      }

      await adminDb.from('child_insights').upsert(
        {
          child_id: child.id,
          insight_date: currentDate,
          short_insights: shortInsights,
          long_insights: longInsights,
          categories,
          generated_at: generatedAt,
          selected_research_by_region: regionMap,
        },
        { onConflict: 'child_id,insight_date', ignoreDuplicates: false },
      );
      }
    }

    let researchBullets: ResearchBulletPayload[] = [];

    if (needsResearch) {
      const { data: researchCheck } = await adminDb
        .from('child_insights')
        .select('selected_research_by_region')
        .eq('child_id', child.id)
        .eq('insight_date', currentDate)
        .maybeSingle();

      const cachedRegionIds =
        (researchCheck?.selected_research_by_region as Record<string, string[]> | undefined)?.[
          userRegion
        ];

      if (cachedRegionIds?.length) {
        regionMap[userRegion] = cachedRegionIds;
        const { data: bullets } = await adminDb
          .from('research_bullets')
          .select('*')
          .in('id', cachedRegionIds);

        const { data: shownRows } = await adminDb
          .from('child_research_shown')
          .select('bullet_id, first_shown_on')
          .eq('child_id', child.id)
          .in('bullet_id', cachedRegionIds);

        const shownToday = new Set(
          (shownRows ?? [])
            .filter((r: { first_shown_on: string }) => r.first_shown_on === currentDate)
            .map((r: { bullet_id: string }) => r.bullet_id),
        );
        const byId = new Map((bullets ?? []).map((b: { id: string }) => [b.id, b]));
        researchBullets = cachedRegionIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((b: {
            id: string;
            category: string;
            subtopic: string;
            text: string;
            source_url: string;
            source_name: string;
          }) => ({
            id: b.id,
            category: b.category,
            subtopic: b.subtopic,
            text: b.text,
            sourceUrl: b.source_url,
            sourceName: b.source_name,
            isNew: shownToday.has(b.id),
          }));
      } else {
      const digestMeta = buildInsightDigest(
        child.name,
        child.date_of_birth,
        currentDate,
        await fetchRecentEvents(adminDb, child.id, 90),
        await fetchMilestones(adminDb, child.id, { limit: 50 }),
        await fetchMemories(adminDb, child.id, { limit: 20 }),
      );

      const { data: shownRows } = await adminDb
        .from('child_research_shown')
        .select('bullet_id, first_shown_on')
        .eq('child_id', child.id);

      const shownIds = new Set((shownRows ?? []).map((r: { bullet_id: string }) => r.bullet_id));
      const shownFirstOn = new Map(
        (shownRows ?? []).map((r: { bullet_id: string; first_shown_on: string }) => [
          r.bullet_id,
          r.first_shown_on,
        ]),
      );

      const { data: pool } = await adminDb
        .from('research_bullets')
        .select('*')
        .eq('active', true)
        .eq('age_bracket', digestMeta.ageBracket);

      const selected = selectResearchBullets({
        ageBracket: digestMeta.ageBracket,
        categories,
        userRegion,
        shownBulletIds: shownIds,
        shownFirstOn,
        pool: pool ?? [],
      });

      const selectedIds = selected.map((b) => b.id);
      const mergedRegionMap = { ...regionMap, [userRegion]: selectedIds };

      await adminDb.from('child_insights').upsert(
        {
          child_id: child.id,
          insight_date: currentDate,
          short_insights: shortInsights,
          long_insights: longInsights,
          categories,
          selected_research_by_region: mergedRegionMap,
          generated_at: generatedAt,
        },
        { onConflict: 'child_id,insight_date' },
      );

      if (selected.length > 0) {
        const today = currentDate;
        const toRecord = selected.filter((b) => !shownIds.has(b.id)).map((b) => ({
          child_id: child.id,
          bullet_id: b.id,
          first_shown_on: today,
        }));
        if (toRecord.length > 0) {
          await adminDb.from('child_research_shown').upsert(toRecord, {
            onConflict: 'child_id,bullet_id',
            ignoreDuplicates: true,
          });
        }
      }

      researchBullets = selected.map((b) => ({
        id: b.id,
        category: b.category,
        subtopic: b.subtopic,
        text: b.text,
        sourceUrl: b.source_url,
        sourceName: b.source_name,
        isNew: b.isNew,
      }));

      regionMap[userRegion] = selectedIds;
      }
    } else {
      const ids = regionMap[userRegion] ?? [];
      if (ids.length > 0) {
        const { data: bullets } = await adminDb
          .from('research_bullets')
          .select('*')
          .in('id', ids);

        const { data: shownRows } = await adminDb
          .from('child_research_shown')
          .select('bullet_id, first_shown_on')
          .eq('child_id', child.id)
          .in('bullet_id', ids);

        const shownToday = new Set(
          (shownRows ?? [])
            .filter((r: { first_shown_on: string }) => r.first_shown_on === currentDate)
            .map((r: { bullet_id: string }) => r.bullet_id),
        );

        const byId = new Map((bullets ?? []).map((b: { id: string }) => [b.id, b]));
        researchBullets = ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((b: {
            id: string;
            category: string;
            subtopic: string;
            text: string;
            source_url: string;
            source_name: string;
          }) => ({
            id: b.id,
            category: b.category,
            subtopic: b.subtopic,
            text: b.text,
            sourceUrl: b.source_url,
            sourceName: b.source_name,
            isNew: shownToday.has(b.id),
          }));
      }
    }

    return new Response(
      JSON.stringify({
        shortInsights: shortInsights ?? [],
        longInsights: longInsights ?? [],
        categories,
        researchBullets,
        generatedAt,
        insightDate: currentDate,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('insights error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
