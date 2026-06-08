"""
Integration tests for the full calculation flow (calc v2 path):

  data discovery  →  calculation storage  →  HTML / PDF generation

Prerequisites: backend running at localhost:8080.
For PDF tests: pdf_backend (WeasyPrint) running at localhost:5000.
"""
import pytest
import httpx

# ---------------------------------------------------------------------------
# Shared fixtures / constants
# ---------------------------------------------------------------------------

# A valid class/body-type pair that always exists in the default dataset.
VALID_CAR_CLASS = "B"
VALID_BODY_TYPE = "sedan"

# Minimal calculation payload that satisfies CarCalcData (camelCase serde).
SAMPLE_CALC = {
    "car": {
        "make": "volkswagen",
        "model": "golf",
        "year": "2020",
        "carClass": VALID_CAR_CLASS,
        "bodyType": VALID_BODY_TYPE,
        "licensePlate": "AA1234BB",
        "vin": None,
        "notes": "Integration test calculation",
        "storeFileName": None,
    },
    "calculations": {
        "total": 2300,
        "parts": [
            {"name": "Hood", "repairType": "full_repaint", "price": 1500},
            {"name": "Front bumper", "repairType": "partial_repaint", "price": 800},
        ],
    },
}

# Payload for HTML/PDF generation endpoints.
SAMPLE_GENERATE_REQUEST = {
    "calculation": SAMPLE_CALC,
    "metadata": {
        "order_number": "TEST-001",
        "order_notes": "Integration test order",
    },
}


# ---------------------------------------------------------------------------
# Data discovery tests
# ---------------------------------------------------------------------------


