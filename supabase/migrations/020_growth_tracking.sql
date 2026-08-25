-- Growth measurement entries per child.
-- Supports weight (kg), height/length (cm), head circumference (cm).

CREATE TABLE public.growth_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  measured_at    date NOT NULL,
  weight_kg      numeric(5, 3),          -- e.g. 7.250
  height_cm      numeric(5, 1),          -- e.g. 68.5
  head_cm        numeric(4, 1),          -- e.g. 42.3
  notes          text,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX growth_entries_child_id_idx ON public.growth_entries(child_id);
CREATE INDEX growth_entries_measured_at_idx ON public.growth_entries(child_id, measured_at DESC);

ALTER TABLE public.growth_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY growth_entries_select ON public.growth_entries
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

CREATE POLICY growth_entries_insert ON public.growth_entries
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY growth_entries_update ON public.growth_entries
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY growth_entries_delete ON public.growth_entries
  FOR DELETE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
