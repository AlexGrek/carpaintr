use crate::{
    db::requests, errors::AppError, middleware::AuthenticatedUser, models::requests::SupportRequestMessage, state::AppState
};
use axum::{
    extract::{Json, Query, State},
    response::IntoResponse,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub async fn support_get_all_requests(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::list_all_requests(&app_state.db.requests_tree)?;
    Ok(Json(requests))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupportTicketQuery {
    pub email: String,
    pub id: String,
}

pub async fn support_get_unresponded(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::find_unresponded_requests(&app_state.db.requests_tree)?;
    Ok(Json(requests))
}

pub async fn support_get(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<SupportTicketQuery>,
) -> Result<impl IntoResponse, AppError> {
    let r = requests::get_request(&app_state.db.requests_tree, &q.email, &q.id)?;
    match r {
        Some(request) => {
            return Ok(Json(request));
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Support ticket not found for email={}, id={}",
                q.email, q.id
            )))
        }
    }
}

pub async fn user_get(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<SupportTicketQuery>,
) -> Result<impl IntoResponse, AppError> {
    if q.email != user_email {
        return Err(AppError::Forbidden)
    }
    let r = requests::get_request(&app_state.db.requests_tree, &q.email, &q.id)?;
    match r {
        Some(request) => {
            return Ok(Json(request));
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Support ticket not found for email={}, id={}",
                q.email, q.id
            )))
        }
    }
}

pub async fn user_get_all(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let requests = requests::query_requests_by_user_email(&app_state.db.requests_tree, &user_email)?;
    Ok(Json(requests))
}

pub async fn support_add_message(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<SupportTicketQuery>,
    Json(mut msg): Json<SupportRequestMessage>,
) -> Result<impl IntoResponse, AppError> {
    msg.timestamp = Utc::now();
    let r = requests::get_request(&app_state.db.requests_tree, &q.email, &q.id)?;
    match r {
        Some(mut request) => {
            request.messages.push(msg);
            requests::update_request(&app_state.db.requests_tree, &request)?
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Support ticket not found for email={}, id={}",
                q.email, q.id
            )))
        }
    }
    Ok(())
}

pub async fn user_add_message(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<SupportTicketQuery>,
    Json(mut msg): Json<SupportRequestMessage>,
) -> Result<impl IntoResponse, AppError> {
    if msg.is_support_response {
        return Err(AppError::Forbidden);
    }
    msg.timestamp = Utc::now();
    let r = requests::get_request(&app_state.db.requests_tree, &q.email, &q.id)?;
    match r {
        Some(mut request) => {
            request.messages.push(msg);
            requests::update_request(&app_state.db.requests_tree, &request)?
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Support ticket not found for email={}, id={}",
                q.email, q.id
            )))
        }
    }
    Ok(())
}
