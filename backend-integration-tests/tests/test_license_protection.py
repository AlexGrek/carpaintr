"""
Integration tests for license-protected routes.

Tests verify that:
1. Routes protected by license middleware work with active licenses
2. Routes protected by license middleware return 403 with expired/missing licenses
3. Routes that require auth but NOT license still work without active license
"""
import asyncio
import pytest
import httpx
from typing import Dict
import time


@pytest.mark.license
@pytest.mark.integration
class TestLicenseProtectedRoutes:
    """Test that license-protected /user/* routes enforce active license."""

    async def test_protected_route_with_active_license(
        self,
        authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        generate_license,
        backend_health_check,
    ):
        """Test that /user/* routes work when user has an active license."""
        user_email = test_user_credentials["email"]

        # Generate a 90-day license for the test user
        result = await generate_license(user_email, days=90, level="premium")
        assert result is not None, "License generation should succeed"

        # Give the server a moment to process the license
        await asyncio.sleep(0.5)

        # Now try accessing a license-protected endpoint
        response = await authenticated_client.get("/user/get_calc_details")

        assert response.status_code == 200, (
            f"Protected route should be accessible with active license. "
            f"Got: {response.status_code}, {response.text}"
        )

    async def test_protected_route_without_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that /user/* routes return 403 for users without a license."""
        # Create a new user who won't have a license
        new_user_email = f"nolicense_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register the new user
        register_response = await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Test Company",
            },
        )
        assert register_response.status_code in (200, 201), "Registration should succeed"

        # Log in to get a token
        login_response = await http_client.post(
            "/login",
            json={
                "email": new_user_email,
                "password": new_user_password,
            },
        )
        assert login_response.status_code == 200, "Login should succeed"
        token = login_response.json().get("token")
        assert token is not None, "Should receive a token"

        # Try accessing a protected endpoint without a license
        response = await http_client.get(
            "/user/get_calc_details",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403, (
            f"Protected route should return 403 without license. "
            f"Got: {response.status_code}, {response.text}"
        )

    async def test_multiple_protected_routes_with_license(
        self,
        authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        generate_license,
        backend_health_check,
    ):
        """Test that multiple /user/* routes work with active license."""
        user_email = test_user_credentials["email"]

        # Generate a license
        await generate_license(user_email, days=365)

        # Give the server a moment to process the license
        await asyncio.sleep(0.5)

        # Test multiple protected endpoints
        endpoints = [
            "/user/get_calc_details",
            "/user/calculationstore/list",
            "/user/carmakes",
            "/user/list_class_body_types",
        ]

        for endpoint in endpoints:
            response = await authenticated_client.get(endpoint)
            assert response.status_code == 200, (
                f"Endpoint {endpoint} should be accessible with active license. "
                f"Got: {response.status_code}"
            )

    async def test_multiple_protected_routes_without_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that multiple /user/* routes return 403 without license."""
        # Create a new user without a license
        new_user_email = f"nolicense2_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register and log in
        await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Test Company",
            },
        )

        login_response = await http_client.post(
            "/login",
            json={"email": new_user_email, "password": new_user_password},
        )
        token = login_response.json().get("token")

        # Test multiple protected endpoints should all return 403
        endpoints = [
            "/user/get_calc_details",
            "/user/calculationstore/list",
            "/user/carmakes",
            "/user/list_class_body_types",
        ]

        for endpoint in endpoints:
            response = await http_client.get(
                endpoint,
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 403, (
                f"Endpoint {endpoint} should return 403 without license. "
                f"Got: {response.status_code}"
            )


@pytest.mark.license
@pytest.mark.integration
class TestNonLicenseProtectedRoutes:
    """Test routes that require auth but NOT an active license."""

    async def test_get_active_license_without_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that /getactivelicense works even without an active license."""
        # Create a new user without a license
        new_user_email = f"checklic_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register and log in
        await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Test Company",
            },
        )

        login_response = await http_client.post(
            "/login",
            json={"email": new_user_email, "password": new_user_password},
        )
        token = login_response.json().get("token")

        # This endpoint should work even without a license
        response = await http_client.get(
            "/getactivelicense",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200, (
            f"/getactivelicense should work without license. "
            f"Got: {response.status_code}, {response.text}"
        )

        data = response.json()
        assert "has_active_license" in data, "Response should include has_active_license field"
        assert data["has_active_license"] is False, "Should indicate no active license"
        assert data.get("license") is None, "License should be None"

    async def test_get_active_license_with_license(
        self,
        authenticated_client: httpx.AsyncClient,
        test_user_credentials: Dict[str, str],
        generate_license,
        backend_health_check,
    ):
        """Test that /getactivelicense returns true with an active license."""
        user_email = test_user_credentials["email"]

        # Generate a license
        await generate_license(user_email, days=180, level="standard")

        # Give the server a moment to process
        await asyncio.sleep(0.5)

        response = await authenticated_client.get("/getactivelicense")

        assert response.status_code == 200, (
            f"/getactivelicense should work. Got: {response.status_code}"
        )

        data = response.json()
        assert data["has_active_license"] is True, "Should indicate active license"
        assert data.get("license") is not None, "License data should be present"

    async def test_get_company_info_without_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that /getcompanyinfo works without an active license."""
        # Create a new user without a license
        new_user_email = f"companyinfo_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register and log in
        await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Test Company",
            },
        )

        login_response = await http_client.post(
            "/login",
            json={"email": new_user_email, "password": new_user_password},
        )
        token = login_response.json().get("token")

        # This endpoint should work even without a license
        response = await http_client.get(
            "/getcompanyinfo",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200, (
            f"/getcompanyinfo should work without license. "
            f"Got: {response.status_code}, {response.text}"
        )

        data = response.json()
        assert "email" in data, "Response should include email"
        assert "company_name" in data, "Response should include company_name"

    async def test_update_company_info_without_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that /updatecompanyinfo works without an active license."""
        # Create a new user without a license
        new_user_email = f"updatecompany_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register and log in
        await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Original Company",
            },
        )

        login_response = await http_client.post(
            "/login",
            json={"email": new_user_email, "password": new_user_password},
        )
        token = login_response.json().get("token")

        # Get current company info
        get_response = await http_client.get(
            "/getcompanyinfo",
            headers={"Authorization": f"Bearer {token}"},
        )
        company_info = get_response.json()

        # Update company name
        company_info["company_name"] = "Updated Company Name"

        # This endpoint should work even without a license
        response = await http_client.post(
            "/updatecompanyinfo",
            headers={"Authorization": f"Bearer {token}"},
            json=company_info,
        )

        assert response.status_code == 200, (
            f"/updatecompanyinfo should work without license. "
            f"Got: {response.status_code}, {response.text}"
        )

        data = response.json()
        assert data["company_name"] == "Updated Company Name", (
            "Company name should be updated"
        )

    async def test_list_licenses_without_active_license(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        """Test that /mylicenses works even without an active license."""
        # Create a new user without a license
        new_user_email = f"listlicenses_{int(time.time())}@example.com"
        new_user_password = "testpassword123"

        # Register and log in
        await http_client.post(
            "/register",
            json={
                "email": new_user_email,
                "password": new_user_password,
                "company_name": "Test Company",
            },
        )

        login_response = await http_client.post(
            "/login",
            json={"email": new_user_email, "password": new_user_password},
        )
        token = login_response.json().get("token")

        # This endpoint should work even without a license
        response = await http_client.get(
            "/mylicenses",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200, (
            f"/mylicenses should work without license. "
            f"Got: {response.status_code}, {response.text}"
        )

        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # User has no licenses, so list should be empty
        assert len(data) == 0, "New user should have no licenses"
