use axum::{extract::{State, Json}, http::StatusCode, response::IntoResponse};
use std::sync::Arc;
use crate::{
    errors::AppError, middleware::AuthenticatedUser, models::{ImpersonateRequest, LoginRequest, LoginResponse, RegisterRequest, User}, state::AppState
};
use uuid::Uuid;

pub async fn register(
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    let hashed_password = app_state.auth.hash_password(&req.password)?;

    let user = User {
        id: Uuid::new_v4(),
        email: req.email.clone(),
        password_hash: hashed_password,
    };

    app_state.db.insert_user(&user)?;

    log::info!("Auth event -> {}", format!("User with ID {:?} created: {}", &user.id, &user.email));

    Ok(StatusCode::OK)
}

pub async fn login(
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user = app_state.db.find_user_by_email(&req.email)?
        .ok_or(AppError::InvalidCredentials)?;

    if !app_state.auth.verify_password(&req.password, &user.password_hash)? {
        return Err(AppError::InvalidCredentials);
    }

    let token = app_state.auth.create_token(&user.email)?;

    log::info!("Auth event -> {}", format!("User logged in: {}", &user.email));

    Ok(Json(LoginResponse { token }))
}

pub async fn impersonate(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<ImpersonateRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user = app_state.db.find_user_by_email(&req.email)?
        .ok_or(AppError::InvalidCredentials)?;

    let token = app_state.auth.create_token(&user.email)?;

    log::info!("Impersonation event -> {}", format!("User impersonated in: {}", &user.email));

    Ok(Json(LoginResponse { token }))
}
