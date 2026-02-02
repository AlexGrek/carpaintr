from flask import Flask, request, send_file
from jinja2 import Environment, FileSystemLoader, Template
from playwright.sync_api import sync_playwright, Browser, Playwright
import io
import os
import logging
import threading
import time
from datetime import datetime

app = Flask(__name__)

# --- Production Mode Configuration ---
app.debug = os.environ.get("FLASK_ENV") != "production"
if not app.debug:
    app.logger.setLevel(logging.INFO)
# --- End of Production Mode Configuration ---

# Configure Jinja2 environment
template_env = Environment(loader=FileSystemLoader("templates"))

# --- Browser Lifecycle Management ---
class BrowserManager:
    """Manages Playwright browser instance with automatic cleanup after inactivity."""

    def __init__(self, idle_timeout_seconds=180):  # 3 minutes default
        self.playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.last_used = None
        self.lock = threading.Lock()
        self.idle_timeout = idle_timeout_seconds
        self.cleanup_thread = None
        self.running = True

    def start_cleanup_daemon(self):
        """Start background thread to monitor and cleanup idle browser."""
        self.cleanup_thread = threading.Thread(target=self._cleanup_daemon, daemon=True)
        self.cleanup_thread.start()
        app.logger.info(f"Browser cleanup daemon started (idle timeout: {self.idle_timeout}s)")

    def _cleanup_daemon(self):
        """Background task that kills browser after idle timeout."""
        while self.running:
            time.sleep(30)  # Check every 30 seconds

            with self.lock:
                if self.browser and self.last_used:
                    idle_time = (datetime.now() - self.last_used).total_seconds()
                    if idle_time > self.idle_timeout:
                        app.logger.info(f"Browser idle for {idle_time:.1f}s, shutting down...")
                        self._close_browser()

    def _close_browser(self):
        """Close browser and playwright instance (must be called with lock held)."""
        try:
            if self.browser:
                self.browser.close()
                self.browser = None
            if self.playwright:
                self.playwright.stop()
                self.playwright = None
            app.logger.info("Browser closed successfully")
        except Exception as e:
            app.logger.error(f"Error closing browser: {e}")

    def get_browser(self) -> Browser:
        """Get or create browser instance."""
        with self.lock:
            if not self.browser:
                app.logger.info("Starting new Playwright browser...")
                self.playwright = sync_playwright().start()
                self.browser = self.playwright.chromium.launch(
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                    ]
                )
                app.logger.info("Browser started successfully")

            self.last_used = datetime.now()
            return self.browser

    def shutdown(self):
        """Shutdown browser manager and cleanup daemon."""
        self.running = False
        with self.lock:
            self._close_browser()

# Initialize browser manager
browser_manager = BrowserManager(
    idle_timeout_seconds=int(os.environ.get("BROWSER_IDLE_TIMEOUT", "180"))
)

# ---------- Helper Functions ----------

def render_template_from_data(data, default_template="paycheck.html"):
    """Render HTML from provided data and either a custom template or a default template file."""
    if not data:
        return None, ("Invalid JSON data provided.", 400)

    custom_template_content = data.get("custom_template_content")
    try:
        if custom_template_content:
            template = Template(custom_template_content)
        else:
            template = template_env.get_template(default_template)

        with app.app_context():
            return template.render({"data": data}), None
    except Exception as e:
        app.logger.error(f"Template rendering error: {e}")
        return None, (f"Template error: {e}", 404)


def html_to_pdf_bytes(html_content):
    """Convert HTML string to PDF bytes using Playwright."""
    try:
        browser = browser_manager.get_browser()
        page = browser.new_page()
        page.set_content(html_content, wait_until="networkidle")
        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            margin={
                "top": "10mm",
                "right": "10mm",
                "bottom": "10mm",
                "left": "10mm"
            }
        )
        page.close()
        return pdf_bytes
    except Exception as e:
        app.logger.error(f"PDF generation error: {e}")
        raise

# ---------- Routes ----------

@app.route("/generate/pdf", methods=["POST"])
def generate_paycheck_pdf():
    try:
        data = request.get_json()
        rendered_html, error = render_template_from_data(data)
        if error:
            return {"error": error[0]}, error[1]

        pdf_bytes = html_to_pdf_bytes(rendered_html)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="paycheck.pdf",
        )
    except Exception as e:
        app.logger.error(f"Error generating paycheck PDF: {e}")
        return {"error": f"An internal error occurred: {e}"}, 500


@app.route("/generate/html", methods=["POST"])
def generate_paycheck_html():
    try:
        data = request.get_json()
        rendered_html, error = render_template_from_data(data)
        if error:
            return {"error": error[0]}, error[1]

        return rendered_html, 200, {"Content-Type": "text/html"}
    except Exception as e:
        app.logger.error(f"Error generating HTML: {e}")
        return {"error": f"An internal error occurred: {e}"}, 500


@app.route("/api/template", methods=["GET"])
def get_template():
    template_name = request.args.get("template_name", "paycheck.html")
    template_path = os.path.join(app.root_path, "templates", template_name)

    if not os.path.exists(template_path):
        return {"error": f"Template '{template_name}' not found."}, 404

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            return f.read(), 200, {"Content-Type": "text/plain"}
    except Exception as e:
        app.logger.error(f"Error reading template file: {e}")
        return {"error": f"An internal error occurred while reading the template: {e}"}, 500


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint with browser status."""
    with browser_manager.lock:
        browser_status = "running" if browser_manager.browser else "stopped"
        idle_time = None
        if browser_manager.last_used:
            idle_time = (datetime.now() - browser_manager.last_used).total_seconds()

    return {
        "status": "healthy",
        "browser_status": browser_status,
        "browser_idle_seconds": idle_time
    }, 200


if __name__ == "__main__":
    os.makedirs("templates", exist_ok=True)
    os.makedirs("static", exist_ok=True)

    # Start browser cleanup daemon
    browser_manager.start_cleanup_daemon()

    if app.debug:
        print("Running in development mode (debug=True).")
        print(f"Browser idle timeout: {browser_manager.idle_timeout}s")
        app.run(debug=True)
    else:
        print("Running in production mode (debug=False). Use Gunicorn to serve the application.")
        print(f"Browser idle timeout: {browser_manager.idle_timeout}s")
