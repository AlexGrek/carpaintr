"""Seed user pool for integration tests and ``task populate``.

Bootstrap admin: ``admin@admin.com`` / ``admin123`` (must be listed in ``admins.txt``).
Seed users: ``user1@example.com`` … ``user30@example.com`` with passwords ``test1`` … ``test30``.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

SEED_USER_COUNT = 30
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080")
API_BASE_PATH = os.getenv("API_BASE_PATH", "/api/v1")

BOOTSTRAP_ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@admin.com")
BOOTSTRAP_ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "admin123")
SEED_LICENSE_DAYS = int(os.getenv("SEED_LICENSE_DAYS", "365"))
SEED_LICENSE_LEVEL = os.getenv("SEED_LICENSE_LEVEL", "premium")


def api_base_url() -> str:
    return f"{BACKEND_BASE_URL.rstrip('/')}{API_BASE_PATH}"


def bootstrap_admin_credentials() -> dict[str, str]:
    return {
        "email": BOOTSTRAP_ADMIN_EMAIL,
        "password": BOOTSTRAP_ADMIN_PASSWORD,
    }


def seed_credentials(number: int) -> dict[str, Any]:
    if number < 1 or number > SEED_USER_COUNT:
        raise ValueError(f"seed user number must be 1..{SEED_USER_COUNT}, got {number}")
    return {
        "number": number,
        "email": f"user{number}@example.com",
        "password": f"test{number}",
        "company_name": f"Seed Company {number}",
    }


def seed_users_spec(count: int = SEED_USER_COUNT) -> list[dict[str, Any]]:
    return [seed_credentials(n) for n in range(1, count + 1)]


def _login_sync(client: httpx.Client, email: str, password: str) -> str:
    response = client.post("/login", json={"email": email, "password": password})
    if response.status_code != 200:
        raise RuntimeError(
            f"Login failed for {email}: {response.status_code} {response.text}"
        )
    token = response.json().get("token")
    if not token:
        raise RuntimeError(f"Login for {email} returned no token")
    return token


def ensure_bootstrap_admin_sync(client: httpx.Client) -> dict[str, Any]:
    """Register the bootstrap admin via public register, or verify login if it exists."""
    admin = bootstrap_admin_credentials()
    response = client.post(
        "/register",
        json={"email": admin["email"], "password": admin["password"]},
    )
    if response.status_code == 200:
        return {**admin, "created": True}

    if response.status_code == 409:
        _login_sync(client, admin["email"], admin["password"])
        return {**admin, "created": False}

    raise RuntimeError(
        f"Failed to seed bootstrap admin {admin['email']}: "
        f"{response.status_code} {response.text}"
    )


def bulk_create_users_sync(
    client: httpx.Client,
    admin_token: str,
    users: list[dict[str, Any]],
) -> dict[str, list[str]]:
    """Create users in one admin request. Returns API ``created`` / ``skipped`` lists."""
    if not users:
        return {"created": [], "skipped": []}

    response = client.post(
        "/admin/users/bulk",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "users": [
                {"email": user["email"], "password": user["password"]} for user in users
            ],
        },
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"Bulk user create failed: {response.status_code} {response.text}"
        )
    data = response.json()
    return {
        "created": list(data.get("created", [])),
        "skipped": list(data.get("skipped", [])),
    }


def generate_licenses_for_users_sync(
    client: httpx.Client,
    admin_token: str,
    users: list[dict[str, Any]],
    *,
    days: int = SEED_LICENSE_DAYS,
    level: str | None = SEED_LICENSE_LEVEL,
) -> list[dict[str, str]]:
    """Issue a license for each email via ``POST /admin/license/generate``."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    issued: list[dict[str, str]] = []

    for user in users:
        email = user["email"]
        payload: dict[str, Any] = {"email": email, "days": days}
        if level is not None:
            payload["level"] = level

        response = client.post(
            "/admin/license/generate",
            headers=headers,
            json=payload,
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"License generation failed for {email}: "
                f"{response.status_code} {response.text}"
            )
        issued.append({"email": email, "message": response.json()})

    return issued


