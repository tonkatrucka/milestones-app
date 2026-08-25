/**
 * generate-milestone-story edge function
 *
 * Given a milestone title, category, date, and optional parent notes,
 * generates a warm 2–3 sentence "story" in the voice of a family journal entry.
 * Returns a draft — the parent reviews and edits before saving.
 *
 * Cost: one Claude Haiku call per use. User-initiated only.
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

const STORY_SYSTEM = `You write warm, personal milestone stories for parents to record in their baby's journal.

Write 2–3 sentences that capture the moment beautifully — like a loving entry in a baby book.
- Use the child's first name.
- Be specific, warm, and present. Write as if this happened today.
- Include sensory or emotional detail if the milestone warrants it.
- If the parent has provided notes, weave them in naturally.
- Language category milestones: focus on the sound/word and the family's reaction.
- Movement milestones: focus on the effort and the triumph.
- Development milestones: focus on the personality or cognitive achievement.
- Return ONLY the story text — no preamble, no JSON, no quotation marks.`;

function calculateAge(dob: string, date: string): string {
  const birth = new Date(dob);
  const event = new Date(date);
  const totalMonths =
    (event.getFullYear() - birth.getFullYear()) * 12 + (event.getMonth() - birth.getMonth());
  if (totalMonths < 1) return 'a newborn';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''} old`;
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years}yr ${months}mo`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userDb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    const body = await req.json();
    const { childName, childDob, milestoneTitle, milestoneCategory, date, notes } = body;

    if (!childName || !milestoneTitle) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    const age = childDob ? calculateAge(childDob, date ?? new Date().toISOString().split('T')[0]) : '';
    const prompt = [
      `Child: ${childName}${age ? ` (${age})` : ''}`,
      `Milestone: "${milestoneTitle}" (${milestoneCategory ?? 'development'} category)`,
      date ? `Date: ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : '',
      notes ? `Parent's notes: ${notes}` : '',
    ].filter(Boolean).join('\n');

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: STORY_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return new Response(JSON.stringify({ error: 'Empty response' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }

    return new Response(
      JSON.stringify({ story: block.text.trim() }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err) {
    console.error('[generate-milestone-story] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
