# my-supabase-sample-app

Aplikacja przykładowa do nauki stosu technologicznego: **React + TypeScript + Tailwind CSS + Supabase**,
z procesem wsadowym w **Pythonie**. Podział na dwie jednostki wdrożeniowe — frontend i backend
działające na zasadzie klucza `sb_publishable_` (odczyt) vs. `sb_secret_` (zapis).

| Katalog                   | Co zawiera                                                              |
| ------------------------- | ----------------------------------------------------------------------- |
| [`frontend/`](./frontend) | React 19 + TypeScript + Tailwind 4 + Supabase Auth, trzy widoki          |
| [`backend/`](./backend)   | migracja SQL z RLS oraz `legal-acts-ingest` — proces pobierania danych  |

**Domena przykładu:** akty prawne publikowane w **Dzienniku Ustaw** i **Monitorze
Polskim**, pobierane z [API ELI Sejmu](https://api.sejm.gov.pl/eli) i wyświetlane w interfejsie.

---

## Spis treści

1. [Przepływ danych](#1-przepływ-danych)
2. [Model dostępu](#2-model-dostępu)
3. [Klucze Supabase — nowa nomenklatura](#3-klucze-supabase--nowa-nomenklatura)
4. [Row Level Security](#4-row-level-security)
5. [Proces wsadowy](#5-proces-wsadowy)
6. [Uruchomienie](#6-uruchomienie)
7. [Tryb demonstracyjny](#7-tryb-demonstracyjny)
8. [Widoki](#8-widoki)
9. [Struktura plików](#9-struktura-plików)

---

## 1. Przepływ danych

```
API ELI Sejmu                legal-acts-ingest          Supabase                 React
(Dz.U. + M.P.)   ──────►     (Python, cron)    ──────►  legal_acts    ──────►   tabela
                  HTTP        sb_secret_…       upsert   + RLS         publishable
```

Kierunek zapisu i odczytu jest rozdzielony i to jest sedno układu:

| Kto              | Klucz              | Co może                                    |
| ---------------- | ------------------ | ------------------------------------------ |
| proces wsadowy   | `sb_secret_…`      | zapis do `legal_acts` (omija RLS)          |
| przeglądarka     | `sb_publishable_…` | wyłącznie odczyt, w granicach polityk RLS  |

---

## 2. Model dostępu

Trzy poziomy widoczności, każdy wymuszany w innym miejscu:

| Zasób                          | Kto widzi                          | Czym wymuszane                           |
| ------------------------------ | ---------------------------------- | ---------------------------------------- |
| Logowanie i rejestracja        | każdy, także niezalogowany         | Supabase Auth                            |
| Listing `legal_acts`           | **każdy zalogowany**, dane wspólne | `legal_acts_select_authenticated`        |
| Notatki `notes`                | **wyłącznie autor wiersza**        | `notes_select/insert/update/delete_own`  |

Rzecz, którą trzeba czytać dosłownie: **routing we frontendzie nie jest zabezpieczeniem.**
Przekierowanie niezalogowanego na `/login` jest wygodą interfejsu. Danych broni wyłącznie
RLS w bazie — i tylko dlatego wolno wysłać klucz dostępowy do przeglądarki.

---

## 3. Klucze Supabase — nowa nomenklatura

Supabase przechodzi z JWT `anon` / `service_role` na klucze `sb_publishable_…` / `sb_secret_…`.
Podział odpowiedzialności jest w obu wersjach ten sam:

| Klucz              | Zastępuje      | Gdzie żyje                     | Wobec RLS       |
| ------------------ | -------------- | ------------------------------ | --------------- |
| `sb_publishable_…` | `anon`         | przeglądarka, zmienne `VITE_*` | **podlega** RLS |
| `sb_secret_…`      | `service_role` | wyłącznie serwer               | **omija** RLS   |

### Czy `publishable` wystarcza?

Tak — i jest to **jedyny** klucz, który wolno umieścić we frontendzie.

Klucz publishable **nie jest sekretem**. Każdy odczyta go z bundla i tak ma być.
Bezpieczeństwo nie bierze się z tajności klucza, tylko z Row Level Security.
Wniosek jest niewygodny, ale prosty: **jeśli RLS jest wyłączony, klucz publishable daje
dostęp do wszystkiego.** RLS nie jest więc opcją, tylko warunkiem wysłania klucza do klienta.

Pomyłka w obie strony jest wychwytywana wcześnie i głośno:

| Gdzie                                                              | Co sprawdza                                    |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| [`frontend/src/lib/supabase.ts`](./frontend/src/lib/supabase.ts)   | rzuca wyjątkiem, gdy wykryje `sb_secret_…`     |
| [`backend/src/legal_acts_ingest/config.py`](./backend/src/legal_acts_ingest/config.py) | odrzuca `sb_publishable_…`, bo zapis go nie przejdzie |

| Plik                                               | Co trzyma                       |
| -------------------------------------------------- | ------------------------------- |
| [`frontend/.env.example`](./frontend/.env.example) | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| [`backend/.env.example`](./backend/.env.example)   | `SUPABASE_SECRET_KEY`           |

Fallback na `VITE_SUPABASE_ANON_KEY` zostaje — projekty jeszcze niezmigrowane działają bez zmian.

---

## 4. Row Level Security

Pełna migracja: [`backend/supabase/migrations/0001_init.sql`](./backend/supabase/migrations/0001_init.sql).

### Listing wspólny dla zalogowanych

```sql
alter table public.legal_acts enable row level security;

create policy "legal_acts_select_authenticated"
  on public.legal_acts for select
  to authenticated          -- rola 'anon' nie przechodzi
  using (true);
```

Brak polityk `insert` / `update` / `delete` jest celowy: przy włączonym RLS **brak polityki
oznacza brak uprawnienia**. Dane wprowadza wyłącznie proces wsadowy kluczem `sb_secret_…`.

### Notatki wyłącznie własne

```sql
create policy "notes_select_own" on public.notes for select
  to authenticated using ((select auth.uid()) = user_id);

create policy "notes_insert_own" on public.notes for insert
  to authenticated with check ((select auth.uid()) = user_id);

create policy "notes_update_own" on public.notes for update
  to authenticated using      ((select auth.uid()) = user_id)
                  with check ((select auth.uid()) = user_id);

create policy "notes_delete_own" on public.notes for delete
  to authenticated using ((select auth.uid()) = user_id);
```

### Cztery szczegóły, które łatwo przeoczyć

| Szczegół | Dlaczego ma znaczenie |
|---|---|
| **`to authenticated`** | Bez tego polityka obejmuje też rolę `anon` i listing wycieka publicznie |
| **`(select auth.uid())` w nawiasie** | Planner traktuje to jako InitPlan i liczy **raz na zapytanie**, nie raz na wiersz. Przy dużej tabeli to różnica rzędu wielkości |
| **`using` vs `with check`** | `using` mówi, które wiersze wolno ruszyć; `with check` — czym wolno je nadpisać. `update` potrzebuje obu, inaczej da się przepisać cudzy wiersz na siebie |
| **Indeks na `user_id`** | Każdy odczyt przechodzi przez predykat RLS na tej kolumnie. Bez indeksu to pełny skan |

### Czego nie ma w kodzie klienckim — i to jest zamierzone

Zapytania w [`useNotes.ts`](./frontend/src/hooks/useNotes.ts) **nie zawierają** `.eq('user_id', …)`.
To nie przeoczenie: filtrowanie po stronie klienta byłoby pozorem bezpieczeństwa, bo każdy
może je ominąć. Zakres wymusza baza, a `user_id` przy zapisie uzupełnia domyślna wartość
kolumny `auth.uid()`.

### Test akceptacyjny separacji

Wprost z [`PRD.md`](../documentation/00_PRD/PRD.md) §8.4 — zapytanie o cudze dane zwraca
**pusty zbiór**, nie komunikat o braku uprawnień. Komunikat potwierdzałby, że rekord istnieje.

```sql
-- jako użytkownik A
insert into public.notes (title, body) values ('Moja notatka', 'treść');
select count(*) from public.notes;   -- 1

-- jako użytkownik B
select count(*) from public.notes;   -- 0, mimo że wiersz w tabeli jest
```

---

## 5. Proces wsadowy

`legal-acts-ingest` — aplikacja Pythona w [`backend/`](./backend). Szczegóły:
[`backend/README.md`](./backend/README.md).

### Źródło

```
GET https://api.sejm.gov.pl/eli/acts/search?dateFrom=<data>&publisher=<DU|MP>&limit=50&offset=<n>
```

Data początkowa to domyślnie **dzień sprzed dwóch tygodni**, liczony przy każdym uruchomieniu.
Zakresy kolejnych przebiegów nachodzą więc na siebie — i tak ma być: akt opublikowany
w sekundzie przełączenia okna inaczej by przepadł.

Nakładanie jest bezpieczne, bo zapis jest **idempotentny**: identyfikator `ELI`
(np. `DU/2026/1308`) jest kluczem głównym, a PostgREST dostaje `on_conflict=eli`
i `Prefer: resolution=merge-duplicates`. Ponowny przebieg aktualizuje wiersze,
zamiast wywalać się na naruszeniu klucza.

### Odporność

| Sytuacja                        | Zachowanie                                               |
| ------------------------------- | -------------------------------------------------------- |
| Chwilowy błąd HTTP (429, 5xx)   | ponowienie z narastającym opóźnieniem, do 4 prób          |
| Pozycja bez `ELI` / `pos`       | pominięta z ostrzeżeniem, przebieg trwa dalej             |
| Więcej wyników niż jedna strona | stronicowanie po `offset` aż do `totalCount`              |
| Zła konfiguracja / źródło / zapis | rozdzielne kody wyjścia 2 / 3 / 4                       |

### Uruchomienie

```bash
cd backend
.venv/bin/python -m bidtiger_ingest --dry-run   # podgląd, bez kluczy
.venv/bin/python -m legal_acts_ingest             # pobranie i zapis
```

Cron: `15 6 * * * /ścieżka/do/backend/run_ingest.sh >> /var/log/legal-acts-ingest.log 2>&1`

---

## 6. Uruchomienie

### Docker

Jeden obraz może zawierać oba komponenty:

- **frontend** jest budowany do statycznych plików i uruchamiany przy starcie kontenera,
- **backend** (`legal-acts-ingest`) jest zainstalowany w tym samym obrazie i można go wywołać ręcznie lub z osobnego joba.

```bash
cd my-supabase-sample-app
docker build -t my-supabase-sample-app .

docker run --rm -p 4173:4173 \
  -e PORT=4173 \
  -e VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx \
  my-supabase-sample-app
```

Po starcie kontener serwuje frontend na porcie `4173`.

Backend jest dostępny wewnątrz obrazu jako polecenie:

```bash
docker run --rm \
  --env-file backend/.env.example \
  my-supabase-sample-app \
  legal-acts-ingest --dry-run
```

Jeżeli chcesz używać tego samego obrazu zarówno do UI, jak i do batcha, nadpisujesz komendę
startową kontenera: domyślnie uruchamia się frontend, a dla wsadu wywołujesz `legal-acts-ingest ...`.

### Krok 1 — baza

Supabase Studio → SQL Editor → wykonaj
[`backend/supabase/migrations/0001_init.sql`](./backend/supabase/migrations/0001_init.sql).

### Krok 2 — napełnienie listingu

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env          # SUPABASE_URL + SUPABASE_SECRET_KEY
.venv/bin/python -m legal_acts_ingest
```

### Krok 3 — frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

### Polecenia

| Gdzie      | Polecenie                              | Co robi                     |
| ---------- | -------------------------------------- | --------------------------- |
| `frontend` | `npm run dev` / `build` / `preview`    | serwer, build, podgląd      |
| `frontend` | `npm run lint` / `typecheck`           | ESLint, sprawdzian typów    |
| `backend`  | `.venv/bin/python -m pytest -q`        | testy                       |
| `backend`  | `.venv/bin/python -m ruff check .`     | lint                        |

### Typy TypeScript

[`database.types.ts`](./frontend/src/lib/database.types.ts) jest dziś napisany ręcznie.
Docelowo ma być generowany ze schematu:

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

---

## 7. Tryb demonstracyjny

Bez zmiennych środowiskowych aplikacja **nadal startuje**. Logowanie jest symulowane,
dane trzymane w `localStorage`, a interfejs mówi o tym wprost — w pasku pod nagłówkiem
i na ekranie logowania.

[`demoStore.ts`](./frontend/src/lib/demoStore.ts) odwzorowuje te same reguły, które
w prawdziwej bazie wymusza RLS: listing jest wspólny, notatki filtrowane po `user_id`
wyprowadzonym z adresu e-mail. Dwóch „użytkowników" demo nie zobaczy więc nawzajem
swoich notatek — zachowanie zgadza się z produkcyjnym.

Po stronie backendu odpowiednikiem jest `--dry-run`: pobiera z prawdziwego API,
wypisuje tabelę, nie zapisuje niczego i nie wymaga kluczy.

---

## 8. Widoki

| Trasa        | Widok                                        | Dostęp            |
| ------------ | -------------------------------------------- | ----------------- |
| `/login`     | logowanie i rejestracja, kolorystyka tygrysa | niezalogowany     |
| `/dashboard` | tabela aktów prawnych                        | każdy zalogowany  |
| `/notes`     | notatki własne — dodawanie i usuwanie        | tylko autor       |

### Kolumny listingu

| Kolumna               | Źródło                                     | Przykład                                      |
| --------------------- | ------------------------------------------ | --------------------------------------------- |
| **Typ**               | `publisher`                                | 📄 Dz.U. · 📜 M.P.                            |
| **Pozycja**           | `position`, `year`                         | Poz. 1042                                     |
| **Organ**             | `issuing_body` (`releasedBy` z API)        | Min. Finansów                                 |
| **Tytuł aktu prawnego** | `title`, pod spodem `act_type` i data    | Rozporządzenie w sprawie sposobu prowadzenia… |
| **Akcja**             | `pdf_url`                                  | [Pobierz PDF]                                 |

Nad tabelą filtr: Wszystkie · Dziennik Ustaw · Monitor Polski.

---

## 9. Struktura plików

```
my-supabase-sample-app/
├── Dockerfile                            wspólny obraz: frontend + backend CLI
├── backend/
│   ├── pyproject.toml                 pakiet legal-acts-ingest
│   ├── run_ingest.sh                  opakowanie pod crona
│   ├── .env.example                   SUPABASE_SECRET_KEY — nigdy do frontendu
│   ├── src/legal_acts_ingest/
│   │   ├── cli.py                     argumenty, podgląd tabeli, kody wyjścia
│   │   ├── config.py                  zmienne środowiskowe, strażnik klucza
│   │   ├── eli_client.py              API ELI: stronicowanie i ponowienia
│   │   ├── models.py                  mapowanie odpowiedzi na wiersz tabeli
│   │   └── supabase_repo.py           upsert przez PostgREST
│   ├── tests/                         testy mapowania i konfiguracji
│   └── supabase/migrations/
│       └── 0001_init.sql              schemat, RLS, trigger
└── frontend/
    ├── .env.example                   VITE_SUPABASE_PUBLISHABLE_KEY
    └── src/
        ├── App.tsx                    routing i brama sesji
        ├── index.css                  motyw Tailwind: paleta tygrysa
        ├── components/
        │   ├── AppShell.tsx           nagłówek, nawigacja, pasek trybu demo
        │   └── TigerMark.tsx          logo (SVG inline)
        ├── hooks/
        │   ├── useAuth.ts             sesja Supabase + tryb demo
        │   ├── useLegalActs.ts        listing wspólny
        │   └── useNotes.ts            notatki własne, CRUD
        ├── lib/
        │   ├── supabase.ts            klient + strażnik klucza sb_secret_
        │   ├── database.types.ts      typy schematu
        │   ├── demoStore.ts           magazyn trybu demo
        │   └── format.ts              formaty polskie, oznaczenia Dz.U./M.P.
        └── pages/
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            └── NotesPage.tsx
```
