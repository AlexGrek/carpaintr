from flask import Flask, request, send_file, render_template, url_for
from jinja2 import Environment, FileSystemLoader, Template
from weasyprint import HTML, CSS
import io
import os

app = Flask(__name__)

# --- Production Mode Configuration ---
# Check the FLASK_ENV environment variable.
# If FLASK_ENV is 'production', set debug mode to False.
# Otherwise, debug mode will be True for development.
app.debug = os.environ.get('FLASK_ENV') != 'production'

# If not in debug mode, disable Flask's default debug logging to console
# and ensure proper error handling for production.
if not app.debug:
    import logging
    # Configure logging for production if needed (e.g., to a file or external service)
    # For now, we'll just ensure it doesn't print debug messages to stdout.
    app.logger.setLevel(logging.INFO)
# --- End of Production Mode Configuration ---


# Configure Jinja2 to load templates from the 'templates' directory
template_env = Environment(loader=FileSystemLoader('templates'))

@app.route('/generate/pdf', methods=['POST'])
def generate_paycheck_pdf():
    """
    Accepts JSON paycheck data, renders it to HTML using either a provided
    HTML string or a Jinja2 template from a file, and converts the HTML to a PDF document.
    """
    try:
        data = request.get_json()

        if not data:
            return {"error": "Invalid JSON data provided."}, 400

        rendered_html = ""
        custom_template_content = data.get('custom_template_content')

        if custom_template_content:
            # If custom_template_content is provided, use it directly as a Jinja2 Template string
            template = Template(custom_template_content)
            with app.app_context():
                rendered_html = template.render(data)
        else:
            # Otherwise, load from the default 'paycheck.html' file
            template_file = 'paycheck.html'
            try:
                template = template_env.get_template(template_file)
                with app.app_context():
                    rendered_html = template.render(data)
            except Exception as e:
                app.logger.error(f"Error loading default template '{template_file}': {e}")
                return {"error": f"Default template '{template_file}' not found or invalid: {e}"}, 404

        # Convert HTML to PDF using WeasyPrint
        html_doc = HTML(string=rendered_html)
        pdf_bytes = html_doc.write_pdf()

        # Send the PDF as a file download
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name='paycheck.pdf'
        )

    except Exception as e:
        app.logger.error(f"Error generating paycheck: {e}")
        return {"error": f"An internal error occurred: {e}"}, 500

@app.route('/generate/html', methods=['POST'])
def generate_paycheck_html():
    """
    Accepts JSON paycheck data, renders it to HTML using either a provided
    HTML string or a Jinja2 template from a file, and returns the rendered HTML.
    """
    try:
        data = request.get_json()

        if not data:
            return {"error": "Invalid JSON data provided."}, 400

        rendered_html = ""
        custom_template_content = data.get('custom_template_content')

        if custom_template_content:
            # If custom_template_content is provided, use it directly as a Jinja2 Template string
            template = Template(custom_template_content)
            with app.app_context():
                rendered_html = template.render(data)
        else:
            # Otherwise, load from the default 'paycheck.html' file
            template_file = 'paycheck.html'
            try:
                template = template_env.get_template(template_file)
                with app.app_context():
                    rendered_html = template.render(data)
            except Exception as e:
                app.logger.error(f"Error loading default template '{template_file}': {e}")
                return {"error": f"Default template '{template_file}' not found or invalid: {e}"}, 404

        return rendered_html, 200, {'Content-Type': 'text/html'}

    except Exception as e:
        app.logger.error(f"Error generating HTML: {e}")
        return {"error": f"An internal error occurred: {e}"}, 500

@app.route('/api/template', methods=['GET'])
def get_template():
    """
    Returns the content of the default 'paycheck.html' template file.
    Optionally, accepts a 'template_name' query parameter to return a specific template.
    """
    template_name = request.args.get('template_name', 'paycheck.html')
    template_path = os.path.join(app.root_path, 'templates', template_name)

    if not os.path.exists(template_path):
        return {"error": f"Template '{template_name}' not found."}, 404

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()
        return template_content, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        app.logger.error(f"Error reading template file: {e}")
        return {"error": f"An internal error occurred while reading the template: {e}"}, 500

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    # Only run app.run() if in debug mode (i.e., not in production).
    # Gunicorn will handle serving the application in production.
    if app.debug:
        print("Running in development mode (debug=True).")
        app.run(debug=True)
    else:
        print("Running in production mode (debug=False). Use Gunicorn to serve the application.")