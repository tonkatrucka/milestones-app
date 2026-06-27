import type { CandidateBullet } from './research-dedup.ts';
import { sanitizeResearchBulletText } from './research-text-sanitize.ts';

export interface ModelParseDebug {
  stopReason?: string;
  contentTypes: string[];
  textBlockCount: number;
  issue: 'no_text' | 'no_json' | 'invalid_shape' | 'all_filtered' | 'parse_error';
  snippet?: string;
  parseError?: string;
  rawCandidateCount?: number;
}

export interface ModelParseResult {
  bullets: CandidateBullet[];
  debug?: ModelParseDebug;
}

type ContentBlock = { type: string; text?: string };

export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = fenced[1].trim();
    if (inner.startsWith('{')) return inner;
  }

  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function mapBullet(b: Record<string, unknown>): CandidateBullet | null {
  const text = sanitizeResearchBulletText(String(b.text ?? ''));
  const sourceUrl = String(b.sourceUrl ?? b.source_url ?? '').trim();
  if (!text || !sourceUrl) return null;
  return {
    text,
    sourceUrl,
    sourceName: String(b.sourceName ?? b.source_name ?? ''),
    sourceTier: b.sourceTier as CandidateBullet['sourceTier'],
    subtopic: String(b.subtopic ?? 'general'),
  };
}

export function parseBulletsPayload(parsed: unknown): CandidateBullet[] {
  const bullets = Array.isArray(parsed)
    ? parsed
    : (parsed as { bullets?: unknown })?.bullets;
  if (!Array.isArray(bullets)) return [];
  return bullets
    .map((b) => mapBullet(b as Record<string, unknown>))
    .filter((b): b is CandidateBullet => b !== null);
}

export function parseResearchModelResponse(
  content: ContentBlock[],
  stopReason?: string,
): ModelParseResult {
  const contentTypes = content.map((b) => b.type);
  const textBlocks = content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string);

  if (textBlocks.length === 0) {
    return {
      bullets: [],
      debug: {
        stopReason,
        contentTypes,
        textBlockCount: 0,
        issue: 'no_text',
      },
    };
  }

  const orderedTexts = [...textBlocks].reverse();
  for (const text of orderedTexts) {
    const jsonText = extractJsonObject(text);
    if (!jsonText) continue;

    try {
      const parsed = JSON.parse(jsonText);
      const bullets = parseBulletsPayload(parsed);
      if (bullets.length > 0) {
        return { bullets };
      }
    } catch (e) {
      return {
        bullets: [],
        debug: {
          stopReason,
          contentTypes,
          textBlockCount: textBlocks.length,
          issue: 'parse_error',
          snippet: text.slice(0, 240),
          parseError: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  const combined = textBlocks.join('\n');
  const jsonText = extractJsonObject(combined);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const rawCandidateCount = Array.isArray(parsed?.bullets)
        ? parsed.bullets.length
        : Array.isArray(parsed)
        ? parsed.length
        : 0;
      const bullets = parseBulletsPayload(parsed);
      if (bullets.length > 0) return { bullets };
      return {
        bullets: [],
        debug: {
          stopReason,
          contentTypes,
          textBlockCount: textBlocks.length,
          issue: 'all_filtered',
          snippet: combined.slice(0, 240),
          rawCandidateCount,
        },
      };
    } catch (e) {
      return {
        bullets: [],
        debug: {
          stopReason,
          contentTypes,
          textBlockCount: textBlocks.length,
          issue: 'parse_error',
          snippet: combined.slice(0, 240),
          parseError: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  return {
    bullets: [],
    debug: {
      stopReason,
      contentTypes,
      textBlockCount: textBlocks.length,
      issue: 'no_json',
      snippet: textBlocks[textBlocks.length - 1]?.slice(0, 240),
    },
  };
}
