"""Interfejs wiersza poleceń — uruchamianie wsadowe."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, timedelta
from pathlib import Path

from .config import ConfigError, Settings, load_dotenv
from .eli_client import EliApiError, EliClient
from .models import LegalAct
from .supabase_repo import LegalActsRepository, SupabaseError

log = logging.getLogger("legal_acts_ingest")

EXIT_OK = 0
EXIT_CONFIG = 2
EXIT_SOURCE = 3
EXIT_SINK = 4


def default_date_from(lookback_days: int, *, today: date | None = None) -> str:
    """Data sprzed `lookback_days` dni — domyślnie dwa tygodnie wstecz."""
    return ((today or date.today()) - timedelta(days=lookback_days)).isoformat()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="legal-acts-ingest",
        description=(
            "Pobiera akty prawne z API ELI Sejmu (Dziennik Ustaw, Monitor Polski) "
            "i zapisuje je do Supabase."
        ),
    )
    parser.add_argument(
        "--date-from",
        help="Data początkowa RRRR-MM-DD. Domyślnie sprzed --lookback-days dni.",
    )
    parser.add_argument("--date-to", help="Data końcowa RRRR-MM-DD (opcjonalna).")
    parser.add_argument(
        "--lookback-days",
        type=int,
        help="Ile dni wstecz, gdy nie podano --date-from. Domyślnie 14.",
    )
    parser.add_argument(
        "--publishers",
        help="Lista wydawców po przecinku. Domyślnie DU,MP.",
    )
    parser.add_argument("--limit", type=int, help="Rozmiar strony w API. Domyślnie 50.")
    parser.add_argument(
        "--max-pages",
        type=int,
        help="Bezpiecznik: maksymalna liczba stron na wydawcę.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nie zapisuj do Supabase. Nie wymaga kluczy.",
    )
    parser.add_argument(
        "--format",
        choices=("table", "json", "none"),
        default="table",
        help="Jak wypisać pobrane akty. Domyślnie table.",
    )
    parser.add_argument("--env-file", default=".env", help="Ścieżka do pliku .env.")
    parser.add_argument("-v", "--verbose", action="store_true", help="Więcej logów.")
    return parser


def _truncate(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 1] + "…"


def print_table(acts: list[LegalAct]) -> None:
    """Podgląd dokładnie tych kolumn, które pokazuje ekran aplikacji."""
    headers = ("Typ", "Pozycja", "Organ", "Tytuł aktu prawnego", "Akcja")
    widths = (10, 12, 22, 60, 14)

    rows = [
        (
            act.publisher_label,
            f"Poz. {act.position}",
            _truncate(act.issuing_body, widths[2]),
            _truncate(act.title, widths[3]),
            "[Pobierz PDF]" if act.pdf_url else "—",
        )
        for act in acts
    ]

    line = "─┼─".join("─" * w for w in widths)
    print(" │ ".join(h.ljust(w) for h, w in zip(headers, widths, strict=True)))
    print(line)
    for row in rows:
        print(" │ ".join(cell.ljust(w) for cell, w in zip(row, widths, strict=True)))
    print(f"\nRazem: {len(acts)}")


def run(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    )

    load_dotenv(Path(args.env_file))

    try:
        settings = Settings.from_env(require_supabase=not args.dry_run)
    except ConfigError as exc:
        log.error("%s", exc)
        return EXIT_CONFIG

    lookback = args.lookback_days if args.lookback_days is not None else settings.lookback_days
    date_from = args.date_from or default_date_from(lookback)
    publishers = (
        tuple(p.strip().upper() for p in args.publishers.split(",") if p.strip())
        if args.publishers
        else settings.publishers
    )
    limit = args.limit or settings.page_limit

    log.info("Zakres od %s, wydawcy: %s", date_from, ", ".join(publishers))

    client = EliClient(settings.api_base, timeout=settings.request_timeout)
    acts: list[LegalAct] = []

    try:
        for publisher in publishers:
            found = list(
                client.search(
                    publisher=publisher,
                    date_from=date_from,
                    date_to=args.date_to,
                    limit=limit,
                    max_pages=args.max_pages,
                )
            )
            log.info("%s: pobrano %s aktów", publisher, len(found))
            acts.extend(found)
    except EliApiError as exc:
        log.error("Błąd źródła: %s", exc)
        return EXIT_SOURCE

    acts.sort(key=lambda a: (a.publisher, -a.year, -a.position))

    if args.format == "table":
        print_table(acts)
    elif args.format == "json":
        print(json.dumps([a.to_row() for a in acts], ensure_ascii=False, indent=2))

    if args.dry_run:
        log.info("Tryb --dry-run: pominięto zapis do Supabase (%s aktów).", len(acts))
        return EXIT_OK

    try:
        written = LegalActsRepository(
            settings.supabase_url,
            settings.supabase_secret_key,
            timeout=settings.request_timeout,
        ).upsert(acts)
    except SupabaseError as exc:
        log.error("Błąd zapisu: %s", exc)
        return EXIT_SINK

    log.info("Gotowe. Zapisano %s aktów.", written)
    return EXIT_OK


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
