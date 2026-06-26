-- Invite acceptance email check, member listing for owners, invite revocation.

CREATE OR REPLACE FUNCTION public.accept_invite(invite_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invites%rowtype;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invite';
  END IF;

  SELECT * INTO inv
  FROM public.invites
  WHERE token = invite_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;

  IF lower(trim(inv.email)) <> lower(trim(user_email)) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  INSERT INTO public.child_members (child_id, user_id, role)
  VALUES (inv.child_id, auth.uid(), inv.role)
  ON CONFLICT (child_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.invites
  SET accepted_at = now()
  WHERE id = inv.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_child_members(p_child_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  email text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cm.user_id, cm.role, u.email::text, cm.created_at
  FROM public.child_members cm
  JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.child_id = p_child_id
    AND EXISTS (
      SELECT 1
      FROM public.child_members owner
      WHERE owner.child_id = p_child_id
        AND owner.user_id = auth.uid()
        AND owner.role = 'owner'
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_child_members(uuid) TO authenticated;

CREATE POLICY "invites_delete" ON public.invites
  FOR DELETE USING (
    accepted_at IS NULL
    AND child_id IN (
      SELECT child_id
      FROM public.child_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
