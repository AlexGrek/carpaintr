use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{list_files_user_common, sanitize_alphanumeric_and_dashes}, // Import the new CompanyInfo struct
};
use axum::{extract::State, response::IntoResponse, Json};
use std::{path::PathBuf, sync::Arc};

const CARS: &'static str = "cars";

pub async fn list_car_makes(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let data = list_files_user_common(&app_state.data_dir_path, &user_email, &CARS)
        .await
        .map_err(|e| AppError::IoError(e))?;
    let car_makes: Vec<String> = data.iter().map(|s| s.replace(".yaml", "")).collect();
    Ok(Json(car_makes))
}

pub async fn get_cars_by(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(maker): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&CARS).join(sanitize_alphanumeric_and_dashes(&maker) + ".yaml");
    let cars_path =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    log::warn!("Opening file {cars_path:?}");
    let cars_data = crate::calc::cars::parse_car_yaml(&cars_path)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(Json(cars_data))
}
