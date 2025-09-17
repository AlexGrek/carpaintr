use crate::{
    calc::templating,
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState, // Import the new CompanyInfo struct
};
use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;



pub async fn list_templates(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let data = templating::list_templates(&user_email, &app_state.data_dir_path).await?;
    Ok(Json(data))
}

pub async fn list_samples(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let data = templating::list_samples(&user_email, &app_state.data_dir_path).await?;
    Ok(Json(data))
}
