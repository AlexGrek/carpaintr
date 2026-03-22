# Backend (Rust) Context

Load this context when working on `backend-service-rust/`.

> **Keep this file up-to-date** when adding new endpoints, middleware, modules, or changing patterns. It is the single source of truth for backend conventions.

---

## Full API reference → [`docs/api.md`](../../docs/api.md)

---

## Directory Structure

```
backend-service-rust/src/
├── main.rs                         # Route registration, AppState init, server startup
├── state.rs                        # AppState struct (shared across all handlers)
├── errors.rs                       # AppError enum → HTTP responses
├── middleware/                     # JWT auth, admin check, license expiry extractors
├── auth/                           # JWT creation/validation, bcrypt, invite logic
├── db/                             # Sled KV operations (users, requests, notifications, attachments)
├── models/                         # Request/response structs (serde)
├── calc/                           # Business logic: T1/T2 table processing, car data, seasons
├── cache/                          # LicenseCache (LRU, in-memory)
├── utils/                          # DataStorageCache, filesystem helpers (safe_join, safe_read, etc.)
├── api/v1/
│   ├── auth.rs                     # register, login, impersonate, health
│   ├── user.rs                     # license upload, company info, active license
│   ├── license.rs                  # get_license, get_license_list, invalidate
│   ├── admin.rs                    # user management, logs, cache, exports
│   ├── admin_editor_endpoints.rs   # global file CRUD, class/body rebuild
│   ├── editor_endpoints.rs         # user file CRUD with git history
│   ├── support.rs                  # support tickets, messages, frontend failure reports
│   ├── attachments.rs              # file upload/download
│   ├── notifications.rs            # list, unread count, mark read
│   ├── templating_endpoints.rs     # templates, samples
│   └── calc/
│       ├── data_endpoints.rs       # car makes/models/parts, T1/T2 lookups, global files
│       ├── persistence_endpoints.rs # save/load/list calculations
│       ├── output_endpoints.rs     # PDF/HTML generation
│       └── plugin_endpoints.rs     # JS processor bundle
├── exlogging.rs                    # Structured logging (log_event)
├── transactionalfs.rs              # Git-backed file commits
└── cleanup.rs                      # Periodic cleanup task
```

---

## AppState

```rust
pub struct AppState {
    pub db: AppDb,                       // Sled trees: users, requests, notifications, attachments
    pub auth: Auth,                      // JWT sign/verify + bcrypt
    pub license_cache: Arc<LicenseCache>,
    pub admin_file_path: PathBuf,        // admins.txt
    pub data_dir_path: PathBuf,          // /app/data — user files, common tables, logs
    pub jwt_license_secret: String,
    pub pdf_gen_api_url_post: String,
    pub cache: Arc<DataStorageCache>,    // LRU cache for file reads
}
```

Passed to handlers as `State(app_state): State<Arc<AppState>>`.

---

## Route Protection (3 layers)

```
GET /api/v1/health           ← public (no auth)
POST /api/v1/register        ← public
POST /api/v1/login           ← public

Everything else              ← jwt_auth_middleware (validates Bearer token, injects email into extensions)
  /admin/*                   ← + admin_check_middleware (checks email against admins.txt)
  /user/*                    ← + license_expiry_middleware (validates active license)
  /editor/*                  ← + license_expiry_middleware
```

Middleware is applied innermost-first in `main.rs`:
```rust
.nest("/user", Router::new()
    .route(...)
    .layer(from_fn_with_state(state, license_expiry_middleware))
)
.layer(from_fn_with_state(state, jwt_auth_middleware))
```

---

## Handler Pattern

```rust
pub async fn my_handler(
    AuthenticatedUser(user_email): AuthenticatedUser,  // custom extractor → user email
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<MyRequest>,                        // or Query<Params>, Path<P>
) -> Result<impl IntoResponse, AppError> {
    // do work
    Ok(Json(response))
}
```

- Always return `Result<impl IntoResponse, AppError>` — errors auto-convert to HTTP
- `AuthenticatedUser` is available on any route behind `jwt_auth_middleware`
- Admin handlers additionally verify via middleware; no need to re-check in the handler

---

## Error Handling

Single `AppError` enum in `src/errors.rs`. Each variant maps to an HTTP status code and logs automatically:

| Variant | Status |
|---------|--------|
| `InvalidCredentials` / `Unauthorized` | 401 |
| `LicenseExpired` / `LicenseNotFound` | 401 |
| `Forbidden` | 403 |
| `UserNotFound` / `NotFound` | 404 |
| `UserExists` / `InvalidData` / `BadRequest` | 400 |
| `InternalServerError` / others | 500 |

Use `?` to propagate — never construct raw HTTP responses for errors.

---

## File Operations — always use `src/utils/`

Never construct paths manually. All file access goes through:

```rust
use crate::utils::{safe_read, safe_write_overwrite, user_personal_directory_from_email};

// Get user's base directory
let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;

// Read (path-traversal safe + cached)
let bytes = safe_read(&user_path, Path::new("subdir/file.csv"), &app_state.cache).await?;

// Write (invalidates cache)
safe_write_overwrite(user_path, PathBuf::from("subdir/file.json"), content, &app_state.cache).await?;
```

- `safe_join()` validates the resolved path stays inside `base`
- Cache is invalidated on write
- User dirs are percent-encoded emails: `users/user%40example%2Ecom/`

---

## Database (Sled)

```rust
// Insert (explicit flush for durability)
let key = email.as_bytes();
let value = serde_json::to_vec(&user)?;
self.users_tree.insert(key, value)?;
self.users_tree.flush()?;

// Read
match self.users_tree.get(email.as_bytes())? {
    Some(ivec) => Ok(Some(serde_json::from_slice(&ivec)?)),
    None => Ok(None),
}
```

- No ORM, no migrations. Schema is implicit in key patterns like `users::{email}`.
- Always call `.flush()` after writes.
- All Sled errors propagate through `AppError` via `?`.

---

## Logging

```rust
use crate::exlogging::{log_event, LogLevel};

log_event(LogLevel::Info,  "User registered",       Some(&user_email));
log_event(LogLevel::Debug, "Cache hit for license", Some(&user_email));
log_event(LogLevel::Error, format!("Failed: {e}"),  None::<&str>);
```

Levels: `Info`, `Debug`, `Trace`, `Error`, `Warning`. Writes to `LOG_FILE_PATH`.

---

## Adding a New Endpoint — Checklist

1. **Handler** in `src/api/v1/{feature}.rs` — return `Result<impl IntoResponse, AppError>`
2. **Register** in `src/main.rs` under the correct nest (public / user / admin / editor)
3. **Middleware** — pick the right layer (jwt / license / admin)
4. **File ops** — use `safe_read` / `safe_write_overwrite`, never raw `fs::read`
5. **Log** the operation with `log_event`
6. **Update** `docs/api.md` with the new endpoint
7. **Update this file** if you introduced a new module or pattern
