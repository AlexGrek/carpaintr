"""MCP protocol, interactive estimates, OAuth and durable public PDF links."""
import base64
import hashlib
import secrets
from urllib.parse import urlparse, parse_qs

import httpx
import pytest

pytestmark = [pytest.mark.integration]


def origin(client):
    parsed = urlparse(str(client.base_url))
    return f"{parsed.scheme}://{parsed.netloc}"


async def key(client, scopes=None):
    payload = {"name": "MCP integration test"}
    if scopes is not None:
        payload["scopes"] = scopes
    response = await client.post("/mcp/keys", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


async def rpc(client, token, method, params=None, *, protocol="2025-11-25"):
    payload = {"jsonrpc": "2.0", "id": secrets.randbelow(100000), "method": method}
    if params is not None:
        payload["params"] = params
    if protocol == "2026-07-28":
        payload.setdefault("params", {})["_meta"] = {
            "io.modelcontextprotocol/protocolVersion": protocol,
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": {"name": "autolab-tests", "version": "1"},
        }
    return await client.post(origin(client) + "/mcp", json=payload, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/json, text/event-stream", "MCP-Protocol-Version": protocol, **({"Mcp-Method": method, **({"Mcp-Name": params["name"]} if method == "tools/call" else {})} if protocol == "2026-07-28" else {}),
    })


async def call(client, token, name, args=None):
    response = await rpc(client, token, "tools/call", {"name": name, "arguments": args or {}})
    assert response.status_code == 200, response.text
    body = response.json()
    assert "result" in body, body
    result = body["result"]
    assert not result.get("isError"), result
    assert result["content"][0]["type"] == "text"
    return result["structuredContent"]


