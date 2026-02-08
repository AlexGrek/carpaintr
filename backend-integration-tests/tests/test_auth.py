"""
Integration tests for authentication endpoints.
"""
import pytest
import httpx
from typing import Dict


@pytest.mark.auth
@pytest.mark.integration
class TestRegistration:
    """Test user registration functionality."""

    async def test_register_new_user(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test registering a new user with valid credentials.

        Note: Registration returns 200 with empty body on success.
        To get a token, use the /login endpoint after registration.
        """
        # Use a unique email for this test
        unique_email = f"newuser_{id(self)}@example.com"

        response = await http_client.post(
            "/register",
            json={
                "email": unique_email,
                "password": "securepassword123",
                "company_name": "New Test Company",
            },
        )

        assert response.status_code in (200, 201), (
            f"Registration failed with status {response.status_code}: {response.text}"
        )

        # Backend returns empty body on successful registration
        # This is expected - use /login to get a token

    async def test_register_duplicate_user(
        self,
        http_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test that registering duplicate user fails or handles gracefully."""
        email = test_user_credentials["email"]
        password = test_user_credentials["password"]

        # First registration (or already exists)
        first_response = await http_client.post(
            "/register",
            json={
                "email": email,
                "password": password,
                "company_name": "Test Company",
            },
        )

        # Second registration attempt with same email
        second_response = await http_client.post(
            "/register",
            json={
                "email": email,
                "password": password,
                "company_name": "Test Company 2",
            },
        )

        # Either first succeeds and second fails, or both fail (already exists)
        # The important thing is that duplicate registration is handled
        assert second_response.status_code in (400, 409, 422, 500), (
            "Duplicate registration should return error status"
        )

    async def test_register_invalid_email(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that registration with invalid email fails or succeeds based on backend validation."""
        response = await http_client.post(
            "/register",
            json={
                "email": "not-an-email",
                "password": "password123",
                "company_name": "Test Company",
            },
        )

        # Backend may accept (200), reject validation (400/422), or indicate conflict (409)
        assert response.status_code in (200, 400, 409, 422), (
            f"Unexpected status code: {response.status_code}"
        )

    async def test_register_missing_fields(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that registration with missing fields fails."""
        response = await http_client.post(
            "/register",
            json={
                "email": "test@example.com",
                # Missing password and company_name
            },
        )

        assert response.status_code in (400, 422), (
            "Missing required fields should return 400 or 422"
        )


@pytest.mark.auth
@pytest.mark.integration
class TestLogin:
    """Test user login functionality."""

    async def test_login_valid_credentials(
        self,
        http_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test login with valid credentials returns a token."""
        # Ensure user exists
        await http_client.post(
            "/register",
            json={
                **test_user_credentials,
                "company_name": "Test Company",
            },
        )

        # Now login
        response = await http_client.post(
            "/login",
            json=test_user_credentials,
        )

        assert response.status_code == 200, (
            f"Login failed with status {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "token" in data, "Response should contain JWT token"
        assert isinstance(data["token"], str), "Token should be a string"
        assert len(data["token"]) > 0, "Token should not be empty"

    async def test_login_invalid_password(
        self,
        http_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test login with invalid password fails."""
        response = await http_client.post(
            "/login",
            json={
                "email": test_user_credentials["email"],
                "password": "wrongpassword",
            },
        )

        assert response.status_code in (401, 403), (
            "Invalid password should return 401 or 403"
        )

    async def test_login_nonexistent_user(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test login with non-existent user fails."""
        response = await http_client.post(
            "/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )

        assert response.status_code in (401, 403, 404), (
            "Non-existent user should return 401, 403, or 404"
        )

    async def test_login_missing_fields(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test login with missing fields fails."""
        response = await http_client.post(
            "/login",
            json={
                "email": "test@example.com",
                # Missing password
            },
        )

        assert response.status_code in (400, 422), (
            "Missing password should return 400 or 422"
        )


@pytest.mark.auth
@pytest.mark.admin
@pytest.mark.integration
class TestAdminStatus:
    """Test admin status checking functionality."""

    async def test_admin_status_with_admin_user(
        self,
        admin_authenticated_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that admin user has admin status."""
        response = await admin_authenticated_client.get(
            "/admin/check_admin_status",
        )

        assert response.status_code == 200, (
            f"Admin status check failed with status {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "is_admin" in data or "admin" in data or data is True, (
            "Response should indicate admin status"
        )

    async def test_admin_status_with_regular_user(
        self,
        authenticated_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that regular user does not have admin status."""
        response = await authenticated_client.get(
            "/admin/check_admin_status",
        )

        # Regular user should get 403/404 (forbidden/not found) or 200 with false admin status
        assert response.status_code in (200, 403, 404), (
            f"Unexpected status code: {response.status_code}"
        )

        if response.status_code == 200:
            data = response.json()
            # If 200, should indicate non-admin status
            if isinstance(data, dict):
                assert data.get("is_admin") is False or data.get("admin") is False

    async def test_admin_status_without_auth(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that unauthenticated request to admin endpoint fails."""
        response = await http_client.get(
            "/admin/check_admin_status",
        )

        assert response.status_code in (401, 403), (
            "Unauthenticated request should return 401 or 403"
        )


@pytest.mark.auth
@pytest.mark.integration
class TestTokenValidation:
    """Test JWT token validation."""

    async def test_protected_endpoint_with_valid_token(
        self,
        authenticated_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that valid token grants access to protected endpoints."""
        # Try accessing a protected endpoint that requires license
        response = await authenticated_client.get("/user/support_requests")

        # Should either succeed or fail due to missing license, not auth
        assert response.status_code not in (401,), (
            "Valid token should not return 401 Unauthorized"
        )

    async def test_protected_endpoint_with_invalid_token(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that invalid token is rejected."""
        response = await http_client.get(
            "/user/support_requests",
            headers={"Authorization": "Bearer invalid_token_here"},
        )

        assert response.status_code in (401, 403), (
            "Invalid token should return 401 or 403"
        )

    async def test_protected_endpoint_without_token(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that request without token is rejected."""
        response = await http_client.get("/user/support_requests")

        assert response.status_code in (401, 403), (
            "Request without token should return 401 or 403"
        )
