-- Daily parent wellbeing check-ins.
-- Linked to a child so the context is preserved per active profile.
-- Scores 1–5 (emoji scale: 1=very low, 5=great).

CREATE TABLE public.parent_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  checked_in_at date NOT NULL DEFAULT CURRENT_DATE,
  mood_score    smallint NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  energy_score  smallint NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  sleep_score   smallint NOT NULL CHECK (sleep_score BETWEEN 1 AND 5),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, child_id, checked_in_at)
);

CREATE INDEX parent_checkins_user_child_idx ON public.parent_checkins(user_id, child_id, checked_in_at DESC);

ALTER TABLE public.parent_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_checkins_select_own ON public.parent_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY parent_checkins_insert_own ON public.parent_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY parent_checkins_update_own ON public.parent_checkins
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY parent_checkins_delete_own ON public.parent_checkins
  FOR DELETE USING (auth.uid() = user_id);
