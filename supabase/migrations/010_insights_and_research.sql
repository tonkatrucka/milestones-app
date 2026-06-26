-- Insights daily cache, research bullet bank, and novelty tracking.

CREATE TYPE public.research_age_bracket AS ENUM (
  'newborn',
  'infant_early',
  'infant',
  'infant_late',
  'toddler_early',
  'toddler',
  'toddler_late'
);

CREATE TYPE public.research_category AS ENUM (
  'sleep',
  'feeding',
  'development',
  'milestones',
  'regression',
  'language'
);

CREATE TYPE public.research_source_tier AS ENUM (
  'tier_1',
  'tier_2',
  'tier_3a',
  'tier_3b'
);

CREATE TYPE public.research_source_region AS ENUM (
  'UK',
  'US',
  'AU',
  'CA',
  'GLOBAL'
);

CREATE TABLE public.research_bullets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_bracket public.research_age_bracket NOT NULL,
  category public.research_category NOT NULL,
  subtopic text NOT NULL,
  text text NOT NULL,
  source_url text NOT NULL,
  source_name text NOT NULL,
  source_domain text NOT NULL,
  source_tier public.research_source_tier NOT NULL,
  source_region public.research_source_region NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  superseded_by_id uuid REFERENCES public.research_bullets (id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX research_bullets_pack_idx
  ON public.research_bullets (age_bracket, category)
  WHERE active = true;

CREATE INDEX research_bullets_subtopic_idx
  ON public.research_bullets (age_bracket, category, subtopic)
  WHERE active = true;

CREATE UNIQUE INDEX research_bullets_content_hash_pack_idx
  ON public.research_bullets (age_bracket, category, content_hash)
  WHERE active = true;

CREATE TABLE public.child_insights (
  child_id uuid NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  insight_date date NOT NULL,
  short_insights jsonb,
  long_insights jsonb,
  categories text[] NOT NULL DEFAULT '{}',
  selected_research_by_region jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, insight_date)
);

CREATE TABLE public.child_research_shown (
  child_id uuid NOT NULL REFERENCES public.children (id) ON DELETE CASCADE,
  bullet_id uuid NOT NULL REFERENCES public.research_bullets (id) ON DELETE CASCADE,
  first_shown_on date NOT NULL,
  PRIMARY KEY (child_id, bullet_id)
);

CREATE INDEX child_research_shown_child_idx
  ON public.child_research_shown (child_id);

-- RLS
ALTER TABLE public.research_bullets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_research_shown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "research_bullets_select" ON public.research_bullets
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "child_insights_select" ON public.child_insights
  FOR SELECT USING (
    child_id IN (
      SELECT child_id FROM public.child_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "child_research_shown_select" ON public.child_research_shown
  FOR SELECT USING (
    child_id IN (
      SELECT child_id FROM public.child_members WHERE user_id = auth.uid()
    )
  );

-- Service role writes via edge functions (bypasses RLS).
