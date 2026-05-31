#!/usr/bin/env python3
"""CLI entrypoint for ``task populate`` — register seed users against a running backend."""

from __future__ import annotations

import argparse
import sys

import httpx

from tests.seed_users import (
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
    SEED_LICENSE_DAYS,
    SEED_LICENSE_LEVEL,
    SEED_USER_COUNT,
    api_base_url,
    ensure_all_seed_users_sync,
)


def _check_backend(base_url: str) -> None:
    health_url = base_url.replace("/api/v1", "") + "/api/v1/health"
    try:
        response = httpx.get(health_url, timeout=5)
    except httpx.RequestError as exc:
        print(f"ERROR: backend not reachable at {health_url}: {exc}", file=sys.stderr)
        print("Start it with: task backend  (or task itests)", file=sys.stderr)
        sys.exit(1)
    if response.status_code != 200:
        print(f"ERROR: backend health check failed: {response.status_code}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Register seed users for local dev / itests")
    parser.add_argument(
        "--count",
        type=int,
        default=SEED_USER_COUNT,
        help=f"Number of seed users to create (1..N), default {SEED_USER_COUNT}",
    )
    parser.add_argument(
        "--base-url",
        default=api_base_url(),
        help="API base URL including /api/v1 prefix",
    )
    parser.add_argument(
        "--no-license-on-create",
        action="store_true",
        help="Skip license generation for newly created users",
    )
    args = parser.parse_args()

    if args.count < 1 or args.count > SEED_USER_COUNT:
        print(f"ERROR: --count must be between 1 and {SEED_USER_COUNT}", file=sys.stderr)
        sys.exit(1)

    _check_backend(args.base_url)

    print(f"==> Ensuring bootstrap admin + {args.count} seed users at {args.base_url} ...")
    if not args.no_license_on_create:
        print(
            f"    Bootstrap admin + new seed users get licenses ({SEED_LICENSE_DAYS} days, "
            f"level={SEED_LICENSE_LEVEL!r}); existing seed users unchanged."
        )

    with httpx.Client(
        base_url=args.base_url, timeout=120.0, follow_redirects=True
    ) as client:
        results = ensure_all_seed_users_sync(
            args.count,
            client=client,
            license_on_create=not args.no_license_on_create,
        )

    print(
        f"    Bootstrap admin: {BOOTSTRAP_ADMIN_EMAIL} / {BOOTSTRAP_ADMIN_PASSWORD}"
    )
    if not args.no_license_on_create:
        print(f"    [{BOOTSTRAP_ADMIN_EMAIL}] licensed")

    created = sum(1 for user in results if user.get("created"))
    existing = len(results) - created
    licensed = sum(1 for user in results if user.get("licensed"))

    print(
        f"    Done: {created} registered ({licensed} licensed), "
        f"{existing} already existed (unchanged)"
    )
    for user in results:
        if user.get("created"):
            tag = "new + licensed" if user.get("licensed") else "new"
        else:
            tag = "ok"
        print(f"    [{tag}] {user['email']} / {user['password']}")


if __name__ == "__main__":
    main()
