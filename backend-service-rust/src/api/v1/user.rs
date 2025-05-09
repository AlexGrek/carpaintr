use axum::{response::IntoResponse, Json};
use crate::{errors::AppError, middleware::AuthenticatedUser}; // Use our custom extractor

// This handler is protected by the license_expiry_middleware applied to the /user scope
pub async fn get_calc_details(
    // If we reach here, the AuthenticatedUser extractor succeeded (JWT valid)
    // and the license_expiry_middleware (applied before this handler) succeeded (license valid).
    AuthenticatedUser(user_email): AuthenticatedUser,
) -> Result<impl IntoResponse, AppError> {
     // Implement your user calculation details logic here...
     Ok(Json(format!("Calculation details for {}", user_email)))
}