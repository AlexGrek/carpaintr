# PDF Backend - Playwright Edition

Lightweight PDF generation service using Playwright for browser-based rendering. This is a drop-in replacement for the WeasyPrint-based `pdf_backend` with significantly smaller image size and better ARM support.

## Key Features

- **Lightweight**: ~300-350MB image (vs ~450-550MB for WeasyPrint)
- **Multi-arch**: Native ARM64 and AMD64 support
- **Browser-based**: Perfect HTML/CSS rendering using Chromium
- **Resource-efficient**: Automatic browser lifecycle management
- **uv-based**: Fast dependency installation with uv package manager
- **Fewer dependencies**: No Pango, Cairo, or GDK-PixBuf required

## Architecture

### Browser Lifecycle Management

The service includes an intelligent `BrowserManager` that:
- Spawns Chromium on first PDF request
- Reuses the same browser instance across requests (faster)
- Automatically shuts down browser after configurable idle timeout (default: 3 minutes)
- Spawns new browser on next request after shutdown

This design saves memory when the service is idle while maintaining fast response times during active use.

### Configuration

Environment variables:
- `BROWSER_IDLE_TIMEOUT`: Seconds of inactivity before browser shutdown (default: 180)
- `FLASK_ENV`: Set to `production` to disable debug mode

## Development

### Local Setup

```bash
# Install dependencies with uv
uv pip install -e .

# Install Playwright browsers
playwright install chromium

# Run development server
python app.py
```

### Docker Build

```bash
# Single architecture
task build-pdfgen-playwright

# Multi-architecture (ARM64 + AMD64)
task multiarch-release-playwright
```

## API Endpoints

### POST /generate/pdf
Generate PDF from JSON data and template.

**Request Body:**
```json
{
  "custom_template_content": "<html>...</html>",  // Optional
  // ... template data
}
```

**Response:** PDF file download

### POST /generate/html
Preview rendered HTML (useful for debugging templates).

### GET /api/template?template_name=paycheck.html
Retrieve template source code.

### GET /health
Health check endpoint with browser status.

**Response:**
```json
{
  "status": "healthy",
  "browser_status": "running|stopped",
  "browser_idle_seconds": 45.2
}
```

## Comparison: WeasyPrint vs Playwright

| Feature | WeasyPrint | Playwright |
|---------|-----------|------------|
| Image Size | ~450-550MB | ~300-350MB |
| Base Image | Debian | Debian Slim |
| C Dependencies | Heavy (Pango, Cairo, GDK) | Lighter (Chromium runtime) |
| ARM Compilation | Complex | Simple |
| CSS Support | Limited CSS2.1 | Full CSS3 + Modern Web |
| Memory (idle) | ~150MB | ~80MB (browser off) |
| Memory (active) | ~200MB | ~200MB (browser on) |
| Startup Time | Fast | Fast (browser cached) |
| Build Dependencies | Many dev packages | None |

## Migration from WeasyPrint

The API is 100% compatible with the original `pdf_backend`. Simply:
1. Update Docker image reference to use `autolab-pdf-playwright`
2. (Optional) Set `BROWSER_IDLE_TIMEOUT` environment variable
3. Deploy

No code changes required in your backend service.

## Production Deployment

### Kubernetes

Update your Helm values to use the new image:

```yaml
pdfgen:
  image:
    repository: grekodocker/autolab-pdf-playwright
    tag: latest
  env:
    - name: BROWSER_IDLE_TIMEOUT
      value: "180"  # 3 minutes
```

### Docker Compose

```yaml
services:
  pdfgen:
    image: grekodocker/autolab-pdf-playwright:latest
    environment:
      BROWSER_IDLE_TIMEOUT: 180
    ports:
      - "5000:5000"
```

## Troubleshooting

### Browser won't start
- Check that the container has enough memory (minimum 512MB recommended)
- Ensure Chrome/Chromium dependencies are installed

### PDF generation timeout
- Increase Gunicorn timeout: `--timeout 120`
- Check browser status via `/health` endpoint
- Increase `BROWSER_IDLE_TIMEOUT` if browser shuts down too frequently

### Memory issues
- Reduce Gunicorn workers (current: 2)
- Lower `BROWSER_IDLE_TIMEOUT` to shut down browser more aggressively
- Use Alpine-based image (already default)

## License

Same as parent project.
