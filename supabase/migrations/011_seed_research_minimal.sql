-- Minimal research bullets for local/dev testing until bootstrap-research runs.

INSERT INTO public.research_bullets (
  age_bracket, category, subtopic, text, source_url, source_name, source_domain,
  source_tier, source_region, content_hash
) VALUES
  (
    'newborn', 'sleep', 'safe_sleep',
    'Babies should sleep on their back on a firm, flat mattress in the same room as you for the first 6 months.',
    'https://www.nhs.uk/conditions/baby/caring-for-a-newborn/helping-your-baby-to-sleep/',
    'NHS', 'nhs.uk', 'tier_1', 'UK', md5('nhs-newborn-safe-sleep')
  ),
  (
    'newborn', 'feeding', 'milk',
    'Newborns typically feed little and often, including during the night.',
    'https://www.nhs.uk/conditions/baby/breastfeeding-and-bottle-feeding/bottle-feeding/how-to-make-up-baby-formula/',
    'NHS', 'nhs.uk', 'tier_1', 'UK', md5('nhs-newborn-feeding')
  ),
  (
    'infant_early', 'development', 'motor',
    'By around 4 months many babies can hold their head steady without support.',
    'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-4mo.html',
    'CDC', 'cdc.gov', 'tier_1', 'US', md5('cdc-4mo-head')
  ),
  (
    'infant', 'sleep', 'naps',
    'Most babies aged 6 to 12 months sleep for around 12 to 16 hours in total over 24 hours.',
    'https://www.nhs.uk/conditions/baby/caring-for-a-newborn/helping-your-baby-to-sleep/',
    'NHS', 'nhs.uk', 'tier_1', 'UK', md5('nhs-infant-sleep-hours')
  ),
  (
    'infant_late', 'language', 'babbling',
    'By 9 months many babies babble chains of sounds and understand "no".',
    'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-9mo.html',
    'CDC', 'cdc.gov', 'tier_1', 'US', md5('cdc-9mo-language')
  ),
  (
    'toddler_early', 'sleep', 'nap_transitions',
    'Many toddlers aged 12 to 18 months move to one nap a day.',
    'https://www.healthychildren.org/English/ages-stages/toddler/Pages/Sleep-and-Your-1-to-2-Year-Old.aspx',
    'AAP', 'healthychildren.org', 'tier_2', 'US', md5('aap-toddler-nap')
  ),
  (
    'toddler_early', 'feeding', 'solids',
    'Toddlers often eat small portions and may refuse foods they previously liked.',
    'https://www.nhs.uk/conditions/baby/weaning-and-feeding/fussy-eaters/',
    'NHS', 'nhs.uk', 'tier_1', 'UK', md5('nhs-fussy-eaters')
  ),
  (
    'toddler_early', 'development', 'motor',
    'By 18 months many toddlers can walk alone and begin to run.',
    'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-18mo.html',
    'CDC', 'cdc.gov', 'tier_1', 'US', md5('cdc-18mo-walk')
  ),
  (
    'toddler', 'milestones', 'upcoming',
    'Between 18 and 24 months children often add many new words and combine two words together.',
    'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-2yr.html',
    'CDC', 'cdc.gov', 'tier_1', 'US', md5('cdc-2yr-words')
  ),
  (
    'toddler', 'regression', 'sleep_regression',
    'Sleep can temporarily worsen during illness, travel, or developmental leaps.',
    'https://www.nhs.uk/conditions/baby/caring-for-a-newborn/helping-your-baby-to-sleep/',
    'NHS', 'nhs.uk', 'tier_1', 'UK', md5('nhs-sleep-regression')
  ),
  (
    'toddler_late', 'language', 'comprehension',
    'By age 3 many children speak in short sentences and are understood by family.',
    'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-3yr.html',
    'CDC', 'cdc.gov', 'tier_1', 'US', md5('cdc-3yr-sentences')
  ),
  (
    'toddler_late', 'development', 'social',
    'Preschool-age children often enjoy parallel play before playing cooperatively with others.',
    'https://www.who.int/news-room/fact-sheets/detail/child-development',
    'WHO', 'who.int', 'tier_1', 'GLOBAL', md5('who-child-development')
  );
