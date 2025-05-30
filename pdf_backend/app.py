from flask import Flask, request, send_file, render_template, url_for # Import url_for here
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML, CSS
import io
import os

app = Flask(__name__)

# Configure Jinja2 to load templates from the 'templates' directory
template_env = Environment(loader=FileSystemLoader('templates'))

@app.route('/generate-paycheck', methods=['POST'])
def generate_paycheck():
    """
    Accepts JSON paycheck data, renders it to HTML using a Jinja2 template,
    and converts the HTML to a PDF document.
    """
    try:
        data = request.get_json()

        if not data:
            return {"error": "Invalid JSON data provided."}, 400

        # Load the HTML template
        template = template_env.get_template('paycheck.html')

        # Render the HTML with the provided data, explicitly passing url_for
        # within a Flask application context
        with app.app_context(): # <--- This is the key change!
            rendered_html = template.render(data)


        # Convert HTML to PDF using WeasyPrint
        # You can optionally add CSS from a file if needed
        # For example: CSS(filename='static/style.css')
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

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    app.run(debug=True)