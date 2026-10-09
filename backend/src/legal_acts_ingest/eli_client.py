"""Klient API ELI Sejmu (https://api.sejm.gov.pl/eli)."""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from typing import Any

import requests

from .models import LegalAct, parse_act

log = logging.getLogger(__name__)

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class EliApiError(RuntimeError):
    """API odpowiedziało błędem, którego nie da się ponowić."""


class EliClient:
    def __init__(
        self,
        api_base: str,
        *,
        timeout: float = 30.0,
        max_retries: int = 4,
        session: requests.Session | None = None,
    ) -> None:
        self.api_base = api_base.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = session or requests.Session()
        self.session.headers.update(
            {"Accept": "application/json", "User-Agent": "legal-acts-ingest/0.1"}
        )

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.api_base}{path}"
        delay = 1.0

        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout)
            except requests.RequestException as exc:
                if attempt == self.max_retries:
                    raise EliApiError(f"Brak odpowiedzi z {url}: {exc}") from exc
                log.warning(
                    "Próba %s/%s nieudana (%s), ponawiam za %.0fs",
                    attempt, self.max_retries, exc, delay,
                )
                time.sleep(delay)
                delay *= 2
                continue

            if response.status_code in RETRY_STATUSES and attempt < self.max_retries:
                log.warning(
                    "HTTP %s z %s, ponawiam za %.0fs (%s/%s)",
                    response.status_code, url, delay, attempt, self.max_retries,
                )
                time.sleep(delay)
                delay *= 2
                continue

            if not response.ok:
                raise EliApiError(f"HTTP {response.status_code} z {url}: {response.text[:200]}")

            return response.json()

        raise EliApiError(f"Wyczerpano próby dla {url}")

    def search(
        self,
        *,
        publisher: str,
        date_from: str,
        date_to: str | None = None,
        limit: int = 50,
        max_pages: int | None = None,
    ) -> Iterator[LegalAct]:
        """
        Akty opublikowane od `date_from`, stronicowane po `limit` pozycji.

        API wymaga offsetu, więc pobieramy kolejne strony aż do wyczerpania
        `totalCount`. `max_pages` jest bezpiecznikiem na wypadek, gdyby zakres
        dat okazał się szerszy, niż zakładano.
        """
        offset = 0
        page = 0
        total = None

        while True:
            params: dict[str, Any] = {
                "dateFrom": date_from,
                "publisher": publisher,
                "limit": limit,
                "offset": offset,
            }
            if date_to:
                params["dateTo"] = date_to

            payload = self._get("/acts/search", params)
            items = payload.get("items") or []

            if total is None:
                total = int(payload.get("totalCount") or 0)
                log.info("%s: %s aktów od %s", publisher, total, date_from)

            for item in items:
                act = parse_act(item, api_base=self.api_base)
                if act is None:
                    log.warning("Pominięto pozycję bez wymaganych pól: %s", item.get("address"))
                    continue
                yield act

            page += 1
            offset += len(items)

            if not items or offset >= total or (max_pages is not None and page >= max_pages):
                return
