use axum::{
    extract::{Json as AxumJson, Path, Query, State},
    http::{header, Response, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use chrono::{Utc, Duration};
use crate::{
    errors::AppError, exlogging::get_latest_logs, license_manager::{
        delete_license_file, generate_license_token, list_license_files, read_license_file_by_name, save_license_file // Import new functions
    }, middleware::AuthenticatedUser, models::{license_requests::GenerateLicenseRequest, AdminStatus, ManageUserRequest}, state::AppState
};

// This handler is protected by the admin_check_middleware applied to the /admin scope
pub async fn check_admin_status(
    // If we reach here, the AuthenticatedUser extractor succeeded (meaning JWT was valid)
    // and the admin_check_middleware (applied before this handler) succeeded.
    // So the user *is* an admin.
    AuthenticatedUser(_user_email): AuthenticatedUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(Json(AdminStatus { is_admin: true }))
}

// Handler for generating license files
// This handler is protected by the admin middleware
pub async fn generate_license_handler(
    AuthenticatedUser(_admin_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    AxumJson(request): AxumJson<GenerateLicenseRequest>,
) -> Result<impl IntoResponse, AppError> {
    let (user_email, expiry_date) = match request {
        GenerateLicenseRequest::ByDays(req) => {
            let expiry_date = Utc::now() + Duration::days(req.days);
            (req.email, expiry_date)
        }
        GenerateLicenseRequest::ByDate(req) => {
            (req.email, req.expiry_date)
        }
    };

    // Generate the JWT token
    let token = generate_license_token(&user_email, expiry_date, app_state.jwt_license_secret.as_bytes())?;

    // Save the license file
    save_license_file(&user_email, &token, &app_state.data_dir_path).await?;

    // Invalidate the cache for this user's license
    app_state.license_cache.invalidate_license(&user_email);

    // Return the generated token (or a confirmation message)
    Ok(Json(format!("License generated and saved for {}.", user_email)))
}

// New handler to list all license files for a specific user (admin only)
pub async fn list_user_licenses_handler(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Path(user_email): Path<String>, // Extract user email from the path
) -> Result<impl IntoResponse, AppError> {
    // Call the new function to list license files
    let license_files = list_license_files(&user_email, &app_state.data_dir_path).await?;

    Ok(Json(license_files)) // Return the list of filenames as JSON
}

// New handler to delete a specific license file for a user (admin only)
pub async fn delete_user_license_handler(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Path((user_email, license_filename)): Path<(String, String)>, // Extract email and filename from path
) -> Result<impl IntoResponse, AppError> {
    // Call the new function to delete the license file
    delete_license_file(&user_email, &license_filename, &app_state.data_dir_path).await?;

    // Invalidate the cache for this user's license
    // Note: If a user could have multiple *active* licenses cached under the same email key,
    // invalidating the single key might not be sufficient. However, based on the LicenseCache
    // structure caching a single LicenseData per email, this is appropriate.
    app_state.license_cache.invalidate_license(&user_email);

    Ok(StatusCode::OK) // Return 200 OK on successful deletion
}



pub async fn get_user_license_handler(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Path((user_email, license_filename)): Path<(String, String)>, // Extract email and filename from path
) -> Result<impl IntoResponse, AppError> {
    // Call the new function to delete the license file
    let jwt = read_license_file_by_name(&user_email, &app_state.data_dir_path, &license_filename).await?;
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(jwt)
        .unwrap())
}

// Existing handler to list all users by email (admin only)
pub async fn list_users(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let emails = app_state.db.get_all_user_emails()?; // Call the new function from UserDb

    Ok(Json(emails)) // Return the list of emails as JSON
}

// Existing handler to manage user (delete, change password) (admin only)
pub async fn manage_user(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<ManageUserRequest>, // Extract the request payload
) -> Result<impl IntoResponse, AppError> {
    match request {
        ManageUserRequest::Delete { email } => {
            // Handle delete action
            app_state.db.delete_user_by_email(&email)?;
            Ok(StatusCode::OK) // Return 200 OK on successful deletion
        }
        ManageUserRequest::ChangePassword { email, data } => {
            // Handle change_password action
            // Hash the new password
            let hashed_password = app_state.auth.hash_password(&data)?;
            // Update the user's password hash in the database
            app_state.db.change_user_password_hash(&email, hashed_password)?;
            Ok(StatusCode::OK) // Return 200 OK on successful password change
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogLinesQuery {
    pub lines: usize
}

// Existing handler to list all users by email (admin only)
pub async fn get_n_logs(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(_app_state): State<Arc<AppState>>,
    Query(log_query): Query<LogLinesQuery>,
) -> Result<impl IntoResponse, AppError> {
    let logs = get_latest_logs(log_query.lines).await.map_err(|err| AppError::BadRequest(err.to_string()))?;
    Ok(Json(logs)) // Return the list of log lines
}
