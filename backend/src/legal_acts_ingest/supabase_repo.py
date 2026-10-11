"""Zapis do Supabase przez PostgREST."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import requests

from .models import LegalAct

log = logging.getLogger(__name__)

TABLE = "s2app_legal_acts"
LEGACY_TABLE = "legal_acts"
TABLE_CANDIDATES = (TABLE, LEGACY_TABLE)
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
        self.base_url = supabase_url.rstrip('/')
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                'apikey': secret_key,
                'Authorization': f'Bearer {secret_key}',
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal',
            }
        )
        self.table = TABLE
        self.endpoint = f'{self.base_url}/rest/v1/{self.table}'

    def _post_with_fallback(self, chunk: Sequence[LegalAct]) -> requests.Response:
        last_response: requests.Response | None = None

        for table_name in TABLE_CANDIDATES:
            endpoint = f'{self.base_url}/rest/v1/{table_name}'
            response = self.session.post(
                endpoint,
                params={'on_conflict': 'eli'},
                json=[act.to_row() for act in chunk],
                timeout=self.timeout,
            )
            last_response = response

            if response.ok:
                self.table = table_name
                self.endpoint = endpoint
                return response

            if response.status_code != 404:
                return response

            error_text = response.text.lower()
            if 'could not find the table' not in error_text:
                return response

            log.warning(
                'Table %s not found in Supabase schema cache; retrying with %s',
                table_name,
                LEGACY_TABLE if table_name == TABLE else TABLE,
            )

        if last_response is not None:
            return last_response

        raise SupabaseError('No valid table candidate found for Supabase upsert.')

    def upsert(self, acts: Sequence[LegalAct]) -> int:
        if not acts:
            return 0

        written = 0
        for start in range(0, len(acts), CHUNK_SIZE):
            chunk = acts[start : start + CHUNK_SIZE]
            response = self._post_with_fallback(chunk)

            if not response.ok:
                raise SupabaseError(
                    f'HTTP {response.status_code} przy zapisie {len(chunk)} wierszy: '
                    f'{response.text[:300]}'
                )

            written += len(chunk)
            log.info('Zapisano %s/%s wierszy', written, len(acts))

        return written