@pytest.mark.calc
@pytest.mark.integration
class TestCalcDataEndpoints:
    """Verify that every data-discovery endpoint returns sensible data."""

    async def test_list_car_makes(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/carmakes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected at least one car make"
        assert all(isinstance(m, str) for m in data)

    async def test_list_class_body_types(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/list_class_body_types")
        assert response.status_code == 200
        # Endpoint returns raw YAML text.
        assert len(response.text) > 0
        assert VALID_CAR_CLASS in response.text
        assert VALID_BODY_TYPE in response.text

    async def test_get_car_models_by_make(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/carmodels/volkswagen")
        assert response.status_code == 200
        data = response.json()
        # Shape: list or dict — either way it must be non-empty.
        assert data is not None
        assert len(data) > 0

    async def test_get_car_parts_t1(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get(
            f"/user/carparts/{VALID_CAR_CLASS}/{VALID_BODY_TYPE}"
        )
        assert response.status_code == 200
        parts = response.json()
        assert isinstance(parts, list)
        assert len(parts) > 0, "T1 parts list must not be empty"

    async def test_get_car_parts_t2(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get(
            f"/user/carparts_t2/{VALID_CAR_CLASS}/{VALID_BODY_TYPE}"
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_repair_types(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/list_all_repair_types")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    async def test_all_parts_t1(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/all_parts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    async def test_all_parts_t2(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get("/user/all_parts_t2")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_lookup_all_tables(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        # First get a valid part name from T1
        t1_response = await licensed_client.get(
            f"/user/carparts/{VALID_CAR_CLASS}/{VALID_BODY_TYPE}"
        )
        assert t1_response.status_code == 200
        parts = t1_response.json()
        assert len(parts) > 0

        # Use the first part's name for the lookup
        first_part = parts[0]
        # T1 parts have various field names; try common ones
        part_name = (
            first_part.get("name")
            or first_part.get("part")
            or first_part.get("detail_ukr")
            or next(iter(first_part.values()), "Hood")
        )

        response = await licensed_client.get(
            "/user/lookup_all_tables",
            params={
                "car_class": VALID_CAR_CLASS,
                "car_type": VALID_BODY_TYPE,
                "part": part_name,
            },
        )
        # 200 with data or 200/404 if part name format differs — just not 500
        assert response.status_code in (200, 404), (
            f"Unexpected status {response.status_code}: {response.text}"
        )

    async def test_data_endpoints_require_auth(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Data endpoints must reject unauthenticated requests."""
        for path in [
            "/user/carmakes",
            "/user/list_class_body_types",
            f"/user/carparts/{VALID_CAR_CLASS}/{VALID_BODY_TYPE}",
        ]:
            response = await http_client.get(path)
            assert response.status_code in (401, 403), (
                f"Expected 401/403 for unauthenticated {path}, got {response.status_code}"
            )


# ---------------------------------------------------------------------------
# Calculation storage tests
# ---------------------------------------------------------------------------


@pytest.mark.calc
@pytest.mark.integration
class TestCalculationStorage:
    """Verify save / list / retrieve lifecycle for stored calculations."""

    async def test_save_calculation(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.post(
            "/user/calculationstore",
            json=SAMPLE_CALC,
        )
        assert response.status_code == 200
        data = response.json()
        assert "saved_file_path" in data
        assert data["saved_file_path"].endswith(".json")

    async def test_list_calculations(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        # Save at least one so the list is non-empty.
        await licensed_client.post("/user/calculationstore", json=SAMPLE_CALC)

        response = await licensed_client.get("/user/calculationstore/list")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0

    async def test_retrieve_saved_calculation(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        # Save and capture the returned filename.
        save_response = await licensed_client.post(
            "/user/calculationstore",
            json=SAMPLE_CALC,
        )
        assert save_response.status_code == 200
        filename = save_response.json()["saved_file_path"]

        # Retrieve it.
        get_response = await licensed_client.get(
            "/user/calculationstore",
            params={"filename": filename},
        )
        assert get_response.status_code == 200
        assert get_response.headers["content-type"] == "application/json"
        data = get_response.json()
        assert "car" in data
        assert data["car"]["carClass"] == VALID_CAR_CLASS

    async def test_overwrite_calculation_by_filename(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Saving with an existing storeFileName should overwrite in place."""
        first_save = await licensed_client.post(
            "/user/calculationstore",
            json=SAMPLE_CALC,
        )
        assert first_save.status_code == 200
        filename = first_save.json()["saved_file_path"]

        # Save again with the same filename.
        updated_calc = {
            **SAMPLE_CALC,
            "car": {
                **SAMPLE_CALC["car"],
                "storeFileName": filename,
                "notes": "Updated notes",
            },
        }
        second_save = await licensed_client.post(
            "/user/calculationstore",
            json=updated_calc,
        )
        assert second_save.status_code == 200
        assert second_save.json()["saved_file_path"] == filename

        # Verify the updated content is persisted.
        get_response = await licensed_client.get(
            "/user/calculationstore",
            params={"filename": filename},
        )
        assert get_response.status_code == 200
        saved = get_response.json()
        assert saved["car"]["notes"] == "Updated notes"

    async def test_retrieve_nonexistent_file_returns_error(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await licensed_client.get(
            "/user/calculationstore",
            params={"filename": "this_file_does_not_exist.json"},
        )
        assert response.status_code in (404, 400, 500)

    async def test_storage_endpoints_require_auth(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        for method, path, kwargs in [
            ("post", "/user/calculationstore", {"json": SAMPLE_CALC}),
            ("get", "/user/calculationstore/list", {}),
            ("get", "/user/calculationstore", {"params": {"filename": "x.json"}}),
        ]:
            response = await getattr(http_client, method)(path, **kwargs)
            assert response.status_code in (401, 403), (
                f"Expected 401/403 for unauthenticated {method.upper()} {path}"
            )


# ---------------------------------------------------------------------------
# Document generation tests
# ---------------------------------------------------------------------------


@pytest.mark.calc
@pytest.mark.integration
class TestDocumentGeneration:
    """Verify HTML and PDF generation endpoints."""

    async def test_generate_html(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """HTML generation does not need the PDF service — it returns HTML text."""
        response = await licensed_client.post(
            "/user/generate_html_table",
            json=SAMPLE_GENERATE_REQUEST,
        )
        assert response.status_code == 200
        assert "text" in response.headers.get("content-type", "")
        assert len(response.content) > 0

    async def test_generate_html_with_calculation_from_store(
        self,
        licensed_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Save a calculation first, then generate HTML using the stored data."""
        save_resp = await licensed_client.post(
            "/user/calculationstore",
            json=SAMPLE_CALC,
        )
        assert save_resp.status_code == 200

        filename = save_resp.json()["saved_file_path"]
        get_resp = await licensed_client.get(
            "/user/calculationstore",
            params={"filename": filename},
        )
        assert get_resp.status_code == 200
        stored_calc = get_resp.json()

        gen_resp = await licensed_client.post(
            "/user/generate_html_table",
            json={
                "calculation": stored_calc,
                "metadata": {"order_number": filename, "order_notes": None},
            },
        )
        assert gen_resp.status_code == 200
        assert len(gen_resp.content) > 0

    async def test_generate_pdf(
        self,
        licensed_client: httpx.AsyncClient,
        pdf_service_available: bool,
        backend_health_check,
    ):
        """Generate a PDF — skipped when the PDF service is not running."""
        if not pdf_service_available:
            pytest.skip("PDF generation service not available at localhost:5000")

        response = await licensed_client.post(
            "/user/generate_pdf_table",
            json=SAMPLE_GENERATE_REQUEST,
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        # PDF files start with the %PDF magic bytes.
        assert response.content[:4] == b"%PDF", (
            "Response content does not look like a PDF"
        )

    async def test_generate_endpoints_require_auth(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        for path in ["/user/generate_html_table", "/user/generate_pdf_table"]:
            response = await http_client.post(path, json=SAMPLE_GENERATE_REQUEST)
            assert response.status_code in (401, 403), (
                f"Expected 401/403 for unauthenticated POST {path}"
            )
