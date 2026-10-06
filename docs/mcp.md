# Autolab MCP

Autolab exposes seven tools at **`https://<autolab-host>/mcp`** over Streamable
HTTP. The server uses the official Rust MCP SDK and returns both structured JSON
and text content, with English and Ukrainian tool/argument descriptions. It does
not require client-side sampling, elicitation or model-specific extensions.

## Connecting an assistant

Sign in to Autolab and open **AI assistants** (`/app/mcp`). Copy the displayed MCP
URL into a remote MCP client's connection settings. OAuth opens Autolab's login
and consent screen; the user reviews the requested permissions before approving.
Connections can be revoked from the same page.

For clients that accept custom headers, create a scoped API key there and send
`Authorization: Bearer <key>`. Keys are displayed once, expire after one year,
and can be revoked immediately. An application login JWT is not an MCP key.
Do not put secrets in URLs. Model and client support are distinct: the server is
model-independent, while the client must support remote Streamable HTTP and
OAuth or Bearer headers. ChatGPT, Claude and Codex are the target clients; live
client acceptance requires a reachable HTTPS deployment and must be verified
against each client's currently available connection settings.

The server accepts SDK-supported protocol versions, including `2025-11-25` and
`2026-07-28`. Clients handle protocol negotiation; newer stateless requests need
the protocol metadata and method headers required by that version. No session
ID is needed for persistence: estimates are addressed by calculation ID.

## Tools and conversation flow

| Tool | Purpose |
|---|---|
| `search_catalog` | Discover makes/models, class/body pairs, parts/subparts, repair actions, colors, paint types, repair quality and PDF templates. |
| `create_calculation` | Create a durable draft with optional incomplete inputs or copy a saved calculation. |
| `get_calculation` | Resume a draft, inspect totals, warnings, missing inputs, archived entities and editable IDs. |
| `update_calculation` | Change inputs, selected parts, damage, quality, lookup overrides or cells; reset edits, restore rows or refresh sources. |
| `set_hour_rates` | Set base/named rates and assign rates to parts or tables. Defaults to calculation scope. |
| `get_company_info` | Read company details, currency and hourly rates. |
| `finalize_calculation` | Save a reviewed PDF and return its owner download URL and expiring public URL. |

Every estimate response includes `calculation_id`, `revision`, intermediate
rows/totals, `missing_inputs`, `warnings`, `processing_errors`, `invalid_cells`,
`ready_to_finalize` and a suggested next step. Rows are paginated (default 50,
maximum 100); follow `next_offset`. Use `get_calculation` with
`include_sources: true` to inspect saved lookup tables and overrides. Catalog
searches use the same pagination.
Vehicle `car.make` (brand), `model`, `year`, `vin`, `licensePlate` and `notes` accept
custom text without catalog, registry, VIN checksum or format verification.
Entered text is preserved. A unique catalog match can fill missing `carClass`
and `bodyType`; otherwise request those calculation classifications separately.
Catalog searching for vehicle identity is optional.

Use returned calculation identifiers exactly; display bilingual labels and ask the user to
choose ambiguous matches. `language` accepts `en`, `uk` or the frontend alias
`ua`; omission follows the company's preference.

Typical interaction:

1. Read company information, accept the supplied vehicle details, and search catalogs for the requested parts/classifications.
2. Start a draft, then ask for missing values instead of guessing them.
3. Update the draft using its latest `expected_revision`. Show intermediate
   work rows and totals so the user can review and adjust them.
4. Set rates for the current calculation, edit cells using stable entity IDs,
   and resolve validation or processing errors.
5. If the user requests a template, use `search_catalog` with `kind: "templates"` (follow pagination), then pass its exact filename as `template_name` to `finalize_calculation`. Every shared and personal template is supported; the default is `calculation_ua.html`. Missing/blank order numbers default to `001`.
6. Return `pdf.public_page_url` with its expiry for browser downloads. It shows a bilingual ready/download page and starts the download while keeping the page visible. `pdf.public_url` remains the direct PDF file for programmatic downloads. Both work without authentication and share the same revocation/expiry.

Example Ukrainian request: «Розрахуй ремонт капота з зовнішнім фарбуванням,
ставка 800 грн за нормо-годину». Example English request: “Estimate exterior
painting and repair of the hood at 800 UAH per labor hour.” Both use catalog
identifiers and `set_hour_rates` with calculation scope. Changing company
defaults requires an explicit request and `scope: "company"`.

```json
{
  "name": "set_hour_rates",
  "arguments": {
    "calculation_id": "<returned ID>",
    "expected_revision": 3,
    "base_amount": 800,
    "additional_rates": [{"id": "premium", "name": "Premium work", "amount": 1000}],
    "assignments": [{"part": "<catalog name>", "table_id": "<returned table ID>", "rate_id": "premium"}],
    "language": "uk"
  }
}
```

Omitting `additional_rates` preserves the list; supplying it replaces the list.
Omitting `parts` preserves selection; supplying it replaces the complete active
list, and `[]` removes all parts. Removed parts/rows retain compatible edits in
archives. Cell edits accept literal values, including explicit zero and blank;
`reset: true` removes the override. Invalid numeric drafts preserve the last
committed cell and block PDF finalization. Lookup overrides apply only to the
estimate. Saved source and processor snapshots remain until explicitly refreshed.
A stale revision fails without overwriting newer changes; read and retry.

## PDF storage and sharing

Both MCP finalization and **Save and share PDF** in the web print drawer persist
the generated PDF. **History** (`/app/history`) lists saved documents and supports
owner downloads, sharing for another 30 days, copying links and revocation.

