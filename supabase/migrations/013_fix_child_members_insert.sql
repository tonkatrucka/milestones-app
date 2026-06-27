-- Close critical RLS gap: authenticated users could self-enroll on any child_id
-- (including as owner) via PostgREST. Membership is only created by:
--   - handle_new_child() trigger (SECURITY DEFINER) on children INSERT
--   - accept_invite() RPC (SECURITY DEFINER)

DROP POLICY IF EXISTS "child_members_insert" ON public.child_members;
