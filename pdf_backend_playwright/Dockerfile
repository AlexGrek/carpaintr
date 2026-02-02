# Lightweight PDF generation with Playwright + uv
# Multi-arch support (amd64, arm64)

FROM python:3.13-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BROWSER_IDLE_TIMEOUT=180 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install minimal system dependencies
# Only what's needed for Playwright Chromium (much lighter than WeasyPrint)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Required for Playwright installation
    wget \
    # Required for Chromium
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install Python dependencies with uv
RUN uv pip install --system --no-cache -r pyproject.toml

# Install Playwright browsers (downloads Chromium ~100MB)
RUN playwright install chromium --with-deps

# Copy application code
COPY . .

# Create directories for templates and static files
RUN mkdir -p templates static

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

EXPOSE 5000

# Use gunicorn with threading (Playwright browser is shared via BrowserManager)
CMD ["gunicorn", \
    "--workers", "2", \
    "--threads", "4", \
    "--worker-class", "gthread", \
    "--bind", "0.0.0.0:5000", \
    "--timeout", "120", \
    "--access-logfile", "-", \
    "--error-logfile", "-", \
    "app:app"]
