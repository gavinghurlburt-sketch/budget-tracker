-- Money coach weekly tip: one free tip per household per week, made once and kept here.
-- Run once in the Supabase SQL editor (Smalljoy project). Safe to run again.
-- The table is only reached through the two functions below, which check the caller belongs to the household.

create table if not exists public.budget_coach_weekly (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  week text not null,                 -- the Sunday that starts the week, 'YYYY-MM-DD'
  tip text,                           -- null while it's being written
  claimed_at timestamptz not null default now(),
  primary key (household_id, week)
);
alter table public.budget_coach_weekly enable row level security;
-- no policies: nobody reads or writes the table directly

-- Returns the week's tip if it's been made ('' if another phone is writing it right now).
-- Returns null when the caller should write it (first ask of the week, or a stalled attempt over 2 minutes old).
create or replace function public.budget_coach_week_claim(h uuid, wk text) returns text
language plpgsql security definer set search_path = public as $$
declare t text; got boolean;
begin
  if not public.budget_is_member(h) then raise exception 'not a member of this household'; end if;
  insert into public.budget_coach_weekly(household_id, week) values (h, wk)
    on conflict (household_id, week) do nothing
    returning true into got;
  if got then return null; end if;
  update public.budget_coach_weekly set claimed_at = now()
    where household_id = h and week = wk and tip is null and claimed_at < now() - interval '2 minutes'
    returning true into got;
  if got then return null; end if;
  select tip into t from public.budget_coach_weekly where household_id = h and week = wk;
  return coalesce(t, '');
end; $$;

create or replace function public.budget_coach_week_save(h uuid, wk text, t text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.budget_is_member(h) then raise exception 'not a member of this household'; end if;
  update public.budget_coach_weekly set tip = left(t, 300) where household_id = h and week = wk and tip is null;
end; $$;

revoke all on function public.budget_coach_week_claim(uuid, text) from public, anon;
revoke all on function public.budget_coach_week_save(uuid, text, text) from public, anon;
grant execute on function public.budget_coach_week_claim(uuid, text) to authenticated;
grant execute on function public.budget_coach_week_save(uuid, text, text) to authenticated;
