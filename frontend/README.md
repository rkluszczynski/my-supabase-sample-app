# my-supabase-sample-app — frontend

React 19 + TypeScript + Tailwind CSS 4 + Vite 7 + Supabase Auth.

Model dostępu, klucze i polityki RLS opisuje [`README.md`](../README.md) w katalogu nadrzędnym.
Ten plik dotyczy wyłącznie frontendu.

## Uruchomienie

```bash
npm install
cp .env.example .env
npm run dev
```

| Polecenie           | Co robi                               |
| ------------------- | ------------------------------------- |
| `npm run dev`       | serwer deweloperski Vite              |
| `npm run build`     | sprawdzenie typów i build produkcyjny |
| `npm run preview`   | podgląd builda                        |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | sam sprawdzian typów                  |

## Zmienne środowiskowe

| Zmienna                         | Skąd                                               |
| ------------------------------- | -------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase → Project Settings → API                  |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | tamże, klucz `sb_publishable_…`                    |
| `VITE_SUPABASE_ANON_KEY`        | starsza nazwa; używana tylko gdy powyższa jest pusta |

**Klucza `sb_secret_…` nie wolno tu podać.** Omija RLS, więc we frontendzie dawałby pełny
dostęp do bazy. [`src/lib/supabase.ts`](./src/lib/supabase.ts) wykrywa taki klucz i rzuca
wyjątkiem przy starcie.

Bez zmiennych aplikacja startuje w trybie demonstracyjnym — dane w `localStorage`.

## Trasy

| Trasa        | Widok                              | Dostęp           |
| ------------ | ---------------------------------- | ---------------- |
| `/login`     | logowanie i rejestracja            | niezalogowany    |
| `/dashboard` | tabela aktów prawnych (Dz.U., M.P.) | każdy zalogowany |
| `/notes`     | notatki własne                     | tylko autor      |

Przekierowania w [`App.tsx`](./src/App.tsx) są wygodą interfejsu, nie zabezpieczeniem —
dostępu do danych broni RLS w bazie.

## Listing aktów prawnych

Dane pochodzą z tabeli `legal_acts`, którą napełnia proces wsadowy `legal-acts-ingest`
z [API ELI Sejmu](https://api.sejm.gov.pl/eli) — zob. [`backend/README.md`](../backend/README.md).

| Kolumna                 | Pole                                  | Przykład                                      |
| ----------------------- | ------------------------------------- | --------------------------------------------- |
| **Typ**                 | `publisher`                           | 📄 Dz.U. · 📜 M.P.                            |
| **Pozycja**             | `position`, `year`                    | Poz. 1042                                     |
| **Organ**               | `issuing_body`                        | Min. Finansów                                 |
| **Tytuł aktu prawnego** | `title`, pod spodem `act_type` i data | Rozporządzenie w sprawie sposobu prowadzenia… |
| **Akcja**               | `pdf_url`                             | [Pobierz PDF]                                 |

Pusty listing nie jest usterką — komunikat podpowiada uruchomienie procesu wsadowego.

## Kolorystyka tygrysa (motyw jasny)

Paleta jako motyw Tailwind 4 w [`src/index.css`](./src/index.css):

| Token            | Rola                                     |
| ---------------- | ---------------------------------------- |
| `tiger-50…900`   | pomarańcz futra: tło, akcenty, przyciski |
| `stripe-700…950` | czerń pasów: tekst i kontury logo        |
| `claw-marks`     | tło: cztery rozmyte muśnięcia pazura     |
| `animate-prowl`  | powolny ruch poświaty w tle              |

Interfejs jest jasny — kremowe tło `tiger-50`, białe karty, tekst `stripe-900`.
Tło nie jest powtarzalnym wzorem: `claw-marks` to cztery pojedyncze smugi o różnych
kątach i szerokościach, więc oko nie czyta ich jako pasków.

## Struktura

```
src/
├── App.tsx                    routing i brama sesji
├── index.css                  motyw Tailwind
├── components/
│   ├── AppShell.tsx           nagłówek, nawigacja, pasek trybu demo
│   └── TigerMark.tsx          logo (SVG inline)
├── hooks/
│   ├── useAuth.ts             sesja Supabase + tryb demo
│   ├── useLegalActs.ts        listing wspólny dla zalogowanych
│   └── useNotes.ts            notatki własne, CRUD
├── lib/
│   ├── supabase.ts            klient + strażnik klucza sb_secret_
│   ├── database.types.ts      typy schematu
│   ├── demoStore.ts           magazyn trybu demonstracyjnego
│   └── format.ts              formaty polskie, oznaczenia Dz.U./M.P.
└── pages/
    ├── LoginPage.tsx
    ├── DashboardPage.tsx
    └── NotesPage.tsx
```
