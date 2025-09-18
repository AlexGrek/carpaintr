use crate::{
    calc::templating::{self, SAMPLES, TEMPLATES},
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils, // Import the new CompanyInfo struct
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

async fn get_user_file(
    user_email: &str,
    app_state: &AppState,
    kind: &str,
    allowed_ext: &str,
    path: String,
) -> Result<String, AppError> {
    if path.ends_with(allowed_ext) {
        let file_path = utils::get_file_path_user_common(
            &app_state.data_dir_path,
            user_email,
            &PathBuf::from(kind).join(&path),
        )
        .await?;
        utils::get_file_as_string_by_path(&file_path, &app_state.data_dir_path, &app_state.cache)
            .await
            .map_err(|_err| AppError::Forbidden)
    } else {
        Err(AppError::BadRequest(format!(
            "Unsupported file type, expected {}",
            allowed_ext
        )))
    }
}

pub async fn get_template(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    get_user_file(&user_email, &app_state, TEMPLATES, ".html", path).await
}

pub async fn get_sample(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    get_user_file(&user_email, &app_state, SAMPLES, ".json", path).await
}
