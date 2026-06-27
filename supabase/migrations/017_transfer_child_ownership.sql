-- Transfer child profile ownership to an existing team member.
CREATE OR REPLACE FUNCTION public.transfer_child_ownership(
  p_child_id uuid,
  p_new_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  target_role text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_new_owner_id = uid THEN
    RAISE EXCEPTION 'Cannot transfer ownership to yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.child_members
    WHERE child_id = p_child_id
      AND user_id = uid
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Not authorized to transfer this profile';
  END IF;

  SELECT cm.role INTO target_role
  FROM public.child_members AS cm
  WHERE cm.child_id = p_child_id
    AND cm.user_id = p_new_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner must already be on the team';
  END IF;

  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Member is already the owner';
  END IF;

  UPDATE public.child_members
  SET role = 'owner'
  WHERE child_id = p_child_id
    AND user_id = p_new_owner_id;

  UPDATE public.child_members
  SET role = 'caregiver'
  WHERE child_id = p_child_id
    AND user_id = uid;

  -- Keep the profile when the original creator later deletes their account.
  UPDATE public.children
  SET created_by = p_new_owner_id
  WHERE id = p_child_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_child_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_child_ownership(uuid, uuid) TO authenticated;
