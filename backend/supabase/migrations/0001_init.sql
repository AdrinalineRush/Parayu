-- Parayu — initial Supabase schema, RLS, trigger, and dictionary seed.
-- Run this once in the Supabase SQL Editor after the project provisions.
-- Safe to run top-to-bottom in a single query. See SUPABASE_INTEGRATION.md.

-- ════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════════════════

-- Global dictionary entries (the editable working set).
create table if not exists public.dictionary_entries (
  id          uuid primary key default gen_random_uuid(),
  from_text   text not null,
  to_text     text not null,
  phrase      boolean not null default false,   -- substring vs whole-word
  stage       text not null default 'post'
                check (stage in ('pre','post')), -- 'pre'=Malayalam script, 'post'=English
  enabled     boolean not null default true,
  notes       text,                             -- admin-only context, never served
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Single meta row holding the published version counter.
create table if not exists public.dictionary_meta (
  id          int primary key default 1 check (id = 1),
  version     int not null default 1,
  updated_at  timestamptz not null default now()
);
insert into public.dictionary_meta (id, version)
  values (1, 1) on conflict (id) do nothing;

-- User profiles / subscription state (1:1 with auth.users).
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  plan            text not null default 'Base Plan'
                    check (plan in ('Base Plan','Pro Plan','Enterprise Plan')),
  plan_expires_at timestamptz,
  is_admin        boolean not null default false,  -- gate for dictionary writes
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 2. ROW-LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════

alter table public.dictionary_entries enable row level security;
alter table public.dictionary_meta    enable row level security;
alter table public.profiles           enable row level security;

-- Dictionary: only admins read/write the raw tables. The public app reads via
-- the Edge Function (service role), so it never needs table-level access.
drop policy if exists admin_rw_entries on public.dictionary_entries;
create policy admin_rw_entries on public.dictionary_entries
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists admin_rw_meta on public.dictionary_meta;
create policy admin_rw_meta on public.dictionary_meta
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Profiles: a user can read/update only their own row.
drop policy if exists self_read on public.profiles;
create policy self_read on public.profiles
  for select using (auth.uid() = id);

drop policy if exists self_update on public.profiles;
create policy self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: is_admin can only be set by you via the SQL Editor (service role), never
-- by a client, because no client-facing policy grants writing it.

-- ════════════════════════════════════════════════════════════════════════
-- 3. AUTO-CREATE A PROFILE ON SIGNUP
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- 4. SEED — current dictionary words (from assets/global-dictionary.json)
--    Replace/extend these later via the admin panel.
-- ════════════════════════════════════════════════════════════════════════

insert into public.dictionary_entries (from_text, to_text, phrase, stage) values
  ('parayu sample', 'Parayu', true,  'post'),
  ('ലോൽ',          'lol',    false, 'pre');
