-- Extend daily_events.type to support pump, temperature, and medication.
-- The type column uses a CHECK constraint (not a Postgres enum), so we
-- drop the old constraint and create a new one with the expanded set.

ALTER TABLE public.daily_events
  DROP CONSTRAINT IF EXISTS daily_events_type_check;

ALTER TABLE public.daily_events
  ADD CONSTRAINT daily_events_type_check
  CHECK (type IN ('nappy', 'meal', 'sleep', 'pump', 'temperature', 'medication'));
