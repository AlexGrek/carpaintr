from flask import Flask, request, send_file
from jinja2 import Environment, FileSystemLoader, Template
from weasyprint import HTML
import io
import os
import logging

app = Flask(__name__)

# --- Production Mode Configuration ---
app.debug = os.environ.get("FLASK_ENV") != "production"
if not app.debug:
    app.logger.setLevel(logging.INFO)
# --- End of Production Mode Configuration ---

# Configure Jinja2 environment
template_env = Environment(loader=FileSystemLoader("templates"))

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
            return template.render(data), None
    except Exception as e:
        app.logger.error(f"Template rendering error: {e}")
        return None, (f"Template error: {e}", 404)


def html_to_pdf_bytes(html_content):
    """Convert HTML string to PDF bytes using WeasyPrint."""
    return HTML(string=html_content).write_pdf()

# ---------- Routes ----------

@app.route("/generate/pdf", methods=["POST"])
def generate_paycheck_pdf():
    try:
        data = request.get_json()
        rendered_html, error = render_template_from_data({"data": data})
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
        rendered_html, error = render_template_from_data({"data": data})
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


if __name__ == "__main__":
    os.makedirs("templates", exist_ok=True)
    os.makedirs("static", exist_ok=True)
    if app.debug:
        print("Running in development mode (debug=True).")
        app.run(debug=True)
    else:
        print("Running in production mode (debug=False). Use Gunicorn to serve the application.")
