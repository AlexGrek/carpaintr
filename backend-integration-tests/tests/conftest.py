"""Shared fixtures for carpaintr backend integration tests."""

import os
from typing import Dict, Iterator, Optional

import httpx
import pytest
from dotenv import load_dotenv

from .helpers import login_user, register_user
from .pdfgen_mock import PdfGenMockClient, PdfGenMockServer, resolve_mock_base_url
from .seed_users import (
    SEED_USER_COUNT,
    bootstrap_admin_credentials,
    ensure_all_seed_users_sync,
)

load_dotenv()

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080")
API_BASE_PATH = os.getenv("API_BASE_PATH", "/api/v1")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
PDF_GEN_URL = os.getenv("PDF_GEN_URL", "http://localhost:5000")

TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL", "test_user@example.com")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD", "testpassword123")
TEST_ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "test_admin@example.com")
TEST_ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "adminpassword123")


@pytest.fixture(scope="session")
def base_url() -> str:
    """Return the base URL for the backend API."""
    return f"{BACKEND_BASE_URL}{API_BASE_PATH}"


@pytest.fixture(scope="session")
def request_timeout() -> int:
    """Return the request timeout in seconds."""
    return REQUEST_TIMEOUT


@pytest.fixture
async def http_client(base_url: str, request_timeout: int) -> httpx.AsyncClient:
    """
    Create an async HTTP client for API requests.
    """
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=request_timeout,
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture
def test_user_credentials() -> Dict[str, str]:
    """Return test user credentials."""
    return {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
    }


@pytest.fixture
def test_admin_credentials() -> Dict[str, str]:
    """Return test admin credentials."""
    return {
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD,
    }


async def ensure_user_registered(
    client: httpx.AsyncClient,
    email: str,
    password: str,
    company_name: str = "Test Company",
) -> None:
    """
    Ensure a user is registered. Attempts to register, ignores if already exists.
    """
    response = await register_user(client, email, password, company_name)
    if response.status_code == 200:
        return
    if response.status_code == 409:
        token = await login_user(client, email, password)
        if token:
            return
        pytest.fail(f"User {email} exists but login failed")
    pytest.fail(f"Failed to register {email}: {response.status_code} {response.text}")


@pytest.fixture(scope="session")
def session_http_client(request_timeout: int) -> Iterator[httpx.Client]:
    """Session-scoped synchronous client for seeding and populate."""
    with httpx.Client(
        base_url=f"{BACKEND_BASE_URL}{API_BASE_PATH}",
        timeout=request_timeout,
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture(scope="session", autouse=True)
def seeded_users(
    session_http_client: httpx.Client,
    backend_health_check,
) -> list[dict]:
    """Ensure seed users ``user1@example.com`` … ``user{N}@example.com`` exist (all tests)."""
    # Bootstrap admin always licensed; seed users licensed only when newly created here.
    return ensure_all_seed_users_sync(
        client=session_http_client,
        license_on_create=True,
    )


@pytest.fixture
def bootstrap_admin() -> dict:
    """Bootstrap admin (``admin@admin.com`` / ``admin123``), ensured by ``seeded_users``."""
    return bootstrap_admin_credentials()


@pytest.fixture
def seed_user(seeded_users: list[dict]) -> dict:
    """First seed user (``user1@example.com`` / ``test1``)."""
    return seeded_users[0]


@pytest.fixture
async def seed_user_token(http_client: httpx.AsyncClient, seed_user: dict) -> str:
    """JWT for ``user1@example.com`` (seed pool is ensured before tests run)."""
    token = await login_user(http_client, seed_user["email"], seed_user["password"])
    if not token:
        pytest.fail(f"Failed to obtain token for seed user: {seed_user['email']}")
    return token


@pytest.fixture
async def seed_authenticated_client(
    base_url: str,
    request_timeout: int,
    seed_user_token: str,
) -> httpx.AsyncClient:
    """Authenticated client for ``user1@example.com``."""
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=request_timeout,
        headers={"Authorization": f"Bearer {seed_user_token}"},
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture
async def test_user_token(
    http_client: httpx.AsyncClient,
    test_user_credentials: Dict[str, str],
) -> str:
    """
    Register (if needed) and log in the test user, returning a valid JWT token.
    """
    email = test_user_credentials["email"]
    password = test_user_credentials["password"]

    # Ensure user is registered
    await ensure_user_registered(http_client, email, password, "Test User Company")

    # Log in and get token
    token = await login_user(http_client, email, password)
    if not token:
        pytest.fail(f"Failed to obtain token for test user: {email}")

    return token


@pytest.fixture
async def test_admin_token(
    http_client: httpx.AsyncClient,
    test_admin_credentials: Dict[str, str],
) -> str:
    """
    Register (if needed) and log in the test admin, returning a valid JWT token.
    Admin status is determined by admins.txt file.
    """
    email = test_admin_credentials["email"]
    password = test_admin_credentials["password"]

    # Ensure admin is registered
    await ensure_user_registered(http_client, email, password, "Test Admin Company")

    # Log in and get token
    token = await login_user(http_client, email, password)
    if not token:
        pytest.fail(f"Failed to obtain token for test admin: {email}")

    return token


@pytest.fixture
async def authenticated_client(
    base_url: str,
    request_timeout: int,
    test_user_token: str,
) -> httpx.AsyncClient:
    """
    Create an authenticated HTTP client with test user token.
    """
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=request_timeout,
        headers={"Authorization": f"Bearer {test_user_token}"},
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture
async def admin_authenticated_client(
    base_url: str,
    request_timeout: int,
    test_admin_token: str,
) -> httpx.AsyncClient:
    """
    Create an authenticated HTTP client with admin token.
    """
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=request_timeout,
        headers={"Authorization": f"Bearer {test_admin_token}"},
        follow_redirects=True,
    ) as client:
        yield client


