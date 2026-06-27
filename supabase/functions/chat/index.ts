import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import {
  answerSimpleQuery,
  buildTodaySnapshotText,
  handleReadTool,
} from '../_shared/child-data.ts';
import {
  classifyBatch,
  parseIntent,
  parseQueryIntent,
  type MessageClass,
} from './intent-parser.ts';

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
  attachedMediaUrls?: string[];          // explicit photo URLs from the client batch
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
  },
  {
    name: 'get_daily_summary',
    description: 'Get activity totals for a single day (meals, nappies, sleep).',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date YYYY-MM-DD. Omit for today.' },
      },
      required: [],
    },
  },
  {
    name: 'get_last_event',
    description: 'Get the most recent event of a given type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['nappy', 'meal', 'sleep'] },
      },
      required: ['type'],
    },
  },
  {
    name: 'get_events',
    description: 'List recent daily events, optionally filtered by type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'How many days back (default 7, max 30)' },
        type: { type: 'string', enum: ['nappy', 'meal', 'sleep'] },
        limit: { type: 'number', description: 'Max events to return (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_milestones',
    description: 'List developmental milestones from the Journey tab.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', enum: ['language', 'movement', 'development'] },
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date: { type: 'string', description: 'YYYY-MM-DD' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_memories',
    description: 'List memories from the Journey tab.',
    input_schema: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date: { type: 'string', description: 'YYYY-MM-DD' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_period_summary',
    description: 'Summarise activity over a period (daily breakdown + totals).',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Days to include (default 7, max 90)' },
        focus: { type: 'string', enum: ['nappy', 'meal', 'sleep'], description: 'Optional focus area' },
      },
      required: [],
    },
    cache_control: { type: 'ephemeral' },
  },
];

// Activity tools that skip the second Claude call after execution
const ACTIVITY_TOOLS = new Set(['log_nappy', 'log_meal', 'log_sleep_start', 'log_sleep_end']);

const READ_TOOLS = new Set([
  'get_daily_summary',
  'get_last_event',
  'get_events',
  'get_milestones',
  'get_memories',
  'get_period_summary',
]);

// Cached across requests — keep child/date/context out of this block
const STATIC_SYSTEM_INSTRUCTIONS = `You are a warm, supportive assistant for parents tracking their baby's development and daily life.

When parents describe something that happened:
- Use the appropriate logging tool to record it in their app
- Nappy, meal, and sleep events appear on the Home screen and in the Activities tab
- Milestones and memories appear on the Journey tab
- If a parent shares photo(s) or describes a special moment that is not a developmental achievement, use log_memory
- If a parent describes a first word, first steps, or other developmental milestone, use log_milestone
- Only use ask_clarification when the message is truly ambiguous and you cannot make a reasonable guess

Reply structure (after logging in the current turn):
1. Start with a brief warm, supportive comment about what the parent shared in their latest message(s) only.
2. Then confirm what you just saved from this turn — be specific (e.g. "I've logged a 120ml bottle feed to today's activities" or "I've saved 'First steps' as a milestone on the Journey tab").
Do not recap or mention items logged in earlier messages, even if they appear in the conversation context below.

Be concise. Every reply that logs something must clearly tell the parent what was saved from this turn only.

IMPORTANT — Action scope: Only call logging tools for the NEW message(s) in the current turn. Do NOT call tools for anything in the "Recent conversation" context section — those events are already saved.

When parents ask questions (not reporting new events):
- Answer from the Today snapshot and read tools — do NOT call logging tools
- Use read tools when the snapshot lacks enough detail (historical data, milestones, memories, multi-day summaries)
- Only call logging tools when the parent is reporting something new this turn`;

const QA_SYSTEM_INSTRUCTIONS = `When answering questions about the child:
- Lead with facts from logged records — cite specific times, counts, and dates
- Clearly separate facts from interpretation ("Based on your logs…")
- You may add brief, light general context where helpful, but do not give medical diagnoses
- If parents express health concerns, encourage them to consult their pediatrician
- If no relevant data exists, say so honestly — never invent records
- Be warm and concise`;

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
      return `Saved milestone "${input.title}" (${input.category}) to the Journey tab.`;
    case 'log_memory':
      return `Saved memory "${input.title}" to the Journey tab.`;
    default:
      return 'Record saved.';
  }
}

// ─── Tool handlers ────────────────────────────────────────────────────────────

interface ToolHandleResult {
  message: string;
  event?: Record<string, unknown>;
}

