"""
Load test workload loops: registration, login, protected requests, seeding, license generation.
"""

import asyncio
import random
import time

import aiohttp

from endpoints import ALL_ENDPOINTS
from utils import ResultCollector, random_email, random_password, timed_request


async def registration_loop(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    duration: float,
    delay: float,
) -> None:
    """Continuously register new users until deadline."""
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        email = random_email()
        pwd = random_password()
        await timed_request(
            session, "POST", f"{base}/register", collector, "register",
            json={"email": email, "password": pwd, "company_name": "LoadTest Corp"},
        )
        await asyncio.sleep(delay)


async def login_loop(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    duration: float,
    delay: float,
    credentials: list[dict],
) -> None:
    """Continuously login with previously created users until deadline."""
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        if not credentials:
            await asyncio.sleep(0.5)
            continue
        cred = random.choice(credentials)
        await timed_request(
            session, "POST", f"{base}/login", collector, "login",
            json={"email": cred["email"], "password": cred["password"]},
        )
        await asyncio.sleep(delay)


async def protected_requests_loop(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    duration: float,
    delay: float,
    tokens: list[str],
) -> None:
    """Hit license-protected and auth-protected endpoints until deadline."""
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        if not tokens:
            await asyncio.sleep(0.5)
            continue
        token = random.choice(tokens)
        method, path, label = random.choice(ALL_ENDPOINTS)
        await timed_request(
            session, method, f"{base}{path}", collector, label,
            headers={"Authorization": f"Bearer {token}"},
        )
        await asyncio.sleep(delay)


async def register_and_collect_creds(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    credentials: list[dict],
    tokens: list[str],
    count: int,
) -> None:
    """Pre-register users, login, and collect their tokens into credentials and tokens lists."""
    for _ in range(count):
        email = random_email()
        pwd = random_password()
        status, _ = await timed_request(
            session, "POST", f"{base}/register", collector, "register (seed)",
            json={"email": email, "password": pwd, "company_name": "LoadTest Corp"},
        )
        if status in (200, 201):
            credentials.append({"email": email, "password": pwd})
            status2, body = await timed_request(
                session, "POST", f"{base}/login", collector, "login (seed)",
                json={"email": email, "password": pwd},
            )
            if status2 == 200 and isinstance(body, dict) and "token" in body:
                tokens.append(body["token"])


async def generate_licenses_for_users(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    admin_token: str,
    user_emails: list[str],
) -> None:
    """Admin generates licenses for seeded users so protected endpoints work."""
    for email in user_emails:
        await timed_request(
            session, "POST", f"{base}/admin/license/generate", collector,
            "admin_license_gen",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"email": email, "days": 30, "level": "premium"},
        )
