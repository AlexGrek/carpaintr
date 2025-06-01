use std::sync::Arc;
use crate::exlogging::{log_event, LogLevel};
use crate::utils::{get_file_summary, safe_ensure_directory_exists, safe_read, safe_write, sanitize_alphanumeric_and_dashes, user_personal_directory_from_email};
use crate::{
    state::AppState,
    errors::AppError,
};
use crate::models::calculations::CalculationData;
use crate::{
    
    middleware::AuthenticatedUser
};
use axum::extract::Query;
use axum::http::header::{CONTENT_TYPE};
use axum::{
    extract::{State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
const CALCULATIONS: &'static str = "calculations";

#[derive(Debug, Serialize, Deserialize)]
struct SaveSuccessResponse {
    saved_file_path: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileQuery {
    filename: String
}

pub fn apply_and_return_file_name(data: &mut CalculationData) -> String {
    let file_name_existing = &data.saved_file_name.clone();
    if file_name_existing.is_some() {
        return file_name_existing.as_deref().unwrap().into();
    } else {
        data.saved_file_name = Some(create_new_saved_file_path(data));
        return data.saved_file_name.as_deref().unwrap().into();
    }
}

pub fn create_new_saved_file_path(data: &CalculationData) -> String {
    let header = match &data.model {
        Some(model_info) => format!("{}_{}", model_info.brand, model_info.model),
        _ => format!("{}_{}", data.body_type, data.car_class)
    };
    let file_name = format!("{}_{}_{:?}", header, data.year, data.timestamp.unwrap_or(chrono::Utc::now()));
    return format!("{}.json", sanitize_alphanumeric_and_dashes(&file_name));
}

// Handler for uploading user files
pub async fn save_calculation(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(mut req): Json<CalculationData>,
) -> Result<impl IntoResponse, AppError> {
    // Update timestamp on each save
    req.timestamp = Some(chrono::Utc::now());
    let file_name = apply_and_return_file_name(&mut req);
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let calcs_path = user_path.join(&CALCULATIONS);
    safe_ensure_directory_exists(&user_path, &calcs_path)?;
    let file_path = calcs_path.join(&file_name);

    
    let json = serde_json::to_string_pretty(&req)?; // or `to_vec` for bytes

    // Save to file
    log_event(LogLevel::Info, format!("Save calculation {} as {:?}", req.digest(), &file_name), Some(user_email));
    safe_write(user_path, file_path, json).await?;

    Ok(Json(SaveSuccessResponse {saved_file_path: file_name}))
}

pub async fn get_calculation_file(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<FileQuery>,
) -> Result<impl IntoResponse, AppError> {
    let filename = q.filename;
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let file_path = user_path.join(&CALCULATIONS).join(filename);

    let content = safe_read(&user_path, &file_path).await?;

    Ok((
        [(CONTENT_TYPE, "application/json")],
        content,
    ))
}

pub async fn get_calculations_list(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_path = user_personal_directory_from_email(&app_state.data_dir_path, &user_email)?;
    let file_path = user_path.join(&CALCULATIONS);

    let calcs = get_file_summary(file_path).await?;

    Ok(Json(calcs))
}