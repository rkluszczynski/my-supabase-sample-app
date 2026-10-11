-- =============================================================================
-- Example schema with Row Level Security
-- =============================================================================
-- Run: Supabase Studio → SQL Editor → paste and execute,
-- or `supabase db push` via Supabase CLI.
--
-- Access model:
--   public.s2app_legal_acts — shared legal acts listing for all authenticated users
--   public.s2app_notes      — notes visible only to their owner
--
-- Data source: ELI API of the Sejm (https://api.sejm.gov.pl/eli) — Dziennik Ustaw
-- and Monitor Polski. Populated by the batch process `legal-acts-ingest`.
--
-- The script is idempotent: it can be executed repeatedly without error.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. s2app_legal_acts — shared legal acts list for authenticated users
-- -----------------------------------------------------------------------------

create table if not exists public.s2app_legal_acts (
  -- ELI identifier (e.g. "DU/2026/1308") is the natural and stable key in the source.
  -- That is why it carries the uniqueness constraint. This allows repeated batch
  -- runs over overlapping date ranges to perform an UPSERT instead of violating the key.
  eli                text        primary key,

  publisher          text        not null check (publisher in ('DU', 'MP')),
  year               integer     not null,
  position           integer     not null,
  display_address    text        not null,

  act_type           text        not null,
  title              text        not null,
  issuing_body       text        not null default '—',

  announcement_date  date,
  promulgation_date  date,
  change_date        timestamptz,
  status             text,

  has_pdf            boolean     not null default false,
  pdf_url            text,

  fetched_at         timestamptz not null default now()
);

comment on table public.s2app_legal_acts is
  'Legal acts from Dziennik Ustaw and Monitor Polski. Shared data for all authenticated clients.';
comment on column public.s2app_legal_acts.eli is
  'European Legislation Identifier, e.g. DU/2026/1308. Natural key from the source system.';
comment on column public.s2app_legal_acts.publisher is
  'DU = Dziennik Ustaw, MP = Monitor Polski.';

create unique index if not exists s2app_legal_acts_address_idx
  on public.s2app_legal_acts (publisher, year, position);

create index if not exists s2app_legal_acts_listing_idx
  on public.s2app_legal_acts (promulgation_date desc nulls last, position desc);

alter table public.s2app_legal_acts enable row level security;

-- Read access: every authenticated user can see the full listing.
-- The `to authenticated` clause is critical here; without it, the policy would also
-- apply to the `anon` role, exposing the listing publicly.
drop policy if exists "s2app_legal_acts_select_authenticated" on public.s2app_legal_acts;
create policy "s2app_legal_acts_select_authenticated"
  on public.s2app_legal_acts
  for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies are intentionally defined: with RLS enabled,
-- missing policies means no write permissions. The data is populated only by the
-- batch process using the `sb_secret_…` key, which bypasses RLS.


-- -----------------------------------------------------------------------------
-- 2. s2app_notes — private notes, only for their owner
-- -----------------------------------------------------------------------------

create table if not exists public.s2app_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  act_eli     text        references public.s2app_legal_acts (eli) on delete set null,
  title       text        not null check (char_length(title) between 1 and 200),
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.s2app_notes is
  'Private user data. Not reproducible from any external source.';

-- The `user_id` index is not ornamental: each query goes through an RLS predicate on
-- this column, so without an index each read becomes a table scan.
create index if not exists s2app_notes_user_id_idx    on public.s2app_notes (user_id);
create index if not exists s2app_notes_created_at_idx on public.s2app_notes (user_id, created_at desc);

alter table public.s2app_notes enable row level security;

-- Four policies, one per operation.
--
-- Writing `(select auth.uid())` instead of raw `auth.uid()` is deliberate:
-- in a subquery the planner treats it as an InitPlan and evaluates it once per
-- query rather than once per row. For larger tables this can materially improve
-- response time.

drop policy if exists "s2app_notes_select_own" on public.s2app_notes;
create policy "s2app_notes_select_own"
  on public.s2app_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "s2app_notes_insert_own" on public.s2app_notes;
create policy "s2app_notes_insert_own"
  on public.s2app_notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "s2app_notes_update_own" on public.s2app_notes;
create policy "s2app_notes_update_own"
  on public.s2app_notes
  for update
  to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "s2app_notes_delete_own" on public.s2app_notes;
create policy "s2app_notes_delete_own"
  on public.s2app_notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- 3. updated_at — controlled by the database, not by the client
-- -----------------------------------------------------------------------------

create or replace function public.s2app_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists s2app_notes_set_updated_at on public.s2app_notes;
create trigger s2app_notes_set_updated_at
  before update on public.s2app_notes
  for each row
  execute function public.s2app_set_updated_at();


-- =============================================================================
-- 4. Verification
-- =============================================================================
-- The listing is populated by the batch process:
--
--   cd backend && python -m legal_acts_ingest
--
-- Acceptance test for PRD §8.4 separation: a query for someone else's notes returns
-- an EMPTY SET, not a permission-denied error. A permission message would imply the
-- record exists but is hidden.
--
--   -- as user A
--   insert into public.s2app_notes (title, body) values ('My note', 'content');
--   select count(*) from public.s2app_notes;   -- 1
--
--   -- as user B
--   select count(*) from public.s2app_notes;   -- 0, even though the row exists
--
-- Check that RLS is enabled wherever it should be:
--
--   select schemaname, tablename, rowsecurity
--   from pg_tables where schemaname = 'public';
-- =============================================================================
