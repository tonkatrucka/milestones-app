-- Owners can change caregiver/viewer roles and update pending invites.

CREATE OR REPLACE FUNCTION public.update_member_role(
  p_child_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('caregiver', 'viewer') THEN
    RAISE EXCEPTION 'Role must be caregiver or viewer';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.child_members AS owner_row
    WHERE owner_row.child_id = p_child_id
      AND owner_row.user_id = auth.uid()
      AND owner_row.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized to update members';
  END IF;

  SELECT cm.role INTO target_role
  FROM public.child_members AS cm
  WHERE cm.child_id = p_child_id
    AND cm.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner role';
  END IF;

  UPDATE public.child_members
  SET role = p_role
  WHERE child_id = p_child_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_member_role(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "invites_update" ON public.invites;

CREATE POLICY "invites_update" ON public.invites
  FOR UPDATE USING (
    child_id IN (
      SELECT child_id
      FROM public.child_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    role IN ('caregiver', 'viewer')
    AND child_id IN (
      SELECT child_id
      FROM public.child_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
