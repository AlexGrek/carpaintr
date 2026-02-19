#!/usr/bin/env python3
"""
High-load testing script for carpaintr backend.

Simultaneously performs registrations, logins, and license-protected requests,
then plots response times over the test duration.

Usage:
    python loadtest.py [--base-url URL] [--duration SECS] [--concurrency N]
                       [--admin-email EMAIL] [--admin-password PASS]
"""

import argparse
import asyncio
import json
import random
import string
import time
from dataclasses import dataclass, field

import aiohttp
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------

@dataclass
class RequestRecord:
    timestamp: float  # relative to test start (seconds)
    endpoint: str  # human-readable label
    method: str
    status: int
    latency_ms: float
    error: str | None = None


@dataclass
class ResultCollector:
    records: list[RequestRecord] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    start_time: float = 0.0

    async def add(self, rec: RequestRecord):
        async with self._lock:
            self.records.append(rec)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def random_email() -> str:
    slug = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"loadtest_{slug}@test.local"


def random_password() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=16))


async def timed_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    collector: ResultCollector,
    label: str,
    **kwargs,
) -> tuple[int, dict | str | None]:
    """Issue a request, record timing, return (status, body)."""
    t0 = time.monotonic()
    error = None
    status = 0
    body = None
    try:
        async with session.request(method, url, **kwargs) as resp:
            status = resp.status
            text = await resp.text()
            try:
                body = json.loads(text)
            except (json.JSONDecodeError, ValueError):
                body = text
    except Exception as exc:
        error = str(exc)
        status = 0

    latency = (time.monotonic() - t0) * 1000
    await collector.add(
        RequestRecord(
            timestamp=time.monotonic() - collector.start_time,
            endpoint=label,
            method=method,
            status=status,
            latency_ms=latency,
            error=error,
        )
    )
    return status, body


# ---------------------------------------------------------------------------
# Workload tasks
# ---------------------------------------------------------------------------

async def registration_loop(
    session: aiohttp.ClientSession,
    base: str,
    collector: ResultCollector,
    duration: float,
    delay: float,
):
    """Continuously register new users."""
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
):
    """Continuously login with previously created users."""
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
):
    """Hit license-protected and auth-protected endpoints."""
    protected_endpoints = [
        ("GET", "/user/carmakes", "carmakes"),
        ("GET", "/user/list_class_body_types", "list_class_body"),
        ("GET", "/user/calculationstore/list", "calc_store_list"),
    ]
    auth_only_endpoints = [
        ("GET", "/getactivelicense", "get_active_license"),
        ("GET", "/getcompanyinfo", "get_company_info"),
        ("GET", "/mylicenses", "my_licenses"),
    ]
    all_endpoints = protected_endpoints + auth_only_endpoints

    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        if not tokens:
            await asyncio.sleep(0.5)
            continue
        token = random.choice(tokens)
        method, path, label = random.choice(all_endpoints)
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
):
    """Pre-register users, login, and collect their tokens."""
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
):
    """Admin generates licenses for seeded users so protected endpoints work."""
    for email in user_emails:
        await timed_request(
            session, "POST", f"{base}/admin/license/generate", collector,
            "admin_license_gen",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"email": email, "days": 30, "level": "premium"},
        )


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

async def run_load_test(args):
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
                print(f"    Backend responded with {resp.status} — OK")
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

        # Login as admin and generate licenses for seeded users
        admin_token = None
        if args.admin_email and args.admin_password:
            # Register admin (may already exist)
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
        print(f"[*] Starting load test: {args.duration}s, concurrency={args.concurrency}")
        delay_between = 1.0 / max(args.rps, 1)

        tasks = []
        # Spread concurrency across workload types
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

        await asyncio.gather(*tasks)

    # ------------------------------------------------------------------
    # Phase 4: Report & plot
    # ------------------------------------------------------------------
    print_report(collector)
    plot_results(collector, args)


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def print_report(collector: ResultCollector):
    records = collector.records
    if not records:
        print("\nNo requests recorded.")
        return

    total = len(records)
    errors = sum(1 for r in records if r.status == 0 or r.status >= 500)
    latencies = [r.latency_ms for r in records]
    duration = max(r.timestamp for r in records)

    print(f"\n{'='*60}")
    print(f"  LOAD TEST RESULTS")
    print(f"{'='*60}")
    print(f"  Total requests:   {total}")
    print(f"  Duration:         {duration:.1f}s")
    print(f"  Throughput:       {total / max(duration, 0.1):.1f} req/s")
    print(f"  Errors (5xx/net): {errors} ({100 * errors / total:.1f}%)")
    print(f"  Latency p50:      {np.percentile(latencies, 50):.1f} ms")
    print(f"  Latency p90:      {np.percentile(latencies, 90):.1f} ms")
    print(f"  Latency p99:      {np.percentile(latencies, 99):.1f} ms")
    print(f"  Latency max:      {max(latencies):.1f} ms")

    # Per-endpoint breakdown
    endpoints = sorted(set(r.endpoint for r in records))
    print(f"\n  {'Endpoint':<25} {'Count':>7} {'p50':>8} {'p90':>8} {'p99':>8} {'Err%':>7}")
    print(f"  {'-'*25} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*7}")
    for ep in endpoints:
        ep_records = [r for r in records if r.endpoint == ep]
        ep_lat = [r.latency_ms for r in ep_records]
        ep_err = sum(1 for r in ep_records if r.status == 0 or r.status >= 500)
        err_pct = 100 * ep_err / len(ep_records) if ep_records else 0
        print(
            f"  {ep:<25} {len(ep_records):>7} "
            f"{np.percentile(ep_lat, 50):>7.1f} "
            f"{np.percentile(ep_lat, 90):>7.1f} "
            f"{np.percentile(ep_lat, 99):>7.1f} "
            f"{err_pct:>6.1f}%"
        )
    print()


