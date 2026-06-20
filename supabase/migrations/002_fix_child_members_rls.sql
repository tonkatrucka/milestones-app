-- Fix: infinite recursion in child_members_select policy.
--
-- The original policy was:
--   FOR SELECT USING (
--     child_id IN (SELECT child_id FROM public.child_members WHERE user_id = auth.uid())
--   )
--
-- Querying child_members from inside child_members' own RLS policy causes
-- Postgres to re-evaluate the same policy recursively until it aborts.
--
-- The fix: a user only needs to see their own membership rows.
-- The children_select policy (which checks child_members to gate access to
-- the children table) only needs to know whether the current user has *any*
-- membership row — it does not need to see other users' rows.

DROP POLICY IF EXISTS "child_members_select" ON public.child_members;

CREATE POLICY "child_members_select" ON public.child_members
  FOR SELECT
  USING (user_id = auth.uid());
