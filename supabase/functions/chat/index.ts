import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { parseIntent } from './intent-parser.ts';

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } };

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

interface RequestBody {
  messages: IncomingMessage[];           // current batch — actionable, may trigger tools
  contextMessages?: IncomingMessage[];   // prior history — read-only context, do not log
  child: { id: string; name: string; date_of_birth: string };
  currentDate: string;
}

// ─── Age helper ───────────────────────────────────────────────────────────────

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

// ─── Tool definitions ─────────────────────────────────────────────────────────

// cache_control on the last tool caches the full tool block for subsequent requests
// deno-lint-ignore no-explicit-any
const TOOLS: any[] = [
  {
    name: 'log_nappy',
    description: 'Log a nappy/diaper change event for the baby.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nappy_type: {
          type: 'string',
          enum: ['wet', 'dirty', 'both', 'dry'],
          description: 'Type of nappy change',
        },
        occurred_at: {
          type: 'string',
          description: 'ISO timestamp when it happened. Omit to use current time.',
        },
        notes: { type: 'string', description: 'Optional free-text note' },
      },
      required: ['nappy_type'],
    },
  },
  {
    name: 'log_meal',
    description: 'Log a feeding or meal event for the baby.',
    input_schema: {
      type: 'object' as const,
      properties: {
        meal_type: {
          type: 'string',
          enum: ['breast', 'bottle', 'solid', 'snack'],
          description: 'Type of meal',
        },
        amount_ml: {
          type: 'number',
          description: 'Amount consumed in ml (for bottle feeds)',
        },
        food: {
          type: 'string',
          description: 'Description of food (for solids/snacks)',
        },
        occurred_at: {
          type: 'string',
          description: 'ISO timestamp when it happened. Omit to use current time.',
        },
        notes: { type: 'string', description: 'Optional free-text note' },
      },
      required: ['meal_type'],
    },
  },
  {
    name: 'log_sleep_start',
    description: 'Log the start of a sleep or nap.',
    input_schema: {
      type: 'object' as const,
      properties: {
        occurred_at: {
          type: 'string',
          description: 'ISO timestamp when the baby fell asleep. Omit to use current time.',
        },
        notes: { type: 'string', description: 'Optional note' },
      },
      required: [],
    },
  },
  {
    name: 'log_sleep_end',
    description:
      "Record the end of the most recent open sleep session (i.e. when the baby woke up). Only call this when the baby has woken up from a previously logged sleep.",
    input_schema: {
      type: 'object' as const,
      properties: {
        occurred_at: {
          type: 'string',
          description: 'ISO timestamp when the baby woke up. Omit to use current time.',
        },
      },
      required: [],
    },
  },
  {
    name: 'log_milestone',
    description:
      'Record a developmental milestone. Use for first words, first steps, and similar developmental achievements.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['language', 'movement', 'development'],
          description:
            'language = speech/communication, movement = physical/motor, development = other developmental achievements',
        },
        title: { type: 'string', description: 'Short title for the milestone' },
        description: {
          type: 'string',
          description: 'Optional longer description or story',
        },
        achieved_at: {
          type: 'string',
          description: 'Date the milestone was achieved (YYYY-MM-DD)',
        },
      },
      required: ['category', 'title', 'achieved_at'],
    },
  },
  {
    name: 'log_memory',
    description:
      'Record a precious memory or special moment (birthday party, trip, funny moment, photo). Use for anything sentimental that is not a developmental milestone.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Short title for the memory' },
        description: {
          type: 'string',
          description: 'Description or story for the memory',
        },
        occurred_at: {
          type: 'string',
          description: 'Date when this memory happened (YYYY-MM-DD)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags e.g. ["family", "travel", "birthday"]',
        },
        media_urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs of any attached photos',
        },
      },
      required: ['title', 'occurred_at'],
    },
  },
  {
    name: 'ask_clarification',
    description:
      'Ask the parent a single clarifying question when the message is genuinely ambiguous. Do not log anything.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: { type: 'string', description: 'The clarifying question to ask' },
      },
      required: ['question'],
    },
    // Caching the tool block saves ~1 000 input tokens on every cached request
    cache_control: { type: 'ephemeral' },
  },
];

// Activity tools that skip the second Claude call after execution
const ACTIVITY_TOOLS = new Set(['log_nappy', 'log_meal', 'log_sleep_start', 'log_sleep_end']);

// ─── Tool result helpers ──────────────────────────────────────────────────────