def plot_results(collector: ResultCollector, args):
    records = collector.records
    if not records:
        return

    # Filter out seed phase records for cleaner graphs
    seed_labels = {"register (seed)", "login (seed)", "register (admin)",
                   "login (admin)", "admin_license_gen"}
    load_records = [r for r in records if r.endpoint not in seed_labels]
    if not load_records:
        load_records = records

    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    fig.suptitle(
        f"Load Test Results — {args.duration}s, concurrency={args.concurrency}",
        fontsize=14, fontweight="bold",
    )

    # Color map for endpoints
    endpoints = sorted(set(r.endpoint for r in load_records))
    cmap = matplotlib.colormaps.get_cmap("tab10").resampled(max(len(endpoints), 1))
    colors = {ep: cmap(i) for i, ep in enumerate(endpoints)}

    # --- Plot 1: Response times scatter ---
    ax1 = axes[0, 0]
    for ep in endpoints:
        ep_recs = [r for r in load_records if r.endpoint == ep]
        ax1.scatter(
            [r.timestamp for r in ep_recs],
            [r.latency_ms for r in ep_recs],
            c=[colors[ep]], label=ep, alpha=0.4, s=8,
        )
    ax1.set_xlabel("Time (s)")
    ax1.set_ylabel("Latency (ms)")
    ax1.set_title("Response Times Over Time")
    ax1.legend(fontsize=7, loc="upper right")
    ax1.grid(True, alpha=0.3)

    # --- Plot 2: Throughput over time (1s buckets) ---
    ax2 = axes[0, 1]
    if load_records:
        max_t = max(r.timestamp for r in load_records)
        bucket_size = 1.0
        buckets = np.arange(0, max_t + bucket_size, bucket_size)
        for ep in endpoints:
            ep_times = [r.timestamp for r in load_records if r.endpoint == ep]
            counts, _ = np.histogram(ep_times, bins=buckets)
            ax2.plot(
                buckets[:-1] + bucket_size / 2, counts / bucket_size,
                label=ep, color=colors[ep], alpha=0.8,
            )
    ax2.set_xlabel("Time (s)")
    ax2.set_ylabel("Requests/sec")
    ax2.set_title("Throughput Over Time")
    ax2.legend(fontsize=7, loc="upper right")
    ax2.grid(True, alpha=0.3)

    # --- Plot 3: Latency distribution (histogram) ---
    ax3 = axes[1, 0]
    for ep in endpoints:
        ep_lat = [r.latency_ms for r in load_records if r.endpoint == ep]
        if ep_lat:
            ax3.hist(
                ep_lat, bins=50, alpha=0.5, label=ep, color=colors[ep],
            )
    ax3.set_xlabel("Latency (ms)")
    ax3.set_ylabel("Count")
    ax3.set_title("Latency Distribution")
    ax3.legend(fontsize=7, loc="upper right")
    ax3.grid(True, alpha=0.3)

    # --- Plot 4: Rolling p50/p90/p99 ---
    ax4 = axes[1, 1]
    if load_records:
        sorted_recs = sorted(load_records, key=lambda r: r.timestamp)
        window = max(len(sorted_recs) // 50, 10)
        times, p50s, p90s, p99s = [], [], [], []
        for i in range(0, len(sorted_recs) - window, window // 2):
            chunk = sorted_recs[i : i + window]
            lats = [r.latency_ms for r in chunk]
            times.append(np.mean([r.timestamp for r in chunk]))
            p50s.append(np.percentile(lats, 50))
            p90s.append(np.percentile(lats, 90))
            p99s.append(np.percentile(lats, 99))
        ax4.plot(times, p50s, label="p50", linewidth=2)
        ax4.plot(times, p90s, label="p90", linewidth=2)
        ax4.plot(times, p99s, label="p99", linewidth=2)
    ax4.set_xlabel("Time (s)")
    ax4.set_ylabel("Latency (ms)")
    ax4.set_title("Rolling Percentiles")
    ax4.legend(fontsize=9)
    ax4.grid(True, alpha=0.3)

    plt.tight_layout()
    out_path = "load_test_results.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"[*] Response times graph saved to: {out_path}")
    plt.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Carpaintr backend load tester")
    parser.add_argument("--base-url", default="http://localhost:8080/api/v1",
                        help="Backend API base URL (default: http://localhost:8080/api/v1)")
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
    asyncio.run(run_load_test(args))


if __name__ == "__main__":
    main()
