use crate::{
    api::v1::calc::data_endpoints::T1, calc::car_class_to_body_type::{self, CLASS_TYPE_MAPPING_FILE}, errors::AppError, exlogging::{self, log_event}, middleware::AuthenticatedUser, state::AppState, transactionalfs::list_files_raw, utils::get_file_as_string_by_path // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use tokio::fs;
use std::{collections::HashMap, path::PathBuf, sync::Arc};

pub async fn get_file_list(
    AuthenticatedUser(_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file list
    let directory_path = &app_state.data_dir_path;
    let data = list_files_raw(directory_path).await?;
    Ok(Json(data))
}

pub async fn trigger_list_class_body_types_rebuild_global(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let mapping = run_list_class_body_types_rebuild(&app_state.data_dir_path, Some(user_email)).await?;
    Ok(Json(mapping))
}

pub async fn run_list_class_body_types_rebuild(data_dir: &PathBuf, user: Option<String>) -> Result<HashMap<String, Vec<String>>, AppError> {
    let file_path = PathBuf::from(&CLASS_TYPE_MAPPING_FILE);
    let common_path = crate::utils::common_directory(data_dir)?;
    let exact_path = common_path.join(file_path);
    let t1_path = common_path.join(T1);
    log_event(exlogging::LogLevel::Info, "Class body type rebuild triggered by admin or rebuild", user.clone());
    let exist_t1 = tokio::fs::try_exists(&t1_path).await;
    if exist_t1.is_err() || exist_t1.unwrap() == false {
        log_event(exlogging::LogLevel::Error, format!("File {:?} not found", &t1_path.as_os_str()), user.clone());
    }
    let mapping = car_class_to_body_type::read_csv_and_map(&t1_path, &common_path).map_err(|e| AppError::InternalServerError(e.to_string()))?;
    if tokio::fs::try_exists(&exact_path).await.unwrap_or(false) {
        tokio::fs::remove_file(&exact_path).await?;
    }
    log_event(exlogging::LogLevel::Debug, format!("Generating yaml file {}", exact_path.to_string_lossy()) , user.clone());
    car_class_to_body_type::serialize_to_yaml(&mapping, exact_path).map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(mapping)
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
    exlogging::log_event(exlogging::LogLevel::Info, format!("Delete file admin request: {:?}", &path.to_string()), Some(user_email.as_str()));
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

    exlogging::log_event(exlogging::LogLevel::Info, format!("Upload file admin request: {:?}", &path.to_string()), Some(user_email.as_str()));

    // let filename = field.file_name().ok_or(AppError::BadRequest("Missing filename".to_string()))?.to_string();

    let data = field
        .bytes()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;

    tokio::fs::write(user_path.join(&PathBuf::from(&path)), data).await?;
    Ok(Json("File uploaded and validated successfully"))
}
