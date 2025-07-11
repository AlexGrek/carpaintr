# Stage 1: Build - Install dependencies
FROM debian:bookworm-slim

# Set environment variables for Python to optimize performance
ENV PYTHONUNBUFFERED 1 \
    PYTHONDONTWRITEBYTECODE 1

# Install necessary system dependencies for WeasyPrint
# WeasyPrint requires some C libraries for PDF rendering (Pango, Cairo, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3-dev python3-pip \
        build-essential \
        libffi-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf2.0-0 \
        libpq-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only requirements.txt first to leverage Docker's caching
COPY requirements.txt .

# Install Python dependencies. Use --no-cache-dir for smaller images.
RUN pip install --no-cache-dir -r requirements.txt  --break-system-packages

# Install necessary system dependencies for WeasyPrint (runtime only)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3-pip python3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf2.0-0 \
        fonts-dejavu-core \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the application code
COPY . .

# Expose the port that Gunicorn will listen on
EXPOSE 5000

RUN pip install gunicorn --break-system-packages

# Command to run the application using Gunicorn
# -w: Number of worker processes (e.g., 2 * NUM_CORES + 1, or 2-4 for a basic app)
# -b: Bind to all interfaces on port 5000
# app: Flask application instance (assuming 'app' is the name of your Flask app object in app.py)
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5000", "app:app"]