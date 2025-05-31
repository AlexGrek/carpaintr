use crate::{
    errors::AppError, exlogging, middleware::AuthenticatedUser, state::AppState, transactionalfs::{GitTransactionalFs, TransactionalFs}, utils::{
        get_file_as_string_by_path, user_catalog_directory_from_email, COMMON
    } // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use std::{path::PathBuf, sync::Arc};

pub async fn get_common_file_list(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let fs_manager =
        GitTransactionalFs::new(app_state.data_dir_path.join(&COMMON), user_email).await?;
    let data = fs_manager.list_files().await?;
    Ok(Json(data))
}

pub async fn get_user_file_list(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file list
    let user_path = user_catalog_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let fs_manager = GitTransactionalFs::new(user_path, user_email).await?;
    let data = fs_manager.list_files().await?;
    Ok(Json(data))
}

pub async fn read_user_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file content
    let user_path = user_catalog_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let data = get_file_as_string_by_path(&user_path.join(&path), &user_path)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(data)
}

pub async fn delete_user_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    exlogging::log_event(exlogging::LogLevel::Info, format!("Delete file request: {:?}", &path.to_string()), Some(user_email.as_str()));
    let user_path = user_catalog_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let fs_manager = GitTransactionalFs::new(user_path, user_email.clone()).await?;
    fs_manager
        .delete_file(
            std::path::Path::new(&path),
            &format!("File {} deleted.", &path),
        )
        .await?;
    Ok("File deleted")
}

pub async fn read_common_file(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file content
    let user_path = PathBuf::new().join(&app_state.data_dir_path).join(&COMMON);
    let data = get_file_as_string_by_path(&user_path.join(&path), &user_path)
        .await?;
    Ok(data)
}

// Handler for uploading user files
pub async fn upload_user_file(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Expecting a single file field
    let user_path = user_catalog_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let fs_manager = GitTransactionalFs::new(user_path, user_email.clone()).await?;
    let field = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("No file uploaded".to_string()))?;
    let field = field.ok_or(AppError::BadRequest("No file uploaded".to_string()))?;

    // let filename = field.file_name().ok_or(AppError::BadRequest("Missing filename".to_string()))?.to_string();

    let data = field
        .bytes()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;

    fs_manager
        .write_file(
            data.into(),
            &PathBuf::from(&path),
            &format!("File {:?} updated at {:?}", &path, chrono::Local::now()),
        )
        .await?;
    log::info!("File uploaded as {:?} by {:?}", &path, &user_email);
    Ok(Json("File uploaded and validated successfully"))
}
