from legal_acts_ingest.models import build_pdf_url, parse_act

API = "https://api.sejm.gov.pl/eli"

ITEM = {
    "ELI": "DU/2026/1308",
    "publisher": "DU",
    "year": 2026,
    "pos": 1308,
    "displayAddress": "Dz.U. 2026 poz. 1308",
    "type": "Ustawa",
    "title": "Ustawa z dnia 4 września 2026 r. o Uniwersytecie Mazowieckim w Płocku",
    "releasedBy": ["SEJM"],
    "announcementDate": "2026-09-04",
    "promulgation": "2026-10-08",
    "changeDate": "2026-10-09T09:41:52",
    "status": "akt jednorazowy",
    "textPDF": True,
    "texts": [{"fileName": "D20261308.pdf", "type": "O"}],
}


def test_parse_act_maps_display_fields():
    act = parse_act(ITEM, api_base=API)

    assert act is not None
    assert act.publisher_label == "Dz.U."
    assert act.position == 1308
    assert act.issuing_body == "SEJM"
    assert act.title.startswith("Ustawa z dnia")
    assert act.pdf_url == f"{API}/acts/DU/2026/1308/text.pdf"


def test_monitor_polski_gets_its_own_label():
    act = parse_act({**ITEM, "publisher": "MP", "ELI": "MP/2026/984"}, api_base=API)

    assert act is not None
    assert act.publisher_label == "M.P."


def test_issuing_body_falls_back_to_authorized_body():
    act = parse_act(
        {**ITEM, "releasedBy": [], "authorizedBody": ["MIN. FINANSÓW"]},
        api_base=API,
    )

    assert act is not None
    assert act.issuing_body == "MIN. FINANSÓW"


def test_issuing_body_never_empty():
    act = parse_act({**ITEM, "releasedBy": [], "authorizedBody": []}, api_base=API)

    assert act is not None
    assert act.issuing_body == "—"


def test_act_without_pdf_has_no_url():
    act = parse_act({**ITEM, "textPDF": False, "texts": []}, api_base=API)

    assert act is not None
    assert act.has_pdf is False
    assert act.pdf_url is None


def test_incomplete_item_is_skipped_not_fatal():
    assert parse_act({"title": "bez ELI"}, api_base=API) is None
    assert parse_act({**ITEM, "pos": None}, api_base=API) is None


def test_row_keys_match_table_columns():
    act = parse_act(ITEM, api_base=API)

    assert act is not None
    assert set(act.to_row()) == {
        "eli", "publisher", "year", "position", "display_address",
        "act_type", "title", "issuing_body", "announcement_date",
        "promulgation_date", "change_date", "status", "has_pdf", "pdf_url",
    }


def test_pdf_url_shape():
    assert build_pdf_url(API, "MP", 2026, 984) == f"{API}/acts/MP/2026/984/text.pdf"
