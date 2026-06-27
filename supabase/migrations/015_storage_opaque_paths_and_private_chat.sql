-- Middle-ground media hardening:
-- - chat-media: private bucket, member-only read via metadata or legacy paths
-- - milestone-media: stays public; new uploads use opaque paths + object metadata
-- - RLS uses metadata->>'child_id' with legacy path fallback for existing objects

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

CREATE OR REPLACE FUNCTION public.storage_object_child_id(
  bucket_id text,
  object_name text,
  object_metadata jsonb
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(object_metadata->>'child_id', '')::uuid,
    public.storage_path_child_id(bucket_id, object_name)
  )
$$;

DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
DROP POLICY IF EXISTS "milestone_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "milestone_media_delete" ON storage.objects;

CREATE POLICY "chat_media_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.storage_object_child_id(bucket_id, name, metadata) IN (
    SELECT child_id FROM public.child_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "chat_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.storage_object_child_id(bucket_id, name, metadata) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "chat_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.storage_object_child_id(bucket_id, name, metadata) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "milestone_media_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'milestone-media'
  AND public.storage_object_child_id(bucket_id, name, metadata) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);

CREATE POLICY "milestone_media_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'milestone-media'
  AND public.storage_object_child_id(bucket_id, name, metadata) IN (
    SELECT child_id FROM public.child_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'caregiver')
  )
);