async def generate_licenses_for_users_async(
    client: httpx.AsyncClient,
    admin_token: str,
    users: list[dict[str, Any]],
    *,
    days: int = SEED_LICENSE_DAYS,
    level: str | None = SEED_LICENSE_LEVEL,
) -> list[dict[str, str]]:
    """Async variant of ``generate_licenses_for_users_sync``."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    issued: list[dict[str, str]] = []

    for user in users:
        email = user["email"]
        payload: dict[str, Any] = {"email": email, "days": days}
        if level is not None:
            payload["level"] = level

        response = await client.post(
            "/admin/license/generate",
            headers=headers,
            json=payload,
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"License generation failed for {email}: "
                f"{response.status_code} {response.text}"
            )
        issued.append({"email": email, "message": response.json()})

    return issued


def ensure_all_seed_users_sync(
    count: int = SEED_USER_COUNT,
    *,
    base_url: str | None = None,
    timeout: float = 120.0,
    client: httpx.Client | None = None,
    license_on_create: bool = True,
) -> list[dict[str, Any]]:
    """Ensure bootstrap admin + seed users exist (fast path: one bulk admin call).

    When ``license_on_create`` is true (default), issues a license for the
    bootstrap admin and for seed users newly created in this run — existing
    seed users are left unchanged.
    """
    users = seed_users_spec(count)

    def run(owned: httpx.Client) -> list[dict[str, Any]]:
        admin_result = ensure_bootstrap_admin_sync(owned)
        admin = bootstrap_admin_credentials()
        token = _login_sync(owned, admin["email"], admin["password"])
        bulk = bulk_create_users_sync(owned, token, users)

        created_set = set(bulk["created"])
        skipped_set = set(bulk["skipped"])
        newly_created = [user for user in users if user["email"] in created_set]

        if license_on_create:
            to_license: list[dict[str, Any]] = [admin_result]
            if newly_created:
                to_license.extend(newly_created)
            generate_licenses_for_users_sync(owned, token, to_license)
            admin_result["licensed"] = True

        results: list[dict[str, Any]] = []
        for user in users:
            email = user["email"]
            if email in created_set:
                results.append(
                    {
                        **user,
                        "created": True,
                        "licensed": license_on_create,
                    }
                )
            elif email in skipped_set:
                results.append({**user, "created": False, "licensed": False})
            else:
                raise RuntimeError(
                    f"Seed user {email} missing from bulk create response: {bulk}"
                )

        return results

    if client is not None:
        return run(client)

    url = base_url or api_base_url()
    with httpx.Client(base_url=url, timeout=timeout, follow_redirects=True) as owned:
        return run(owned)


def ensure_seed_licenses_sync(
    count: int = SEED_USER_COUNT,
    *,
    base_url: str | None = None,
    timeout: float = 120.0,
    client: httpx.Client | None = None,
    days: int = SEED_LICENSE_DAYS,
    level: str | None = SEED_LICENSE_LEVEL,
) -> list[dict[str, str]]:
    """Generate licenses for bootstrap admin and existing seed users (admin login required)."""
    users = seed_users_spec(count)
    admin = bootstrap_admin_credentials()

    def run(owned: httpx.Client) -> list[dict[str, str]]:
        ensure_bootstrap_admin_sync(owned)
        token = _login_sync(owned, admin["email"], admin["password"])
        targets = [{"email": admin["email"]}, *users]
        return generate_licenses_for_users_sync(
            owned, token, targets, days=days, level=level
        )

    if client is not None:
        return run(client)

    url = base_url or api_base_url()
    with httpx.Client(base_url=url, timeout=timeout, follow_redirects=True) as owned:
        return run(owned)


# --- Legacy per-user helpers (single-user tests) ---


def ensure_seed_user_sync(client: httpx.Client, user: dict[str, Any]) -> dict[str, Any]:
    """Register one user via public register (for idempotency tests)."""
    response = client.post(
        "/register",
        json={"email": user["email"], "password": user["password"]},
    )
    if response.status_code == 200:
        return {**user, "created": True}

    if response.status_code == 409:
        _login_sync(client, user["email"], user["password"])
        return {**user, "created": False}

    raise RuntimeError(
        f"Failed to seed {user['email']}: {response.status_code} {response.text}"
    )


async def ensure_seed_user_async(
    client: httpx.AsyncClient,
    user: dict[str, Any],
) -> dict[str, Any]:
    """Async single-user register (legacy)."""
    response = await client.post(
        "/register",
        json={"email": user["email"], "password": user["password"]},
    )
    if response.status_code == 200:
        return {**user, "created": True}

    if response.status_code == 409:
        login = await client.post(
            "/login",
            json={"email": user["email"], "password": user["password"]},
        )
        if login.status_code != 200:
            raise RuntimeError(
                f"Seed user {user['email']} exists but login failed: {login.status_code} {login.text}"
            )
        return {**user, "created": False, "token": login.json().get("token")}

    raise RuntimeError(
        f"Failed to seed {user['email']}: {response.status_code} {response.text}"
    )


async def ensure_all_seed_users_async(
    client: httpx.AsyncClient,
    count: int = SEED_USER_COUNT,
) -> list[dict[str, Any]]:
    """Async path: bootstrap admin + bulk create."""
    admin = bootstrap_admin_credentials()
    reg = await client.post(
        "/register",
        json={"email": admin["email"], "password": admin["password"]},
    )
    if reg.status_code not in (200, 409):
        raise RuntimeError(f"Bootstrap admin failed: {reg.status_code} {reg.text}")

    login = await client.post(
        "/login",
        json={"email": admin["email"], "password": admin["password"]},
    )
    if login.status_code != 200:
        raise RuntimeError(f"Bootstrap admin login failed: {login.text}")
    token = login.json()["token"]

    users = seed_users_spec(count)
    response = await client.post(
        "/admin/users/bulk",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "users": [
                {"email": u["email"], "password": u["password"]} for u in users
            ],
        },
    )
    if response.status_code != 200:
        raise RuntimeError(f"Bulk create failed: {response.status_code} {response.text}")

    data = response.json()
    created_set = set(data.get("created", []))
    skipped_set = set(data.get("skipped", []))
    newly_created = [user for user in users if user["email"] in created_set]
    if newly_created:
        await generate_licenses_for_users_async(client, token, newly_created)
    await generate_licenses_for_users_async(
        client, token, [{"email": admin["email"]}]
    )

    return [
        {
            **user,
            "created": user["email"] in created_set,
        }
        for user in users
        if user["email"] in created_set or user["email"] in skipped_set
    ]
