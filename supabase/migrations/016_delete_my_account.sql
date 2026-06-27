-- Self-service account deletion: removes owned child profiles (and their data),
-- storage files for those children, team memberships, then the auth user.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth
AS $$
DECLARE
  uid uuid := auth.uid();
  owned_child_ids uuid[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT array_agg(child_id)
  INTO owned_child_ids
  FROM public.child_members
  WHERE user_id = uid AND role = 'owner';

  IF owned_child_ids IS NOT NULL THEN
    DELETE FROM storage.objects
    WHERE bucket_id IN ('chat-media', 'milestone-media')
      AND public.storage_object_child_id(bucket_id, name, metadata) = ANY(owned_child_ids);

    DELETE FROM public.children
    WHERE id = ANY(owned_child_ids);
  END IF;

  DELETE FROM public.child_members WHERE user_id = uid;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
