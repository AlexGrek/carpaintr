"""Minimal PDF generation service mock for integration tests.

Implements the endpoints the Rust backend calls via ``PDF_GEN_URL_POST``:

  POST /generate/pdf   → minimal valid PDF bytes
  POST /generate/html  → stub HTML document
  GET  /health         → {"status": "healthy", ...}
  GET  /api/template   → empty template stub (optional catalog probe)

Test introspection:

  GET  /_mock/requests → JSON list of recorded requests
  POST /_mock/reset    → clear request log

The backend builds URLs as ``{PDF_GEN_URL_POST}/pdf`` where
``PDF_GEN_URL_POST`` defaults to ``http://127.0.0.1:<port>/generate``.
"""

from __future__ import annotations

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from typing import Any
from urllib.parse import parse_qs, urlparse

# Minimal PDF document (valid header/trailer).
MOCK_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj<<>>endobj\n"
    b"trailer<<>>\n"
    b"%%EOF\n"
)

MOCK_HTML_BODY = (
    b"<!DOCTYPE html><html><body><p>mock paycheck</p></body></html>"
)


class MockServerCtx:
    """Thread-safe state shared across request handler instances."""

    def __init__(self, delay_ms: int = 0) -> None:
        self.delay_s = delay_ms / 1000.0
        self.lock = threading.Lock()
        self.requests: list[dict[str, Any]] = []

    def record(self, method: str, path: str, body: bytes | None) -> None:
        parsed: Any = None
        if body:
            try:
                parsed = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                parsed = body.decode("utf-8", errors="replace")
        with self.lock:
            self.requests.append(
                {
                    "method": method,
                    "path": path,
                    "body": parsed,
                    "ts": time.time(),
                }
            )

    def reset(self) -> None:
        with self.lock:
            self.requests.clear()

    def get_requests(self) -> list[dict[str, Any]]:
        with self.lock:
            return list(self.requests)


class _MockHandler(BaseHTTPRequestHandler):
    server: "_ThreadedHTTPServer"  # type: ignore[assignment]

    def log_message(self, format: str, *args: Any) -> None:
        pass

    @property
    def ctx(self) -> MockServerCtx:
        return self.server.ctx

    def _sleep(self) -> None:
        if self.ctx.delay_s > 0:
            time.sleep(self.ctx.delay_s)

    def do_GET(self) -> None:
        self._sleep()
        path = urlparse(self.path).path

        if path == "/health":
            self._json(
                200,
                {
                    "status": "healthy",
                    "browser_status": "mock",
                    "browser_idle_seconds": None,
                },
            )
            return

        if path == "/_mock/requests":
            self._json(200, self.ctx.get_requests())
            return

        if path == "/api/template":
            self.ctx.record("GET", self.path, None)
            self._respond(200, b"<html><body>mock template</body></html>", "text/plain")
            return

        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        self._sleep()
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        if path == "/_mock/reset":
            self.ctx.reset()
            self._json(200, {"ok": True})
            return

        if path == "/generate/pdf":
            self.ctx.record("POST", path, body)
            self._respond(200, MOCK_PDF_BYTES, "application/pdf")
            return

        if path == "/generate/html":
            self.ctx.record("POST", path, body)
            self._respond(200, MOCK_HTML_BODY, "text/html")
            return

        self.ctx.record("POST", path, body)
        self._json(404, {"error": f"unknown path: {path}"})

    def _json(self, status: int, payload: Any) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _respond(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class _ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    ctx: MockServerCtx


class PdfGenMockServer:
    """Reusable PDF service mock bound to a random port on 127.0.0.1."""

    def __init__(self, delay_ms: int = 0) -> None:
        self._server = _ThreadedHTTPServer(("127.0.0.1", 0), _MockHandler)
        self._server.ctx = MockServerCtx(delay_ms=delay_ms)
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        if self._thread:
            self._thread.join(timeout=5)

    @property
    def port(self) -> int:
        return self._server.server_address[1]

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    @property
    def pdf_gen_url_post(self) -> str:
        """Value for backend ``PDF_GEN_URL_POST`` env var."""
        return f"{self.base_url}/generate"

    @property
    def ctx(self) -> MockServerCtx:
        return self._server.ctx

    def wait_healthy(self, timeout_s: float = 5.0) -> None:
        import urllib.error
        import urllib.request

        deadline = time.time() + timeout_s
        url = f"{self.base_url}/health"
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(url, timeout=1) as resp:
                    if resp.status == 200:
                        return
            except (urllib.error.URLError, TimeoutError):
                pass
            time.sleep(0.1)
        raise RuntimeError(f"PDF mock did not become healthy at {url}")

    def fetch_requests(self) -> list[dict[str, Any]]:
        import urllib.request

        with urllib.request.urlopen(f"{self.base_url}/_mock/requests", timeout=5) as resp:
            return json.loads(resp.read().decode())

    def reset_requests(self) -> None:
        import urllib.request

        req = urllib.request.Request(
            f"{self.base_url}/_mock/reset",
            method="POST",
            data=b"",
        )
        urllib.request.urlopen(req, timeout=5).read()


class PdfGenMockClient:
    """Client for a mock server started elsewhere (e.g. ``task itests`` daemon)."""

    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    @property
    def pdf_gen_url_post(self) -> str:
        return f"{self.base_url}/generate"

    def fetch_requests(self) -> list[dict[str, Any]]:
        import urllib.request

        with urllib.request.urlopen(
            f"{self.base_url}/_mock/requests", timeout=5
        ) as resp:
            return json.loads(resp.read().decode())

    def reset_requests(self) -> None:
        import urllib.request

        req = urllib.request.Request(
            f"{self.base_url}/_mock/reset",
            method="POST",
            data=b"",
        )
        urllib.request.urlopen(req, timeout=5).read()


def resolve_mock_base_url() -> str | None:
    """Return mock base URL from env or temp files written by ``run_pdfgen_mock``."""
    import os
    from pathlib import Path

    env_url = os.environ.get("PDFGEN_MOCK_URL")
    if env_url:
        return env_url.rstrip("/")

    url_file = Path("/tmp/carpaintr-pdfgen-mock.url")
    if url_file.is_file():
        post_url = url_file.read_text(encoding="utf-8").strip()
        if post_url.endswith("/generate"):
            return post_url[: -len("/generate")]
        return post_url.rstrip("/")

    port_file = Path("/tmp/carpaintr-pdfgen-mock.port")
    if port_file.is_file():
        port = port_file.read_text(encoding="utf-8").strip()
        return f"http://127.0.0.1:{port}"

    return None
