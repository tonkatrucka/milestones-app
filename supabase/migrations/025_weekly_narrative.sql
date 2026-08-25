-- Add weekly narrative columns to child_insights.
-- Populated by the weekly-narrative edge function (Sunday cron).

ALTER TABLE public.child_insights
  ADD COLUMN IF NOT EXISTS weekly_narrative text,
  ADD COLUMN IF NOT EXISTS weekly_narrative_week date;   -- ISO week start (Monday)

CREATE INDEX IF NOT EXISTS child_insights_weekly_idx
  ON public.child_insights(child_id, weekly_narrative_week DESC NULLS LAST);
