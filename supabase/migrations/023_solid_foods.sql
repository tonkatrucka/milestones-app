-- Solid food introduction log per child.
-- Tracks foods tried, allergen status, and any reactions.

CREATE TABLE public.solid_foods (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  food_name         text NOT NULL,
  introduced_at     date NOT NULL DEFAULT CURRENT_DATE,
  is_top_allergen   boolean NOT NULL DEFAULT false,
  reaction          text,                        -- 'none' | 'mild' | 'moderate' | 'severe' | null
  reaction_notes    text,
  notes             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX solid_foods_child_id_idx ON public.solid_foods(child_id, introduced_at DESC);

ALTER TABLE public.solid_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY solid_foods_select ON public.solid_foods
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

CREATE POLICY solid_foods_insert ON public.solid_foods
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY solid_foods_update ON public.solid_foods
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY solid_foods_delete ON public.solid_foods
  FOR DELETE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
