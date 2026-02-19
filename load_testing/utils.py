"""
Reusable utilities for load testing: data collection, HTTP helpers, random data.
"""

import asyncio
import json
import random
import string
import time
from dataclasses import dataclass, field

import aiohttp


@dataclass
class RequestRecord:
    """Single request result: timing, endpoint label, status, optional error."""
    timestamp: float  # relative to test start (seconds)
    endpoint: str  # human-readable label
    method: str
    status: int
    latency_ms: float
    error: str | None = None


@dataclass
class ResultCollector:
    """Thread-safe collector of RequestRecords with optional start_time for relative timestamps."""
    records: list[RequestRecord] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    start_time: float = 0.0

    async def add(self, rec: RequestRecord) -> None:
        async with self._lock:
            self.records.append(rec)


def random_email() -> str:
    """Generate a unique load-test email."""
    slug = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"loadtest_{slug}@test.local"


def random_password() -> str:
    """Generate a random password for load-test users."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=16))


async def timed_request(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    collector: ResultCollector,
    label: str,
    **kwargs,
) -> tuple[int, dict | str | None]:
    """
    Issue a request, record timing into collector, return (status, body).
    Body is parsed JSON when possible, else raw text. On exception, status=0 and error stored.
    """
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
