use crate::exlogging::{log_event, LogLevel};
use crate::middleware::AuthenticatedUser;
use crate::models::calculations::CarCalcData;
use crate::utils::{
    get_file_summary, safe_read, safe_write_overwrite,
    sanitize_alphanumeric_and_dashes, user_personal_directory_from_email,
};
use crate::{errors::AppError, state::AppState};
use axum::extract::Query;
use axum::http::header::CONTENT_TYPE;
use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
const CALCULATIONS: &str = "stored_calculations";

#[derive(Debug, Serialize, Deserialize)]
struct SaveSuccessResponse {
    saved_file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileQuery {
    filename: String,
}

pub fn apply_and_return_file_name(data: &mut CarCalcData) -> String {
    let file_name_existing = &data.car.store_file_name.clone();
    if file_name_existing.is_some() {
        file_name_existing.as_deref().unwrap().into()
    } else {
        data.car.store_file_name = Some(create_new_saved_file_path(data));
        data.car.store_file_name.as_deref().unwrap().into()
    }
}

pub fn create_new_saved_file_path(data: &CarCalcData) -> String {
    let carmake = data.car.make.clone().unwrap_or_default();
    let carmodel = data.car.make.clone().unwrap_or_default();
    let header = if carmake != String::default() && carmodel != String::default() {
        format!("{}_{}", carmake, carmodel)
    } else {
        format!("{}_{}", data.car.body_type, data.car.car_class)
    };
    let file_name = format!("{}_{}_{:?}", header, data.car.year, chrono::Utc::now());
    format!("{}.json", sanitize_alphanumeric_and_dashes(&file_name))
}

// Handler for uploading user files
pub async fn save_calculation(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(mut req): Json<CarCalcData>,
) -> Result<impl IntoResponse, AppError> {
    // Update timestamp on each save
    let file_name = apply_and_return_file_name(&mut req);
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let file_path = PathBuf::from(&CALCULATIONS).join(&file_name);

    let json = serde_json::to_string_pretty(&req)?; // or `to_vec` for bytes

    // Save to file
    log_event(
        LogLevel::Info,
        format!("Save calculation {:?} as {:?}", req.car.vin, &file_name),
        Some(user_email),
    );
    safe_write_overwrite(user_path, file_path, json, &app_state.cache).await?;

    Ok(Json(SaveSuccessResponse {
        saved_file_path: file_name,
    }))
}

pub async fn get_calculation_file(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<FileQuery>,
) -> Result<impl IntoResponse, AppError> {
    let filename = q.filename;
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let file_path = PathBuf::from(&CALCULATIONS).join(filename);

    let content = safe_read(&user_path, &file_path, &app_state.cache).await?;

    Ok(([(CONTENT_TYPE, "application/json")], content))
}

pub async fn get_calculations_list(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let file_path = user_path.join(CALCULATIONS);

    let calcs = get_file_summary(file_path).await?;

    Ok(Json(calcs))
}
