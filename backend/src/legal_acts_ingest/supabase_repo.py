"""Zapis do Supabase przez PostgREST."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import requests

from .models import LegalAct

log = logging.getLogger(__name__)

TABLE = "legal_acts"
CHUNK_SIZE = 200


class SupabaseError(RuntimeError):
    """Zapis do Supabase nie powiódł się."""


class LegalActsRepository:
    """
    Zapis idempotentny: `on_conflict=eli` plus nagłówek
    `Prefer: resolution=merge-duplicates` zamieniają INSERT w UPSERT.

    Dzięki temu ponowne uruchomienie dla nakładającego się zakresu dat aktualizuje
    wiersze zamiast wywalać się na naruszeniu klucza — a nakładanie zakresów jest
    konieczne, żeby nie zgubić aktu opublikowanego w sekundzie przełączenia okna.
    """

    def __init__(
        self,
        supabase_url: str,
        secret_key: str,
        *,
        timeout: float = 30.0,
        session: requests.Session | None = None,
    ) -> None:
        self.endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{TABLE}"
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "apikey": secret_key,
                "Authorization": f"Bearer {secret_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            }
        )

    def upsert(self, acts: Sequence[LegalAct]) -> int:
        if not acts:
            return 0

        written = 0
        for start in range(0, len(acts), CHUNK_SIZE):
            chunk = acts[start : start + CHUNK_SIZE]
            response = self.session.post(
                self.endpoint,
                params={"on_conflict": "eli"},
                json=[act.to_row() for act in chunk],
                timeout=self.timeout,
            )

            if not response.ok:
                raise SupabaseError(
                    f"HTTP {response.status_code} przy zapisie {len(chunk)} wierszy: "
                    f"{response.text[:300]}"
                )

            written += len(chunk)
            log.info("Zapisano %s/%s wierszy", written, len(acts))

        return written
