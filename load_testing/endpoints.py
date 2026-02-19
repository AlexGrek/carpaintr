"""
Endpoint definitions for load testing: heavy (license-protected), light (auth-only), and carparts variations.
"""


def _build_carparts_variations() -> list[tuple[str, str, str]]:
    """Build carparts and carparts_t2 endpoint variations with class/body combos."""
    combos = [
        ("B", "hatchback%205%20doors"),
        ("B", "hatchback%203%20doors"),
        ("C", "hatchback%205%20doors"),
        ("C", "hatchback%203%20doors"),
        ("C", "sedan"),
        ("D", "sedan"),
        ("E", "sedan"),
    ]
    endpoints = []
    for cls, body in combos:
        short_body = body.replace("%20", "").replace("%25", "")[:6]
        endpoints.append(("GET", f"/user/carparts/{cls}/{body}", f"carparts/{cls}/{short_body}"))
        endpoints.append(("GET", f"/user/carparts_t2/{cls}/{body}", f"carparts_t2/{cls}/{short_body}"))
    return endpoints


# Pre-built so we don't rebuild every iteration
_CARPARTS_VARIATIONS = _build_carparts_variations()

# Heavy endpoints that do filesystem searches / file assembly (license-protected)
HEAVY_ENDPOINTS = [
    ("GET", "/user/carmakes", "carmakes"),
    ("GET", "/user/list_class_body_types", "list_class_body"),
    ("GET", "/user/global/colors.json", "colors.json"),
    ("GET", "/user/global/quality.yaml", "quality.yaml"),
    ("GET", "/user/processors_bundle", "processors_bundle"),
    ("GET", "/user/all_parts_t2", "all_parts_t2"),
    ("GET", "/user/all_parts", "all_parts"),
] + _CARPARTS_VARIATIONS

# Light auth-only endpoints (no license required, no filesystem search)
LIGHT_ENDPOINTS = [
    ("GET", "/getactivelicense", "get_active_license"),
    ("GET", "/getcompanyinfo", "get_company_info"),
    ("GET", "/mylicenses", "my_licenses"),
    ("GET", "/editor/list_user_files", "list_user_files"),
]

ALL_ENDPOINTS = HEAVY_ENDPOINTS + LIGHT_ENDPOINTS
