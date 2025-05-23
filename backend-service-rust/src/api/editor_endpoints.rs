use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    transactionalfs::{GitTransactionalFs, TransactionalFs},
    utils::{
        get_file_by_path, sanitize_alphanumeric_and_dashes_and_dots, user_directory_from_email,
        COMMON,
    }, // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use std::{path::PathBuf, sync::Arc};

// const GLOBAL: &'static str = "global";

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
    let user_path = user_directory_from_email(&app_state.data_dir_path, &user_email)?;
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
    let user_path = user_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let data = get_file_by_path(&user_path.join(sanitize_alphanumeric_and_dashes_and_dots(&path)))
        .await
        .map_err(|e| AppError::IoError(e))?;
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
    let user_path = user_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let fs_manager = GitTransactionalFs::new(user_path, user_email).await?;
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

    Ok(Json("License uploaded and validated successfully"))
}