async def generate_license_for_user(
    admin_client: httpx.AsyncClient,
    email: str,
    days: int = 365,
    level: Optional[str] = None,
) -> Optional[str]:
    """
    Helper function to generate a license for a user using admin privileges.

    Args:
        admin_client: Authenticated admin HTTP client
        email: Email of the user to generate license for
        days: Number of days until license expiry (default: 365)
        level: License level/tier (optional)

    Returns:
        Response message if successful, None otherwise.
    """
    payload = {
        "email": email,
        "days": days,
    }

    # Add level if provided
    if level is not None:
        payload["level"] = level

    response = await admin_client.post(
        "/admin/license/generate",
        json=payload,
    )

    if response.status_code == 200:
        return response.json()
    return None


@pytest.fixture
async def generate_license(admin_authenticated_client: httpx.AsyncClient):
    """
    Fixture that provides a license generation helper function.
    Uses admin authentication to generate licenses for any user.

    Example usage:
        license_msg = await generate_license("user@example.com", days=90)
    """
    async def _generate(email: str, days: int = 365, level: Optional[str] = None):
        return await generate_license_for_user(
            admin_authenticated_client, email, days, level
        )

    return _generate


@pytest.fixture
async def licensed_client(
    base_url: str,
    request_timeout: int,
    test_user_token: str,
    test_user_credentials: Dict[str, str],
    admin_authenticated_client: httpx.AsyncClient,
) -> httpx.AsyncClient:
    """
    Authenticated client with a valid 30-day license for the test user.
    License generation is idempotent — safe to call on every test.
    """
    await generate_license_for_user(
        admin_authenticated_client,
        test_user_credentials["email"],
        days=30,
    )
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=request_timeout,
        headers={"Authorization": f"Bearer {test_user_token}"},
        follow_redirects=True,
    ) as client:
        yield client


@pytest.fixture(scope="session")
def pdf_service_available() -> bool:
    """Return True if the PDF generation service is reachable."""
    try:
        response = httpx.get(f"{PDF_GEN_URL}/health", timeout=3)
        return response.status_code < 500
    except Exception:
        pass
    # Fall back to a POST probe — WeasyPrint service may not have /health
    try:
        httpx.post(f"{PDF_GEN_URL}/generate", json={}, timeout=3)
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def pdfgen_mock() -> Iterator[PdfGenMockServer | PdfGenMockClient]:
    """PDF service mock — external daemon from ``task itests`` or in-process fallback."""
    external_url = resolve_mock_base_url()
    if external_url:
        yield PdfGenMockClient(external_url)
        return

    server = PdfGenMockServer()
    server.start()
    server.wait_healthy()
    os.environ.setdefault("PDFGEN_MOCK_URL", server.base_url)
    yield server
    server.stop()


@pytest.fixture(scope="session")
def pdfgen_mock_configured() -> None:
    """Skip PDF tests when backend was not started with the mock wired in."""
    if os.environ.get("CARPAINTR_ITEST_SKIP_PDF") == "1":
        pytest.skip(
            "PDF tests skipped: backend was already running without PDF_GEN_URL_POST. "
            "Stop it and run `task itests` for full coverage."
        )


@pytest.fixture(scope="session")
def backend_health_check():
    """
    Session-scoped fixture to verify backend is running before tests start.
    """
    try:
        response = httpx.get(f"{BACKEND_BASE_URL}/api/v1/login", timeout=5)
        # We expect 405 (Method Not Allowed) or 400 (Bad Request) for GET on login endpoint
        # Any response means the server is up
        if response.status_code in (405, 400, 404, 200):
            return True
    except Exception as e:
        pytest.exit(
            f"Backend server is not running at {BACKEND_BASE_URL}. "
            f"Please start the backend before running tests. Error: {e}"
        )
