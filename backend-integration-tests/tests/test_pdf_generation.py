"""Integration tests for calculation PDF/HTML output via the PDF mock service."""

import uuid

import httpx
import pytest

from .helpers import login_user, register_user
from .pdfgen_mock import MOCK_HTML_BODY, MOCK_PDF_BYTES


pytestmark = [
    pytest.mark.integration,
    pytest.mark.pdf,
    pytest.mark.usefixtures("pdfgen_mock_configured"),
]


MINIMAL_CALCULATION_PAYLOAD = {
    "calculation": {"identifier": "ITEST-001", "total_sum": "$0"},
    "metadata": {},
}


@pytest.fixture
async def licensed_authenticated_client(
    authenticated_client: httpx.AsyncClient,
    generate_license,
    test_user_credentials: dict[str, str],
):
    """Authenticated user with an active license."""
    await generate_license(test_user_credentials["email"], days=365, level="premium")
    return authenticated_client


class TestPdfGeneration:
    async def test_generate_pdf_table_returns_pdf(
        self,
        licensed_authenticated_client: httpx.AsyncClient,
        pdfgen_mock,
        backend_health_check,
    ):
        pdfgen_mock.reset_requests()

        response = await licensed_authenticated_client.post(
            "/user/generate_pdf_table",
            json=MINIMAL_CALCULATION_PAYLOAD,
        )

        assert response.status_code == 200, response.text
        assert response.headers.get("content-type", "").startswith("application/pdf")
        assert response.content.startswith(b"%PDF")

        requests = pdfgen_mock.fetch_requests()
        pdf_calls = [r for r in requests if r["path"] == "/generate/pdf"]
        assert len(pdf_calls) == 1
        assert pdf_calls[0]["body"]["calculation"]["identifier"] == "ITEST-001"

    async def test_generate_html_table_returns_html(
        self,
        licensed_authenticated_client: httpx.AsyncClient,
        pdfgen_mock,
        backend_health_check,
    ):
        pdfgen_mock.reset_requests()

        response = await licensed_authenticated_client.post(
            "/user/generate_html_table",
            json=MINIMAL_CALCULATION_PAYLOAD,
        )

        assert response.status_code == 200, response.text
        content_type = response.headers.get("content-type", "")
        assert "text" in content_type
        assert b"mock" in response.content.lower() or b"<" in response.content

        requests = pdfgen_mock.fetch_requests()
        html_calls = [r for r in requests if r["path"] == "/generate/html"]
        assert len(html_calls) == 1

    async def test_generate_pdf_without_license_fails(
        self,
        http_client: httpx.AsyncClient,
        base_url: str,
        request_timeout: int,
        pdfgen_mock,
        backend_health_check,
    ):
        """Use a fresh user so parallel tests cannot grant a license to the shared test user."""
        email = f"unlicensed_{uuid.uuid4().hex[:10]}@example.com"
        password = "testpassword123"
        await register_user(http_client, email, password)
        token = await login_user(http_client, email, password)
        assert token is not None

        pdfgen_mock.reset_requests()

        async with httpx.AsyncClient(
            base_url=base_url,
            timeout=request_timeout,
            headers={"Authorization": f"Bearer {token}"},
        ) as client:
            response = await client.post(
                "/user/generate_pdf_table",
                json=MINIMAL_CALCULATION_PAYLOAD,
            )

        assert response.status_code == 403, (
            f"Expected license failure (403), got {response.status_code}: {response.text}"
        )
        assert pdfgen_mock.fetch_requests() == []

    def test_mock_returns_expected_stub_bytes(self, pdfgen_mock):
        """Sanity check that the mock itself serves valid stubs."""
        import urllib.request

        pdf_req = urllib.request.Request(
            f"{pdfgen_mock.base_url}/generate/pdf",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(pdf_req) as resp:
            assert resp.read().startswith(MOCK_PDF_BYTES[:5])

        html_req = urllib.request.Request(
            f"{pdfgen_mock.base_url}/generate/html",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(html_req) as resp:
            assert resp.read() == MOCK_HTML_BODY
