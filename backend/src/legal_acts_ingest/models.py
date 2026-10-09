"""Model aktu prawnego i mapowanie z odpowiedzi API ELI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

PUBLISHER_LABELS = {
    "DU": "Dz.U.",
    "MP": "M.P.",
}


@dataclass(frozen=True)
class LegalAct:
    """Jeden akt prawny — odwzorowanie wiersza tabeli `public.legal_acts`."""

    eli: str
    publisher: str
    year: int
    position: int
    display_address: str
    act_type: str
    title: str
    issuing_body: str
    announcement_date: str | None
    promulgation_date: str | None
    change_date: str | None
    status: str | None
    has_pdf: bool
    pdf_url: str | None

    @property
    def publisher_label(self) -> str:
        return PUBLISHER_LABELS.get(self.publisher, self.publisher)

    def to_row(self) -> dict[str, Any]:
        """Postać wysyłana do PostgREST. Klucze odpowiadają kolumnom tabeli."""
        return {
            "eli": self.eli,
            "publisher": self.publisher,
            "year": self.year,
            "position": self.position,
            "display_address": self.display_address,
            "act_type": self.act_type,
            "title": self.title,
            "issuing_body": self.issuing_body,
            "announcement_date": self.announcement_date,
            "promulgation_date": self.promulgation_date,
            "change_date": self.change_date,
            "status": self.status,
            "has_pdf": self.has_pdf,
            "pdf_url": self.pdf_url,
        }


def _issuing_body(item: dict[str, Any]) -> str:
    """
    Organ wydający.

    API podaje go w `releasedBy` jako listę. Bywa pusta — wtedy sięgamy po
    `authorizedBody`, a w ostateczności zwracamy półpauzę, żeby kolumna w tabeli
    nie była pusta bez wyjaśnienia.
    """
    for key in ("releasedBy", "authorizedBody"):
        values = [str(v).strip() for v in item.get(key) or [] if str(v).strip()]
        if values:
            return ", ".join(values)
    return "—"


def build_pdf_url(api_base: str, publisher: str, year: int, position: int) -> str:
    """Adres PDF-a w API ELI: /eli/acts/{publisher}/{year}/{pos}/text.pdf"""
    return f"{api_base.rstrip('/')}/acts/{publisher}/{year}/{position}/text.pdf"


def parse_act(item: dict[str, Any], *, api_base: str) -> LegalAct | None:
    """
    Zamiana pozycji z odpowiedzi API na model.

    Zwraca `None`, gdy brakuje pól, bez których wiersz nie ma sensu — pojedynczy
    wybrakowany rekord nie może wywrócić całego przebiegu wsadowego.
    """
    eli = str(item.get("ELI") or "").strip()
    publisher = str(item.get("publisher") or "").strip().upper()
    year = item.get("year")
    position = item.get("pos")

    if not eli or not publisher or year is None or position is None:
        return None

    texts = item.get("texts") or []
    has_pdf = bool(item.get("textPDF")) or any(
        str(t.get("fileName", "")).lower().endswith(".pdf") for t in texts
    )

    return LegalAct(
        eli=eli,
        publisher=publisher,
        year=int(year),
        position=int(position),
        display_address=str(item.get("displayAddress") or eli),
        act_type=str(item.get("type") or "—"),
        title=str(item.get("title") or "").strip(),
        issuing_body=_issuing_body(item),
        announcement_date=item.get("announcementDate"),
        promulgation_date=item.get("promulgation"),
        change_date=item.get("changeDate"),
        status=item.get("status"),
        has_pdf=has_pdf,
        pdf_url=build_pdf_url(api_base, publisher, int(year), int(position)) if has_pdf else None,
    )
