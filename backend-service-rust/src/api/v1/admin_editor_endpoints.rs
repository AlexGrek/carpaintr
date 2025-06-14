use crate::{
    errors::AppError, exlogging, middleware::AuthenticatedUser, state::AppState, transactionalfs::{list_files_raw, GitTransactionalFs, TransactionalFs}, utils::{
        get_file_as_string_by_path, user_catalog_directory_from_email, COMMON
    } // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use tokio::fs;
use std::{path::PathBuf, sync::Arc};

pub async fn get_file_list(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file list
    let directory_path = &app_state.data_dir_path;
    let data = list_files_raw(directory_path).await?;
    Ok(Json(data))
}

pub async fn read_file(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file content
    let user_path = &app_state.data_dir_path;
    let data = get_file_as_string_by_path(&user_path.join(&path), &user_path)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(data)
}

pub async fn delete_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    exlogging::log_event(exlogging::LogLevel::Info, format!("Delete file request: {:?}", &path.to_string()), Some(user_email.as_str()));
    let user_path = &app_state.data_dir_path;
    fs::remove_file(user_path.join(path)).await?;
    Ok("File deleted")
}

// Handler for uploading user files
pub async fn upload_file(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Expecting a single file field
    let user_path = &app_state.data_dir_path;
    
    let field = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("No file uploaded".to_string()))?;
    let field = field.ok_or(AppError::BadRequest("No file uploaded".to_string()))?;

    exlogging::log_event(exlogging::LogLevel::Info, format!("Upload file request: {:?}", &path.to_string()), Some(user_email.as_str()));

    // let filename = field.file_name().ok_or(AppError::BadRequest("Missing filename".to_string()))?.to_string();

    let data = field
        .bytes()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;

    tokio::fs::write(user_path.join(&PathBuf::from(&path)), data).await?;
    Ok(Json("File uploaded and validated successfully"))
}
