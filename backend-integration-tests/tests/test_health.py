"""Tests for GET /api/v1/health."""

import httpx
import pytest


@pytest.mark.integration
class TestHealth:
    async def test_returns_200(
        self,
        http_client: httpx.AsyncClient,
        backend_health_check,
    ):
        response = await http_client.get("/health")
        assert response.status_code == 200
