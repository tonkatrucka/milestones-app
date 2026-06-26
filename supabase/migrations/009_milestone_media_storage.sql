-- Create milestone-media storage bucket and policies for milestone, memory, and avatar uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-media',
  'milestone-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated caregivers can upload to their child's folder ({child_id}/...)
create policy "milestone_media_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'milestone-media'
  and (storage.foldername(name))[1] in (
    select child_id::text from public.child_members where user_id = auth.uid()
  )
);

-- Public read (bucket is public)
create policy "milestone_media_select"
on storage.objects for select to public
using (bucket_id = 'milestone-media');

-- Owners/caregivers can delete their child's uploads
create policy "milestone_media_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'milestone-media'
  and (storage.foldername(name))[1] in (
    select child_id::text from public.child_members where user_id = auth.uid()
  )
);
