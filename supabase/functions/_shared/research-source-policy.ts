import {
  isDomainOnAllowlist,
  TRUSTED_DOMAIN_SUFFIXES,
  TRUSTED_RESEARCH_SOURCES,
} from './research-sources-registry.ts';

export type SourceTier = 'tier_1' | 'tier_2' | 'tier_3a' | 'tier_3b';
export type SourceRegion = 'UK' | 'US' | 'AU' | 'CA' | 'GLOBAL';

export type ResearchCategory =
  | 'sleep'
  | 'feeding'
  | 'development'
  | 'milestones'
  | 'regression'
  | 'language';

export type AgeBracket =
  | 'newborn'
  | 'infant_early'
  | 'infant'
  | 'infant_late'
  | 'toddler_early'
  | 'toddler'
  | 'toddler_late';

const URL_SHORTENERS = new Set(['bit.ly', 't.co', 'goo.gl', 'tinyurl.com']);

const DOMAIN_TIER: Record<string, SourceTier> = Object.fromEntries(
  TRUSTED_RESEARCH_SOURCES.map((s) => [s.domain, s.tier]),
);

const DOMAIN_REGION: Record<string, SourceRegion> = Object.fromEntries(
  TRUSTED_RESEARCH_SOURCES.map((s) => [s.domain, s.region]),
);

export { TRUSTED_RESEARCH_SOURCES, isDomainOnAllowlist } from './research-sources-registry.ts';

export const RESEARCH_SYSTEM_INSTRUCTIONS = `You are researching evidence-based child development guidance for parents.

SOURCE RULES (mandatory):
- Use web search for every bullet. Do not rely on memory alone.
- Prefer sources in this order:
  1) Tier 1 government health (NHS, CDC, WHO, Australian Government, Raising Children Network,
     healthdirect, Pregnancy Birth and Baby, HSE Ireland, Health New Zealand)
  2) Tier 2 professional bodies (AAP/HealthyChildren, CPS Caring for Kids, RCPCH, UNICEF, Zero to Three)
  3) Tier 3a government portals (gov.uk, gov.au pages on child health only)
  4) Tier 3b open-access journals (PMC, Cochrane summaries) — only when higher tiers lack coverage
- Australia: strongly prefer raisingchildren.net.au, pregnancybirthbaby.org.au, healthdirect.gov.au
  for parent-facing bullets; these are government-funded and expert-reviewed.
- Journal sources (Tier 3b): cite only open-access full text (PubMed Central,
  Cochrane summaries, open-access publisher pages). Never cite paywalled abstracts.
- Each bullet must include the exact URL of the page where you found the fact.
- Do not cite blogs, forums, news articles, commercial sites, Wikipedia, or preprints.
- Do not state medical diagnoses, prescribe treatments, or replace a pediatrician.
- Translate journal findings into plain parent-friendly language.
- Use ranges and "typically" language — children develop at different rates.
- Gather sources from multiple regions (UK, US, Australia, Canada, Ireland, New Zealand) when possible.
- If search finds no acceptable source for a subtopic, omit that bullet rather than guess.

OUTPUT: Return a JSON object with key "bullets" containing an array. Each bullet:
{ "text": string, "sourceUrl": string, "sourceName": string, "sourceTier": "tier_1"|"tier_2"|"tier_3a"|"tier_3b", "subtopic": string }`;

export const ALL_AGE_BRACKETS: AgeBracket[] = [
  'newborn',
  'infant_early',
  'infant',
  'infant_late',
  'toddler_early',
  'toddler',
  'toddler_late',
];

export const ALL_CATEGORIES: ResearchCategory[] = [
  'sleep',
  'feeding',
  'development',
  'milestones',
  'regression',
  'language',
];

export function parseDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host;
  } catch {
    return null;
  }
}

function matchesAllowlist(host: string): boolean {
  return isDomainOnAllowlist(host);
}

export function inferSourceTier(host: string): SourceTier | null {
  if (DOMAIN_TIER[host]) return DOMAIN_TIER[host];
  if (host.endsWith('.nhs.uk')) return 'tier_3a';
  if (host.endsWith('.gov.uk') || host.endsWith('.gov.au')) return 'tier_3a';
  if (host.endsWith('.hse.ie')) return 'tier_1';
  if (host.endsWith('.govt.nz')) return 'tier_1';
  if (host.includes('ncbi.nlm.nih.gov')) return 'tier_3b';
  return null;
}

