-- =============================================================================
-- BidTiger — przykładowy schemat z Row Level Security
-- =============================================================================
-- Uruchomienie: Supabase Studio → SQL Editor → wklej i wykonaj,
-- albo `supabase db push` przy użyciu Supabase CLI.
--
-- Model dostępu:
--   public.legal_acts — listing aktów prawnych, wspólny dla WSZYSTKICH ZALOGOWANYCH
--   public.notes      — notatki widoczne WYŁĄCZNIE dla ich autora
--
-- Źródło danych: API ELI Sejmu (https://api.sejm.gov.pl/eli) — Dziennik Ustaw
-- i Monitor Polski. Wypełnia je proces wsadowy `bidtiger-ingest`.
--
-- Skrypt jest idempotentny: można go wykonać ponownie bez błędu.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. LEGAL_ACTS — listing aktów prawnych, wspólny dla zalogowanych
-- -----------------------------------------------------------------------------

create table if not exists public.legal_acts (
  -- Identyfikator ELI (np. "DU/2026/1308") jest kluczem naturalnym i stabilnym
  -- w źródle, więc to on nosi ograniczenie unikalności. Dzięki temu ponowne
  -- uruchomienie procesu dla nakładającego się zakresu dat jest UPSERT-em,
  -- a nie naruszeniem klucza.
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

comment on table public.legal_acts is
  'Akty prawne z Dziennika Ustaw i Monitora Polskiego. Dane globalne, wspólne dla wszystkich klientów.';
comment on column public.legal_acts.eli is
  'Identyfikator European Legislation Identifier, np. DU/2026/1308. Klucz naturalny ze źródła.';
comment on column public.legal_acts.publisher is
  'DU = Dziennik Ustaw, MP = Monitor Polski.';

create unique index if not exists legal_acts_address_idx
  on public.legal_acts (publisher, year, position);

create index if not exists legal_acts_listing_idx
  on public.legal_acts (promulgation_date desc nulls last, position desc);

alter table public.legal_acts enable row level security;

-- Odczyt: każdy zalogowany użytkownik widzi pełny listing.
-- Klauzula `to authenticated` jest tu istotna — bez niej polityka objęłaby
-- także rolę `anon`, czyli listing wyciekłby publicznie.
drop policy if exists "legal_acts_select_authenticated" on public.legal_acts;
create policy "legal_acts_select_authenticated"
  on public.legal_acts
  for select
  to authenticated
  using (true);

-- Brak polityk INSERT/UPDATE/DELETE jest celowy: przy włączonym RLS brak
-- polityki oznacza brak uprawnienia. Dane wprowadza wyłącznie proces wsadowy
-- kluczem `sb_secret_…`, który RLS omija.


-- -----------------------------------------------------------------------------
-- 2. NOTES — notatki prywatne, wyłącznie własne
-- -----------------------------------------------------------------------------

create table if not exists public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,
  act_eli     text        references public.legal_acts (eli) on delete set null,
  title       text        not null check (char_length(title) between 1 and 200),
  body        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.notes is
  'Dane prywatne użytkownika. Nieodtwarzalne z żadnego źródła zewnętrznego.';

-- Indeks pod `user_id` nie jest ozdobnikiem: każde zapytanie przechodzi przez
-- predykat RLS na tej kolumnie, więc bez indeksu każdy odczyt to pełny skan.
create index if not exists notes_user_id_idx    on public.notes (user_id);
create index if not exists notes_created_at_idx on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

-- Cztery polityki, po jednej na operację.
--
-- Zapis `(select auth.uid())` zamiast gołego `auth.uid()` jest świadomy:
-- w podzapytaniu planner traktuje wywołanie jako InitPlan i liczy je RAZ na
-- zapytanie, a nie raz na wiersz. Przy większych tabelach to różnica rzędu
-- wielkości w czasie odpowiedzi.

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes
  for update
  to authenticated
  using      ((select auth.uid()) = user_id)   -- które wiersze wolno ruszyć
  with check ((select auth.uid()) = user_id);  -- i czym wolno je nadpisać

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- 3. updated_at — utrzymywane przez bazę, nie przez klienta
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
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

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Porządki po wcześniejszej wersji przykładu
-- -----------------------------------------------------------------------------

drop table if exists public.tenders cascade;


-- =============================================================================
-- 5. Weryfikacja
-- =============================================================================
-- Listing napełnia proces wsadowy:
--
--   cd backend && python -m bidtiger_ingest
--
-- Test akceptacyjny separacji z PRD §8.4 — zapytanie o cudze notatki zwraca
-- PUSTY ZBIÓR, nie komunikat o braku uprawnień. Komunikat potwierdzałby,
-- że rekord istnieje.
--
--   -- jako użytkownik A
--   insert into public.notes (title, body) values ('Moja notatka', 'treść');
--   select count(*) from public.notes;   -- 1
--
--   -- jako użytkownik B
--   select count(*) from public.notes;   -- 0, mimo że wiersz w tabeli jest
--
-- Sprawdzenie, czy RLS jest włączony wszędzie, gdzie powinien:
--
--   select schemaname, tablename, rowsecurity
--   from pg_tables where schemaname = 'public';
-- =============================================================================
