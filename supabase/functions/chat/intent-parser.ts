export type MessageClass = 'log' | 'simple_query' | 'complex_query' | 'unknown';

export interface ParsedLogIntent {
  kind: 'log';
  toolName: string;
  input: Record<string, unknown>;
}

export interface ParsedSimpleQuery {
  kind: 'simple_query';
  queryType:
    | 'nappy_count_today'
    | 'meal_count_today'
    | 'milk_today'
    | 'sleep_today'
    | 'nappy_count_yesterday'
    | 'meal_count_yesterday'
    | 'milk_yesterday'
    | 'sleep_yesterday'
    | 'last_meal'
    | 'last_nappy'
    | 'last_sleep'
    | 'is_asleep'
    | 'today_summary';
}

export interface ParsedComplexQuery {
  kind: 'complex_query';
}

export type ParsedMessage =
  | ParsedLogIntent
  | ParsedSimpleQuery
  | ParsedComplexQuery
  | { kind: 'unknown' };

interface ParsedIntent {
  toolName: string;
  input: Record<string, unknown>;
}

const COMPLEX_QUERY_PATTERNS = [
  /\b(summar(?:y|ise|ize)|overview|pattern|trend|how\s+has|how\s+have|this\s+week|last\s+week|past\s+(?:few\s+)?days|recently)\b/i,
  /\b(milestone|memor(?:y|ies)|journey)\b/i,
  /\b(enough|normal|should\s+(?:i|we)|worried|concern)\b/i,
];

function parseMlAmount(lower: string): ParsedIntent | null {
  const patterns = [
    /^(?:(?:bottle|fed|feed|gave)\s+)?(\d+)\s*ml(?:\s+bottle)?$/,
    /^(\d+)\s*ml$/,
    /^bottle\s+(\d+)\s*ml?$/,
    /^(?:fed|feed|gave)\s+(\d+)\s*ml$/,
    /^(\d+)\s*ml\s+bottle$/,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return {
        toolName: 'log_meal',
        input: { meal_type: 'bottle', amount_ml: parseInt(match[1], 10) },
      };
    }
  }
  return null;
}

function parseNappyIntent(lower: string): ParsedIntent | null {
  if (/^(?:wet\s+)?nappy(?:\s+change)?$|^wet\s+diaper$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'wet' } };
  }
  if (
    /^(?:dirty|poo(?:py)?|poop(?:y)?)(?:\s+nappy|\s+diaper)?$|^soiled(?:\s+nappy)?$|^poo$/.test(
      lower,
    )
  ) {
    return { toolName: 'log_nappy', input: { nappy_type: 'dirty' } };
  }
  if (
    /^(?:wet\s+(?:and|&)\s+dirty|dirty\s+(?:and|&)\s+wet|both)(?:\s+nappy|\s+diaper)?$/.test(lower)
  ) {
    return { toolName: 'log_nappy', input: { nappy_type: 'both' } };
  }
  if (/^dry(?:\s+nappy|\s+diaper)?$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'dry' } };
  }
  return null;
}

function parseBreastIntent(lower: string): ParsedIntent | null {
  const withSideAndDuration = lower.match(
    /^(?:bf|breast(?:feed|fed)?|nursing|nursed)\s+(left|right|both)\s+(\d+)\s*(?:m|min|mins|minutes?)$/,
  );
  if (withSideAndDuration) {
    return {
      toolName: 'log_meal',
      input: {
        meal_type: 'breast',
        breast_side: withSideAndDuration[1],
        duration_mins: parseInt(withSideAndDuration[2], 10),
      },
    };
  }

  const sideFirst = lower.match(
    /^(left|right|both)\s+(?:bf|breast(?:feed)?)\s+(\d+)\s*(?:m|min|mins|minutes?)$/,
  );
  if (sideFirst) {
    return {
      toolName: 'log_meal',
      input: {
        meal_type: 'breast',
        breast_side: sideFirst[1],
        duration_mins: parseInt(sideFirst[2], 10),
      },
    };
  }

  const durationOnly = lower.match(
    /^(?:bf|breast(?:feed|fed)?|nursing|nursed)\s+(\d+)\s*(?:m|min|mins|minutes?)$/,
  );
  if (durationOnly) {
    return {
      toolName: 'log_meal',
      input: {
        meal_type: 'breast',
        duration_mins: parseInt(durationOnly[1], 10),
      },
    };
  }

  const sideOnly = lower.match(/^(?:bf|breast(?:feed|fed)?|nursing|nursed)\s+(left|right|both)$/);
  if (sideOnly) {
    return {
      toolName: 'log_meal',
      input: { meal_type: 'breast', breast_side: sideOnly[1] },
    };
  }

  return null;
}

function parseMealIntent(lower: string): ParsedIntent | null {
  const breast = parseBreastIntent(lower);
  if (breast) return breast;

  if (/^(?:breast(?:fed|feed)?|bf|nursing|nursed)$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'breast' } };
  }
  if (/^(?:solid|solids)$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'solid' } };
  }
  if (/^snack$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'snack' } };
  }
  if (/^bottle$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'bottle' } };
  }
  return null;
}

