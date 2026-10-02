"""Editable calc2 documents survive the real storage and output APIs intact."""

from copy import deepcopy
import uuid

import pytest

from .test_calc_flow import SAMPLE_CALC

pytestmark = [pytest.mark.integration, pytest.mark.calc]


def editable_document():
    row = {
        "id": "row:hood:paint:coat", "name": "Authored painting", "category": "paint",
        "unit": "л", "orderingNum": 73, "estimation": 2, "price": 100, "sum": 17,
    }
    table = {"id": "table:hood:paint", "name": "Renamed table", "result": [row], "total": 42}
    return {
        **deepcopy(SAMPLE_CALC),
        "schemaVersion": 2,
        "revision": 7,
        "normRates": {"base": 100, "currency": "EUR", "additional": []},
        "cellOverrides": {
            row["id"]: {field: {"kind": "literal", "value": value} for field, value in {"name": "Authored painting", "unit": "л", "sum": 17}.items()},
            table["id"]: {"name": {"kind": "literal", "value": "Renamed table"}, "total": {"kind": "literal", "value": 42}},
            "part-total:Hood": {"total": {"kind": "literal", "value": 63}},
            "category-total:paint": {"total": {"kind": "literal", "value": 51}},
            "grand-total": {"total": {"kind": "literal", "value": 91}},
        },
        "generatedCalculations": {"Hood": [{**deepcopy(table), "result": [{**row, "sum": 200}]}]},
        "calculations": {"Hood": [table]},
        "totalTables": {"Hood": {"result": [row], "total": 63}},
        "categoryTables": {"paint": {"result": [row], "total": 51}},
        "grandTotal": 91,
        "order": {"orderNumber": "EDIT-001", "orderNotes": "Saved notes", "orderDate": "2026-10-02"},
        "sourceSnapshot": {"processorVersions": {"paint": "1"}, "tables": {"paint": [{"value": "0,3"}]}},
        "inputOverrides": {"paint:0:value": "0,4"},
        "unknownMetadata": {"preserve": [0, "", None, False]},
    }


async def test_v2_editable_document_storage_roundtrip(licensed_client, backend_health_check):
    payload = editable_document()
    payload["car"]["storeFileName"] = f"editable-{uuid.uuid4().hex}.json"
    saved = await licensed_client.post("/user/calculationstore", json=payload)
    assert saved.status_code == 200, saved.text
    filename = saved.json()["saved_file_path"]
    loaded = await licensed_client.get("/user/calculationstore", params={"filename": filename})
    assert loaded.status_code == 200, loaded.text
    assert loaded.json() == payload
    assert loaded.json()["car"]["year"] == "2020"

    payload["revision"] = 8
    payload["calculations"]["Hood"][0]["result"][0]["sum"] = 0
    payload["cellOverrides"]["row:hood:paint:coat"]["sum"]["value"] = 0
    payload["calculations"]["Hood"][0]["result"].append({
        "id": "row:manual:blank", "name": "Blank authored row", "estimation": "", "price": "", "sum": "",
    })
    updated = await licensed_client.post("/user/calculationstore", json=payload)
    assert updated.status_code == 200, updated.text
    assert updated.json()["saved_file_path"] == filename
    loaded = await licensed_client.get("/user/calculationstore", params={"filename": filename})
    assert loaded.json() == payload


@pytest.mark.pdf
@pytest.mark.usefixtures("pdfgen_mock_configured")
@pytest.mark.parametrize("format_name", ["html", "pdf"])
async def test_resolved_document_forwarded_without_repricing(
    format_name, licensed_client, pdfgen_mock, backend_health_check,
):
    document = editable_document()
    output = {
        "car": document["car"], "order": document["order"], "currency": "EUR",
        "calc": document["calculations"],
        "calc_by_category": {"Paint works": [document["categoryTables"]["paint"]]},
        "grand_total": document["grandTotal"],
    }
    identifier = f"OUTPUT-{uuid.uuid4().hex}"
    response = await licensed_client.post(f"/user/generate_{format_name}_table", json={
        "calculation": output,
        "metadata": {"order_number": identifier, "order_notes": "Saved notes"},
        "template_name": "calculation_ua.html",
    })
    assert response.status_code == 200, response.text
    calls = [r for r in pdfgen_mock.fetch_requests() if r["path"] == f"/generate/{format_name}"
             and r["body"]["metadata"]["order_number"] == identifier]
    assert len(calls) == 1
    forwarded = calls[0]["body"]
    assert forwarded["calculation"] == output
    assert "data.calculation.currency" in forwarded["custom_template_content"]
    assert "grand_total" in forwarded["custom_template_content"]


async def test_processor_bundle_has_source_identity_and_separate_version(licensed_client, backend_health_check):
    response = await licensed_client.get('/user/processors_bundle')
    assert response.status_code == 200, response.text
    assert 'processorId: "ФАРБУВАННЯ.js"' in response.text
    assert 'version: "' in response.text
    # The source filename stays independent of translated/edited processor labels.
    assert 'Object.assign((' in response.text
