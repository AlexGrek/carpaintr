use axum::{response::IntoResponse, Json};
use crate::{
    errors::AppError, middleware::AuthenticatedUser, models::AdminStatus // Use our custom extractor
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