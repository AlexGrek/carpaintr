#!/usr/bin/env python3
"""Daemon entrypoint for the PDF generation mock (used by ``task itests``)."""

from __future__ import annotations

import signal
import sys
import time
from pathlib import Path

from tests.pdfgen_mock import PdfGenMockServer

PID_FILE = Path("/tmp/carpaintr-pdfgen-mock.pid")
PORT_FILE = Path("/tmp/carpaintr-pdfgen-mock.port")
URL_FILE = Path("/tmp/carpaintr-pdfgen-mock.url")


def _shutdown(_signum: int, _frame: object) -> None:
    for path in (PID_FILE, PORT_FILE, URL_FILE):
        path.unlink(missing_ok=True)
    sys.exit(0)


def main() -> None:
    mock = PdfGenMockServer()
    mock.start()
    mock.wait_healthy()

    PID_FILE.write_text(str(__import__("os").getpid()), encoding="utf-8")
    PORT_FILE.write_text(str(mock.port), encoding="utf-8")
    URL_FILE.write_text(mock.pdf_gen_url_post, encoding="utf-8")

    # First line is the PDF_GEN_URL_POST value for shell scripts.
    print(mock.pdf_gen_url_post, flush=True)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        _shutdown(0, None)


if __name__ == "__main__":
    main()
