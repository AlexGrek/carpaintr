use axum::{response::IntoResponse, Json, extract::{State, Multipart}};
use std::{sync::Arc};
use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    license_manager::{decode_license_token, save_license_file}, // Import necessary functions
    cache::get_license_cache, // Import get_license_cache
    utils,
    models::CompanyInfo, // Import the new CompanyInfo struct
};
use chrono::Utc; // Import Utc
use tokio::fs; // Import tokio::fs for async file operations
use serde_json; // Import serde_json

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
    save_license_file(&user_email, &token, &app_state.data_dir_path).await?;

    // Invalidate the user's license cache entry to force a reload from the new file
    let license_cache = get_license_cache(&app_state);
    license_cache.invalidate_license(&user_email);


    Ok(Json("License uploaded and validated successfully"))
}

// Handler to get company information from company.json
pub async fn get_company_info(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Get the user's data directory path
    let user_dir = utils::user_directory_from_email(&app_state.data_dir_path, &user_email)
        .map_err(|e| AppError::InternalServerError(format!("Failed to get user directory: {}", e)))?;

    let company_info_path = user_dir.join("company.json");

    // Check if the company.json file exists
    if !company_info_path.exists() {
        // If not, create it with dummy data
        let dummy_info = CompanyInfo {
            email: user_email.clone(),
            license: None, // Or some default license info if applicable
            company_name: "Default Company Name".to_string(), // Or derive from email
            current_time: Utc::now(),
        };

        let dummy_json = serde_json::to_string_pretty(&dummy_info)
            .map_err(|e| AppError::InternalServerError(format!("Failed to serialize dummy company info: {}", e)))?;

        fs::write(&company_info_path, dummy_json).await
            .map_err(|e| AppError::InternalServerError(format!("Failed to write company.json: {}", e)))?;
    }

    // Read the content of company.json
    let company_info_content = fs::read_to_string(&company_info_path).await
        .map_err(|e| AppError::InternalServerError(format!("Failed to read company.json: {}", e)))?;

    // Deserialize the JSON content into CompanyInfo struct
    let company_info: CompanyInfo = serde_json::from_str(&company_info_content)
        .map_err(|e| AppError::InternalServerError(format!("Failed to parse company.json: {}", e)))?;

    // Return the CompanyInfo as a JSON response
    Ok(Json(company_info))
}
