-- 003_memories_and_chat.sql
-- Adds memories table, chat_messages table, and updates milestone categories.

-- ============================================================
-- Update milestones category constraint
-- Rename word→language, steps→movement, physical→development, custom→development
-- Drop the old constraint first so the UPDATE statements aren't blocked by it
-- ============================================================
alter table public.milestones drop constraint milestones_category_check;

update public.milestones set category = 'language'    where category = 'word';
update public.milestones set category = 'movement'    where category = 'steps';
update public.milestones set category = 'development' where category = 'physical';
update public.milestones set category = 'development' where category = 'custom';

alter table public.milestones
  add constraint milestones_category_check
  check (category in ('language', 'movement', 'development'));

-- ============================================================
-- Memories table (precious moments, not developmental achievements)
-- ============================================================
create table public.memories (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid references public.children(id) on delete cascade not null,
  title        text not null,
  description  text,
  occurred_at  date not null,
  media_urls   text[] not null default '{}',
  tags         text[] not null default '{}',
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now() not null
);

alter table public.memories enable row level security;

create policy "memories_select" on public.memories
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );

create policy "memories_insert" on public.memories
  for insert with check (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

create policy "memories_update" on public.memories
  for update using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

create policy "memories_delete" on public.memories
  for delete using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- ============================================================
-- Chat messages table
-- ============================================================
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references public.children(id) on delete cascade not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  media_urls  text[] not null default '{}',
  created_at  timestamptz default now() not null
);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select" on public.chat_messages
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );

create policy "chat_messages_insert" on public.chat_messages
  for insert with check (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

create policy "chat_messages_delete" on public.chat_messages
  for delete using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- ============================================================
-- Storage bucket: chat-media
-- Run in the Supabase dashboard (Storage > New bucket):
--   Name: chat-media, Public: true
-- Or via CLI: supabase storage create chat-media --public
-- ============================================================