export function inferSourceRegion(host: string): SourceRegion {
  if (DOMAIN_REGION[host]) return DOMAIN_REGION[host];
  if (host.endsWith('.nhs.uk') || host.endsWith('.gov.uk') || host.endsWith('.rcpch.ac.uk')) {
    return 'UK';
  }
  if (host.endsWith('nhsinform.scot')) return 'UK';
  if (host.endsWith('.gov.au') || host.endsWith('raisingchildren.net.au')) return 'AU';
  if (host.endsWith('healthdirect.gov.au') || host.endsWith('pregnancybirthbaby.org.au')) return 'AU';
  if (host.endsWith('startingblocks.gov.au')) return 'AU';
  if (host.endsWith('canada.ca') || host.endsWith('.cps.ca')) return 'CA';
  if (host.endsWith('.hse.ie')) return 'GLOBAL';
  if (host.endsWith('.govt.nz') || host.includes('healthnz.govt.nz') || host.includes('tewhatuora.govt.nz')) {
    return 'GLOBAL';
  }
  if (
    host.endsWith('.gov') ||
    host.includes('cdc.gov') ||
    host.includes('nih.gov') ||
    host.includes('healthychildren.org')
  ) {
    return 'US';
  }
  return 'GLOBAL';
}

/** Map ISO user region code to preferred source_region for tiebreak. */
export function userRegionToSourceRegion(userRegion: string): SourceRegion | 'GLOBAL' {
  const r = userRegion.toUpperCase();
  if (r === 'GB' || r === 'IE') return 'UK';
  if (r === 'US') return 'US';
  if (r === 'AU' || r === 'NZ') return 'AU';
  if (r === 'CA') return 'CA';
  return 'GLOBAL';
}

export function categorySearchHint(category: ResearchCategory, ageLabel: string): string {
  const patterns: Record<ResearchCategory, string> = {
    sleep: `"infant sleep" ${ageLabel} site:raisingchildren.net.au OR site:nhs.uk OR site:cdc.gov`,
    feeding: `"baby feeding" ${ageLabel} site:pregnancybirthbaby.org.au OR site:healthychildren.org OR site:nhs.uk`,
    development: `"child development" ${ageLabel} site:raisingchildren.net.au OR site:cdc.gov OR site:who.int`,
    milestones: `"developmental milestones" ${ageLabel} site:cdc.gov OR site:raisingchildren.net.au`,
    regression: `"sleep regression" ${ageLabel} site:nhs.uk OR site:raisingchildren.net.au`,
    language: `"language development" ${ageLabel} site:raisingchildren.net.au OR site:cdc.gov OR site:nhs.uk`,
  };
  return patterns[category];
}

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
  domain?: string;
  tier?: SourceTier;
  region?: SourceRegion;
}

export async function validateSourceUrl(
  url: string,
  declaredTier?: SourceTier,
  options: { skipNetwork?: boolean } = {},
): Promise<UrlValidationResult> {
  if (!url.startsWith('https://')) {
    return { ok: false, reason: 'bad_url' };
  }

  const domain = parseDomain(url);
  if (!domain) return { ok: false, reason: 'bad_url' };

  if (URL_SHORTENERS.has(domain)) return { ok: false, reason: 'bad_url' };

  const tier = inferSourceTier(domain);
  if (!tier || !matchesAllowlist(domain)) {
    return { ok: false, reason: 'bad_url' };
  }

  if (declaredTier && declaredTier !== tier && tier !== 'tier_3b') {
    // Allow declared tier_3b when inferred tier_3b; otherwise trust inference
  }

  if (domain === 'pubmed.ncbi.nlm.nih.gov' && !url.includes('/pmc/')) {
    return { ok: false, reason: 'bad_url' };
  }

  if (!options.skipNetwork) {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (res.status === 404 || res.status === 410) {
        return { ok: false, reason: 'bad_url' };
      }
      const finalHost = parseDomain(res.url);
      if (finalHost && !matchesAllowlist(finalHost)) {
        return { ok: false, reason: 'bad_url' };
      }
      if (declaredTier === 'tier_3b' || tier === 'tier_3b') {
        const paywall = await validateJournalAccess(url);
        if (!paywall.ok) return paywall;
      }
    } catch {
      return { ok: false, reason: 'bad_url' };
    }
  }

  return {
    ok: true,
    domain,
    tier,
    region: inferSourceRegion(domain),
  };
}

export async function validateJournalAccess(url: string): Promise<UrlValidationResult> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok && res.status !== 403) {
      return { ok: false, reason: 'bad_url' };
    }
    const text = (await res.text()).slice(0, 8000).toLowerCase();
    const paywallSignals = [
      'sign in to access',
      'purchase pdf',
      'subscribe to read',
      'access denied',
      'buy this article',
    ];
    if (paywallSignals.some((s) => text.includes(s))) {
      return { ok: false, reason: 'bad_url' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'bad_url' };
  }
}

/** Suffix wildcards for audit scripts (Node). */
export const ALLOWLIST_SUFFIXES = [...TRUSTED_DOMAIN_SUFFIXES, 'ncbi.nlm.nih.gov'];
