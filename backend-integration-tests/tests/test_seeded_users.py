"""Tests for the seed user pool (user1@example.com … user30@example.com)."""

import httpx
import pytest

from .helpers import login_user
from .seed_users import (
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
    SEED_USER_COUNT,
    seed_credentials,
)


pytestmark = [pytest.mark.integration, pytest.mark.auth]


class TestSeededUsers:
    async def test_bootstrap_admin_can_login(
        self,
        http_client: httpx.AsyncClient,
        bootstrap_admin: dict,
        backend_health_check,
    ):
        token = await login_user(
            http_client,
            bootstrap_admin["email"],
            bootstrap_admin["password"],
        )
        assert token is not None
        assert bootstrap_admin["email"] == BOOTSTRAP_ADMIN_EMAIL
        assert bootstrap_admin["password"] == BOOTSTRAP_ADMIN_PASSWORD

    async def test_bootstrap_admin_has_active_license_after_seed(
        self,
        http_client: httpx.AsyncClient,
        bootstrap_admin: dict,
        backend_health_check,
    ):
        token = await login_user(
            http_client,
            bootstrap_admin["email"],
            bootstrap_admin["password"],
        )
        response = await http_client.get(
            "/getactivelicense",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data.get("has_active_license") is True, data

    def test_seed_pool_has_expected_size(self, seeded_users: list[dict]):
        assert len(seeded_users) == SEED_USER_COUNT
        assert seeded_users[0]["email"] == "user1@example.com"
        assert seeded_users[-1]["email"] == f"user{SEED_USER_COUNT}@example.com"

    @pytest.mark.parametrize("number", [1, 15, 30])
    async def test_seeded_user_can_login(
        self,
        http_client: httpx.AsyncClient,
        seeded_users: list[dict],
        number: int,
        backend_health_check,
    ):
        user = seeded_users[number - 1]
        token = await login_user(http_client, user["email"], user["password"])
        assert token is not None

    async def test_ensure_seed_user_is_idempotent(
        self,
        session_http_client: httpx.Client,
        backend_health_check,
    ):
        from .seed_users import ensure_seed_user_sync

        spec = seed_credentials(7)
        first = ensure_seed_user_sync(session_http_client, spec)
        second = ensure_seed_user_sync(session_http_client, spec)
        assert first["email"] == second["email"] == "user7@example.com"
        assert second.get("created") is False