function formatLogConfirmation(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'log_nappy': {
      const labels: Record<string, string> = {
        wet: 'wet nappy change',
        dirty: 'dirty nappy change',
        both: 'wet & dirty nappy change',
        dry: 'dry nappy check',
      };
      const label = labels[String(input.nappy_type)] ?? 'nappy change';
      return `Logged a ${label} to today's activities.`;
    }
    case 'log_meal': {
      const types: Record<string, string> = {
        breast: 'breastfeed',
        bottle: 'bottle feed',
        solid: 'solid meal',
        snack: 'snack',
      };
      const meal = types[String(input.meal_type)] ?? 'meal';
      const detail =
        input.amount_ml != null
          ? ` (${input.amount_ml}ml)`
          : input.food
          ? ` (${input.food})`
          : '';
      return `Logged a ${meal}${detail} to today's activities.`;
    }
    case 'log_sleep_start':
      return "Logged nap/sleep start to today's activities.";
    case 'log_sleep_end':
      return "Logged wake-up to today's activities.";
    case 'log_milestone':
      return `Saved milestone "${input.title}" (${input.category}) to the Journey timeline.`;
    case 'log_memory':
      return `Saved memory "${input.title}" to the Journey timeline.`;
    default:
      return 'Record saved.';
  }
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleTool(
  toolName: string,
  // deno-lint-ignore no-explicit-any
  input: Record<string, any>,
  childId: string,
  userId: string | null,
  // deno-lint-ignore no-explicit-any
  adminDb: any,
  currentDate: string,
): Promise<string> {
  const now = new Date().toISOString();

  switch (toolName) {
    case 'log_nappy': {
      const { error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'nappy',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata: { nappyType: input.nappy_type },
        created_by: userId,
      });
      if (error) throw new Error(`log_nappy: ${error.message}`);
      return formatLogConfirmation('log_nappy', input);
    }

    case 'log_meal': {
      const metadata: Record<string, unknown> = { mealType: input.meal_type };
      if (input.amount_ml != null) metadata.amountMl = input.amount_ml;
      if (input.food) metadata.food = input.food;

      const { error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'meal',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata,
        created_by: userId,
      });
      if (error) throw new Error(`log_meal: ${error.message}`);
      return formatLogConfirmation('log_meal', input);
    }

    case 'log_sleep_start': {
      const { error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'sleep',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata: {},
        created_by: userId,
      });
      if (error) throw new Error(`log_sleep_start: ${error.message}`);
      return formatLogConfirmation('log_sleep_start', input);
    }

    case 'log_sleep_end': {
      const { data: events, error: fetchErr } = await adminDb
        .from('daily_events')
        .select('id, metadata')
        .eq('child_id', childId)
        .eq('type', 'sleep')
        .order('occurred_at', { ascending: false })
        .limit(20);

      if (fetchErr) throw new Error(`log_sleep_end fetch: ${fetchErr.message}`);

      const openSleep = (events ?? []).find(
        (e: { metadata: Record<string, unknown> }) => !e.metadata?.sleepEnd,
      );

      if (!openSleep) return 'No open sleep session found to close.';

      const sleepEnd = input.occurred_at ?? now;
      const { error: updateErr } = await adminDb
        .from('daily_events')
        .update({ metadata: { ...openSleep.metadata, sleepEnd } })
        .eq('id', openSleep.id);

      if (updateErr) throw new Error(`log_sleep_end update: ${updateErr.message}`);
      return formatLogConfirmation('log_sleep_end', input);
    }

    case 'log_milestone': {
      const { error } = await adminDb.from('milestones').insert({
        child_id: childId,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        achieved_at: input.achieved_at ?? currentDate,
        media_urls: [],
        created_by: userId,
      });
      if (error) throw new Error(`log_milestone: ${error.message}`);
      return formatLogConfirmation('log_milestone', input);
    }

    case 'log_memory': {
      const { error } = await adminDb.from('memories').insert({
        child_id: childId,
        title: input.title,
        description: input.description ?? null,
        occurred_at: input.occurred_at ?? currentDate,
        media_urls: input.media_urls ?? [],
        tags: input.tags ?? [],
        created_by: userId,
      });
      if (error) throw new Error(`log_memory: ${error.message}`);
      return formatLogConfirmation('log_memory', input);
    }

    case 'ask_clarification':
      return `CLARIFICATION:${input.question}`;

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userDb.auth.getUser();

    const adminDb = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    const { messages, contextMessages = [], child, currentDate } = body;

    // ── Intent parser: bypass Claude for simple activity messages ─────────────
    // Only applies to the current batch (messages), never to contextMessages.
    // Supports multi-message batches: all user messages are checked and all
    // matches are executed before returning a combined confirmation.
    const hasPhoto = messages.some(
      (m) =>
        Array.isArray(m.content) &&
        (m.content as ContentBlock[]).some((b) => b.type === 'image'),
    );

    if (!hasPhoto) {
      const batchUserMsgs = messages.filter(
        (m) => m.role === 'user' && typeof m.content === 'string',
      );
      const confirmations: string[] = [];
      let anyParseError = false;

      for (const msg of batchUserMsgs) {
        const intent = parseIntent(msg.content as string);
        if (!intent) {
          anyParseError = true; // unrecognised message — fall through to Claude
          break;
        }
        const result = await handleTool(
          intent.toolName,
          intent.input,
          child.id,
          user?.id ?? null,
          adminDb,
          currentDate,
        );
        if (result.startsWith('Error:')) {
          anyParseError = true;
          break;
        }
        confirmations.push(result);
      }

      if (!anyParseError && confirmations.length > 0 && confirmations.length === batchUserMsgs.length) {
        const reply = confirmations.length === 1
          ? `Done! ${confirmations[0]}`
          : `Done! ${confirmations.join(' ')}`;
        return new Response(JSON.stringify({ content: reply }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
      // If any message wasn't matched or errored, fall through to Claude
    }

    // ── Build system prompt ───────────────────────────────────────────────────
    const age = calculateAge(child.date_of_birth, currentDate);

    // Build optional read-only context block from prior messages
    let contextBlock = '';
    if (contextMessages.length > 0) {
      const lines = contextMessages.map((m) => {
        const text = typeof m.content === 'string'
          ? m.content
          : (m.content as ContentBlock[]).find((b) => b.type === 'text')?.text ?? '';
        return `${m.role}: ${text}`;
      });
      contextBlock = `\n\nRecent conversation (context only — already logged or answered, do NOT call tools for these again):\n${lines.join('\n')}`;
    }

    const systemPrompt = `You are a warm, supportive assistant for parents tracking their baby's development and daily life.

You are helping the parents of ${child.name}, who is ${age} (born ${child.date_of_birth}). Today is ${currentDate}.

When parents describe something that happened:
- Use the appropriate logging tool to record it in their app
- After logging, always confirm what you saved in your reply — be specific (e.g. "I've logged a 120ml bottle feed to today's activities" or "I've saved 'First steps' as a milestone on the Journey timeline")
- Nappy, meal, and sleep events appear in today's activities and the Journey timeline
- Milestones and memories appear on the Journey timeline
- If a parent shares a photo or describes a special moment that is not a developmental achievement, use log_memory
- If a parent describes a first word, first steps, or other developmental milestone, use log_milestone
- Only use ask_clarification when the message is truly ambiguous and you cannot make a reasonable guess

Be concise and supportive. Every reply that logs something must clearly tell the parent what was saved.

IMPORTANT — Action scope: Only call logging tools for the NEW message(s) in the current turn. Do NOT call tools for anything in the "Recent conversation" context section — those events are already saved.${contextBlock}`;

    // System prompt with prompt caching — saves repeated input tokens after the first call
    const systemParam = [
      {
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
    ];

    // ── Model selection ───────────────────────────────────────────────────────
    // Use Haiku for text-only requests; Sonnet when a photo is attached
    const model = hasPhoto ? 'claude-sonnet-4-6' : 'claude-haiku-4-5';

    // ── Agentic loop ──────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Only the current batch goes to Claude as turns — context is embedded in the system prompt
    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content as string | Anthropic.ContentBlockParam[],
    }));

    let finalText = '';
    const loggedConfirmations: string[] = [];
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 300,
        system: systemParam,
        tools: TOOLS,
        messages: apiMessages,
      });

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (textBlocks.length > 0) {
        finalText = textBlocks.map((b) => b.text).join('\n');
      }

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        break;
      }

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tb) => {
          let result: string;
          try {
            result = await handleTool(
              tb.name,
              tb.input as Record<string, unknown>,
              child.id,
              user?.id ?? null,
              adminDb,
              currentDate,
            );
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }

          if (
            !result.startsWith('Error:') &&
            !result.startsWith('CLARIFICATION:') &&
            !result.startsWith('No open')
          ) {
            loggedConfirmations.push(result);
          }

          if (result.startsWith('CLARIFICATION:')) {
            finalText = result.replace('CLARIFICATION:', '');
          }

          return {
            type: 'tool_result' as const,
            tool_use_id: tb.id,
            content: result,
          };
        }),
      );

      // Clarification requested — stop here
      if (finalText && toolResults.some((r) => r.content.startsWith('CLARIFICATION:'))) {
        break;
      }

      // Activity-only tools: skip the second Claude call and use server-built confirmations
      const allActivityTools = toolUseBlocks.every((tb) => ACTIVITY_TOOLS.has(tb.name));
      if (allActivityTools) {
        break;
      }

      apiMessages.push({ role: 'assistant', content: response.content });
      apiMessages.push({ role: 'user', content: toolResults });
    }

    // Fallback: tools ran but Claude returned no text
    if (!finalText.trim() && loggedConfirmations.length > 0) {
      finalText =
        loggedConfirmations.length === 1
          ? `Done! ${loggedConfirmations[0]}`
          : `Done! ${loggedConfirmations.join(' ')}`;
    }

    return new Response(JSON.stringify({ content: finalText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('[chat-fn] error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
