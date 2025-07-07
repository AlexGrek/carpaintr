use axum::{extract::{State, Path}, response::IntoResponse, Json};
use std::sync::Arc;
use crate::{
    cache::license_cache::get_license_cache, errors::AppError, license_manager::list_license_files, middleware::AuthenticatedUser, state::AppState
};

pub async fn get_license(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from extension
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let license_cache = get_license_cache(&app_state);
    let license_data = license_cache.get_license(&user_email).await?;
    Ok(Json(license_data))
}

pub async fn get_license_list(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from extension
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let license_files = list_license_files(&user_email, &app_state.data_dir_path).await?;
    Ok(Json(license_files)) // Return the list of filenames as JSON
}

// Admin endpoint to invalidate license cache for a specific user
// (Example of how to expose cache invalidation)
pub async fn invalidate_license_cache_admin(
    // This handler is protected by the admin middleware, so we know the caller is an admin
    AuthenticatedUser(_admin_email): AuthenticatedUser, // We don't need the admin's email, just confirmation they are admin
    State(app_state): State<Arc<AppState>>,
    Path(user_email_to_invalidate): Path<String>, // The email to invalidate from the path
) -> Result<impl IntoResponse, AppError> {
     let license_cache = get_license_cache(&app_state);
     license_cache.invalidate_license(&user_email_to_invalidate);
     Ok(Json("License cache invalidated"))
}