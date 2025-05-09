// src/middleware/mod.rs
use axum::{
    http::{Request, StatusCode, request::Parts},
    middleware::Next, // Import Next without generic
    response::{IntoResponse, Response},
    extract::{State, FromRequestParts},
    body::Body, // Explicitly use axum's Body type
};
// Removed: use tower_http::handle_error::HandleErrorLayer; // Not used in this file

use crate::{
    errors::AppError,
    state::AppState,
    cache::get_license_cache,
};

use std::fs::File;
use std::io::{BufReader, BufRead};
use std::collections::HashSet;
use chrono::Utc;
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
        let user_email = parts.extensions.get::<String>()
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
    req: Request<Body>, // Request<Body>
    next: Next,         // Next
) -> Result<Response, AppError> {
    let (mut parts, body) = req.into_parts();

    let path = parts.uri.path();
    // Explicitly bypass auth for register and login paths
    // Check the full path including the scope prefix /api/v1
    if path == "/api/v1/register" || path == "/api/v1/login" {
         let req = Request::from_parts(parts, body);
         return Ok(next.run(req).await);
    }


    let auth_header = parts.headers
        .get("Authorization")
        .and_then(|header| header.to_str().ok());

    let token = auth_header
        .and_then(|header| header.strip_prefix("Bearer ").map(|s| s.to_string()));

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
    req: Request<Body>, // Request<Body>
    next: Next,         // Next
) -> Result<Response, AppError> {
    // Read admin list EVERY time as requested
    let admins_file = File::open(&app_state.admin_file_path).map_err(|_| AppError::ConfigError("Could not open admins.txt".into()))?;
    let reader = BufReader::new(admins_file);
    let admins: HashSet<String> = reader.lines().filter_map(|line| line.ok()).collect();

    if admins.contains(&user_email) {
        Ok(next.run(req).await)
    } else {
        Err(AppError::AdminCheckFailed)
    }
}


// Middleware to check license expiry for user endpoints
// Signature: (AuthenticatedUser, State<Arc<AppState>>, Request<Body>, Next)
pub async fn license_expiry_middleware(
    AuthenticatedUser(user_email): AuthenticatedUser, // Extractor 1
    State(app_state): State<Arc<AppState>>,           // Extractor 2
    req: Request<Body>, // Request<Body>
    next: Next,         // Next
) -> Result<Response, AppError> {
    let license_cache = get_license_cache(&app_state);

    match license_cache.get_license(&user_email).await {
        Ok(license_data) => {
            if license_data.expiry_date > Utc::now() {
                 Ok(next.run(req).await)
            } else {
                Err(AppError::LicenseExpired)
            }
        }
        Err(e) => {
            log::error!("Failed to get license for expiry check: {}", e);
            Err(e)
        }
    }
}

// Update your error handler to be generic over the error type
// This allows it to work with HandleErrorLayer in Axum 0.8
pub async fn handle_app_error<E>(
    // Use Request<Body> instead of just Request
    req: Request<axum::body::Body>, 
    err: E,
) -> impl IntoResponse 
where
    E: Into<axum::BoxError>,
{
    let err = err.into();
    
    // Log the error
    log::error!(
        "Error handling request {} {}: {:?}",
        req.method(),
        req.uri(),
        err
    );
    
    // You can implement custom error handling based on error type
    // For example, converting your AppError types to appropriate status codes
    
    // Default error response
    (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
}
