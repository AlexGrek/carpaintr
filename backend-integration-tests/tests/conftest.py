"""
Pytest fixtures for backend integration tests.
"""
import os
from typing import Dict, Optional
import pytest
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080")
API_BASE_PATH = os.getenv("API_BASE_PATH", "/api/v1")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))

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


async def register_user(
    client: httpx.AsyncClient,
    email: str,
    password: str,
    company_name: str = "Test Company",
) -> Optional[Dict]:
    """
    Helper function to register a new user.
    Returns the response JSON if successful, None otherwise.
    """
    response = await client.post(
        "/register",
        json={
            "email": email,
            "password": password,
            "company_name": company_name,
        },
    )
    if response.status_code in (200, 201):
        return response.json()
    return None


async def login_user(
    client: httpx.AsyncClient,
    email: str,
    password: str,
) -> Optional[str]:
    """
    Helper function to log in a user.
    Returns the JWT token if successful, None otherwise.
    """
    response = await client.post(
        "/login",
        json={
            "email": email,
            "password": password,
        },
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    return None


async def ensure_user_registered(
    client: httpx.AsyncClient,
    email: str,
    password: str,
    company_name: str = "Test Company",
) -> None:
    """
    Ensure a user is registered. Attempts to register, ignores if already exists.
    """
    await register_user(client, email, password, company_name)


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
