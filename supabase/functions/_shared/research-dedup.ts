import {
  inferSourceRegion,
  inferSourceTier,
  parseDomain,
  type SourceTier,
  validateSourceUrl,
} from './research-source-policy.ts';
import { sanitizeResearchBulletText } from './research-text-sanitize.ts';

export type DedupRejectReason =
  | 'exact_dup'
  | 'near_dup'
  | 'subtopic_saturated'
  | 'bad_url'
  | 'tier_3b_cap';

export interface CandidateBullet {
  text: string;
  sourceUrl: string;
  sourceName: string;
  sourceTier?: SourceTier;
  subtopic: string;
}

export interface StoredBullet extends CandidateBullet {
  id: string;
  content_hash: string;
  source_domain: string;
  source_region: string;
  active: boolean;
}

export interface PackKey {
  age_bracket: string;
  category: string;
}

const MAX_PER_SUBTOPIC = 8;
const JACCARD_THRESHOLD = 0.65;
const TIER_3B_MAX_RATIO = 0.2;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function contentHash(text: string): Promise<string> {
  const normalized = normalizeText(text);
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(' ').filter((w) => w.length > 2));
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isNearDuplicate(text: string, existing: string[]): boolean {
  const norm = normalizeText(text);
  for (const ex of existing) {
    const exNorm = normalizeText(ex);
    if (norm === exNorm) return true;
    if (norm.includes(exNorm) || exNorm.includes(norm)) return true;
    if (jaccardSimilarity(norm, exNorm) >= JACCARD_THRESHOLD) return true;
  }
  return false;
}

export function countBySubtopic(bullets: { subtopic: string; active?: boolean }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of bullets) {
    if (b.active === false) continue;
    map.set(b.subtopic, (map.get(b.subtopic) ?? 0) + 1);
  }
  return map;
}

export function subtopicGaps(counts: Map<string, number>, min = 3): string[] {
  const gaps: string[] = [];
  for (const [topic, n] of counts) {
    if (n < min) gaps.push(topic);
  }
  return gaps;
}

export interface DedupContext {
  existingTexts: string[];
  existingHashes: Set<string>;
  subtopicCounts: Map<string, number>;
  batchTier3bCount: number;
  batchTotal: number;
}

export function createDedupContext(existing: StoredBullet[]): DedupContext {
  const active = existing.filter((b) => b.active);
  return {
    existingTexts: active.map((b) => b.text),
    existingHashes: new Set(active.map((b) => b.content_hash)),
    subtopicCounts: countBySubtopic(active),
    batchTier3bCount: 0,
    batchTotal: 0,
  };
}

export async function validateCandidate(
  candidate: CandidateBullet,
  ctx: DedupContext,
  options: { skipNetwork?: boolean } = {},
): Promise<{ ok: true; hash: string; domain: string; tier: SourceTier; region: string } | { ok: false; reason: DedupRejectReason }> {
  const cleaned: CandidateBullet = {
    ...candidate,
    text: sanitizeResearchBulletText(candidate.text),
  };
  if (!cleaned.text) {
    return { ok: false, reason: 'bad_url' };
  }

  const hash = await contentHash(cleaned.text);
  if (ctx.existingHashes.has(hash)) {
    return { ok: false, reason: 'exact_dup' };
  }
  if (isNearDuplicate(cleaned.text, ctx.existingTexts)) {
    return { ok: false, reason: 'near_dup' };
  }

  const subtopicCount = ctx.subtopicCounts.get(cleaned.subtopic) ?? 0;
  if (subtopicCount >= MAX_PER_SUBTOPIC) {
    return { ok: false, reason: 'subtopic_saturated' };
  }

  const urlCheck = await validateSourceUrl(
    cleaned.sourceUrl,
    cleaned.sourceTier,
    options,
  );
  if (!urlCheck.ok || !urlCheck.domain || !urlCheck.tier) {
    return { ok: false, reason: 'bad_url' };
  }

  const tier = urlCheck.tier;
  if (tier === 'tier_3b') {
    const projected = ctx.batchTier3bCount + 1;
    const total = ctx.batchTotal + 1;
    if (total > 0 && projected / total > TIER_3B_MAX_RATIO && ctx.batchTotal >= 4) {
      return { ok: false, reason: 'tier_3b_cap' };
    }
  }

  const domain = urlCheck.domain;
  const region = urlCheck.region ?? inferSourceRegion(domain);

  return { ok: true, hash, domain, tier, region };
}

export function recordAccepted(ctx: DedupContext, bullet: CandidateBullet, hash: string): void {
  const cleaned = { ...bullet, text: sanitizeResearchBulletText(bullet.text) };
  ctx.existingTexts.push(cleaned.text);
  ctx.existingHashes.add(hash);
  ctx.subtopicCounts.set(bullet.subtopic, (ctx.subtopicCounts.get(bullet.subtopic) ?? 0) + 1);
  ctx.batchTotal++;
  const domain = parseDomain(bullet.sourceUrl);
  const tier = domain ? inferSourceTier(domain) : bullet.sourceTier;
  if (tier === 'tier_3b') ctx.batchTier3bCount++;
}
