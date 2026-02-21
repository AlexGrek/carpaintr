use crate::{
    db::notifications,
    errors::AppError,
    middleware::AuthenticatedUser,
    models::notifications::Notification,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

/// GET /notifications - list all notifications for the authenticated user (including read).
pub async fn list_notifications(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let list = notifications::query_notifications_by_user_email(
        &app_state.db.notifications_tree,
        &user_email,
    )?;
    Ok(Json(list))
}

/// GET /notifications/unread-count - count unread notifications for the authenticated user. Not license-protected.
pub async fn unread_count(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let count = notifications::count_unread_by_email(
        &app_state.db.notifications_tree,
        &user_email,
    )?;
    #[derive(serde::Serialize)]
    #[serde(rename_all = "camelCase")]
    struct UnreadCountResponse {
        count: u64,
    }
    Ok(Json(UnreadCountResponse { count }))
}

/// PATCH /notifications/:id/read - mark a single notification as read. Returns 404 if not found or not owned by user.
pub async fn mark_notification_read(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Path(notification_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let tree = &app_state.db.notifications_tree;
    let mut notification = notifications::get_notification(tree, &user_email, &notification_id)?
        .ok_or(AppError::NotFound)?;
    notification.read = true;
    notifications::update_notification(tree, &notification)?;
    Ok(Json(notification))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNotificationRequest {
    pub email: String,
    pub title: String,
    #[serde(default)]
    pub body: String,
}

/// GET /admin/notifications - list all notifications for all users (admin only).
pub async fn admin_list_all_notifications(
    AuthenticatedUser(_admin_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let list = notifications::list_all_notifications(&app_state.db.notifications_tree)?;
    Ok(Json(list))
}

/// POST /admin/notifications - create a notification for a user (admin only).
pub async fn admin_create_notification(
    AuthenticatedUser(_admin_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(req): Json<CreateNotificationRequest>,
) -> Result<impl IntoResponse, AppError> {
    let notification = Notification {
        id: crate::utils::random::generate_random_id(6),
        email: req.email,
        title: req.title,
        body: req.body,
        read: false,
        timestamp: chrono::Utc::now(),
    };
    notifications::insert_notification(&app_state.db.notifications_tree, &notification)?;
    Ok(Json(notification))
}
