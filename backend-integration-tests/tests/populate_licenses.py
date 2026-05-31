#!/usr/bin/env python3
"""CLI for ``task populate:licenses`` — issue licenses for all seed users."""

from __future__ import annotations

import argparse
import sys

import httpx

from tests.populate_users import _check_backend
from tests.seed_users import (
    SEED_LICENSE_DAYS,
    SEED_LICENSE_LEVEL,
    SEED_USER_COUNT,
    api_base_url,
    ensure_seed_licenses_sync,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate licenses for bootstrap admin and seed users user1..userN"
    )
    parser.add_argument(
        "--count",
        type=int,
        default=SEED_USER_COUNT,
        help=f"Number of seed users (1..{SEED_USER_COUNT})",
    )
    parser.add_argument(
        "--base-url",
        default=api_base_url(),
        help="API base URL including /api/v1 prefix",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=SEED_LICENSE_DAYS,
        help="License duration in days",
    )
    parser.add_argument(
        "--level",
        default=SEED_LICENSE_LEVEL,
        help="License level (omit with --no-level)",
    )
    parser.add_argument(
        "--no-level",
        action="store_true",
        help="Do not send level field",
    )
    args = parser.parse_args()

    if args.count < 1 or args.count > SEED_USER_COUNT:
        print(f"ERROR: --count must be between 1 and {SEED_USER_COUNT}", file=sys.stderr)
        sys.exit(1)

    _check_backend(args.base_url)

    level = None if args.no_level else args.level
    print(
        f"==> Generating licenses for bootstrap admin + {args.count} seed users "
        f"({args.days} days, level={level!r}) ..."
    )

    with httpx.Client(
        base_url=args.base_url, timeout=120.0, follow_redirects=True
    ) as client:
        issued = ensure_seed_licenses_sync(
            args.count,
            client=client,
            days=args.days,
            level=level,
        )

    for row in issued:
        print(f"    [ok] {row['email']}")
    print(f"    Done: {len(issued)} licenses issued.")


if __name__ == "__main__":
    main()
