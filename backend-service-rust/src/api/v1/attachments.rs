use crate::{
    auth::admin_check::is_admin_async,
    db::attachment::{
        self, handle_attachment, list_all_attachments_for_all_users, list_all_attachments_for_user,
        try_get_by_id, try_get_by_id_checked, try_get_by_id_checked_or_public, AttachmentHandle,
    },
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{
        get_file_bytes_no_cache, random::generate_random_id, safe_read,
        user_personal_directory_from_email, ATTACHMENTS,
    }, // Import the new CompanyInfo struct
};
use axum::{
    extract::{Multipart, State},
    http::{HeaderMap, HeaderValue},
    response::IntoResponse,
    Json,
};
use std::{path::PathBuf, sync::Arc};
fn rename_file(original: &str, id: &str) -> String {
    // Find the last dot to separate filename and extension
    let (name, ext) = match original.rfind('.') {
        Some(dot_pos) => {
            let (name_part, ext_part) = original.split_at(dot_pos);
            (name_part, &ext_part[1..]) // Skip the dot
        }
        None => (original, ""), // No extension found
    };

    // Safely truncate the filename to 20 Unicode characters
    let original_truncated: String = name.chars().take(20).collect();

    // Return formatted string with or without extension
    if ext.is_empty() {
        format!("{}__{}", id, original_truncated)
    } else {
        format!("{}__{}.{}", id, original_truncated, ext)
    }
}


pub async fn get_att_metadata(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let user = if is_admin_async(&user_email, &app_state.admin_file_path).await? {
        None
    } else {
        Some(user_email.clone())
    };
    let data = try_get_by_id_checked_or_public(&app_state.db.attachments_tree, &id, user)?;
    if data.is_none() {
        return Err(AppError::FileNotFound);
    }
    let mut handle = data.unwrap();
    handle.file_path = handle.file_name.clone();
    // hide real file path
    Ok(serde_json::to_string_pretty(&handle)?.into_response())
}

pub async fn admin_all_attachments(
    AuthenticatedUser(_admin_user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    Ok(Json(list_all_attachments_for_all_users(
        &app_state.db.attachments_tree,
    )?))
}

pub async fn my_attachments(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    Ok(Json(list_all_attachments_for_user(
        &app_state.db.attachments_tree,
        &user_email,
    )?))
}

pub async fn get_att_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let user = if is_admin_async(&user_email, &app_state.admin_file_path).await? {
        None
    } else {
        Some(user_email.clone())
    };
    let data = try_get_by_id_checked_or_public(&app_state.db.attachments_tree, &id, user)?;
    let user_path =
        crate::utils::user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    match data {
        Some(handle) => {
            let file: Vec<u8> = get_file_bytes_no_cache(&handle.file_path, &user_path).await?;
            let content_disposition = format!("attachment; filename=\"{}\"", handle.file_name);

            // 2. Determine MIME type
            let mime_type = mime_guess::from_path(&handle.file_name)
                .first_or_octet_stream()
                .to_string();

            let mut headers = HeaderMap::new();
            headers.insert(
                axum::http::header::CONTENT_TYPE,
                HeaderValue::from_str(&mime_type).map_err(|_| {
                    AppError::InternalServerError("Invalid MIME type header".to_string())
                })?,
            );
            headers.insert(
                axum::http::header::CONTENT_DISPOSITION,
                HeaderValue::from_str(&content_disposition).map_err(|_| {
                    AppError::InternalServerError("Invalid Content-Disposition header".to_string())
                })?,
            );
            Ok((headers, file).into_response())
        }
        _ => Err(AppError::FileNotFound),
    }
}

// Handler for uploading user attachments
pub async fn attach(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Expecting a single file field
    let user_att_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?
        .join(ATTACHMENTS);

    let field = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("No file uploaded".to_string()))?;
    let field = field.ok_or(AppError::BadRequest("No file uploaded".to_string()))?;

    let filename = field
        .file_name()
        .ok_or(AppError::BadRequest("Missing filename".to_string()))?
        .to_string();

    // rename file (add junk) to avoid file name conflicts
    // also truncate file name to 10 chars
    let junk = generate_random_id(5);
    let renamed_file_name = rename_file(&filename, &junk);

    let data = field
        .bytes()
        .await
        .map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;

    let size = data.len();

    // write file with modified name
    let written_file_path = crate::utils::safe_write(
        user_att_path,
        renamed_file_name.into(),
        data,
        &app_state.cache,
    )
    .await?;

    // store attachment handle
    let mut handle = handle_attachment(
        &written_file_path,
        &filename,
        &user_email,
        &app_state.db,
        Some(size),
    )?;
    log::info!("Attachment uploaded: {:?}", &handle);

    //return handle
    handle.file_path = filename; // hide full path, leave only a file name
    Ok(Json(handle))
}