async def test_protocol_and_scoped_keys(licensed_client):
    client = licensed_client
    created = await key(client, ["company:read"])
    init = await rpc(client, created["key"], "initialize", {
        "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"},
    })
    assert init.status_code == 200, init.text
    assert init.json()["result"]["protocolVersion"] == "2025-11-25"
    assert init.json()["result"]["serverInfo"]["name"] == "Autolab MCP"
    tools = await rpc(client, created["key"], "tools/list")
    assert tools.status_code == 200, tools.text
    assert len(tools.json()["result"]["tools"]) == 7
    for tool in tools.json()["result"]["tools"]:
        assert "EN:" in tool["description"] and "UK:" in tool["description"]
    latest = await rpc(client, created["key"], "tools/list", protocol="2026-07-28")
    assert latest.status_code == 200, latest.text
    assert len(latest.json()["result"]["tools"]) == 7
    latest_call = await rpc(client, created["key"], "tools/call", {"name": "get_company_info", "arguments": {"language": "uk"}}, protocol="2026-07-28")
    assert latest_call.status_code == 200 and not latest_call.json()["result"].get("isError"), latest_call.text
    await call(client, created["key"], "get_company_info", {"language": "uk"})
    denied = await rpc(client, created["key"], "tools/call", {"name": "create_calculation", "arguments": {}})
    assert denied.status_code == 403
    assert "insufficient_scope" in denied.headers["www-authenticate"]
    assert (await client.delete(f"/mcp/keys/{created['id']}")).status_code == 200
    assert (await rpc(client, created["key"], "tools/list")).status_code == 401
    no_auth = await client.post(origin(client) + "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers={"Authorization": ""})
    assert no_auth.status_code == 401 and "resource_metadata" in no_auth.headers["www-authenticate"]


@pytest.mark.pdf
@pytest.mark.usefixtures("pdfgen_mock_configured")
async def test_interactive_calculation_and_public_pdf(licensed_client, http_client):
    client = licensed_client
    token = (await key(client))["key"]
    company_before = await call(client, token, "get_company_info")
    draft = await call(client, token, "create_calculation", {"language": "uk"})
    assert draft["missing_inputs"] and not draft["ready_to_finalize"]
    parts = await call(client, token, "search_catalog", {"kind": "parts", "car_class": "B", "body_type": "sedan", "query": "hood"})
    assert parts["items"]
    part = parts["items"][0]["name"]
    choices = await call(client, token, "search_catalog", {"kind": "repair_actions", "part": part})
    action = next(choice["id"] for choice in choices["items"] if "з зовнішнім фарбуванням" in choice["id"])
    result = await call(client, token, "update_calculation", {
        "calculation_id": draft["calculation_id"], "expected_revision": draft["revision"],
        "changes": {"car": {"carClass": "B", "bodyType": "sedan", "year": "2020"}, "paint": {"paintType": "metallic"}, "parts": [{"name": part, "selectedAction": action}]}, "language": "en",
    })
    assert result["rows"] and result["ready_to_finalize"], result
    assert result["revision"] == 1
    stale = await rpc(client, token, "tools/call", {"name": "update_calculation", "arguments": {"calculation_id": draft["calculation_id"], "expected_revision": 0, "changes": {}}})
    assert stale.json()["result"]["isError"]
    rates = await call(client, token, "set_hour_rates", {
        "calculation_id": result["calculation_id"], "expected_revision": result["revision"], "base_amount": 800,
        "additional_rates": [{"id": "premium", "name": "Premium", "amount": 1000}],
        "assignments": [{"part": part, "rate_id": "premium"}],
    })
    sources = await call(client, token, "get_calculation", {"calculation_id": result["calculation_id"], "include_sources": True})
    assert sources["lookup_tables"][part]["tables"]
    assert rates["rates"]["base"] == 800
    company_after = await call(client, token, "get_company_info")
    assert company_after["pricing_preferences"] == company_before["pricing_preferences"]
    table_id = next(entry["table_id"] for entry in rates["rows"] if entry["row"]["kind"] == "labor")
    rates = await call(client, token, "set_hour_rates", {"calculation_id": rates["calculation_id"], "expected_revision": rates["revision"], "assignments": [{"part": part, "table_id": table_id, "rate_id": "base"}]})
    assert all(entry["row"]["price"] == 800 for entry in rates["rows"] if entry["table_id"] == table_id and entry["row"]["kind"] == "labor")
    labor = next(entry["row"] for entry in rates["rows"] if entry["row"]["kind"] == "labor")
    edited = await call(client, token, "update_calculation", {
        "calculation_id": rates["calculation_id"], "expected_revision": rates["revision"],
        "changes": {"edits": [{"entity_id": labor["id"], "field": "sum", "value": "123,45"}], "order": {"orderNumber": "MCP-001", "orderNotes": "Український кошторис"}},
    })
    row = next(entry["row"] for entry in edited["rows"] if entry["row"]["id"] == labor["id"])
    assert row["sum"] == 123.45
    final_args = {"calculation_id": edited["calculation_id"], "expected_revision": edited["revision"]}
    pdf = (await call(client, token, "finalize_calculation", final_args))["pdf"]
    assert pdf["public_url"] and pdf["expires_at"] - pdf["created_at"] == 30 * 86400
    public = await http_client.get(pdf["public_url"])
    assert public.status_code == 200 and public.content.startswith(b"%PDF")
    assert public.headers["content-type"] == "application/pdf" and "no-store" in public.headers["cache-control"]
    again = (await call(client, token, "finalize_calculation", final_args))["pdf"]
    assert again["document_id"] == pdf["document_id"] and again["public_url"] == pdf["public_url"]
    rotation = await client.post(f"/pdfs/{pdf['document_id']}/share")
    assert rotation.status_code == 200
    rotated = rotation.json()
    assert rotated["public_url"] != pdf["public_url"]
    assert (await http_client.get(pdf["public_url"])).status_code == 404
    assert (await http_client.get(rotated["public_url"])).status_code == 200
    assert (await client.delete(f"/pdfs/{pdf['document_id']}/share")).status_code == 200
    assert (await http_client.get(rotated["public_url"])).status_code == 404
    assert (await client.get(f"/pdfs/{pdf['document_id']}")).status_code == 200
    assert (await http_client.get(f"/pdfs/{pdf['document_id']}")).status_code == 401


async def test_oauth_pkce_and_refresh_replay(licensed_client):
    client = licensed_client
    base = origin(client)
    redirect = "http://localhost:19000/callback"
    registration = await client.post(base + "/oauth/register", json={"client_name": "OAuth integration", "redirect_uris": [redirect], "token_endpoint_auth_method": "none"})
    assert registration.status_code == 201
    client_id = registration.json()["client_id"]
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    async with httpx.AsyncClient(follow_redirects=False) as browser:
        authorization = await browser.get(base + "/oauth/authorize", params={"client_id": client_id, "redirect_uri": redirect, "response_type": "code", "code_challenge": challenge, "code_challenge_method": "S256", "state": "state-1", "resource": base + "/mcp"})
    assert authorization.status_code == 303, authorization.text
    request = parse_qs(urlparse(authorization.headers["location"]).query)["request"][0]
    info = await client.post("/mcp/authorize", json={"request": request})
    assert info.json()["client_name"] == "OAuth integration"
    consent = await client.post("/mcp/authorize", json={"request": request, "decision": "approve"})
    assert consent.status_code == 200
    callback = parse_qs(urlparse(consent.json()["redirect"]).query)
    assert callback["state"] == ["state-1"] and callback["iss"] == [base]
    payload = {"grant_type": "authorization_code", "code": callback["code"][0], "client_id": client_id, "redirect_uri": redirect, "code_verifier": verifier, "resource": base + "/mcp"}
    assert (await client.post(base + "/oauth/token", data={**payload, "code_verifier": "x" * 64})).status_code == 400
    tokens = await client.post(base + "/oauth/token", data=payload)
    assert tokens.status_code == 200, tokens.text
    assert tokens.headers["cache-control"] == "no-store"
    assert (await client.post(base + "/oauth/token", data=payload)).status_code == 400
    initial = tokens.json()
    await call(client, initial["access_token"], "get_company_info")
    refresh_payload = {"grant_type": "refresh_token", "refresh_token": initial["refresh_token"], "client_id": client_id, "resource": base + "/mcp"}
    refreshed = await client.post(base + "/oauth/token", data=refresh_payload)
    assert refreshed.status_code == 200 and refreshed.json()["refresh_token"] != initial["refresh_token"]
    assert (await client.post(base + "/oauth/token", data=refresh_payload)).status_code == 400
    assert (await rpc(client, refreshed.json()["access_token"], "tools/list")).status_code == 401


async def test_invalid_inputs_and_account_isolation(licensed_client, seed_authenticated_client):
    token = (await key(licensed_client))["key"]
    draft = await call(licensed_client, token, "create_calculation")
    other_token = (await key(seed_authenticated_client))["key"]
    other = await rpc(seed_authenticated_client, other_token, "tools/call", {"name": "get_calculation", "arguments": {"calculation_id": draft["calculation_id"]}})
    assert other.json()["result"]["isError"]
    invalid = await rpc(licensed_client, token, "tools/call", {"name": "create_calculation", "arguments": {"inputs": {"parts": "bad"}}})
    assert invalid.json()["result"]["isError"]
    invalid_year = await rpc(licensed_client, token, "tools/call", {"name":"update_calculation","arguments":{"calculation_id":draft["calculation_id"],"expected_revision":draft["revision"],"changes":{"car":{"year":"unknown"}}}})
    assert invalid_year.json()["result"]["isError"]
    traversal = await rpc(licensed_client, token, "tools/call", {"name": "create_calculation", "arguments": {"saved_filename": "../company.json"}})
    assert traversal.json()["result"]["isError"]
    hostile = await licensed_client.post(origin(licensed_client) + "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"})
    assert hostile.status_code == 403


