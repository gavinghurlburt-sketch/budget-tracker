-- Household Budget: Supabase schema
-- Already applied to the Smalljoy project (vthqrbzaqhrfcuembkvz) as migration
-- "household_budget_tables". Kept here so the repo documents it and it can be
-- re-run on a fresh project.
--
-- Design: one row per household holding the whole budget as JSON, plus a
-- members table for access control. The app loads the row on sign-in, pushes
-- the whole document on each change, and listens for realtime updates.

create table public.budget_households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our household',
  data jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.budget_members (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index budget_members_user_idx on public.budget_members(user_id);

create or replace function public.budget_is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.budget_members where household_id = h and user_id = auth.uid());
$$;

create or replace function public.budget_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger budget_households_touch before update on public.budget_households
  for each row execute function public.budget_touch();

alter table public.budget_households enable row level security;
alter table public.budget_members enable row level security;

create policy "budget households insert" on public.budget_households
  for insert to authenticated with check (true);
create policy "budget households select" on public.budget_households
  for select to authenticated using (public.budget_is_member(id));
create policy "budget households update" on public.budget_households
  for update to authenticated using (public.budget_is_member(id)) with check (public.budget_is_member(id));

create policy "budget members insert self" on public.budget_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "budget members select" on public.budget_members
  for select to authenticated using (user_id = auth.uid() or public.budget_is_member(household_id));
create policy "budget members delete self" on public.budget_members
  for delete to authenticated using (user_id = auth.uid());

-- live updates between devices
alter publication supabase_realtime add table public.budget_households;
