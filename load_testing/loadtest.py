#!/usr/bin/env python3
"""
High-load testing script for carpaintr backend.

Simultaneously performs registrations, logins, and license-protected requests,
then plots response times over the test duration.

Usage:
    python loadtest.py [--mode steady|full] [--base-url URL] [--duration SECS]
                       [--concurrency N] [--admin-email EMAIL] [--admin-password PASS]

Modes:
    steady  - Pre-registers users before the test, then only hits protected/auth
              endpoints. No registration or login noise during the measured run.
    full    - Simultaneously performs registrations, logins, AND protected requests
              during the test (original behavior).
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path

import aiohttp

# Ensure load_testing directory is on path when run as script
_LOAD_TESTING_DIR = Path(__file__).resolve().parent
if str(_LOAD_TESTING_DIR) not in sys.path:
    sys.path.insert(0, str(_LOAD_TESTING_DIR))

from reporting import plot_results, print_report
from utils import ResultCollector, timed_request
from workloads import (
    generate_licenses_for_users,
    login_loop,
    protected_requests_loop,
    register_and_collect_creds,
    registration_loop,
)


def resolve_base_url(args) -> str:
    """Resolve the base URL from --server or --base-url, with --server taking precedence."""
    if args.server:
        host = args.server.strip().rstrip("/")
        if host.startswith("http://") or host.startswith("https://"):
            return f"{host}/api/v1"
        return f"https://{host}/api/v1"
    return args.base_url


async def run_load_test(args) -> None:
    collector = ResultCollector()
    credentials: list[dict] = []
    tokens: list[str] = []
    base = args.base_url.rstrip("/")

    connector = aiohttp.TCPConnector(limit=args.concurrency * 3, force_close=False)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # ------------------------------------------------------------------
        # Phase 1: Health check
        # ------------------------------------------------------------------
        print("[*] Checking backend health...")
        try:
            async with session.get(f"{base}/login", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                print(f"    Backend responded with {resp.status} - OK")
        except Exception as e:
            print(f"    ERROR: Cannot reach backend at {base}: {e}")
            print("    Make sure the backend is running (cargo run --release)")
            return

        # ------------------------------------------------------------------
        # Phase 2: Seed users & get admin token
        # ------------------------------------------------------------------
        print(f"[*] Seeding {args.seed_users} test users...")
        collector.start_time = time.monotonic()

        await register_and_collect_creds(
            session, base, collector, credentials, tokens, args.seed_users,
        )
        print(f"    Seeded {len(credentials)} users, {len(tokens)} tokens")

        admin_token = None
        if args.admin_email and args.admin_password:
            await timed_request(
                session, "POST", f"{base}/register", collector, "register (admin)",
                json={
                    "email": args.admin_email,
                    "password": args.admin_password,
                    "company_name": "Admin Corp",
                },
            )
            status, body = await timed_request(
                session, "POST", f"{base}/login", collector, "login (admin)",
                json={"email": args.admin_email, "password": args.admin_password},
            )
            if status == 200 and isinstance(body, dict) and "token" in body:
                admin_token = body["token"]
                print("[*] Admin authenticated, generating licenses for seeded users...")
                user_emails = [c["email"] for c in credentials]
                await generate_licenses_for_users(
                    session, base, collector, admin_token, user_emails,
                )
                print(f"    Generated {len(user_emails)} licenses")
            else:
                print(f"    WARNING: Admin login failed (status={status}). "
                      "Protected endpoints will return 403.")

        # ------------------------------------------------------------------
        # Phase 3: Load test
        # ------------------------------------------------------------------
        mode = args.mode
        print(f"[*] Starting load test: mode={mode}, {args.duration}s, concurrency={args.concurrency}")

        collector.records.clear()
        collector.start_time = time.monotonic()

        delay_between = 1.0 / max(args.rps, 1)

        tasks = []
        if mode == "full":
            n_register = max(1, args.concurrency // 4)
            n_login = max(1, args.concurrency // 4)
            n_protected = args.concurrency - n_register - n_login

            for _ in range(n_register):
                tasks.append(
                    registration_loop(session, base, collector, args.duration, delay_between)
                )
            for _ in range(n_login):
                tasks.append(
                    login_loop(session, base, collector, args.duration, delay_between, credentials)
                )
            for _ in range(n_protected):
                tasks.append(
                    protected_requests_loop(
                        session, base, collector, args.duration, delay_between, tokens,
                    )
                )
        else:
            for _ in range(args.concurrency):
                tasks.append(
                    protected_requests_loop(
                        session, base, collector, args.duration, delay_between, tokens,
                    )
                )

        await asyncio.gather(*tasks)

    # ------------------------------------------------------------------
    # Phase 4: Report & plot
    # ------------------------------------------------------------------
    print_report(collector)
    plot_results(collector, args)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Carpaintr backend load tester")
    parser.add_argument("--mode", choices=["steady", "full"], default="steady",
                        help="Test mode: 'steady' = only protected endpoints with "
                             "pre-registered users (default), 'full' = registrations + "
                             "logins + protected endpoints simultaneously")
    parser.add_argument("--server", default=None, metavar="HOST",
                        help="Target server hostname or URL, e.g. 'myserver.com', "
                             "'myserver.com:8443', or 'https://myserver.com'. "
                             "Takes precedence over --base-url. Assumes HTTPS when no scheme given.")
    parser.add_argument("--base-url", default="http://localhost:8080/api/v1",
                        help="Backend API base URL (default: http://localhost:8080/api/v1). "
                             "Ignored when --server is set.")
    parser.add_argument("--duration", type=int, default=30,
                        help="Test duration in seconds (default: 30)")
    parser.add_argument("--concurrency", type=int, default=20,
                        help="Number of concurrent workers (default: 20)")
    parser.add_argument("--rps", type=int, default=50,
                        help="Target requests per second per worker (default: 50)")
    parser.add_argument("--seed-users", type=int, default=20,
                        help="Number of users to pre-register before the test (default: 20)")
    parser.add_argument("--admin-email", default="test_admin@example.com",
                        help="Admin email for license generation (default: test_admin@example.com)")
    parser.add_argument("--admin-password", default="adminpassword123",
                        help="Admin password (default: adminpassword123)")
    args = parser.parse_args()
    args.base_url = resolve_base_url(args)
    return args


def main() -> None:
    args = parse_args()
    print(f"[*] Target: {args.base_url}")
    asyncio.run(run_load_test(args))


if __name__ == "__main__":
    main()
