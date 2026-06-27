import { userRegionToSourceRegion, type SourceRegion } from './research-source-policy.ts';

export interface ResearchBulletRow {
  id: string;
  age_bracket: string;
  category: string;
  subtopic: string;
  text: string;
  source_url: string;
  source_name: string;
  source_domain: string;
  source_tier: string;
  source_region: string;
  reviewed_at: string;
  created_at: string;
  active: boolean;
}

export interface SelectResearchInput {
  ageBracket: string;
  categories: string[];
  userRegion: string;
  shownBulletIds: Set<string>;
  shownFirstOn: Map<string, string>;
  pool: ResearchBulletRow[];
  count?: number;
}

export interface SelectedResearchBullet extends ResearchBulletRow {
  isNew: boolean;
}

const DEFAULT_CATEGORIES = ['development', 'milestones', 'sleep'];
const TARGET_MIN = 5;
const TARGET_MAX = 7;
const MIN_CATEGORY_COUNT = 2;

function distinctCategories(bullets: ResearchBulletRow[]): number {
  return new Set(bullets.map((b) => b.category)).size;
}

function ensureMinCategories(
  picked: ResearchBulletRow[],
  active: ResearchBulletRow[],
  usedIds: Set<string>,
  usedSubtopics: Set<string>,
  categories: string[],
  preferred: SourceRegion | 'GLOBAL',
  shownFirstOn: Map<string, string>,
  target: number,
): void {
  if (distinctCategories(picked) >= MIN_CATEGORY_COUNT) return;

  const represented = new Set(picked.map((b) => b.category));
  const categoryOrder = [
    ...categories.filter((c) => !represented.has(c)),
    ...DEFAULT_CATEGORIES.filter((c) => !represented.has(c)),
    ...[...new Set(active.map((b) => b.category))].filter((c) => !represented.has(c)),
  ];

  for (const category of categoryOrder) {
    if (distinctCategories(picked) >= MIN_CATEGORY_COUNT) break;
    const candidates = sortCandidates(
      active.filter((b) => b.category === category),
      categories,
      preferred,
      shownFirstOn,
    );
    for (const b of candidates) {
      if (picked.length >= target && distinctCategories(picked) >= MIN_CATEGORY_COUNT) break;
      if (usedIds.has(b.id) || usedSubtopics.has(b.subtopic)) continue;
      picked.push(b);
      usedIds.add(b.id);
      usedSubtopics.add(b.subtopic);
      if (distinctCategories(picked) >= MIN_CATEGORY_COUNT) break;
    }
  }
}

function regionalScore(bullet: ResearchBulletRow, preferred: SourceRegion | 'GLOBAL'): number {
  if (preferred === 'GLOBAL') {
    if (bullet.source_region === 'GLOBAL') return 2;
    return 1;
  }
  if (bullet.source_region === preferred) return 3;
  if (bullet.source_region === 'GLOBAL') return 2;
  return 1;
}

function freshnessScore(bullet: ResearchBulletRow): number {
  const reviewed = new Date(bullet.reviewed_at).getTime();
  const created = new Date(bullet.created_at).getTime();
  return Math.max(reviewed, created);
}

function relevanceScore(bullet: ResearchBulletRow, categories: string[]): number {
  if (categories.length === 0) return 0;
  return categories.includes(bullet.category) ? 2 : 0;
}

function sortCandidates(
  bullets: ResearchBulletRow[],
  categories: string[],
  preferredRegion: SourceRegion | 'GLOBAL',
  shownFirstOn: Map<string, string>,
): ResearchBulletRow[] {
  return [...bullets].sort((a, b) => {
    const aShown = shownFirstOn.has(a.id);
    const bShown = shownFirstOn.has(b.id);
    if (aShown !== bShown) return aShown ? 1 : -1;

    const rel = relevanceScore(b, categories) - relevanceScore(a, categories);
    if (rel !== 0) return rel;

    const reg = regionalScore(b, preferredRegion) - regionalScore(a, preferredRegion);
    if (reg !== 0) return reg;

    return freshnessScore(b) - freshnessScore(a);
  });
}

export function selectResearchBullets(input: SelectResearchInput): SelectedResearchBullet[] {
  const {
    ageBracket,
    categories,
    userRegion,
    shownBulletIds,
    shownFirstOn,
    pool,
    count,
  } = input;

  const target = Math.min(TARGET_MAX, Math.max(TARGET_MIN, count ?? TARGET_MIN));
  const preferred = userRegionToSourceRegion(userRegion);

  const active = pool.filter((b) => b.active && b.age_bracket === ageBracket);
  if (active.length === 0) return [];

  const relevantCats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const primaryPool = sortCandidates(
    active.filter((b) => relevantCats.includes(b.category)),
    relevantCats,
    preferred,
    shownFirstOn,
  );
  const fallbackPool = sortCandidates(
    active.filter((b) => DEFAULT_CATEGORIES.includes(b.category)),
    DEFAULT_CATEGORIES,
    preferred,
    shownFirstOn,
  );

  const picked: ResearchBulletRow[] = [];
  const usedSubtopics = new Set<string>();
  const usedIds = new Set<string>();

  const tryPick = (list: ResearchBulletRow[], requireNovel = false) => {
    for (const b of list) {
      if (picked.length >= target) break;
      if (usedIds.has(b.id)) continue;
      if (usedSubtopics.has(b.subtopic)) continue;
      if (requireNovel && shownBulletIds.has(b.id)) continue;
      picked.push(b);
      usedIds.add(b.id);
      usedSubtopics.add(b.subtopic);
    }
  };

  // 1 — novelty guarantee
  const unseen = active.filter((b) => !shownBulletIds.has(b.id));
  if (unseen.length > 0) {
    const novelSorted = sortCandidates(unseen, relevantCats, preferred, shownFirstOn);
    tryPick(novelSorted, true);
  }

  tryPick(primaryPool);
  if (picked.length < target) tryPick(fallbackPool);

  // recycle oldest shown
  if (picked.length < target) {
    const recycled = sortCandidates(active, relevantCats, preferred, shownFirstOn)
      .filter((b) => shownFirstOn.has(b.id))
      .sort((a, b) => (shownFirstOn.get(a.id) ?? '').localeCompare(shownFirstOn.get(b.id) ?? ''));
    tryPick(recycled);
  }

  if (picked.length < target) {
    tryPick(sortCandidates(active, relevantCats, preferred, shownFirstOn));
  }

  ensureMinCategories(
    picked,
    active,
    usedIds,
    usedSubtopics,
    relevantCats,
    preferred,
    shownFirstOn,
    target,
  );

  return picked.slice(0, target).map((b) => ({
    ...b,
    isNew: !shownBulletIds.has(b.id),
  }));
}