Public URLs have a 256-bit unguessable capability:
`/public/pdfs/<43-character-token>.pdf`. They work without authentication, return
`application/pdf` with an attachment disposition, and expire after 30 days.
Anyone who has the link can download the PDF. Expiry and revocation are checked
on every request; responses are marked `no-store`. Re-sharing rotates the URL
and immediately invalidates the previous one. Missing, expired, revoked and
invalid links return 404. The owner retains authenticated download access after
expiry or revocation, including when their license expires. Deleted accounts
and accounts recreated with the same email cannot reuse the old public links.

PDF bytes live in `DATA_DIR_PATH/users/<encoded-email>/pdfs/<UUID>.pdf`.
Metadata, hashed credentials, OAuth state and draft indexes live in Sled's `mcp`
tree. Drafts use the existing `stored_calculations` directory and appear in the
web calculation browser. MCP-managed documents carry a revision guard for web
saves too. Repeated finalization of the same revision/payload returns the same
saved document; PDF service failure publishes no downloadable document.

These files and the Sled database are covered by existing data backups. Keep
`JWT_SECRET` stable: it also protects reproducible PDF capability URLs. Secrets
remain outside backups as described in [backup.md](backup.md).

Mutations are serialized per account; another account can continue working while
a PDF is generated.

## Authentication and permissions

Discovery endpoints are `/.well-known/oauth-protected-resource/mcp` (also at the
root path) and `/.well-known/oauth-authorization-server`. OAuth supports resource
indicators, authorization code with mandatory S256 PKCE, browser consent,
one-use short-lived codes, one-hour access tokens and rotating 30-day refresh
tokens. Refresh replay revokes the connection. Credentials are opaque, persisted
only as SHA-256 hashes, bound to the account's UUID and MCP resource URL.

`/oauth/register` supports public clients and `client_secret_post` or
`client_secret_basic`. HTTPS client metadata document URLs support public clients
(`token_endpoint_auth_method: "none"`); fetching rejects private network
addresses, pins validated DNS results, and disables redirects. Callback URLs must
match registration exactly, except HTTP loopback callbacks may use a different
port as required by RFC 8252 for native clients (including ChatGPT/Codex).
Callback host, path and query still match exactly; HTTPS callbacks require an
exact match including the port. The code and token exchange remain bound to the
exact callback selected during authorization. Callbacks have no fragment or
embedded credentials. Connections and keys are separately revocable.

| Scope | Tools |
|---|---|
| `company:read` | `get_company_info` |
| `company:write` | `set_hour_rates` with company scope |
| `calculations:read` | `search_catalog`, `get_calculation` |
| `calculations:write` | `create_calculation`, `update_calculation`, calculation rates |
| `pdfs:publish` | `finalize_calculation` |

Tool calls also require an active license. Connection/key management and saved
PDF owner downloads use normal application JWT authentication.

## Deployment and development

Set **`PUBLIC_BASE_URL`** to the externally reachable origin, for example
`https://autolab.example.com`, without a path or trailing application prefix.
HTTPS is required except on loopback. OAuth URLs and PDF links are constructed
from this configured origin, never from forwarded request headers. The Helm
chart uses `publicBaseUrl`, defaulting to `https://<ingress.host>`. Its ingress
must route `/mcp`, `/oauth/*`, `/.well-known/*`, `/public/pdfs/*`, `/api/*` and
`/app/*` to Autolab. Disable intermediary caching of public PDFs.

`MCP_ALLOWED_ORIGINS` is an optional comma-separated list of additional exact
origins permitted by MCP transport validation (Helm: `mcpAllowedOrigins`). The
configured public origin is always allowed. Requests without an Origin header
work for server-side clients. This setting does not enable cross-origin browser
JavaScript access; use the same-origin app or a server-side MCP client.

Locally the default origin is `http://localhost:${FRONTEND_PORT:-3000}`. Vite
proxies MCP, OAuth, discovery and public PDF routes alongside `/api` to the
backend. Set `PUBLIC_BASE_URL` explicitly when accessing the backend directly
or using a tunnel. The calculation modules in `calculation-engine/` are shared
by the browser and Rust's embedded QuickJS interpreter; Docker builds copy them
into both build stages. Backend evaluations expose no filesystem/network APIs
and are limited to 64 MiB memory, a 512 KiB stack, five seconds and four workers.

Relevant checks:

```bash
cd backend-service-rust && cargo test mcp::
# From repository root:
node --test calculation-engine/index.test.js carpaintr-front/src/calc/*.test.js
cd backend-integration-tests && uv run pytest tests/test_mcp.py -n 0
cd carpaintr-front && npx cypress run --spec cypress/e2e/mcp.cy.js
```

API/PDF tests use the integration suite's PDF mock. Verify the deployed real PDF
service and complete a login, calculation and public PDF download from each
target assistant before claiming live client acceptance.


Local validation on 2026-10-06: 75 backend integration tests, 14 Rust tests,
95 shared/frontend calculation tests, eight Jinja template tests, and 12 targeted
Cypress checks passed (MCP, editable documents and norm rates). Final MCP checks
also cover legacy imports and the print drawer's save/share action. Backend and
frontend builds, Helm rendering and restart recovery passed. Changed-file lint
passed; full frontend lint has five existing duplicate-key errors in
`src/vindecoder.js`. Live hosted assistant acceptance and a deployed real-PDF
service check remain deployment validation steps.


Follow-up validation on 2026-10-06: 19 Rust checks, 96 shared/frontend engine
checks, 30 template/service rendering checks, 10 MCP/PDF integration checks and
eight consent/download browser checks passed. Coverage includes unverified
vehicle identity, all shared/personal templates, default order number `001`,
HTML escaping, automatic downloads at 320px and capability revocation. Changed
frontend files pass lint; the five existing `vindecoder.js` duplicate keys remain.
