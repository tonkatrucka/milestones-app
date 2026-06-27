-- Restrict storage writes to owners/caregivers and match all upload path layouts.

CREATE OR REPLACE FUNCTION public.storage_path_child_id(bucket_id text, object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN bucket_id = 'chat-media' THEN
      NULLIF(split_part(object_name, '/', 1), '')::uuid
    WHEN bucket_id = 'milestone-media' AND split_part(object_name, '/', 1) = 'memories' THEN
      NULLIF(split_part(object_name, '/', 2), '')::uuid
    WHEN bucket_id = 'milestone-media' AND split_part(object_name, '/', 1) = 'avatars' THEN
      NULLIF(split_part(split_part(object_name, '/', 2), '.', 1), '')::uuid
    WHEN bucket_id = 'milestone-media' THEN
      NULLIF(split_part(object_name, '/', 1), '')::uuid
    ELSE NULL
  END
$$;

DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "milestone_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "milestone_media_delete" ON storage.objects;

CREATE POLICY "chat_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.storage_path_child_id(bucket_id, name) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "chat_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.storage_path_child_id(bucket_id, name) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "milestone_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'milestone-media'
  AND public.storage_path_child_id(bucket_id, name) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "milestone_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'milestone-media'
  AND public.storage_path_child_id(bucket_id, name) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);
