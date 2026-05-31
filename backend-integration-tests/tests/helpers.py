"""Shared helper utilities for integration tests."""

import httpx


def bearer_headers(token: str) -> dict[str, str]:
    """Authorization header dict for Bearer JWT."""
    return {"Authorization": f"Bearer {token}"}


async def register_user(
    client: httpx.AsyncClient,
    email: str,
    password: str,
    company_name: str = "Test Company",
) -> httpx.Response:
    return await client.post(
        "/register",
        json={
            "email": email,
            "password": password,
            "company_name": company_name,
        },
    )


async def login_user(
    client: httpx.AsyncClient,
    email: str,
    password: str,
) -> str | None:
    response = await client.post(
        "/login",
        json={"email": email, "password": password},
    )
    if response.status_code == 200:
        return response.json().get("token")
    return None
