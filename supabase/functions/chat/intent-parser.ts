interface ParsedIntent {
  toolName: string;
  input: Record<string, unknown>;
}

/**
 * Lightweight pre-parser for simple, unambiguous activity messages.
 * Returns a tool name + input for direct execution — bypassing Claude entirely.
 * Never matches messages that could be memories (sentimental, photo-implied, complex).
 */
export function parseIntent(text: string): ParsedIntent | null {
  const trimmed = text.trim();

  // Only parse short, unambiguous messages. Questions or long prose go to Claude.
  if (trimmed.length > 60 || trimmed.includes('?')) return null;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 6) return null;

  const lower = trimmed.toLowerCase();

  // ── Bottle feed: "120ml", "bottle 120ml", "120ml bottle", "fed 120ml" ─────
  const mlMatch = lower.match(
    /^(?:(?:bottle|fed|feed|gave)\s+)?(\d+)\s*ml(?:\s+bottle)?$/,
  );
  if (mlMatch) {
    return {
      toolName: 'log_meal',
      input: { meal_type: 'bottle', amount_ml: parseInt(mlMatch[1], 10) },
    };
  }

  // ── Breast feed ───────────────────────────────────────────────────────────
  if (/^(?:breast(?:fed|feed)?|bf|nursing|nursed)$/.test(lower)) {
    return { toolName: 'log_meal', input: { meal_type: 'breast' } };
  }

  // ── Wet nappy ─────────────────────────────────────────────────────────────
  if (/^(?:wet\s+)?nappy(?:\s+change)?$|^wet\s+diaper$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'wet' } };
  }

  // ── Dirty nappy ───────────────────────────────────────────────────────────
  if (
    /^(?:dirty|poo(?:py)?|poop(?:y)?)(?:\s+nappy|\s+diaper)?$|^soiled(?:\s+nappy)?$/.test(lower)
  ) {
    return { toolName: 'log_nappy', input: { nappy_type: 'dirty' } };
  }

  // ── Wet + dirty ───────────────────────────────────────────────────────────
  if (/^(?:wet\s+(?:and|&)\s+dirty|dirty\s+(?:and|&)\s+wet)(?:\s+nappy)?$/.test(lower)) {
    return { toolName: 'log_nappy', input: { nappy_type: 'both' } };
  }

  // ── Sleep start ───────────────────────────────────────────────────────────
  if (
    /^(?:nap(?:\s+start(?:ed)?)?|asleep|sleeping|napping|went\s+to\s+sleep|fell\s+asleep)$/.test(
      lower,
    )
  ) {
    return { toolName: 'log_sleep_start', input: {} };
  }

  // ── Sleep end ─────────────────────────────────────────────────────────────
  if (
    /^(?:woke?\s+up|awake|nap\s+(?:end(?:ed)?|over|done)|wake\s+up)$/.test(lower)
  ) {
    return { toolName: 'log_sleep_end', input: {} };
  }

  return null;
}