function parseSleepIntent(lower: string): ParsedIntent | null {
  if (
    /^(?:nap(?:\s+start(?:ed)?)?|asleep|sleeping|napping|went\s+to\s+sleep|fell\s+asleep|sleep|went\s+down)$/.test(
      lower,
    )
  ) {
    return { toolName: 'log_sleep_start', input: {} };
  }
  if (
    /^(?:woke?\s+up|awake|nap\s+(?:end(?:ed)?|over|done)|wake\s+up|up)$/.test(lower)
  ) {
    return { toolName: 'log_sleep_end', input: {} };
  }
  return null;
}

/**
 * Lightweight pre-parser for simple, unambiguous activity messages.
 * Returns a tool name + input for direct execution — bypassing Claude entirely.
 */
export function parseIntent(text: string): ParsedIntent | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes('?')) return null;
  if (trimmed.length > 80) return null;

  const lower = trimmed.toLowerCase();

  const ml = parseMlAmount(lower);
  if (ml) return ml;

  const nappy = parseNappyIntent(lower);
  if (nappy) return nappy;

  const meal = parseMealIntent(lower);
  if (meal) return meal;

  const sleep = parseSleepIntent(lower);
  if (sleep) return sleep;

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 8 || trimmed.length > 60) return null;

  return null;
}

/**
 * Parse simple factual questions that can be answered without an LLM.
 */
export function parseQueryIntent(text: string): ParsedSimpleQuery | null {
  const trimmed = text.trim();
  if (!trimmed.includes('?') && !/^(how many|how much|when did|is (?:she|he|they)|last )/i.test(trimmed)) {
    return null;
  }
  if (trimmed.length > 120) return null;

  const lower = trimmed.toLowerCase().replace(/[?!.]/g, '').trim();
  const isYesterday = /\byesterday\b/.test(lower);
  const isToday = /\btoday\b/.test(lower) || (!isYesterday && !/\bthis\s+week\b/.test(lower));

  if (/\b(asleep|sleeping|still\s+sleep(?:ing)?)\b/.test(lower) && /\b(is|are)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'is_asleep' };
  }

  if (/\b(how\s+many|number\s+of)\b.*\b(napp(?:y|ies)|diaper)/.test(lower)) {
    if (isYesterday) return { kind: 'simple_query', queryType: 'nappy_count_yesterday' };
    if (isToday) return { kind: 'simple_query', queryType: 'nappy_count_today' };
  }

  if (/\b(how\s+many|number\s+of)\b.*\b(feed|feeds|meal|meals)\b/.test(lower)) {
    if (isYesterday) return { kind: 'simple_query', queryType: 'meal_count_yesterday' };
    if (isToday) return { kind: 'simple_query', queryType: 'meal_count_today' };
  }

  if (/\b(how\s+much)\b.*\b(milk|ml|bottle)\b/.test(lower)) {
    if (isYesterday) return { kind: 'simple_query', queryType: 'milk_yesterday' };
    if (isToday) return { kind: 'simple_query', queryType: 'milk_today' };
  }

  if (/\b(how\s+much)\b.*\b(sleep|slept|nap)\b/.test(lower)) {
    if (isYesterday) return { kind: 'simple_query', queryType: 'sleep_yesterday' };
    if (isToday) return { kind: 'simple_query', queryType: 'sleep_today' };
  }

  if (/\b(feeds?|meals?|napp(?:y|ies)|diapers?)\b.*\byesterday\b/.test(lower)) {
    if (/\b(napp|diaper)/.test(lower)) {
      return { kind: 'simple_query', queryType: 'nappy_count_yesterday' };
    }
    return { kind: 'simple_query', queryType: 'meal_count_yesterday' };
  }

  if (/\b(when|what\s+time)\b.*\b(last|latest)\b.*\b(eat|fed|feed|meal|bottle|milk)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'last_meal' };
  }

  if (/\b(when|what\s+time)\b.*\b(last|latest)\b.*\b(napp|diaper)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'last_nappy' };
  }

  if (/\b(when|what\s+time)\b.*\b(last|latest)\b.*\b(nap|sleep|slept)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'last_sleep' };
  }

  if (/\b(how(?:'s| is)|how\s+is)\b.*\btoday\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'today_summary' };
  }

  if (/\b(today|so\s+far)\b/.test(lower) && /\b(summary|going|been)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'today_summary' };
  }

  return null;
}

function isComplexQuery(text: string): boolean {
  return COMPLEX_QUERY_PATTERNS.some((p) => p.test(text));
}

/**
 * Classify a single user message for routing.
 */
export function classifyMessage(text: string): MessageClass {
  if (parseIntent(text)) return 'log';
  if (parseQueryIntent(text)) return 'simple_query';
  if (isComplexQuery(text)) return 'complex_query';
  if (text.includes('?')) return 'complex_query';
  return 'unknown';
}

export function classifyBatch(texts: string[]): MessageClass {
  const classes = texts.map(classifyMessage);
  const unique = new Set(classes);
  if (unique.size > 1) return 'unknown';
  if (unique.has('log')) return 'log';
  if (unique.has('simple_query')) return 'simple_query';
  if (unique.has('complex_query')) return 'complex_query';
  return 'unknown';
}

export function parseMessage(text: string): ParsedMessage {
  const log = parseIntent(text);
  if (log) return { kind: 'log', toolName: log.toolName, input: log.input };

  const query = parseQueryIntent(text);
  if (query) return query;

  if (isComplexQuery(text) || text.includes('?')) {
    return { kind: 'complex_query' };
  }

  return { kind: 'unknown' };
}
