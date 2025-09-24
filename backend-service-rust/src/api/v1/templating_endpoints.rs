use crate::{
    calc::templating::{self, SAMPLES, TEMPLATES},
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{self, get_catalog_file_as_string}, // Import the new CompanyInfo struct
};
use axum::{extract::State, response::IntoResponse, Json};
use std::{path::PathBuf, sync::Arc};

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

pub async fn get_template(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    get_catalog_file_as_string(&user_email, &app_state.cache, &app_state.data_dir_path, TEMPLATES, ".html", path).await
}

pub async fn get_sample(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    get_catalog_file_as_string(&user_email, &app_state.cache, &app_state.data_dir_path, SAMPLES, ".json", path).await
}
