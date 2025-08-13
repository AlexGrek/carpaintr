// src/middleware/mod.rs
use axum::{
    body::Body, // Explicitly use axum's Body type
    extract::{FromRequestParts, State},
    http::{request::Parts, Request},
    middleware::Next, // Import Next without generic
    response::Response,
};
// Removed: use tower_http::handle_error::HandleErrorLayer; // Not used in this file

use crate::{auth::admin_check::is_admin_async, cache::license_cache::get_license_cache, errors::AppError, state::AppState};

use std::sync::Arc;
// Removed: use async_trait::async_trait; // Not needed for native async traits

// Custom extractor to get the authenticated user email from extensions
pub struct AuthenticatedUser(pub String);

// Removed #[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync + 'static, // 'static bound is often needed for extractors in axum 0.8
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let user_email = parts
            .extensions
            .get::<String>()
            .cloned()
            .ok_or(AppError::MissingExtension("user email".to_string()))?;

        Ok(AuthenticatedUser(user_email))
    }
}

// Middleware function signatures remain correct for use with from_fn_with_state
// They list extractors first, then Request<Body>, then Next.

// JWT Authentication Middleware
// Signature: (State<Arc<AppState>>, Request<Body>, Next)
pub async fn jwt_auth_middleware(
    State(app_state): State<Arc<AppState>>, // Extractor 1
    req: Request<Body>,                     // Request<Body>
    next: Next,                             // Next
) -> Result<Response, AppError> {
    let (mut parts, body) = req.into_parts();

    let path = parts.uri.path();

    if path == "/register" || path == "/login" {
        let req = Request::from_parts(parts, body);
        return Ok(next.run(req).await);
    }

    let auth_header = parts
        .headers
        .get("Authorization")
        .and_then(|header| header.to_str().ok());

    let token =
        auth_header.and_then(|header| header.strip_prefix("Bearer ").map(|s| s.to_string()));

    let token = token.ok_or(AppError::Unauthorized)?;

    match app_state.auth.decode_token(&token) {
        Ok(claims) => {
            parts.extensions.insert(claims.sub);
            let req = Request::from_parts(parts, body);
            Ok(next.run(req).await)
        }
        Err(e) => {
            log::warn!("JWT validation failed: {}", e);
            Err(AppError::Unauthorized)
        }
    }
}

// Middleware to check if the authenticated user is an admin
// Signature: (AuthenticatedUser, State<Arc<AppState>>, Request<Body>, Next)
pub async fn admin_check_middleware(
    AuthenticatedUser(user_email): AuthenticatedUser, // Extractor 1
    State(app_state): State<Arc<AppState>>,           // Extractor 2
    req: Request<Body>,                               // Request<Body>
    next: Next,                                       // Next
) -> Result<Response, AppError> {
    if is_admin_async(&user_email, &app_state.admin_file_path).await? {
        Ok(next.run(req).await)
    } else {
        Err(AppError::AdminCheckFailed)
    }
}

pub async fn license_expiry_middleware(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    req: Request<Body>, // Request<Body>
    next: Next,         // Next
) -> Result<Response, AppError> {
    let license_cache = get_license_cache(&app_state);

    match license_cache.get_license(&user_email).await {
        Ok(license_data) => {
            if !license_data.is_expired() {
                Ok(next.run(req).await)
            } else {
                license_cache.invalidate_license(&user_email);
                Err(AppError::LicenseExpired)
            }
        }
        Err(_e) => Err(AppError::LicenseExpired),
    }
}
