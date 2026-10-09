"""Konfiguracja czytana ze zmiennych środowiskowych."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_API_BASE = "https://api.sejm.gov.pl/eli"
DEFAULT_LOOKBACK_DAYS = 14
DEFAULT_PAGE_LIMIT = 50
DEFAULT_PUBLISHERS = ("DU", "MP")


class ConfigError(RuntimeError):
    """Konfiguracja jest niekompletna albo niebezpieczna."""


def load_dotenv(path: Path) -> None:
    """Minimalny czytnik `.env` — bez zależności, nie nadpisuje istniejących zmiennych."""
    if not path.is_file():
        return

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    api_base: str = DEFAULT_API_BASE
    lookback_days: int = DEFAULT_LOOKBACK_DAYS
    page_limit: int = DEFAULT_PAGE_LIMIT
    publishers: tuple[str, ...] = field(default=DEFAULT_PUBLISHERS)
    request_timeout: float = 30.0

    @classmethod
    def from_env(cls, *, require_supabase: bool = True) -> Settings:
        url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
        key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()

        if require_supabase and not (url and key):
            raise ConfigError(
                "Brak SUPABASE_URL albo SUPABASE_SECRET_KEY. "
                "Skopiuj .env.example do .env i uzupełnij, albo użyj --dry-run."
            )

        # Klucz serwerowy omija RLS. Klucz publishable nie ma uprawnień do zapisu,
        # więc wcześnie i wyraźnie odrzucamy pomyłkę, zamiast czekać na błąd 401.
        if key and key.startswith("sb_publishable_"):
            raise ConfigError(
                "Podano klucz sb_publishable_… Proces wsadowy zapisuje do tabel chronionych "
                "RLS i wymaga klucza sb_secret_… (dawniej service_role)."
            )

        publishers = tuple(
            p.strip().upper()
            for p in os.environ.get("ELI_PUBLISHERS", ",".join(DEFAULT_PUBLISHERS)).split(",")
            if p.strip()
        )

        return cls(
            supabase_url=url,
            supabase_secret_key=key,
            api_base=os.environ.get("ELI_API_BASE", DEFAULT_API_BASE).rstrip("/"),
            lookback_days=int(os.environ.get("ELI_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS)),
            page_limit=int(os.environ.get("ELI_PAGE_LIMIT", DEFAULT_PAGE_LIMIT)),
            publishers=publishers or DEFAULT_PUBLISHERS,
            request_timeout=float(os.environ.get("ELI_TIMEOUT", "30")),
        )
