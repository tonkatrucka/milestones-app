# Research source policy

Curated allowlist for the Insights **Research** section. Every bullet must cite an HTTPS URL on one of these domains. The list is enforced in code at [`supabase/functions/_shared/research-sources-registry.ts`](../supabase/functions/_shared/research-sources-registry.ts).

## Tier model

| Tier | Who | Use in app |
|------|-----|------------|
| **tier_1** | National government health agencies | Default — prefer these |
| **tier_2** | Professional colleges & institutional nonprofits | When tier 1 lacks a subtopic |
| **tier_3a** | Broader government portals (`*.gov.uk`, `*.gov.au`) | Specific child-health pages only |
| **tier_3b** | Open-access journals (PMC, Cochrane, etc.) | Rare; max 20% per batch; paywall scan |

## Highlighted sources (especially valuable)

These are the strongest parent-facing sources for 0–3 years in the app:

### International
| Source | Region | Why trust it |
|--------|--------|--------------|
| **WHO** (`who.int`) | Global | UN agency; gold standard on breastfeeding and international child health norms |
| **UNICEF** (`unicef.org`) | Global | UN children's agency; early childhood development programmes worldwide |

### United Kingdom & Ireland
| Source | Region | Why trust it |
|--------|--------|--------------|
| **NHS** (`nhs.uk`, `*.nhs.uk`) | UK | National Health Service; Start for Life, sleep, feeding, milestones |
| **NHS inform** (`nhsinform.scot`) | UK | Official Scottish NHS patient information |
| **HSE** (`hse.ie`, `mychild.ie`) | Ireland | Ireland's national health service; pregnancy to age 5 |

### United States
| Source | Region | Why trust it |
|--------|--------|--------------|
| **CDC** (`cdc.gov`) | US | Learn the Signs Act Early milestones; widely used in clinical practice |
| **HealthyChildren.org** (`healthychildren.org`) | US | American Academy of Pediatrics — position statements from US paediatricians |
| **MedlinePlus / NICHD** (`medlineplus.gov`, `nichd.nih.gov`) | US | NIH consumer and research summaries |

### Australia (priority for AU/NZ users)
| Source | Region | Why trust it |
|--------|--------|--------------|
| **Raising Children Network** (`raisingchildren.net.au`) | AU | **Flagship AU source.** Government-funded (DSS); Murdoch Children's Research Institute + Parenting Research Centre; 400+ expert reviewers; ad-free; birth–18 years |
| **Pregnancy, Birth and Baby** (`pregnancybirthbaby.org.au`) | AU | Australian Government service (via healthdirect); maternal child health nurses; birth–5 years |
| **healthdirect** (`healthdirect.gov.au`) | AU | Government-funded national health information; clinical governance framework |
| **Starting Blocks** (`startingblocks.gov.au`) | AU | ACECQA (government) — early learning and development |
| **health.gov.au** | AU | Federal Department of Health — national programmes and policy |

### Canada
| Source | Region | Why trust it |
|--------|--------|--------------|
| **Caring for Kids** (`caringforkids.cps.ca`) | CA | Canadian Paediatric Society; WHO Vaccine Safety Net member |
| **Government of Canada** (`canada.ca`) | CA | Federal health guidance |

### New Zealand
| Source | Region | Why trust it |
|--------|--------|--------------|
| **Health New Zealand** (`healthnz.govt.nz`, `tewhatuora.govt.nz`, `*.govt.nz`) | NZ | National health system; Well Child Tamariki Ora programme for under-5s |

### Supplementary (tier 2)
| Source | Region | Why trust it |
|--------|--------|--------------|
| **Nemours KidsHealth** (`kidshealth.org`) | US | Doctor-reviewed; used by many hospitals |
| **Zero to Three** (`zerotothree.org`) | US | Research-informed infant–toddler development |
| **RCPCH** (`rcpch.ac.uk`) | UK | Royal College of Paediatrics and Child Health |

## Explicitly excluded

- Blogs, parenting influencers, forums (Mumsnet, Reddit, etc.)
- News sites (BBC, Guardian health sections)
- Wikipedia
- Commercial brands (formula companies, baby product retailers)
- Preprint servers (bioRxiv, medRxiv)
- URL shorteners
- Paywalled journal abstracts
- Non-HTTPS links

## Rejection rules (at ingest)

| Reason | Meaning |
|--------|---------|
| `bad_url` | Domain not on allowlist, HTTP only, 404, paywall, or redirect off-list |
| `exact_dup` | Identical content hash in pack |
| `near_dup` | Jaccard word overlap ≥ 0.65 or substring match |
| `subtopic_saturated` | Already 8 bullets on that subtopic in the pack |
| `tier_3b_cap` | Journal sources would exceed 20% of the batch |

## Maintenance

- **Bootstrap:** domain allowlist only (fast)
- **Hygiene (monthly):** live URL checks; stale bullets replaced or deactivated
- **Audit:** `npm run audit:research`

## Updating this list

Add entries to `research-sources-registry.ts`, then redeploy `research-refresh`. Do not add domains without verifying: government or major professional body, stable HTTPS, parent-facing content, no advertising bias.
