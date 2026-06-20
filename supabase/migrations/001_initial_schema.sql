-- Run this in your Supabase SQL editor or via the Supabase CLI.
-- After applying, enable Realtime on daily_events and milestones tables
-- in the Supabase dashboard under Database > Replication.

create extension if not exists "pgcrypto";

-- Children
create table public.children (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date_of_birth date not null,
  avatar_url  text,
  created_by  uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now() not null
);

-- Members (who has access to each child)
create table public.child_members (
  child_id    uuid references public.children(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  role        text not null check (role in ('owner', 'caregiver', 'viewer')),
  created_at  timestamptz default now() not null,
  primary key (child_id, user_id)
);

-- Daily events (nappy, meal, sleep)
create table public.daily_events (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references public.children(id) on delete cascade not null,
  type        text not null check (type in ('nappy', 'meal', 'sleep')),
  occurred_at timestamptz not null default now(),
  notes       text,
  metadata    jsonb not null default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- Milestones
create table public.milestones (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references public.children(id) on delete cascade not null,
  category    text not null check (category in ('word', 'steps', 'physical', 'custom')),
  title       text not null,
  description text,
  achieved_at date not null,
  media_urls  text[] not null default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now() not null
);

-- Invites
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid references public.children(id) on delete cascade not null,
  email       text not null,
  role        text not null check (role in ('caregiver', 'viewer')),
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_by  uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now() not null
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.children      enable row level security;
alter table public.child_members enable row level security;
alter table public.daily_events  enable row level security;
alter table public.milestones    enable row level security;
alter table public.invites       enable row level security;

-- children: members can view; anyone can insert their own
create policy "children_select" on public.children
  for select using (
    id in (select child_id from public.child_members where user_id = auth.uid())
  );
create policy "children_insert" on public.children
  for insert with check (created_by = auth.uid());
create policy "children_update" on public.children
  for update using (
    id in (select child_id from public.child_members where user_id = auth.uid() and role = 'owner')
  );
create policy "children_delete" on public.children
  for delete using (
    id in (select child_id from public.child_members where user_id = auth.uid() and role = 'owner')
  );

-- child_members: members see their own child's members; owner inserts
create policy "child_members_select" on public.child_members
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );
create policy "child_members_insert" on public.child_members
  for insert with check (user_id = auth.uid());
create policy "child_members_delete" on public.child_members
  for delete using (
    child_id in (select child_id from public.child_members where user_id = auth.uid() and role = 'owner')
    and user_id != auth.uid()
  );

-- daily_events
create policy "daily_events_select" on public.daily_events
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );
create policy "daily_events_insert" on public.daily_events
  for insert with check (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );
create policy "daily_events_update" on public.daily_events
  for update using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );
create policy "daily_events_delete" on public.daily_events
  for delete using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- milestones
create policy "milestones_select" on public.milestones
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );
create policy "milestones_insert" on public.milestones
  for insert with check (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );
create policy "milestones_update" on public.milestones
  for update using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );
create policy "milestones_delete" on public.milestones
  for delete using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- invites: owners can manage; users can view invites for their email
create policy "invites_select" on public.invites
  for select using (
    child_id in (
      select child_id from public.child_members where user_id = auth.uid() and role = 'owner'
    )
    or email = (select email from auth.users where id = auth.uid())
  );
create policy "invites_insert" on public.invites
  for insert with check (
    child_id in (
      select child_id from public.child_members where user_id = auth.uid() and role = 'owner'
    )
  );
create policy "invites_update" on public.invites
  for update using (
    child_id in (
      select child_id from public.child_members where user_id = auth.uid() and role = 'owner'
    )
  );

-- ============================================================
-- Trigger: auto-create 'owner' member when a child is inserted
-- ============================================================
create or replace function public.handle_new_child()
returns trigger language plpgsql security definer as $$
begin
  insert into public.child_members (child_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_child_created
  after insert on public.children
  for each row execute procedure public.handle_new_child();

-- ============================================================
-- RPC: accept an invite by token
-- ============================================================
create or replace function public.accept_invite(invite_token text)
returns void language plpgsql security definer as $$
declare
  inv public.invites%rowtype;
begin
  select * into inv
  from public.invites
  where token = invite_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Invalid or expired invite token';
  end if;

  insert into public.child_members (child_id, user_id, role)
  values (inv.child_id, auth.uid(), inv.role)
  on conflict (child_id, user_id) do nothing;

  update public.invites
  set accepted_at = now()
  where id = inv.id;
end;
$$;

-- ============================================================
-- Storage bucket (run in Supabase dashboard or via CLI):
-- create bucket 'milestone-media' with public = false
-- Add policy: authenticated users can upload to their child's folder
-- ============================================================
