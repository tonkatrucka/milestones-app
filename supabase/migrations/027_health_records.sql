-- Visits and notes log. Growth measurements and vaccinations stay in
-- growth_entries / vaccinations. Types measurement and vaccination remain
-- in the CHECK so any earlier rows from the original draft still load.

CREATE TABLE IF NOT EXISTS public.health_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('measurement', 'visit', 'vaccination', 'note')),
  recorded_at  date NOT NULL,
  notes        text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_records_child_date
  ON public.health_records (child_id, recorded_at DESC);

ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_records_select ON public.health_records;
CREATE POLICY health_records_select ON public.health_records
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS health_records_insert ON public.health_records;
CREATE POLICY health_records_insert ON public.health_records
  FOR INSERT WITH CHECK (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

DROP POLICY IF EXISTS health_records_update ON public.health_records;
CREATE POLICY health_records_update ON public.health_records
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );

DROP POLICY IF EXISTS health_records_delete ON public.health_records;
CREATE POLICY health_records_delete ON public.health_records
  FOR DELETE USING (
    child_id IN (
      SELECT child_id FROM public.child_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
    )
  );
