-- Health records: growth measurements, doctor visits, vaccinations, general notes
create table public.health_records (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid references public.children(id) on delete cascade not null,
  type         text not null check (type in ('measurement', 'visit', 'vaccination', 'note')),
  recorded_at  date not null,
  notes        text,
  metadata     jsonb not null default '{}',
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now() not null
);

alter table public.health_records enable row level security;

-- Members can view health records for children they have access to
create policy "health_records_select" on public.health_records
  for select using (
    child_id in (select child_id from public.child_members where user_id = auth.uid())
  );

-- Owners and caregivers can insert
create policy "health_records_insert" on public.health_records
  for insert with check (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- Owners and caregivers can update
create policy "health_records_update" on public.health_records
  for update using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- Owners and caregivers can delete
create policy "health_records_delete" on public.health_records
  for delete using (
    child_id in (
      select child_id from public.child_members
      where user_id = auth.uid() and role in ('owner', 'caregiver')
    )
  );

-- Index for efficient per-child chronological queries
create index health_records_child_date on public.health_records (child_id, recorded_at desc);