@pytest.mark.pdf
@pytest.mark.usefixtures("pdfgen_mock_configured")
async def test_web_saved_pdf_and_cross_client_revision_guard(licensed_client, seed_authenticated_client, http_client):
    client = licensed_client
    token = (await key(client))["key"]
    draft = await call(client, token, "create_calculation")
    stored = await client.get('/user/calculationstore', params={'filename': draft['saved_filename']})
    assert stored.status_code == 200
    web_snapshot = stored.json()
    newer = await call(client, token, 'update_calculation', {
        'calculation_id': draft['calculation_id'], 'expected_revision': draft['revision'],
        'changes': {'order': {'orderNumber': 'NEW'}},
    })
    web_snapshot['revision'] += 1
    stale = await client.post('/user/calculationstore', json=web_snapshot)
    assert stale.status_code == 400
    reloaded = (await client.get('/user/calculationstore', params={'filename': draft['saved_filename']})).json()
    reloaded['revision'] += 1
    reloaded['order']['orderNumber'] = 'WEB'
    assert (await client.post('/user/calculationstore', json=reloaded)).status_code == 200
    current = await call(client, token, 'get_calculation', {'calculation_id': newer['calculation_id']})
    assert current['revision'] == reloaded['revision']
    copied = await call(client, token, "create_calculation", {"saved_filename": draft["saved_filename"]})
    assert copied["calculation_id"] != draft["calculation_id"] and copied["saved_filename"] != draft["saved_filename"]
    assert copied["revision"] == 0
    legacy_filename = f"legacy-mcp-{secrets.token_hex(6)}.json"
    legacy = {"car":{"year":"2020","carClass":"B","bodyType":"sedan","storeFileName":legacy_filename},"calculations":{},"parts":{"selectedParts":[]}}
    assert (await client.post('/user/calculationstore',json=legacy)).status_code == 200
    legacy_copy = await call(client, token, 'create_calculation', {'saved_filename':legacy_filename})
    assert legacy_copy['rates']['currency'] and isinstance(legacy_copy['rates']['additional'], list)
    legacy_rates = await call(client,token,'set_hour_rates',{'calculation_id':legacy_copy['calculation_id'],'expected_revision':legacy_copy['revision'],'base_amount':500})
    assert legacy_rates['rates']['base'] == 500
    payload = {'calculation': {'car': {'year': '2020', 'carClass': 'B', 'bodyType': 'sedan'}, 'calc': {}, 'grand_total': 0}, 'metadata': {'order_number': 'WEB-PDF', 'order_notes': None}}
    pdf = await client.post('/pdfs', json=payload)
    assert pdf.status_code == 200, pdf.text
    document = pdf.json()
    assert (await http_client.get(document['public_url'])).status_code == 200
    assert (await seed_authenticated_client.get(f"/pdfs/{document['document_id']}")).status_code == 404
    assert (await seed_authenticated_client.post(f"/pdfs/{document['document_id']}/share")).status_code == 404
    assert any(p['document_id'] == document['document_id'] for p in (await client.get('/pdfs')).json())
    repeated = await client.post('/pdfs', json=payload)
    assert repeated.json()['document_id'] == document['document_id']


async def test_oauth_rejects_invalid_redirects_and_private_metadata(licensed_client):
    base = origin(licensed_client)
    malformed = await licensed_client.post(base + '/oauth/register', json={'redirect_uris': ['http://evil.example/callback']})
    assert malformed.status_code == 400
    for client_id in ['https://127.0.0.1/client.json', 'https://[::1]/client.json', 'https://169.254.169.254/client.json']:
        response = await licensed_client.get(base + '/oauth/authorize', params={'client_id': client_id, 'redirect_uri': 'http://localhost:19000/callback', 'response_type': 'code', 'code_challenge': 'a'*43, 'code_challenge_method': 'S256', 'resource': base + '/mcp'})
        assert response.status_code == 400
