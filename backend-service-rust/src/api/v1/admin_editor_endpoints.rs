use crate::{
    api::v1::calc::data_endpoints::T1, calc::car_class_to_body_type::{self, CLASS_TYPE_MAPPING_FILE}, errors::AppError, exlogging::{self, log_event}, middleware::AuthenticatedUser, state::AppState, transactionalfs::{list_files_raw, GitTransactionalFs, TransactionalFs}, utils::{get_file_as_string_by_path, safe_write, CATALOG, USERS} // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    response::IntoResponse,
    Json,
};
use tokio::fs;
use std::{collections::HashMap, path::PathBuf, sync::Arc};

/// If `path` (relative to the data dir) points inside a user's catalog (`users/<email>/catalog/...`),
/// returns the catalog directory (the user's git repo root) and the path relative to it.
/// Anything else (common data, calculations, attachments, ...) is not a git repo and returns `None`.
fn split_user_catalog_path(data_dir: &PathBuf, path: &str) -> Option<(PathBuf, PathBuf)> {
    let parts: Vec<&str> = path.split('/').collect();
    match parts.as_slice() {
        [users, user_dir, catalog, rest @ ..]
            if *users == USERS
                && *catalog == CATALOG
                && !matches!(*user_dir, "" | "." | "..")
                && !rest.is_empty() =>
        {
            let root = data_dir.join(USERS).join(user_dir).join(CATALOG);
            Some((root, rest.iter().collect()))
        }
        _ => None,
    }
}

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
    if exist_t1.is_err() || !exist_t1.unwrap() {
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
    let data = get_file_as_string_by_path(&user_path.join(&path), user_path, &app_state.cache)
        .await
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(Arc::unwrap_or_clone(data))
}

pub async fn delete_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    exlogging::log_event(exlogging::LogLevel::Info, format!("Delete file admin request: {:?}", &path.to_string()), Some(user_email.as_str()));
    let user_path = &app_state.data_dir_path;
    let end_path = user_path.join(&path);
    if let Some((root, relative)) = split_user_catalog_path(user_path, &path) {
        // Other user's catalog is a git repo: commit as the admin instead of leaving it dirty
        let fs_manager = GitTransactionalFs::new(root, user_email.clone(), &app_state.cache).await?;
        fs_manager
            .delete_file(&relative, &format!("File {} deleted by admin {}", relative.display(), user_email))
            .await?;
        app_state.cache.invalidate_all().await;
        return Ok("File deleted");
    }
    app_state.cache.invalidate(&end_path).await;
    fs::remove_file(end_path).await?;
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
    if let Some((root, relative)) = split_user_catalog_path(user_path, &path) {
        // Other user's catalog is a git repo: commit as the admin instead of leaving it dirty
        safe_write(&root, &relative, data, &app_state.cache).await?;
        let fs_manager = GitTransactionalFs::new(root, user_email.clone(), &app_state.cache).await?;
        fs_manager
            .commit_all_if_changed(&format!("File {} updated by admin {}", relative.display(), user_email))
            .await?;
        return Ok(Json("File uploaded and validated successfully"));
    }
    let end_path = user_path.join(PathBuf::from(&path));
    app_state.cache.invalidate(&end_path).await;
    tokio::fs::write(end_path, data).await?;
    Ok(Json("File uploaded and validated successfully"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_user_catalog_paths_only() {
        let data = PathBuf::from("data");
        let (root, rel) = split_user_catalog_path(&data, "users/a%40b/catalog/dir/t1.csv").unwrap();
        assert_eq!(root, PathBuf::from("data/users/a%40b/catalog"));
        assert_eq!(rel, PathBuf::from("dir/t1.csv"));

        assert!(split_user_catalog_path(&data, "common/t1.csv").is_none());
        assert!(split_user_catalog_path(&data, "users/a%40b/calculations/x.json").is_none());
        assert!(split_user_catalog_path(&data, "users/a%40b/catalog").is_none());
        assert!(split_user_catalog_path(&data, "users/../catalog/x.csv").is_none());
    }
}
