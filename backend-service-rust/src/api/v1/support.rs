use axum::{extract::{State, Json}, http::StatusCode, response::IntoResponse};
use std::sync::Arc;
use crate::{
    db::requests, errors::AppError, middleware::AuthenticatedUser, models::{requests::SupportRequestMessage, LoginRequest, LoginResponse, RegisterRequest, User}, state::AppState
};

pub async fn support_get_all_requests(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::list_all_requests(&app_state.db.requests_tree)?;
    Ok(Json(requests))
}

pub async fn support_get_unresponded(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::find_unresponded_requests(&app_state.db.requests_tree)?;
    Ok(Json(requests))
}

pub async fn support_add_message(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    Json(mut req): Json<SupportRequestMessage>
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::find_unresponded_requests(&app_state.db.requests_tree)?;
    Ok(Json(requests))
}
