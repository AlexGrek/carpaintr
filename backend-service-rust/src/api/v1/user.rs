use axum::{response::IntoResponse, Json, extract::{State, Multipart}};
use std::{sync::Arc};
use crate::{
    cache::license_cache::get_license_cache, errors::AppError, license_manager::{decode_license_token, save_license_file, LicenseData}, middleware::AuthenticatedUser, models::CompanyInfo, state::AppState, utils // Import the new CompanyInfo struct
};
use chrono::Utc; // Import Utc
use tokio::fs; // Import tokio::fs for async file operations
use serde_json; // Import serde_json
use serde::Serialize; // Import Serialize for the response struct

// Define a simple response struct for the boolean result
#[derive(Debug, Serialize)]
pub struct ActiveLicenseResponse {
    pub has_active_license: bool,
    pub license: Option<LicenseData>
}


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
    // Allow both .license and .jwt extensions
    if !filename.ends_with(".license") && !filename.ends_with(".jwt") {
        return Err(AppError::BadRequest("Invalid file extension. Must be .license or .jwt".to_string()));
    }

    let data = field.bytes().await.map_err(|_| AppError::InternalServerError("Failed to read file data".to_string()))?;
    let token = String::from_utf8(data.to_vec()).map_err(|_| AppError::BadRequest("Invalid file content".to_string()))?;

    // Decode and validate the license token
    // This will return AppError::LicenseExpired if expired or AppError::Unauthorized if invalid signature
    let claims = decode_license_token(&token, app_state.jwt_license_secret.as_bytes())?;

    // Check if the license is for the authenticated user
    if claims.sub != user_email {
        return Err(AppError::InvalidData("License is not for this user".to_string()));
    }

    // Check if the license is expired (decode_license_token already does this, but explicit check is good)
    // Although decode_license_token handles this via error kind, a direct check using chrono
    // might be clearer if needed, but relying on the error kind is sufficient here.
    // Let's rely on the error kind from decode_license_token which is handled by AppError.

    // If valid, save the license file
    save_license_file(&user_email, &token, &app_state.data_dir_path).await?;

    // Invalidate the user's license cache entry to force a reload from the new file
    let license_cache = get_license_cache(&app_state);
    license_cache.invalidate_license(&user_email);


    Ok(Json("License uploaded and validated successfully"))
}

pub async fn find_or_create_company_info(app_state: &Arc<AppState>, user: &str) -> Result<CompanyInfo, AppError> {
    // Get the user's data directory path
    let user_dir = utils::user_personal_directory_from_email(&app_state.data_dir_path, &user)
        .map_err(|e| AppError::InternalServerError(format!("Failed to get user directory: {}", e)))?;

    let company_info_path = user_dir.join("company.json");

    // Check if the company.json file exists
    if !company_info_path.exists() {
        // If not, create it with dummy data
        let dummy_info = CompanyInfo {
            email: user.to_string(),
            license: None, // Or some default license info if applicable
            company_name: "Company Name".to_string(), // Or derive from email
            company_addr: "".to_string(),
            current_time: Utc::now(),
            lang_output: "ua".into(),
            lang_ui: "ua".into()
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

    return Ok(company_info);
}

// Handler to get company information from company.json
pub async fn get_company_info(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Return the CompanyInfo as a JSON response
    Ok(Json(find_or_create_company_info(&app_state, &user_email).await?))
}

pub async fn update_company_info(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(mut company_info_input): Json<CompanyInfo>
) -> Result<impl IntoResponse, AppError> {
    // Get the user's data directory path
    let user_dir = utils::user_personal_directory_from_email(&app_state.data_dir_path, &user_email)
        .map_err(|e| AppError::InternalServerError(format!("Failed to get user directory: {}", e)))?;

    let company_info_path = user_dir.join("company.json");

    company_info_input.current_time = Utc::now();

    let json = serde_json::to_string_pretty(&company_info_input)
            .map_err(|e| AppError::BadRequest(format!("Failed to serialize dummy company info: {}", e)))?;

    fs::write(&company_info_path, json).await
            .map_err(|e| AppError::InternalServerError(format!("Failed to write company.json: {}", e)))?;

    // let json = serde_json::to_string_pretty(&dummy_info);
    // fs::write(&company_info_path, json).await.map_err(|e| AppError::InternalServerError(format!("Failed to write company.json: {}", e)))?;

    // Read the content of company.json
    let company_info_content = fs::read_to_string(&company_info_path).await
        .map_err(|e| AppError::InternalServerError(format!("Failed to read company.json: {}", e)))?;

    // Deserialize the JSON content into CompanyInfo struct
    let company_info: CompanyInfo = serde_json::from_str(&company_info_content)
        .map_err(|e| AppError::InternalServerError(format!("Failed to parse company.json: {}", e)))?;

    // Return the CompanyInfo as a JSON response
    Ok(Json(company_info))
}

// New handler to check if the authenticated user has an active license
pub async fn get_active_license(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let license_cache = get_license_cache(&app_state);

    // Attempt to get the license from the cache or load it from disk.
    // The get_license method handles decoding and expiration checks.
    match license_cache.get_license(&user_email).await {
        Ok(license) => {
            // If get_license succeeds, it means a valid, non-expired license was found.
            Ok(Json(ActiveLicenseResponse { has_active_license: !license.is_expired(), license: Some(license) }))
        }
        Err(AppError::LicenseExpired) | Err(AppError::FileNotFound) | Err(AppError::LicenseNotFound) => {
            // If the error is LicenseExpired, FileNotFound, or LicenseNotFound,
            // the user does not have an active license.
            Ok(Json(ActiveLicenseResponse { has_active_license: false, license: None }))
        }
        Err(e) => {
            // Propagate other errors (e.g., IO errors, JWT errors other than expired)
            // These indicate a problem fetching or validating the license beyond just absence/expiration.
            Err(e)
        }
    }
}
