use crate::{
    calc::seasons::get_current_season_info, errors::AppError, middleware::AuthenticatedUser, state::AppState, utils::{list_files_user_common, sanitize_alphanumeric_and_dashes, sanitize_alphanumeric_and_dashes_and_dots} // Import the new CompanyInfo struct
};
use axum::{extract::State, response::IntoResponse, Json};
use std::{path::PathBuf, sync::Arc};

const CARS: &'static str = "cars";
const GLOBAL: &'static str = "global";
const T1: &'static str = "tables/t1.csv";
const SEASONS_YAML: &'static str = "seasons.yaml";
// const PAINT_STYLES_YAML: &'static str = "paint_styles.yaml";
// const COLORS_YAML: &'static str = "colors.yaml";

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
    let cars_data = crate::calc::cars::parse_car_yaml(&cars_path)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(Json(cars_data))
}

pub async fn get_car_parts_by_type_class(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(class): axum::extract::Path<String>,
    axum::extract::Path(body_type): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&CARS).join(&T1);
    let cars_path =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let cars_data = crate::calc::cars::parse_csv_t1(&cars_path)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    let parts_lines: Vec<&crate::calc::cars::CarPart> = cars_data.iter().filter(|fld| fld.class == class && fld.type_field == body_type).collect();
    if parts_lines.len() != 1 {
        return Err(AppError::InvalidData(format!("Data for class {} and body type {} found: {}", &class, &body_type, parts_lines.len())));
    }
    Ok(Json(parts_lines[1].detail_rus.clone()))
}

pub async fn get_global_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
     axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
     // Read the file content
    let file_path = PathBuf::from(&GLOBAL).join(sanitize_alphanumeric_and_dashes_and_dots(&path));
    let path_in_userspace = crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let string = tokio::fs::read_to_string(path_in_userspace).await.map_err(|_e| AppError::FileNotFound)?;
    Ok(string)
}

pub async fn get_season(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&GLOBAL).join(&SEASONS_YAML);
    let path_in_userspace = crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    Ok(Json(get_current_season_info(&path_in_userspace).map_err(|e| AppError::InternalServerError(e.to_string()))?))
}
