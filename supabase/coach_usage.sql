-- Money coach: a monthly question allowance per household, so running costs stay predictable.
-- Run once in the Supabase SQL editor (Smalljoy project). Safe to run again.
-- The table is only reached through budget_coach_take(), which checks the caller belongs to the household.

create table if not exists public.budget_coach_usage (
  household_id uuid not null references public.budget_households(id) on delete cascade,
  month text not null,              -- 'YYYY-MM'
  used int not null default 0,
  primary key (household_id, month)
);
alter table public.budget_coach_usage enable row level security;
-- no policies: nobody reads or writes the table directly

-- Uses one question if any are left. Returns the number used after this one, or -1 when the month's allowance is spent.
create or replace function public.budget_coach_take(h uuid, ym text, cap int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.budget_is_member(h) then raise exception 'not a member of this household'; end if;
  insert into public.budget_coach_usage(household_id, month, used) values (h, ym, 0)
    on conflict (household_id, month) do nothing;
  update public.budget_coach_usage set used = used + 1
    where household_id = h and month = ym and used < cap
    returning used into n;
  return coalesce(n, -1);
end; $$;
revoke all on function public.budget_coach_take(uuid, text, int) from public, anon;
grant execute on function public.budget_coach_take(uuid, text, int) to authenticated;
