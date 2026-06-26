export type RegistrySourceTier = 'tier_1' | 'tier_2' | 'tier_3a' | 'tier_3b';
export type RegistrySourceRegion = 'UK' | 'US' | 'AU' | 'CA' | 'GLOBAL';

export interface TrustedResearchSource {
  /** Primary hostname (no www). */
  domain: string;
  tier: RegistrySourceTier;
  region: RegistrySourceRegion;
  /** Display name for docs and prompts. */
  name: string;
  /** Especially valuable for parent-facing 0–3y content in this app. */
  highlight: boolean;
  /** What this source is strongest on. */
  strengths: string[];
  notes: string;
}

/**
 * Curated allowlist for research bullets. Government and professional-body
 * sources only; blogs, news, Wikipedia, and commercial sites are excluded.
 *
 * See docs/research-sources.md for the full rationale.
 */
export const TRUSTED_RESEARCH_SOURCES: TrustedResearchSource[] = [
  // ── Tier 1: National government health agencies ─────────────────────────
  {
    domain: 'nhs.uk',
    tier: 'tier_1',
    region: 'UK',
    name: 'NHS',
    highlight: true,
    strengths: ['sleep', 'feeding', 'milestones', 'safety', 'everyday illness'],
    notes: 'UK National Health Service. Gold-standard parent guidance; Start for Life and child health hubs.',
  },
  {
    domain: 'nhsinform.scot',
    tier: 'tier_1',
    region: 'UK',
    name: 'NHS inform',
    highlight: true,
    strengths: ['family health', 'immunisation', 'symptoms', 'development'],
    notes: 'Official Scottish NHS patient information service.',
  },
  {
    domain: 'cdc.gov',
    tier: 'tier_1',
    region: 'US',
    name: 'CDC',
    highlight: true,
    strengths: ['milestones', 'development', 'immunisation', 'safe sleep'],
    notes: 'US Centers for Disease Control. Learn the Signs Act Early milestones are widely used clinically.',
  },
  {
    domain: 'who.int',
    tier: 'tier_1',
    region: 'GLOBAL',
    name: 'WHO',
    highlight: true,
    strengths: ['feeding', 'breastfeeding', 'global development norms'],
    notes: 'World Health Organization. Authoritative international feeding and child health guidance.',
  },
  {
    domain: 'health.gov.au',
    tier: 'tier_1',
    region: 'AU',
    name: 'Australian Government Department of Health',
    highlight: true,
    strengths: ['policy', 'immunisation', 'national programmes'],
    notes: 'Federal Australian health department; links to Pregnancy, Birth and Baby and national programmes.',
  },
  {
    domain: 'raisingchildren.net.au',
    tier: 'tier_1',
    region: 'AU',
    name: 'Raising Children Network',
    highlight: true,
    strengths: ['sleep', 'feeding', 'behaviour', 'development', 'milestones', 'language'],
    notes:
      'Australian Government-funded (DSS). Partnership of Parenting Research Centre and Murdoch Children\'s Research Institute. 400+ expert reviewers; ad-free.',
  },
  {
    domain: 'healthdirect.gov.au',
    tier: 'tier_1',
    region: 'AU',
    name: 'healthdirect',
    highlight: true,
    strengths: ['symptoms', 'when to seek care', 'feeding', 'development links'],
    notes: 'Government-funded national health information service with clinical governance framework.',
  },
  {
    domain: 'pregnancybirthbaby.org.au',
    tier: 'tier_1',
    region: 'AU',
    name: 'Pregnancy, Birth and Baby',
    highlight: true,
    strengths: ['newborn', 'feeding', 'sleep', 'development 0–5y'],
    notes: 'Australian Government service delivered by healthdirect. MCH nurse-reviewed content to age 5.',
  },
  {
    domain: 'startingblocks.gov.au',
    tier: 'tier_1',
    region: 'AU',
    name: 'Starting Blocks',
    highlight: false,
    strengths: ['early learning', 'development', 'childcare quality'],
    notes: 'Australian Children\'s Education & Care Quality Authority (ACECQA) — government early-years resource.',
  },
  {
    domain: 'canada.ca',
    tier: 'tier_1',
    region: 'CA',
    name: 'Government of Canada',
    highlight: false,
    strengths: ['immunisation', 'pregnancy', 'child health programmes'],
    notes: 'Federal Canadian health and social guidance.',
  },
  {
    domain: 'nichd.nih.gov',
    tier: 'tier_1',
    region: 'US',
    name: 'NICHD (NIH)',
    highlight: false,
    strengths: ['research summaries', 'safe sleep', 'development'],
    notes: 'US National Institutes of Health — Eunice Kennedy Shriver National Institute of Child Health and Human Development.',
  },
  {
    domain: 'medlineplus.gov',
    tier: 'tier_1',
    region: 'US',
    name: 'MedlinePlus',
    highlight: false,
    strengths: ['plain-language health summaries', 'feeding', 'conditions'],
    notes: 'US National Library of Medicine consumer health site.',
  },
  {
    domain: 'hse.ie',
    tier: 'tier_1',
    region: 'GLOBAL',
    name: 'HSE (Ireland)',
    highlight: true,
    strengths: ['sleep', 'feeding', 'milestones', 'immunisation', 'well-child'],
    notes: 'Health Service Executive Ireland. mychild.ie content is HSE-authored for pregnancy through age 5.',
  },
  {
    domain: 'mychild.ie',
    tier: 'tier_1',
    region: 'GLOBAL',
    name: 'HSE mychild.ie',
    highlight: false,
    strengths: ['pregnancy', 'baby', 'toddler health'],
    notes: 'HSE Ireland parent portal (pregnancy to age 5).',
  },
  {
    domain: 'healthnz.govt.nz',
    tier: 'tier_1',
    region: 'GLOBAL',
    name: 'Health New Zealand',
    highlight: true,
    strengths: ['Well Child Tamariki Ora', 'immunisation', 'growth checks'],
    notes: 'Te Whatu Ora / Health NZ — national child health programme for under-5s in Aotearoa New Zealand.',
  },
  {
    domain: 'tewhatuora.govt.nz',
    tier: 'tier_1',
    region: 'GLOBAL',
    name: 'Te Whatu Ora',
    highlight: false,
    strengths: ['maternity', 'early years', 'clinical guidance'],
    notes: 'Health New Zealand (Te Whatu Ora) — official NZ health system guidance.',
  },

  // ── Tier 2: Professional bodies & institutional nonprofits ────────────────
  {
    domain: 'healthychildren.org',
    tier: 'tier_2',
    region: 'US',
    name: 'HealthyChildren.org (AAP)',
    highlight: true,
    strengths: ['feeding', 'sleep', 'milestones', 'behaviour', 'safety'],
    notes: 'American Academy of Pediatrics parent site — position statements from US paediatricians.',
  },
  {
    domain: 'rcpch.ac.uk',
    tier: 'tier_2',
    region: 'UK',
    name: 'RCPCH',
    highlight: false,
    strengths: ['clinical standards', 'child health policy', 'professional guidance'],
    notes: 'Royal College of Paediatrics and Child Health (UK).',
  },
  {
    domain: 'caringforkids.cps.ca',
    tier: 'tier_2',
    region: 'CA',
    name: 'Caring for Kids (CPS)',
    highlight: true,
    strengths: ['feeding', 'sleep', 'safety', 'development'],
    notes: 'Canadian Paediatric Society. WHO Vaccine Safety Net member; based on CPS position statements.',
  },
  {
    domain: 'zerotothree.org',
    tier: 'tier_2',
    region: 'US',
    name: 'Zero to Three',
    highlight: false,
    strengths: ['early development', 'attachment', 'social-emotional'],
    notes: 'US nonprofit focused on infants and toddlers; research-informed parenting resources.',
  },
  {
    domain: 'unicef.org',
    tier: 'tier_2',
    region: 'GLOBAL',
    name: 'UNICEF',
    highlight: true,
    strengths: ['global child health', 'feeding', 'early childhood development'],
    notes: 'United Nations children\'s agency; strong international early-years guidance.',
  },
  {
    domain: 'kidshealth.org',
    tier: 'tier_2',
    region: 'US',
    name: 'Nemours KidsHealth',
    highlight: false,
    strengths: ['parent articles', 'development', 'conditions', 'behaviour'],
    notes: 'Nemours Foundation — doctor-reviewed; widely embedded in hospitals and paediatric practices.',
  },

  // ── Tier 3a: Broader government portals (wildcard-backed) ─────────────────
  {
    domain: 'gov.uk',
    tier: 'tier_3a',
    region: 'UK',
    name: 'GOV.UK',
    highlight: false,
    strengths: ['policy', 'benefits', 'official leaflets'],
    notes: 'UK government portal — use only child-health pages (e.g. Start for Life).',
  },
  {
    domain: 'gov.au',
    tier: 'tier_3a',
    region: 'AU',
    name: 'Australian Government',
    highlight: false,
    strengths: ['state and federal programmes'],
    notes: 'Australian government domains — prefer raisingchildren.net.au or healthdirect when possible.',
  },

  // ── Tier 3b: Open-access journals (strict URL + paywall checks) ───────────
  {
    domain: 'pmc.ncbi.nlm.nih.gov',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'PubMed Central',
    highlight: false,
    strengths: ['evidence deep-dives'],
    notes: 'Open-access full text only. Never use bare pubmed.ncbi.nlm.nih.gov abstract pages.',
  },
  {
    domain: 'ncbi.nlm.nih.gov',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'NCBI / PMC',
    highlight: false,
    strengths: ['evidence deep-dives'],
    notes: 'PMC paths only at ingest.',
  },
  {
    domain: 'cochranelibrary.com',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'Cochrane Library',
    highlight: false,
    strengths: ['systematic reviews'],
    notes: 'Use plain-language summaries where available.',
  },
  {
    domain: 'journals.plos.org',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'PLOS',
    highlight: false,
    strengths: ['open-access research'],
    notes: 'Open-access publisher.',
  },
  {
    domain: 'frontiersin.org',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'Frontiers',
    highlight: false,
    strengths: ['open-access research'],
    notes: 'Open-access journals — parent-friendly translation required.',
  },
  {
    domain: 'bmjopen.bmj.com',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'BMJ Open',
    highlight: false,
    strengths: ['open-access research'],
    notes: 'BMJ open-access journal.',
  },
  {
    domain: 'pediatrics.aappublications.org',
    tier: 'tier_3b',
    region: 'US',
    name: 'Pediatrics (AAP)',
    highlight: false,
    strengths: ['paediatric research'],
    notes: 'Open-access AAP articles only; paywall check enforced.',
  },
  {
    domain: 'onlinelibrary.wiley.com',
    tier: 'tier_3b',
    region: 'GLOBAL',
    name: 'Wiley Online Library',
    highlight: false,
    strengths: ['open-access articles'],
    notes: 'Only when page passes paywall scan.',
  },
];

/** Domains that match via suffix (subdomains included). */
export const TRUSTED_DOMAIN_SUFFIXES = [
  '.nhs.uk',
  '.gov.uk',
  '.gov.au',
  '.hse.ie',
  '.govt.nz',
] as const;

export function highlightedSourceNames(): string[] {
  return TRUSTED_RESEARCH_SOURCES.filter((s) => s.highlight).map((s) => s.name);
}

export function domainsForTier(tier: RegistrySourceTier): string[] {
  return TRUSTED_RESEARCH_SOURCES.filter((s) => s.tier === tier).map((s) => s.domain);
}

export function isDomainOnAllowlist(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, '');
  if (TRUSTED_RESEARCH_SOURCES.some((s) => s.domain === normalized)) return true;
  for (const suffix of TRUSTED_DOMAIN_SUFFIXES) {
    if (normalized.endsWith(suffix)) return true;
  }
  if (normalized.includes('ncbi.nlm.nih.gov')) return true;
  return false;
}
