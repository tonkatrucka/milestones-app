-- Vaccination records per child.
-- Tracks administered vaccines and supports region-aware schedule display.

CREATE TABLE public.vaccinations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  vaccine_code    text NOT NULL,           -- e.g. 'DTaP', 'MMR', '6-in-1'
  vaccine_name    text NOT NULL,           -- human-readable full name
  administered_at date NOT NULL,
  dose_number     smallint DEFAULT 1,      -- which dose in the schedule (1, 2, 3…)
  clinic          text,
  batch_number    text,
  reaction_notes  text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vaccinations_child_id_idx ON public.vaccinations(child_id, administered_at DESC);

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY vaccinations_select ON public.vaccinations
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

CREATE POLICY vaccinations_insert ON public.vaccinations
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY vaccinations_update ON public.vaccinations
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

CREATE POLICY vaccinations_delete ON public.vaccinations
  FOR DELETE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
