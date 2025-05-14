use axum::{extract::{Json as AxumJson, State}, http::StatusCode, response::IntoResponse, Json};
use std::sync::Arc;
use chrono::{Utc, Duration};
use crate::{
    errors::AppError, license_manager::{generate_license_token, save_license_file}, middleware::AuthenticatedUser, models::{license_requests::GenerateLicenseRequest, AdminStatus, ManageUserRequest}, state::AppState // Import the combined request enum
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
pub async fn generate_license(
    // This handler is protected by the admin middleware
    AuthenticatedUser(_admin_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    AxumJson(request): AxumJson<GenerateLicenseRequest>, // Use the combined enum
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

    // Return the generated token (or a confirmation message)
    Ok(Json(format!("License generated and saved for {}. Token: {}", user_email, token)))
}

// New handler to list all users by email (admin only)
pub async fn list_users(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // In a real application, you would add logic here to verify the authenticated user is an admin
    // For now, we assume the admin_check_middleware handles this.

    let emails = app_state.db.get_all_user_emails()?; // Call the new function from UserDb

    Ok(Json(emails)) // Return the list of emails as JSON
}

pub async fn manage_user(
    AuthenticatedUser(_admin_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<ManageUserRequest>, // Extract the request payload
) -> Result<impl IntoResponse, AppError> {
    // In a real application, you would add logic here to verify the authenticated user is an admin
    // For now, we assume the admin_check_middleware handles this.

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
