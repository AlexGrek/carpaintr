# API Documentation

**Base URL:** `/api/v1`
**Backend Port:** `8080`

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Authentication Flow

1. `POST /api/v1/register` — create account (returns empty body)
2. `POST /api/v1/login` — get JWT token
3. `POST /api/v1/license_upload` — upload license file (or admin generates one)
4. Access `/api/v1/user/*` endpoints with JWT + valid license

---

## Middleware Layers

| Layer | Applies to |
|-------|-----------|
| `jwt_auth` | All protected routes |
| `admin_check` | `/admin/*` routes |
| `license_expiry` | `/user/*`, `/editor/*`, company info, calc routes |

---

## Public Endpoints

### `POST /api/v1/register`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret",
  "invite": ""
}
```

**Response:** `200 OK` (empty body)

---

### `POST /api/v1/login`
Authenticate and receive JWT token.

**Request:**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Response:**
```json
{ "token": "<jwt>" }
```

---

## License Endpoints

Auth: **JWT required**

### `GET /api/v1/license`
Get current active license details.

**Response:**
```json
{
  "claims": { "sub": "user@example.com", "exp": 1234567890, "level": "Basic" },
  "expiration_date": "2026-01-01T00:00:00Z",
  "days_left": 90,
  "level": "Basic"
}
```

---

### `GET /api/v1/getlicenses`
List all license filenames for the authenticated user.

**Response:** `["license1.license", "license2.jwt"]`

---

### `GET /api/v1/getactivelicense`
Check for an active (non-expired) license.

**Response:**
```json
{
  "has_active_license": true,
  "license": { /* LicenseData or null */ }
}
```

---

### `GET /api/v1/mylicenses`
Get full data for all user license files.

**Response:** Array of `LicenseData` objects.

---

### `POST /api/v1/license_upload`
Upload a license file.

**Request:** Multipart form, field name `license`, extension `.license` or `.jwt`.

**Validation:** JWT signature verified, email must match authenticated user, expiry checked.

**Response:** JSON string message.

---

## User / Company Endpoints

Auth: **JWT + license**

### `GET /api/v1/getcompanyinfo`
Get company profile. Creates default if none exists.

**Response:**
```json
{
  "email": "user@example.com",
  "license": null,
  "company_name": "My Company",
  "company_addr": "",
  "current_time": "2026-03-23T00:00:00Z",
  "lang_ui": "ua",
  "lang_output": "ua",
  "pricing_preferences": {
    "preferred_currency": "UAH",
    "norm_price": { "amount": 0, "currency": "UAH" }
  }
}
```

---

### `POST /api/v1/updatecompanyinfo`
Update company profile.

**Request:** Same structure as `GET /getcompanyinfo` response.

**Response:** Updated `CompanyInfo` object.

---

## Notification Endpoints

Auth: **JWT required** (no license check)

### `GET /api/v1/notifications`
List all notifications for the authenticated user.

**Response:**
```json
[
  {
    "id": "abc123",
    "email": "user@example.com",
    "title": "Your license expires soon",
    "body": "Renew before 2026-04-01",
    "read": false,
    "timestamp": "2026-03-20T10:00:00Z"
  }
]
```

---

### `GET /api/v1/notifications/unread-count`
Count unread notifications.

**Response:** `{ "count": 3 }`

---

### `PATCH /api/v1/notifications/{id}/read`
Mark a notification as read.

**Response:** Updated `Notification` object.

---

## Support Endpoints

Auth: **JWT required**

### `POST /api/v1/user/support_request_submit`
Submit a new support ticket.

**Request:**
```json
{
  "title": "Issue title",
  "description": "Detailed description",
  "req_type": "bug",
  "contacts": { "phone": "+380..." },
  "attachments": ["attachment-id-1"]
}
```

**Response:** Created `SupportRequest` object (with auto-generated `id` and `timestamp`).

---

### `GET /api/v1/user/support_requests`
List all support tickets for the authenticated user.

**Response:** Array of `SupportRequest` objects.

---

### `GET /api/v1/user/support_request?email=<email>&id=<id>`
Get a specific support ticket (must belong to authenticated user).

---

### `POST /api/v1/user/support_message?email=<email>&id=<id>`
Add a message to a support ticket. `is_support_response` is forced to `false`.

**Request:**
```json
{ "text": "My reply", "resolved": false }
```

---

### `POST /api/v1/support_frontend_failure`
Report a frontend error.

**Request:**
```json
{
  "component": "CalcWizard",
  "message": "Cannot read property...",
  "app_version": "1.2.3"
}
```

**Response:** `200 OK` (empty)

---

## Attachment Endpoints

Auth: **JWT required**

### `POST /api/v1/user/attach`
Upload a file attachment (multipart).

**Response:**
```json
{
  "id": "uuid",
  "file_name": "photo.jpg",
  "file_path": "obfuscated/path",
  "owner_user_email": "user@example.com",
  "size": 204800,
  "is_public": false
}
```

---

### `GET /api/v1/user/attachment/{id}`
Download an attachment. Admins can access any; users only their own.

**Response:** Binary file with `Content-Type` and `Content-Disposition` headers.

---

### `GET /api/v1/user/attachment_meta/{id}`
Get attachment metadata without downloading.

**Response:** Attachment handle object (same structure as upload response).

---

### `GET /api/v1/user/attachment_list`
List all attachments for the authenticated user.

**Response:** Array of attachment handle objects.

---

## Calculation / Data Endpoints

Auth: **JWT + license**

### `GET /api/v1/user/carmakes`
List all car manufacturers.

**Response:** `["Toyota", "BMW", ...]`

---

### `GET /api/v1/user/carmodels/{maker}`
Get all models for a manufacturer.

**Path:** `maker` must be alphanumeric/dashes (sanitized).

**Response:** Parsed YAML car data.

---

### `GET /api/v1/user/carparts/{class}/{body_type}`
Get car parts for a class/body-type from the T1 table.

**Response:** Array of `CarPart` objects.

---

### `GET /api/v1/user/carparts_t2/{class}/{body_type}`
Get T2 subcomponents for a class/body-type.

**Response:** Array of parsed T2 entries.

---

### `GET /api/v1/user/all_parts`
Get all unique part names from the T1 table.

**Response:** `["bumper_front", "hood", ...]`

---

### `GET /api/v1/user/all_parts_t2`
Get all T2 subcomponents.

**Response:**
```json
{ "data": [...], "errors": [] }
```

---

### `GET /api/v1/user/list_repair_types`
Get all repair type categories.

**Response:** Array of repair type strings.

---

### `GET /api/v1/user/lookup_all_tables?car_class=<>&car_type=<>&part=<>`
Lookup parts across all repair tables by class, body type, and part name.

**Response:** Array of matching rows.

---

### `GET /api/v1/user/lookup_all_tables_all?part=<>`
Lookup parts across all tables regardless of car class/type.

**Response:** Array of matching rows.

---

### `GET /api/v1/user/list_class_body_types`
Get car class → body type mapping (YAML).

**Response:** Plain text YAML.

---

### `GET /api/v1/user/season`
Get current season data from `global/seasons.yaml`.

**Response:** Season object.

---

### `GET /api/v1/user/global/{path}`
Read a global configuration file (from `global/` directory).

**Response:** Plain text file content.

---

## Calculation Persistence Endpoints

Auth: **JWT + license**

### `POST /api/v1/user/calculationstore`
Save a calculation.

**Request:**
```json
{
  "car": {
    "make": "Toyota",
    "model": "Corolla",
    "year": "2020",
    "car_class": "B",
    "body_type": "sedan",
    "license_plate": "AA1234BB",
    "vin": null,
    "notes": null,
    "store_file_name": null
  },
  "calculations": { /* calculation data */ }
}
```

**Response:** `{ "saved_file_path": "corolla_2020.json" }`

---

### `GET /api/v1/user/calculationstore?filename=<filename>`
Load a saved calculation by filename.

**Response:** Full `CarCalcData` object.

---

### `GET /api/v1/user/calculationstore/list`
List all saved calculations for the user.

**Response:** Array of file summary objects.

---

## Calculation Output Endpoints

Auth: **JWT + license**

### `POST /api/v1/user/generate_pdf_table`
Generate a PDF from calculation data.

**Request:**
```json
{
  "custom_template_content": null,
  "template_name": "default",
  "calculation": { /* calculation JSON */ },
  "metadata": { /* template metadata */ }
}
```

**Response:** PDF binary (`Content-Type: application/pdf`, `Content-Disposition: attachment`).

---

### `POST /api/v1/user/generate_html_table`
Generate an HTML table from calculation data (same request as PDF).

**Response:** HTML text (`Content-Type: text/plain`, `Content-Disposition: attachment`).

---

## Plugin / Template Endpoints

Auth: **JWT + license**

### `GET /api/v1/user/processors_bundle`
Get all JavaScript processor plugins bundled into one file.

**Response:** `Content-Type: text/javascript` — `exports.default = [...]`

---

### `GET /api/v1/user/list_templates`
List available HTML templates.

**Response:** `["default.html", "custom.html"]`

---

### `GET /api/v1/user/list_samples`
List available calculation samples.

**Response:** Array of sample filenames.

---

### `GET /api/v1/user/get_template/{path}`
Read an HTML template file.

**Response:** HTML text content.

---

### `GET /api/v1/user/get_sample/{path}`
Read a sample calculation file.

**Response:** JSON content.

---

## Editor Endpoints

Auth: **JWT + license**

### `GET /api/v1/editor/list_user_files`
List user's editable files with version history metadata.

**Response:** Array of file metadata objects (include git commit info).

---

### `GET /api/v1/editor/list_common_files`
List common/shared editable files.

**Response:** Array of file metadata objects.

---

### `GET /api/v1/editor/all_tables_headers`
Get column headers from all CSV tables.

**Response:** `{ "table_name": ["col1", "col2", ...], ... }`

---

### `GET /api/v1/editor/read_user_file/{path}`
Read a user file.

**Response:** Plain text / YAML / CSV content.

---

### `GET /api/v1/editor/validate_user_file/{path}`
Validate a CSV file for structural issues.

**Response:** Validation error report. (Only `.csv` files supported.)

---

### `GET /api/v1/editor/fix_user_file/{path}`
Auto-fix CSV issues and commit the fix.

**Response:** Fix report object.

---

### `POST /api/v1/editor/upload_user_file/{path}`
Upload or overwrite a user file. Creates a git commit.

**Request:** Multipart file upload.

**Response:** JSON success message.

---

### `DELETE /api/v1/editor/delete_user_file/{path}`
Delete a user file. Creates a git commit.

**Response:** String message.

---

### `GET /api/v1/editor/read_common_file/{path}`
Read a shared/common file.

**Response:** Plain text content.

---

### `GET /api/v1/editor/list_commits`
List git commits for the user's file repository.

**Response:** Array of commit objects.

---

### `POST /api/v1/editor/revert_commit`
Revert to a previous commit. Clears all caches.

**Request:**
```json
{ "commit_hash": "last" }
```
Use `"last"` for the most recent commit, or provide a specific hash.

**Response:** Revert result object.

---

## Admin Endpoints

Auth: **JWT + admin role** (email must be in `admins.txt`)

### `GET /api/v1/admin/check_admin_status`
Verify admin status.

**Response:** `{ "is_admin": true }`

---

### `GET /api/v1/admin/listusers`
List all registered user emails.

**Response:** `["user1@example.com", "user2@example.com"]`

---

### `POST /api/v1/admin/impersonate`
Generate a JWT token for another user.

**Request:**
```json
{ "action": "impersonate", "email": "target@example.com" }
```

**Response:** `{ "token": "<jwt>" }`

---

### `GET /api/v1/admin/logs?lines=<n>`
Get the last N lines from the application log.

**Response:** Array of log line strings.

---

### `GET /api/v1/admin/logs_frontend?lines=<n>`
Get the last N lines from the frontend failure log.

**Response:** Array of log line strings.

---

### `GET /api/v1/admin/cache_status`
Get current cache statistics.

**Response:** Cache size/stats object.

---

### `POST /api/v1/admin/cache_clear_all`
Clear all in-memory caches.

**Response:** `{ "cache_invalidated": true }`

---

### `POST /api/v1/admin/manageuser`
Delete a user or change their password.

**Request (delete):**
```json
{ "action": "delete", "email": "user@example.com" }
```

**Request (change password):**
```json
{ "action": "change_pass", "email": "user@example.com", "data": "newpassword" }
```

**Response:** `200 OK` (empty)

---

### `POST /api/v1/admin/license/generate`
Generate a license for a user (saves to their license directory).

**Request (by days):**
```json
{ "email": "user@example.com", "days": 365, "level": "Basic" }
```

**Request (by date):**
```json
{ "email": "user@example.com", "expiry_date": "2027-01-01T00:00:00Z", "level": "Basic" }
```

`level` is optional (default: `"Basic"`). Uses an **untagged enum** — send JSON directly without variant tags.

**Response:** String message.

---

### `POST /api/v1/admin/license/invalidate/{email}`
Invalidate the cached license for a user.

**Response:** String message.

---

### `GET /api/v1/admin/license/list/{user_email}`
List all license files for a user.

**Response:** Array of license filenames.

---

### `GET /api/v1/admin/license/{user_email}/{license_filename}`
Read the raw JWT content of a license file.

**Response:** Plain text JWT token.

---

### `DELETE /api/v1/admin/license/{user_email}/{license_filename}`
Delete a license file. Invalidates the user's license cache.

**Response:** `200 OK` (empty)

---

### `POST /api/v1/admin/invite/generate`
Generate an invitation code.

**Request:**
```json
{
  "evaluation_license_type": "Basic",
  "evaluation_license_duration_days": 30,
  "usage_policy": "UseOnce"
}
```

`usage_policy` options: `"UseOnce"`, `"UseForever"`, `{ "UseUpToCertainLimit": 5 }`

**Response:** `Invite` object.

---

### `GET /api/v1/admin/invite/list`
List all active invitations.

**Response:** Array of `Invite` objects.

---

### `GET /api/v1/admin/invite/list_archived`
List all archived invitations.

**Response:** Array of `Invite` objects.

---

### `GET /api/v1/admin/export_user_data/{user_email}`
Export a user's personal directory as a ZIP archive.

**Response:** ZIP binary (`Content-Type: application/zip`, filename: `user_export_<email>.zip`).

---

### `POST /api/v1/admin/trigger_list_class_body_types_rebuild_global`
Rebuild the car class → body type mapping from the T1 table.

**Response:** `HashMap<String, Vec<String>>` mapping.

---

### `GET /api/v1/admin/support_all`
List all support tickets across all users.

**Response:** Array of `SupportRequest` objects.

---

### `GET /api/v1/admin/support_unresponded`
List support tickets with no admin response.

**Response:** Array of `SupportRequest` objects.

---

### `GET /api/v1/admin/support_get?email=<>&id=<>`
Get a specific support ticket by user email and ticket ID.

**Response:** `SupportRequest` object.

---

### `DELETE /api/v1/admin/support_delete?email=<>&id=<>`
Delete a support ticket (archived to `deleted_support_requests/`).

**Response:** `200 OK` (empty)

---

### `POST /api/v1/admin/support_message?email=<>&id=<>`
Add an admin message to a support ticket. `is_support_response` is set to `true`.

**Request:** `{ "text": "Admin reply", "resolved": true }`

**Response:** `200 OK` (empty)

---

### `GET /api/v1/admin/notifications`
List all notifications for all users.

**Response:** Array of `Notification` objects.

---

### `POST /api/v1/admin/notifications`
Create a notification for a user.

**Request:**
```json
{ "email": "user@example.com", "title": "Notice", "body": "Details here" }
```

**Response:** Created `Notification` object.

---

### `GET /api/v1/admin/attachment_list`
List all file attachments across all users.

**Response:** Array of attachment handle objects.

---

### Admin Editor Endpoints

### `GET /api/v1/admin/editor/list_files`
List all global admin-managed files.

**Response:** Array of file metadata objects.

---

### `GET /api/v1/admin/editor/read_file/{path}`
Read a global file (path uses `/` separators, URL encoded).

**Response:** Plain text content.

---

### `POST /api/v1/admin/editor/upload_file/{path}`
Upload/overwrite a global file.

**Request:** Multipart file upload.

**Response:** JSON success message.

---

### `DELETE /api/v1/admin/editor/delete_file/{path}`
Delete a global file.

**Response:** String message.

---

## Error Responses

All errors return a JSON body with an error message:

```json
{ "error": "Description of the error" }
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad request / invalid input |
| `401` | Unauthorized (missing/invalid JWT, license expired or not found) |
| `403` | Forbidden (not admin, or accessing another user's resource) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `supersecretjwtkey` | Signs user JWT tokens |
| `LICENSE_JWT_SECRET` | `licensejwtsecretkey` | Signs license tokens |
| `DATABASE_URL` | `data/sled_db` | Sled database path |
| `DATA_DIR_PATH` | `data` | Root data directory |
| `ADMIN_FILE_PATH` | `admins.txt` | Path to admin email list |
| `LOG_FILE_PATH` | `application.log` | Application log path |
| `PDF_GEN_URL_POST` | `localhost:5000/generate` | PDF service endpoint |
| `LICENSE_CACHE_SIZE` | `100` | Max cached licenses |
