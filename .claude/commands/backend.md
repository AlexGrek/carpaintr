You are working on the Rust backend of the Carpaintr/Autolab project (`backend-service-rust/`). Load this context before making any changes.

## Full API reference → [`docs/api.md`](../../docs/api.md)
> Keep `docs/api.md` and this file up-to-date when adding endpoints, middleware, or new patterns.

---

## Directory Structure

```
src/
├── main.rs                         # Route registration, AppState init, server startup
├── state.rs                        # AppState (Arc-shared across handlers)
├── errors.rs                       # AppError enum → HTTP responses (single source of truth)
├── middleware/                     # jwt_auth, admin_check, license_expiry + AuthenticatedUser extractor
├── auth/                           # JWT sign/verify, bcrypt, invite logic
├── db/                             # Sled KV operations (users, requests, notifications, attachments)
├── models/                         # Request/response structs (serde)
├── calc/                           # T1/T2 table processing, car data, seasons, templating
├── cache/                          # LicenseCache (LRU, in-memory)
├── utils/                          # safe_join, safe_read, safe_write_overwrite, DataStorageCache
├── exlogging.rs                    # Structured logging → log_event()
├── transactionalfs.rs              # Git-backed file commits for editor endpoints
└── api/v1/
    ├── auth.rs                     # register, login, impersonate, health
    ├── user.rs                     # license upload, company info
    ├── license.rs                  # get/list/invalidate licenses
    ├── admin.rs                    # user management, logs, cache, exports
    ├── admin_editor_endpoints.rs   # global file CRUD, class/body rebuild
    ├── editor_endpoints.rs         # per-user file CRUD with git history
    ├── support.rs                  # support tickets and messages
    ├── attachments.rs              # file upload/download
    ├── notifications.rs            # list, unread-count, mark-read
    ├── templating_endpoints.rs     # templates and samples
    └── calc/
        ├── data_endpoints.rs       # car makes/models/parts, T1/T2 lookups
        ├── persistence_endpoints.rs
        ├── output_endpoints.rs     # PDF/HTML generation
        └── plugin_endpoints.rs     # JS processor bundle
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

---

## Route Protection — 3 Middleware Layers

```
GET /health, POST /register, POST /login     ← public (no middleware)

All other routes
  └── jwt_auth_middleware                    ← validates Bearer token, injects email into request extensions

  /admin/*
    └── + admin_check_middleware             ← verifies email is in admins.txt

  /user/*, /editor/*
    └── + license_expiry_middleware          ← validates active non-expired license
```

Layers are applied innermost-first in `main.rs`. When adding a route, place it in the correct `nest()` block.

---

## Handler Pattern

```rust
pub async fn my_handler(
    AuthenticatedUser(user_email): AuthenticatedUser,  // custom extractor → email string
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<MyRequest>,
) -> Result<impl IntoResponse, AppError> {
    // ...
    Ok(Json(response))
}
```

- Always return `Result<impl IntoResponse, AppError>` — never raw status codes
- `AuthenticatedUser` is available on all JWT-protected routes
- Admin routes: middleware already verified admin status; no need to re-check in handler

---

## Error Handling

Use `AppError` variants — they auto-convert to HTTP responses with JSON body and log themselves:

| Variant | HTTP |
|---------|------|
| `InvalidCredentials` / `Unauthorized` | 401 |
| `LicenseExpired` / `LicenseNotFound` | 401 |
| `Forbidden` | 403 |
| `UserNotFound` / `NotFound` | 404 |
| `UserExists` / `InvalidData` / `BadRequest` | 400 |
| `InternalServerError` | 500 |

Use `?` to propagate. Never construct raw HTTP error responses.

---

## File Operations — Always Use `src/utils/`

Never use `std::fs` or `tokio::fs` directly for user-facing file access:

```rust
// Get user's isolated base directory (percent-encoded email)
let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;

// Read (path-traversal safe + LRU cached)
let bytes = safe_read(&user_path, Path::new("subdir/file.csv"), &app_state.cache).await?;

// Write (validates path, invalidates cache entry)
safe_write_overwrite(user_path, PathBuf::from("subdir/file.json"), content, &app_state.cache).await?;
```

`safe_join()` rejects any path that escapes the base directory. User directories are stored as percent-encoded emails: `users/user%40example%2Ecom/`.

---

## Database (Sled KV)

```rust
// Write — always flush
self.users_tree.insert(email.as_bytes(), serde_json::to_vec(&user)?)?;
self.users_tree.flush()?;

// Read
match self.users_tree.get(email.as_bytes())? {
    Some(ivec) => Ok(Some(serde_json::from_slice(&ivec)?)),
    None => Ok(None),
}
```

No ORM, no migrations. Key patterns: `users::{email}`, `licenses::{email}`, etc. Always call `.flush()` after writes.

---

## Logging

```rust
use crate::exlogging::{log_event, LogLevel};

log_event(LogLevel::Info,  "User registered",     Some(&user_email));
log_event(LogLevel::Error, format!("Failed: {e}"), None::<&str>);
```

---

## Checklist for Adding a New Endpoint

1. Write handler in `src/api/v1/{feature}.rs` returning `Result<impl IntoResponse, AppError>`
2. Register the route in `src/main.rs` in the correct `nest()` block (public / user / admin / editor)
3. Apply the right middleware layer (none / jwt / license / admin)
4. Use `safe_read` / `safe_write_overwrite` for any file access
5. Log with `log_event`
6. Update `docs/api.md` with the new endpoint
7. Update this skill file if a new module or pattern was introduced
