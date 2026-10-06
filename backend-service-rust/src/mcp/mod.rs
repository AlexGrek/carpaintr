//! Account-bound MCP, OAuth credentials, and durable public PDF capabilities.
pub mod auth;
pub mod calculations;
pub mod engine;
pub mod pdf;
mod tools;

use crate::{errors::AppError, middleware::jwt_auth_middleware, state::AppState};
use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get as route_get, post},
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, Weak},
    time::Duration,
};

pub struct McpState {
    pub base_url: String,
    pub share_secret: Vec<u8>,
    pub allowed_origins: Vec<String>,
    pub mutation: tokio::sync::Mutex<()>,
    accounts: tokio::sync::Mutex<HashMap<String, Weak<tokio::sync::Mutex<()>>>>,
    pub registrations: tokio::sync::Mutex<(std::time::Instant, usize)>,
    pub evaluations: Arc<tokio::sync::Semaphore>,
}
impl McpState {
    pub fn new() -> Self {
        let base_url = std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| {
            format!(
                "http://localhost:{}",
                std::env::var("FRONTEND_PORT").unwrap_or_else(|_| "3000".into())
            )
        });
        let url = url::Url::parse(&base_url).expect("PUBLIC_BASE_URL must be an absolute URL");
        assert!(
            url.path() == "/"
                && url.host_str().is_some()
                && url.query().is_none()
                && url.fragment().is_none()
                && url.username().is_empty()
                && url.password().is_none(),
            "Invalid PUBLIC_BASE_URL"
        );
        assert!(
            url.scheme() == "https"
                || url.scheme() == "http"
                    && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
            "PUBLIC_BASE_URL requires HTTPS except on loopback"
        );
        let mut allowed_origins = vec![url.origin().ascii_serialization()];
        allowed_origins.extend(
            std::env::var("MCP_ALLOWED_ORIGINS")
                .unwrap_or_default()
                .split(',')
                .filter(|s| !s.is_empty())
                .map(|s| s.trim().to_string()),
        );
        Self {
            allowed_origins,
            share_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "supersecretjwtkey".into())
                .into_bytes(),
            base_url: url.origin().ascii_serialization(),
            mutation: tokio::sync::Mutex::new(()),
            accounts: tokio::sync::Mutex::new(HashMap::new()),
            registrations: tokio::sync::Mutex::new((std::time::Instant::now(), 0)),
            evaluations: Arc::new(tokio::sync::Semaphore::new(4)),
        }
    }
    // Serialize account writes without blocking other owners during PDF generation.
    // Weak entries let idle account locks be discarded instead of growing forever.
    pub async fn account_lock(&self, email: &str) -> Arc<tokio::sync::Mutex<()>> {
        let mut accounts = self.accounts.lock().await;
        accounts.retain(|_, lock| lock.strong_count() > 0);
        if let Some(lock) = accounts.get(email).and_then(Weak::upgrade) {
            return lock;
        }
        let lock = Arc::new(tokio::sync::Mutex::new(()));
        accounts.insert(email.into(), Arc::downgrade(&lock));
        lock
    }
    pub fn resource(&self) -> String {
        format!("{}/mcp", self.base_url)
    }
}
pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
pub fn digest(value: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(value))
}
pub fn get<T: DeserializeOwned>(state: &AppState, key: &str) -> Result<Option<T>, AppError> {
    state
        .db
        .mcp_tree
        .get(key)?
        .map(|v| serde_json::from_slice(&v).map_err(AppError::from))
        .transpose()
}
pub fn put(state: &AppState, key: &str, value: &impl Serialize) -> Result<(), AppError> {
    state.db.mcp_tree.insert(key, serde_json::to_vec(value)?)?;
    state.db.mcp_tree.flush()?;
    Ok(())
}
pub async fn licensed(state: &AppState, email: &str) -> Result<(), AppError> {
    if state.db.find_user_by_email(email)?.is_none() {
        return Err(AppError::Unauthorized);
    }
    if state.service_users.contains(email) {
        return Ok(());
    }
    let license = state
        .license_cache
        .get_license(email)
        .await
        .map_err(|_| AppError::LicenseExpired)?;
    if license.is_expired() {
        return Err(AppError::LicenseExpired);
    }
    Ok(())
}
pub fn routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    use rmcp::transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    };
    let handler_state = state.clone();
    let mut config = StreamableHttpServerConfig::default()
        .with_legacy_session_mode(false)
        .with_json_response(true)
        .with_max_request_body_bytes(2 * 1024 * 1024);
    config.allowed_hosts = vec![url::Url::parse(&state.mcp.base_url)
        .unwrap()
        .host_str()
        .unwrap()
        .into()];
    config.allowed_origins = state.mcp.allowed_origins.clone();
    let service = StreamableHttpService::new(
        move || {
            Ok(tools::AutolabMcp {
                state: handler_state.clone(),
            })
        },
        LocalSessionManager::default().into(),
        config,
    );
    let mcp = Router::new()
        .nest_service("/mcp", service)
        .layer(from_fn_with_state(state.clone(), auth::authenticate));
    let private = Router::new()
        .route(
            "/api/v1/mcp/keys",
            route_get(auth::list_keys).post(auth::create_key),
        )
        .route("/api/v1/mcp/keys/{id}", delete(auth::revoke_key))
        .route("/api/v1/mcp/connections", route_get(auth::list_connections))
        .route(
            "/api/v1/mcp/connections/{id}",
            delete(auth::revoke_connection),
        )
        .route("/api/v1/mcp/authorize", post(auth::consent))
        .route("/api/v1/pdfs", route_get(pdf::list).post(pdf::save))
        .route("/api/v1/pdfs/{id}", route_get(pdf::download))
        .route(
            "/api/v1/pdfs/{id}/share",
            post(pdf::share).delete(pdf::revoke),
        )
        .layer(from_fn_with_state(state, jwt_auth_middleware));
    Router::new()
        .merge(mcp)
        .merge(private)
        .route(
            "/.well-known/oauth-protected-resource",
            route_get(auth::resource_metadata),
        )
        .route(
            "/.well-known/oauth-protected-resource/mcp",
            route_get(auth::resource_metadata),
        )
        .route(
            "/.well-known/oauth-authorization-server",
            route_get(auth::server_metadata),
        )
        .route("/oauth/register", post(auth::register))
        .route("/oauth/authorize", route_get(auth::authorize))
        .route("/oauth/token", post(auth::token))
        .route("/oauth/revoke", post(auth::revoke_token))
        .route("/public/pdfs/{token}", route_get(pdf::public_download))
        .layer(axum::extract::DefaultBodyLimit::max(2 * 1024 * 1024))
}
pub const ACCESS_LIFETIME: Duration = Duration::from_secs(3600);

#[cfg(test)]
pub fn test_state() -> (tempfile::TempDir, Arc<AppState>) {
    let dir = tempfile::tempdir().unwrap();
    let db = crate::db::users::AppDb::new(dir.path().join("sled_db").to_str().unwrap()).unwrap();
    let email = "mcp-test@example.com".to_string();
    db.insert_user(&crate::models::User {
        id: uuid::Uuid::new_v4(),
        email: email.clone(),
        password_hash: "test".into(),
    })
    .unwrap();
    let state = Arc::new(AppState {
        db,
        auth: crate::auth::Auth::new(b"test"),
        mcp: McpState::new(),
        license_cache: crate::cache::license_cache::LicenseCache::new(
            dir.path().into(),
            100,
            "test".into(),
        ),
        admin_file_path: dir.path().join("admins.txt"),
        data_dir_path: dir.path().into(),
        jwt_license_secret: "test".into(),
        pdf_gen_api_url_post: "http://localhost:1/generate".into(),
        cache: Arc::new(crate::utils::DataStorageCache::new(10, 10, 50)),
        service_users: [email].into_iter().collect(),
    });
    (dir, state)
}
