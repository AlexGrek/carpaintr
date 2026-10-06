"""Built-in templates display the resolved document, including authored totals."""
from pathlib import Path

import pytest
from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("filename", ["calculation_ua.html", "work_order_category_ua.html"])
@pytest.mark.parametrize("source", ["common", "data/common"])
def test_templates_preserve_authored_values_and_saved_currency(filename, source):
    env = Environment(loader=FileSystemLoader(ROOT / source / "doc_templates"), autoescape=True)
    template = env.get_template(filename)
    table = {"name": "Renamed table", "total": 42, "result": [
        {"name": "Authored painting", "part": "Edited hood", "unit": "л", "estimation": 2, "price": 100, "sum": 17, "tooltip": "Authored instruction", "category": "Custom finishing", "_overrides": ["tooltip", "category"]},
        {"name": "No charge", "part": "Edited hood", "estimation": 1, "price": 100, "sum": 0},
        {"name": "Blank authored row", "part": "", "estimation": "", "price": "", "sum": ""},
    ]}
    data = {
        "company_info": {"company_name": "Test", "email": "test@example.com", "pricing_preferences": {"preferred_currency": "UAH"}},
        "metadata": {"order_number": "EDIT-001", "order_notes": "Saved notes"},
        "calculation": {"car": {}, "paint": {}, "order": {"orderDate": "2026-10-02"},
                        "calc": {"Edited hood": [table]}, "calc_by_category": {"Custom category": [table]},
                        "currency": "EUR", "grand_total": 91, "part_totals": {"Edited hood": {"name": "Final authored hood", "total": 63, "computedTotal": 42}}},
    }
    html = template.render(data=data)
    assert "Authored painting (л)" in html
    assert "Authored instruction" in html
    assert "Категорія: Custom finishing" in html
    assert "No charge" in html
    assert "Blank authored row" in html
    assert '>17<' in html
    assert '>0<' in html
    assert "42.00 EUR" in html
    assert "UAH" not in html
    assert "Saved notes" in html
    if filename == "calculation_ua.html":
        assert "91.00 EUR" in html
        assert "63.00 EUR" in html
        assert "Final authored hood" in html

    # Old documents still use live company currency when no snapshot exists.
    del data["calculation"]["currency"]
    assert "42.00 UAH" in template.render(data=data)

    # A deliberately empty subtotal renders as a blank, without formatting errors.
    table["total"] = ""
    template.render(data=data)


@pytest.mark.parametrize("source", ["common", "data/common"])
def test_category_template_preserves_custom_and_deliberately_blank_groups(source):
    env = Environment(loader=FileSystemLoader(ROOT / source / "doc_templates"), autoescape=True)
    data = {
        "company_info": {"company_name": "Test", "email": "test@example.com"},
        "metadata": {"order_number": "EDIT-002"},
        "calculation": {"car": {}, "paint": {}, "order": {}, "currency": "EUR",
            "calc_by_category": {
                "Custom finishing": [{"total": 19, "result": [
                    {"name": "Earlier row", "part": "Hood", "estimation": 1, "price": 100, "sum": 2, "tooltip": "Instruction"},
                    {"name": "Later row", "part": "Hood", "estimation": 1, "price": 100, "sum": 17},
                ]}],
                "": [{"total": 0, "result": [{"name": "Blank group row", "part": "Hood", "estimation": 0, "price": 100, "sum": 0}]}],
            }},
    }
    html = env.get_template("work_order_category_ua.html").render(data=data)
    assert '<div class="category-title">Custom finishing</div>' in html
    assert '<div class="category-title"></div>' in html
    assert html.index("Earlier row") < html.index("Later row")
    assert "Instruction" in html
    assert "Blank group row" in html


@pytest.mark.parametrize("source", ["common", "data/common"])
def test_stable_keys_keep_colliding_labels_as_separate_sections(source):
    env = Environment(loader=FileSystemLoader(ROOT / source / "doc_templates"), autoescape=True)
    rows = lambda name: [{"name": name, "part": "Edited part", "estimation": 1, "price": 100, "sum": 17}]
    data = {
        "company_info": {"company_name": "Test", "email": "test@example.com"},
        "metadata": {"order_number": "LABEL-COLLISION"},
        "calculation": {"car": {}, "paint": {}, "order": {}, "currency": "EUR",
            "calc_by_category": {"paint": [{"result": rows("Standard paint row"), "total": 17}], "Paint works": [{"result": rows("Custom paint row"), "total": 17}]},
            "category_labels": {"paint": "Paint works", "Paint works": "Paint works"},
            "calc": {"Hood": [{"result": rows("Hood row"), "total": 17}], "Door": [{"result": rows("Door row"), "total": 17}]},
            "part_labels": {"Hood": "Edited part", "Door": "Edited part"},
        },
    }
    category_html = env.get_template("work_order_category_ua.html").render(data=data)
    assert category_html.count('<div class="category-title">Paint works</div>') == 2
    assert "Standard paint row" in category_html and "Custom paint row" in category_html
    part_html = env.get_template("calculation_ua.html").render(data=data)
    assert part_html.count('<div class="calc-title">Edited part</div>') == 2
    assert "Hood row" in part_html and "Door row" in part_html


@pytest.mark.parametrize("source,filename", [
    ("common/doc_templates", "calculation_ua.html"),
    ("common/doc_templates", "work_order_category_ua.html"),
    ("data/common/doc_templates", "calculation_ua.html"),
    ("data/common/doc_templates", "work_order_category_ua.html"),
    ("pdf_backend_playwright/templates", "paycheck.html"),
])
@pytest.mark.parametrize("metadata,expected", [({}, "001"), ({"order_number": None}, "001"), ({"order_number": ""}, "001"), ({"order_number": "CUSTOM-7"}, "CUSTOM-7")])
def test_order_number_fallback_in_every_template(source, filename, metadata, expected):
    env = Environment(loader=FileSystemLoader(ROOT / source), autoescape=True)
    data = {
        "company_info": {"company_name": "Test", "email": "test@example.com", "pricing_preferences": {"preferred_currency": "UAH"}},
        "metadata": metadata,
        "calculation": {"car": {}, "paint": {}, "order": {}, "calc": {}, "calc_by_category": {}, "grand_total": 0},
    }
    html = env.get_template(filename).render(data=data)
    assert f"№{expected}" in html
    assert "№None" not in html


@pytest.mark.parametrize("custom", [None, "<html><body>{{ data.company_info.company_name }} {{ data.calculation.car.make }}</body></html>"])
def test_actual_service_preserves_free_form_text_as_text(custom, monkeypatch):
    import importlib.util
    spec = importlib.util.spec_from_file_location("autolab_pdf_app", ROOT / "pdf_backend_playwright/app.py")
    service = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(service)
    monkeypatch.chdir(ROOT / "pdf_backend_playwright")
    data = {
        "company_info": {"company_name": "Shop <custom> & repair", "email": "test@example.com", "pricing_preferences": {"preferred_currency": "UAH"}},
        "custom_template_content": custom,
        "metadata": {},
        "calculation": {"car": {"make": "Brand <prototype>"}, "order": {}, "calc": {}},
    }
    html, error = service.render_template_from_data(data)
    assert error is None
    assert "Shop &lt;custom&gt; &amp; repair" in html
    assert "<custom>" not in html
    if custom:
        assert "Brand &lt;prototype&gt;" in html
