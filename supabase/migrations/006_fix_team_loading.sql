-- Fix team loading: invites RLS must not query auth.users (permission denied).
-- Harden list_child_members as plpgsql with explicit auth check.

DROP POLICY IF EXISTS "invites_select" ON public.invites;

CREATE POLICY "invites_select" ON public.invites
  FOR SELECT USING (
    child_id IN (
      SELECT child_id
      FROM public.child_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE OR REPLACE FUNCTION public.list_child_members(p_child_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.child_members AS owner_row
    WHERE owner_row.child_id = p_child_id
      AND owner_row.user_id = auth.uid()
      AND owner_row.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized to list members';
  END IF;

  RETURN QUERY
  SELECT
    cm.user_id,
    cm.role,
    u.email::text,
    cm.created_at
  FROM public.child_members AS cm
  INNER JOIN auth.users AS u ON u.id = cm.user_id
  WHERE cm.child_id = p_child_id
  ORDER BY cm.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.list_child_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_child_members(uuid) TO authenticated;
