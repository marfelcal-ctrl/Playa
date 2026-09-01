-- Personal Tracker - Supabase schema
-- Run this entire file once in Supabase Dashboard > SQL Editor > New query.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_income numeric(14,2) not null default 0,
  overtime_pay numeric(14,2) not null default 0,
  holiday_pay numeric(14,2) not null default 0,
  credits numeric(14,2) not null default 0,
  savings numeric(14,2) not null default 0,
  government numeric(14,2) not null default 0,
  late_deduction numeric(14,2) not null default 0,
  absent_deduction numeric(14,2) not null default 0,
  overbreak_deduction numeric(14,2) not null default 0,
  misc_deduction numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  bill_type text not null default 'regular' check (bill_type in ('essential','regular','debt','optional')),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bills_user_id_idx on public.bills(user_id);
create index if not exists bills_due_date_idx on public.bills(due_date);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  time_in timestamptz,
  time_out timestamptz,
  breaks jsonb not null default '[]'::jsonb,
  details text not null default '',
  updated_at timestamptz not null default now(),
  unique(user_id, work_date)
);
create index if not exists time_entries_user_date_idx on public.time_entries(user_id, work_date desc);

-- Automatically make a profile whenever a new Auth user registers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email,''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profile rows for Auth users that already exist.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(coalesce(email,''), '@', 1))
from auth.users
on conflict (id) do nothing;

-- Helper functions. SECURITY DEFINER avoids recursive profile RLS checks.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and is_active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active = true
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.budgets enable row level security;
alter table public.bills enable row level security;
alter table public.time_entries enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.budgets from anon, authenticated;
revoke all on table public.bills from anon, authenticated;
revoke all on table public.time_entries from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.budgets to authenticated;
grant select, insert, update, delete on table public.bills to authenticated;
grant select, insert, update, delete on table public.time_entries to authenticated;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select to authenticated
using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "budgets_select" on public.budgets;
create policy "budgets_select" on public.budgets
for select to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "budgets_insert" on public.budgets;
create policy "budgets_insert" on public.budgets
for insert to authenticated
with check (public.is_active_user() and (select auth.uid()) = user_id);

drop policy if exists "budgets_update" on public.budgets;
create policy "budgets_update" on public.budgets
for update to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()))
with check (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "budgets_delete" on public.budgets;
create policy "budgets_delete" on public.budgets
for delete to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "bills_select" on public.bills;
create policy "bills_select" on public.bills
for select to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "bills_insert" on public.bills;
create policy "bills_insert" on public.bills
for insert to authenticated
with check (public.is_active_user() and (select auth.uid()) = user_id);

drop policy if exists "bills_update" on public.bills;
create policy "bills_update" on public.bills
for update to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()))
with check (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "bills_delete" on public.bills;
create policy "bills_delete" on public.bills
for delete to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "time_entries_select" on public.time_entries;
create policy "time_entries_select" on public.time_entries
for select to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "time_entries_insert" on public.time_entries;
create policy "time_entries_insert" on public.time_entries
for insert to authenticated
with check (public.is_active_user() and (select auth.uid()) = user_id);

drop policy if exists "time_entries_update" on public.time_entries;
create policy "time_entries_update" on public.time_entries
for update to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()))
with check (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

drop policy if exists "time_entries_delete" on public.time_entries;
create policy "time_entries_delete" on public.time_entries
for delete to authenticated
using (public.is_active_user() and ((select auth.uid()) = user_id or public.is_admin()));

commit;

-- AFTER YOU REGISTER YOUR OWN ACCOUNT:
-- Run the next line separately, replacing the email with your login email.
-- This is intentionally NOT automatic so a random first visitor cannot become admin.
-- update public.profiles set role = 'admin' where email = 'YOUR-EMAIL@example.com';
