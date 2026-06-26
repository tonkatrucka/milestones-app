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

/**
 * Lightweight pre-parser for simple, unambiguous activity messages.
 * Returns a tool name + input for direct execution — bypassing Claude entirely.
 */
export function parseIntent(text: string): ParsedIntent | null {
  const trimmed = text.trim();

  if (trimmed.length > 60 || trimmed.includes('?')) return null;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 6) return null;

  const lower = trimmed.toLowerCase();

  const mlMatch = lower.match(
    /^(?:(?:bottle|fed|feed|gave)\s+)?(\d+)\s*ml(?:\s+bottle)?$/,
  );
  if (mlMatch) {
    return {
      toolName: 'log_meal',
      input: { meal_type: 'bottle', amount_ml: parseInt(mlMatch[1], 10) },
    };
  }

  if (/^(?:breast(?:fed|feed)?|bf|nursing|nursed)$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'breast' } };
  }

  if (/^(?:wet\s+)?nappy(?:\s+change)?$|^wet\s+diaper$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'wet' } };
  }

  if (
    /^(?:dirty|poo(?:py)?|poop(?:y)?)(?:\s+nappy|\s+diaper)?$|^soiled(?:\s+nappy)?$/.test(lower)
  ) {
    return { toolName: 'log_nappy', input: { nappy_type: 'dirty' } };
  }

  if (/^(?:wet\s+(?:and|&)\s+dirty|dirty\s+(?:and|&)\s+wet)(?:\s+nappy)?$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'both' } };
  }

  if (
    /^(?:nap(?:\s+start(?:ed)?)?|asleep|sleeping|napping|went\s+to\s+sleep|fell\s+asleep)$/.test(
      lower,
    )
  ) {
    return { toolName: 'log_sleep_start', input: {} };
  }

  if (
    /^(?:woke?\s+up|awake|nap\s+(?:end(?:ed)?|over|done)|wake\s+up)$/.test(lower)
  ) {
    return { toolName: 'log_sleep_end', input: {} };
  }

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

  if (/\b(asleep|sleeping|still\s+sleep(?:ing)?)\b/.test(lower) && /\b(is|are)\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'is_asleep' };
  }

  if (/\b(how\s+many|number\s+of)\b.*\b(napp(?:y|ies)|diaper)/.test(lower) && /\btoday\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'nappy_count_today' };
  }

  if (/\b(how\s+many|number\s+of)\b.*\b(feed|feeds|meal|meals)\b/.test(lower) && /\btoday\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'meal_count_today' };
  }

  if (/\b(how\s+much)\b.*\b(milk|ml|bottle)\b/.test(lower) && /\btoday\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'milk_today' };
  }

  if (/\b(how\s+much)\b.*\b(sleep|slept|nap)\b/.test(lower) && /\btoday\b/.test(lower)) {
    return { kind: 'simple_query', queryType: 'sleep_today' };
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
