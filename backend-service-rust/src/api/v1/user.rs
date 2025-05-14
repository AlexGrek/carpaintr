use axum::{response::IntoResponse, Json, extract::{State, Multipart}};
use std::{path::Path, sync::Arc};
use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    license_manager::{decode_license_token, save_license_file}, // Import necessary functions
    cache::get_license_cache, // Import get_license_cache
    utils,
};
use chrono::Utc; // Import Utc

// This handler is protected by the license_expiry_middleware applied to the /user scope
pub async fn get_calc_details(
    // If we reach here, the AuthenticatedUser extractor succeeded (JWT valid)
    // and the license_expiry_middleware (applied before this handler) succeeded (license valid).
    AuthenticatedUser(user_email): AuthenticatedUser,
) -> Result<impl IntoResponse, AppError> {
     // Implement your user calculation details logic here...
     Ok(Json(format!("Calculation details for {}", user_email)))
}

// Handler for uploading license files
pub async fn upload_license(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    // Expecting a single file field named "license"
    let field = multipart.next_field().await.map_err(|_| AppError::BadRequest("No file uploaded".to_string()))?;
    let field = field.ok_or(AppError::BadRequest("No file uploaded".to_string()))?;

    let filename = field.file_name().ok_or(AppError::BadRequest("Missing filename".to_string()))?.to_string();
    if !filename.ends_with(".license") {
        return Err(AppError::BadRequest("Invalid file extension. Must be .license".to_string()));
    }

    let data = field.bytes().await.map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;
    let token = String::from_utf8(data.to_vec()).map_err(|_| AppError::BadRequest("Invalid file content".to_string()))?;

    // Decode and validate the license token
    let claims = decode_license_token(&token, app_state.jwt_license_secret.as_bytes())?;

    // Check if the license is for the authenticated user
    if claims.sub != user_email {
        return Err(AppError::InvalidData("License is not for this user".to_string()));
    }

    // Check if the license is expired (decode_license_token already does this, but explicit check is good)
    let current_time = Utc::now().timestamp() as usize;
    if claims.exp < current_time {
        return Err(AppError::InvalidData("License has expired".to_string()));
    }

    // If valid, save the license file
    save_license_file(&user_email, &token, Path::new(&app_state.data_dir_path)).await?;

    // Invalidate the user's license cache entry to force a reload from the new file
    let license_cache = get_license_cache(&app_state);
    license_cache.invalidate_license(&user_email);


    Ok(Json("License uploaded and validated successfully"))
}
