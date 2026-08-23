-- Cached nap window predictions per child per day.
-- Populated by the sleep-predictions edge function (daily cron).

CREATE TABLE public.child_sleep_predictions (
  child_id            uuid PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
  generated_date      date NOT NULL DEFAULT CURRENT_DATE,
  wake_window_mins    smallint,            -- average wake window in minutes
  next_nap_start      timestamptz,         -- predicted start of next nap
  next_nap_end        timestamptz,         -- estimated end of next nap
  confidence          smallint CHECK (confidence BETWEEN 0 AND 100),
  avg_nap_mins        smallint,            -- average nap duration in minutes
  data_days           smallint,            -- how many days of data were used
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.child_sleep_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sleep_predictions_select ON public.child_sleep_predictions
  FOR SELECT USING (
    child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
  );

-- Service role writes predictions via cron — no client insert policy needed.