async function handleTool(
  toolName: string,
  // deno-lint-ignore no-explicit-any
  input: Record<string, any>,
  childId: string,
  userId: string | null,
  // deno-lint-ignore no-explicit-any
  adminDb: any,
  currentDate: string,
  batchMediaUrls: string[] = [],
): Promise<ToolHandleResult> {
  const now = new Date().toISOString();

  switch (toolName) {
    case 'log_nappy': {
      const { data, error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'nappy',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata: { nappyType: input.nappy_type },
        created_by: userId,
      }).select().single();
      if (error) throw new Error(`log_nappy: ${error.message}`);
      return { message: formatLogConfirmation('log_nappy', input), event: data };
    }

    case 'log_meal': {
      const metadata: Record<string, unknown> = { mealType: input.meal_type };
      if (input.amount_ml != null) metadata.amountMl = input.amount_ml;
      if (input.food) metadata.food = input.food;

      const { data, error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'meal',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata,
        created_by: userId,
      }).select().single();
      if (error) throw new Error(`log_meal: ${error.message}`);
      return { message: formatLogConfirmation('log_meal', input), event: data };
    }

    case 'log_sleep_start': {
      const { data, error } = await adminDb.from('daily_events').insert({
        child_id: childId,
        type: 'sleep',
        occurred_at: input.occurred_at ?? now,
        notes: input.notes ?? null,
        metadata: {},
        created_by: userId,
      }).select().single();
      if (error) throw new Error(`log_sleep_start: ${error.message}`);
      return { message: formatLogConfirmation('log_sleep_start', input), event: data };
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

      if (!openSleep) return { message: 'No open sleep session found to close.' };

      const sleepEnd = input.occurred_at ?? now;
      const { data, error: updateErr } = await adminDb
        .from('daily_events')
        .update({ metadata: { ...openSleep.metadata, sleepEnd } })
        .eq('id', openSleep.id)
        .select()
        .single();

      if (updateErr) throw new Error(`log_sleep_end update: ${updateErr.message}`);
      return { message: formatLogConfirmation('log_sleep_end', input), event: data };
    }

    case 'log_milestone': {
      const { error } = await adminDb.from('milestones').insert({
        child_id: childId,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        achieved_at: input.achieved_at ?? currentDate,
        media_urls: batchMediaUrls.slice(0, 5),
        created_by: userId,
      });
      if (error) throw new Error(`log_milestone: ${error.message}`);
      return { message: formatLogConfirmation('log_milestone', input) };
    }

    case 'log_memory': {
      const { error } = await adminDb.from('memories').insert({
        child_id: childId,
        title: input.title,
        description: input.description ?? null,
        occurred_at: input.occurred_at ?? currentDate,
        media_urls: [...new Set([...(input.media_urls ?? []), ...batchMediaUrls])].slice(0, 5),
        tags: input.tags ?? [],
        created_by: userId,
      });
      if (error) throw new Error(`log_memory: ${error.message}`);
      return { message: formatLogConfirmation('log_memory', input) };
    }

    case 'ask_clarification':
      return { message: `CLARIFICATION:${input.question}` };

    case 'get_daily_summary':
    case 'get_last_event':
    case 'get_events':
    case 'get_milestones':
    case 'get_memories':
    case 'get_period_summary': {
      const message = await handleReadTool(toolName, input, adminDb, childId, currentDate);
      return { message };
    }

    default:
      return { message: `Unknown tool: ${toolName}` };
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
    const { messages, contextMessages = [], attachedMediaUrls = [], child, currentDate } = body;

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

    if (member.role !== 'owner' && member.role !== 'caregiver') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Collect durable storage refs / URLs for milestone/memory persistence.
    // Prefer explicit attachedMediaUrls (storage refs) over signed URLs in message content.
    const imageUrlsFromMessages = messages.flatMap((m) => {
      if (!Array.isArray(m.content)) return [];
      return (m.content as ContentBlock[])
        .filter((b) => b.type === 'image')
        .map((b) => (b as { type: 'image'; source: { type: 'url'; url: string } }).source.url);
    });
    const batchMediaUrls: string[] = [
      ...new Set([
        ...(attachedMediaUrls.length > 0 ? attachedMediaUrls : imageUrlsFromMessages),
      ]),
    ].slice(0, 5);

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
      const batchTexts = batchUserMsgs.map((m) => m.content as string);
      const batchClass: MessageClass = classifyBatch(batchTexts);

      // ── Simple query fast path (Tier 0) ─────────────────────────────────────
      if (batchClass === 'simple_query' && batchTexts.length > 0) {
        const replies: string[] = [];
        let allMatched = true;

        for (const text of batchTexts) {
          const query = parseQueryIntent(text);
          if (!query) {
            allMatched = false;
            break;
          }
          try {
            replies.push(
              await answerSimpleQuery(query, adminDb, child.id, child.name, currentDate),
            );
          } catch {
            allMatched = false;
            break;
          }
        }

        if (allMatched && replies.length > 0) {
          const reply = replies.length === 1 ? replies[0] : replies.join('\n\n');
          return new Response(JSON.stringify({ content: reply, loggedEvents: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }
      }

      // ── Logging fast path (Tier 0) ──────────────────────────────────────────
      if (batchClass === 'log') {
        const confirmations: string[] = [];
        const loggedEvents: Record<string, unknown>[] = [];
        let anyParseError = false;

        for (const msg of batchUserMsgs) {
          const intent = parseIntent(msg.content as string);
          if (!intent) {
            anyParseError = true;
            break;
          }
          let result: ToolHandleResult;
          try {
            result = await handleTool(
              intent.toolName,
              intent.input,
              child.id,
              user.id,
              adminDb,
              currentDate,
            );
          } catch {
            anyParseError = true;
            break;
          }
          if (result.message.startsWith('Error:')) {
            anyParseError = true;
            break;
          }
          confirmations.push(result.message);
          if (result.event) loggedEvents.push(result.event);
        }

        if (!anyParseError && confirmations.length > 0 && confirmations.length === batchUserMsgs.length) {
          const reply = confirmations.length === 1
            ? `Done! ${confirmations[0]}`
            : `Done! ${confirmations.join(' ')}`;
          return new Response(JSON.stringify({ content: reply, loggedEvents }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }
      }
      // Mixed or unrecognised batch — fall through to Claude
    }

    // ── Build system prompt ───────────────────────────────────────────────────
    const age = calculateAge(child.date_of_birth, currentDate);

    const todaySnapshot = await buildTodaySnapshotText(
      adminDb,
      child.id,
      child.name,
      currentDate,
    );

    const batchUserTexts = messages
      .filter((m) => m.role === 'user' && typeof m.content === 'string')
      .map((m) => m.content as string);
    const requestClass: MessageClass = hasPhoto
      ? 'unknown'
      : classifyBatch(batchUserTexts.length > 0 ? batchUserTexts : ['']);

    // Build per-request context (not cached — changes every turn)
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

    const dynamicSystemPrompt = `You are helping the parents of ${child.name}, who is ${age} (born ${child.date_of_birth}). Today is ${currentDate}.

Today snapshot: ${todaySnapshot}${contextBlock}`;

    // Static instructions cached; child/date/context sent as a separate uncached block
    const systemParam = [
      {
        type: 'text' as const,
        text: STATIC_SYSTEM_INSTRUCTIONS,
        cache_control: { type: 'ephemeral' as const },
      },
      {
        type: 'text' as const,
        text: QA_SYSTEM_INSTRUCTIONS,
        cache_control: { type: 'ephemeral' as const },
      },
      {
        type: 'text' as const,
        text: dynamicSystemPrompt,
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
    const loggedEvents: Record<string, unknown>[] = [];
    const MAX_ITERATIONS = 5;
    const needsSynthesis = requestClass === 'complex_query';
    const synthesisMaxTokens = needsSynthesis ? 400 : 300;
    let readToolsRan = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: i === 0 ? synthesisMaxTokens : 400,
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
          let message: string;
          try {
            const result = await handleTool(
              tb.name,
              tb.input as Record<string, unknown>,
              child.id,
              user.id,
              adminDb,
              currentDate,
              batchMediaUrls,
            );
            message = result.message;
            if (result.event) loggedEvents.push(result.event);
            if (READ_TOOLS.has(tb.name)) readToolsRan = true;
          } catch (err) {
            message = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }

          if (
            !message.startsWith('Error:') &&
            !message.startsWith('CLARIFICATION:') &&
            !message.startsWith('No open') &&
            !READ_TOOLS.has(tb.name)
          ) {
            loggedConfirmations.push(message);
          }

          if (message.startsWith('CLARIFICATION:')) {
            finalText = message.replace('CLARIFICATION:', '');
          }

          return {
            type: 'tool_result' as const,
            tool_use_id: tb.id,
            content: message,
          };
        }),
      );

      // Clarification requested — stop here
      if (finalText && toolResults.some((r) => r.content.startsWith('CLARIFICATION:'))) {
        break;
      }

      const allActivityTools = toolUseBlocks.every((tb) => ACTIVITY_TOOLS.has(tb.name));
      if (allActivityTools) {
        break;
      }

      const allReadTools = toolUseBlocks.every((tb) => READ_TOOLS.has(tb.name));
      if (allReadTools) {
        const readReply = toolResults.map((r) => r.content).join('\n\n');
        if (!needsSynthesis) {
          finalText = readReply;
          break;
        }
        // Complex query: one synthesis follow-up with tool results
        if (i >= MAX_ITERATIONS - 1) {
          finalText = readReply;
          break;
        }
      }

      apiMessages.push({ role: 'assistant', content: response.content });
      apiMessages.push({ role: 'user', content: toolResults });

      // After read tools + synthesis iteration, stop if we already got a text response
      if (allReadTools && needsSynthesis && i > 0) {
        break;
      }
    }

    // Fallback: tools ran but Claude returned no text
    if (!finalText.trim() && loggedConfirmations.length > 0) {
      finalText =
        loggedConfirmations.length === 1
          ? `Done! ${loggedConfirmations[0]}`
          : `Done! ${loggedConfirmations.join(' ')}`;
    }

    if (!finalText.trim() && readToolsRan) {
      finalText = "I couldn't find matching records for that question.";
    }

    return new Response(JSON.stringify({ content: finalText, loggedEvents }), {
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
