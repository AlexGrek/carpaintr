"""
Integration tests for license management endpoints.
"""
import pytest
import httpx
from typing import Dict


@pytest.mark.license
@pytest.mark.admin
@pytest.mark.integration
class TestLicenseGeneration:
    """Test license generation functionality (admin-only)."""

    async def test_generate_license_by_days(
        self,
        admin_authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test generating a license for a user by number of days."""
        user_email = test_user_credentials["email"]

        response = await admin_authenticated_client.post(
            "/admin/license/generate",
            json={
                "email": user_email,
                "days": 365,
                "level": "premium",
            },
        )

        assert response.status_code == 200, (
            f"License generation failed with status {response.status_code}: {response.text}"
        )

        # Response should be a confirmation message
        result = response.json()
        assert isinstance(result, str), "Response should be a string message"
        assert user_email in result, "Response should mention the user email"
        assert "generated" in result.lower(), "Response should confirm license was generated"

    async def test_generate_license_by_days_without_level(
        self,
        admin_authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test generating a license without specifying level (level is optional)."""
        user_email = test_user_credentials["email"]

        response = await admin_authenticated_client.post(
            "/admin/license/generate",
            json={
                "email": user_email,
                "days": 90,
            },
        )

        assert response.status_code == 200, (
            f"License generation failed with status {response.status_code}: {response.text}"
        )

        result = response.json()
        assert isinstance(result, str)
        assert user_email in result

    async def test_generate_license_for_admin(
        self,
        admin_authenticated_client: httpx.AsyncClient,
        test_admin_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test generating a license for the admin user themselves."""
        admin_email = test_admin_credentials["email"]

        response = await admin_authenticated_client.post(
            "/admin/license/generate",
            json={
                "email": admin_email,
                "days": 730,  # 2 years
                "level": "enterprise",
            },
        )

        assert response.status_code == 200, (
            f"License generation for admin failed with status {response.status_code}: {response.text}"
        )

        result = response.json()
        assert admin_email in result

    async def test_generate_license_without_admin_auth(
        self,
        authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test that regular users cannot generate licenses."""
        response = await authenticated_client.post(
            "/admin/license/generate",
            json={
                "email": test_user_credentials["email"],
                "days": 365,
            },
        )

        # Regular user should be denied access to admin endpoint
        assert response.status_code in (403, 404), (
            f"Non-admin should not be able to generate licenses. Got: {response.status_code}"
        )

    async def test_generate_license_without_auth(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that unauthenticated requests cannot generate licenses."""
        response = await http_client.post(
            "/admin/license/generate",
            json={
                "email": "someone@example.com",
                "days": 365,
            },
        )

        assert response.status_code in (401, 403), (
            "Unauthenticated request should return 401 or 403"
        )

    async def test_generate_license_with_fixture(
        self,
        generate_license,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test using the generate_license fixture helper."""
        user_email = test_user_credentials["email"]

        result = await generate_license(user_email, days=180, level="standard")

        assert result is not None, "License generation should succeed"
        assert user_email in result, "Result should mention the user email"

    async def test_generate_multiple_licenses(
        self,
        generate_license,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test generating multiple licenses for the same user."""
        user_email = test_user_credentials["email"]

        # Generate first license
        result1 = await generate_license(user_email, days=30)
        assert result1 is not None

        # Generate second license (should overwrite or create new file)
        result2 = await generate_license(user_email, days=60, level="pro")
        assert result2 is not None
        assert user_email in result2


@pytest.mark.license
@pytest.mark.admin
@pytest.mark.integration
class TestLicenseInvalidation:
    """Test license cache invalidation functionality."""

    async def test_invalidate_license_cache(
        self,
        admin_authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        generate_license,
        backend_health_check,
    ):
        """Test invalidating license cache for a user."""
        user_email = test_user_credentials["email"]

        # First generate a license
        await generate_license(user_email, days=365)

        # Now invalidate the cache
        response = await admin_authenticated_client.post(
            f"/admin/license/invalidate/{user_email}"
        )

        assert response.status_code == 200, (
            f"Cache invalidation failed with status {response.status_code}: {response.text}"
        )

        result = response.json()
        assert "invalidated" in str(result).lower(), (
            "Response should confirm cache was invalidated"
        )

    async def test_invalidate_cache_without_admin(
        self,
        authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        backend_health_check,
    ):
        """Test that regular users cannot invalidate license cache."""
        response = await authenticated_client.post(
            f"/admin/license/invalidate/{test_user_credentials['email']}"
        )

        assert response.status_code in (403, 404), (
            "Non-admin should not be able to invalidate cache"
        )
