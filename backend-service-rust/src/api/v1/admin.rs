use axum::{response::IntoResponse, Json, extract::{State, Json as AxumJson}};
use std::sync::Arc;
use chrono::{Utc, Duration};
use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    models::AdminStatus,
    state::AppState,
    license_manager::{generate_license_token, save_license_file}, // Import necessary functions
    models::license_requests::GenerateLicenseRequest, // Import the combined request enum
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
