# my-supabase-sample-app — backend

Dwa komponenty:

1. **Schemat bazy** (`SQL`) z politykami Row Level Security — definiuje tabele i reguły dostępu.
2. **`legal-acts-ingest`** — aplikacja Pythona, która wsadowo pobiera akty prawne
   z [API ELI Sejmu](https://api.sejm.gov.pl/eli) (Dziennik Ustaw, Monitor Polski) 
   i zapisuje je do Supabase za pomocą klucza `sb_secret_`.

Pełny opis modelu dostępu i kluczy: [`README.md`](../README.md) w katalogu nadrzędnym.

---

## Zawartość

| Ścieżka                             | Co zawiera                                          |
| ----------------------------------- | --------------------------------------------------- |
| `supabase/migrations/0001_init.sql` | tabele `legal_acts` i `notes`, RLS, trigger          |
| `src/legal_acts_ingest/`            | aplikacja pobierająca                               |
| `tests/`                            | testy jednostkowe mapowania i konfiguracji           |
| `run_ingest.sh`                     | opakowanie pod crona                                 |
| `.env.example`                      | `SUPABASE_SECRET_KEY` i parametry pobierania         |

---

## 1. Migracja

Supabase Studio → SQL Editor → wklej i wykonaj `supabase/migrations/0001_init.sql`.
Skrypt jest idempotentny, można go powtórzyć. Albo przez Supabase CLI:

```bash
supabase db push
```

### Polityki w skrócie

| Tabela       | SELECT               | INSERT / UPDATE / DELETE         |
| ------------ | -------------------- | -------------------------------- |
| `legal_acts` | każdy zalogowany     | brak polityki → brak uprawnienia |
| `notes`      | tylko własne wiersze | tylko własne wiersze             |

Dane do `legal_acts` wprowadza wyłącznie proces wsadowy kluczem `sb_secret_…`,
który RLS omija. To dlatego brak polityk zapisu nie jest przeoczeniem.

---

## 2. `legal-acts-ingest`

### Źródło

```
GET https://api.sejm.gov.pl/eli/acts/search?dateFrom=<data>&publisher=<DU|MP>&limit=50&offset=<n>
```

Data początkowa to domyślnie **dzień sprzed dwóch tygodni**, liczony przy każdym
uruchomieniu. Zakresy kolejnych przebiegów nachodzą więc na siebie — i tak ma być:
akt opublikowany w sekundzie przełączenia okna inaczej by przepadł. Nakładanie jest
bezpieczne, bo zapis jest idempotentny (`on_conflict=eli` + `Prefer: resolution=merge-duplicates`).

### Instalacja

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env     # uzupełnij SUPABASE_URL i SUPABASE_SECRET_KEY
```

### Uruchomienie

```bash
# Podgląd bez zapisu — nie wymaga żadnych kluczy
.venv/bin/python -m legal_acts_ingest --dry-run

# Pełny przebieg: pobranie i zapis do Supabase
.venv/bin/python -m legal_acts_ingest

# Konkretny zakres i tylko Monitor Polski
.venv/bin/python -m legal_acts_ingest --date-from 2026-09-01 --publishers MP
```

### Docker

Backend jest instalowany do tego samego obrazu co frontend. Domyślnie kontener startuje UI,
ale komendę można nadpisać i użyć obrazu jako joba wsadowego:

```bash
cd ..
docker build -t my-supabase-sample-app .

# Podgląd bez zapisu
docker run --rm my-supabase-sample-app legal-acts-ingest --dry-run

# Pełny zapis do Supabase
docker run --rm \
  -e SUPABASE_URL=https://<project-ref>.supabase.co \
  -e SUPABASE_SECRET_KEY=sb_secret_xxx \
  my-supabase-sample-app \
  legal-acts-ingest --format none
```

Jeżeli używasz pliku `.env`, najwygodniej przekazać go przez `--env-file backend/.env`.

Wynik `--dry-run` to dokładnie te kolumny, które pokazuje ekran aplikacji:

```
Typ        │ Pozycja      │ Organ                  │ Tytuł aktu prawnego          │ Akcja
───────────┼──────────────┼────────────────────────┼──────────────────────────────┼───────────────
Dz.U.      │ Poz. 1289    │ MIN. FINANSÓW I GOSPO… │ Rozporządzenie Ministra Fin… │ [Pobierz PDF]
M.P.       │ Poz. 981     │ PAŃSTWOWA KOMISJA WYB… │ Uchwała nr 141/2026 Państwo… │ [Pobierz PDF]
```

### Przełączniki

| Przełącznik        | Domyślnie | Co robi                                        |
| ------------------ | --------- | ---------------------------------------------- |
| `--date-from`      | dziś − 14 dni | data początkowa `RRRR-MM-DD`               |
| `--date-to`        | brak      | data końcowa                                   |
| `--lookback-days`  | 14        | ile dni wstecz, gdy brak `--date-from`         |
| `--publishers`     | `DU,MP`   | lista wydawców po przecinku                    |
| `--limit`          | 50        | rozmiar strony w API                           |
| `--max-pages`      | brak      | bezpiecznik na liczbę stron                    |
| `--dry-run`        | —         | nie zapisuj; nie wymaga kluczy                 |
| `--format`         | `table`   | `table`, `json` albo `none`                    |
| `--env-file`       | `.env`    | ścieżka do pliku `.env`                        |
| `-v`               | —         | więcej logów                                   |

### Kody wyjścia

Rozdzielone celowo: inaczej reaguje się na zepsutą konfigurację, inaczej na
niedostępne źródło, a jeszcze inaczej na odmowę zapisu.

| Kod | Znaczenie                            |
| --- | ------------------------------------ |
| 0   | sukces                               |
| 2   | błąd konfiguracji                    |
| 3   | błąd źródła (API ELI)                |
| 4   | błąd zapisu (Supabase)               |

### Cron

```bash
15 6 * * * /ścieżka/do/backend/run_ingest.sh >> /var/log/legal-acts-ingest.log 2>&1
```

---

## 3. Mapowanie pól

| Kolumna w bazie     | Pole API            | Uwaga                                     |
| ------------------- | ------------------- | ----------------------------------------- |
| `eli`               | `ELI`               | klucz główny, np. `DU/2026/1308`          |
| `publisher`         | `publisher`         | `DU` albo `MP`                            |
| `position`          | `pos`               | „Poz. 1042" w tabeli                      |
| `display_address`   | `displayAddress`    | `Dz.U. 2026 poz. 1308`                    |
| `act_type`          | `type`              | Rozporządzenie, Uchwała, Obwieszczenie…   |
| `title`             | `title`             | pełny tytuł aktu                          |
| `issuing_body`      | `releasedBy`        | lista → tekst; fallback `authorizedBody`  |
| `promulgation_date` | `promulgation`      | data ogłoszenia                           |
| `has_pdf`           | `textPDF` / `texts` | sterują przyciskiem „Pobierz PDF"         |
| `pdf_url`           | wyliczane           | `…/eli/acts/{pub}/{rok}/{poz}/text.pdf`   |

Pozycja bez `ELI`, `publisher`, `year` albo `pos` jest **pomijana z ostrzeżeniem**,
a nie przerywa przebiegu. Jeden wybrakowany rekord w źródle nie może wywalić
całego okna dwutygodniowego.

---

## 4. Testy i lint

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check .
```

---

## 5. Czego tu jeszcze nie ma

Bardziej zaawansowane komponenty (jak retriever czy analizer) nie są tu zaimplementowane — to przykład stosu,
nie produkt. Punkt wyjścia do decyzji o stosie:
[`documentation/10_Produkt/STACK.md`](../../documentation/10_Produkt/STACK.md)
i [`documentation/20_Backend/STACK.md`](../../documentation/20_Backend/STACK.md).

Otwarte: sposób dostępu do danych z frontendu — Supabase bezpośrednio na tabelach,
własna warstwa API, hybryda albo Supabase przeciw widokom w bazie
([ADR-P11](../../documentation/10_Produkt/ADR_PRODUKT.md), decyzja architekta).
Ten przykład realizuje wariant pierwszy: frontend czyta tabele, zapis należy do
procesu wsadowego.
