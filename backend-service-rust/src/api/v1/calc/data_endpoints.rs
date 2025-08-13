use crate::{
    calc::{
        car_class_to_body_type::CLASS_TYPE_MAPPING_FILE,
        cars::body_type_into_t1_entry,
        constants::CAR_PART_DETAIL_UKR_FIELD,
        seasons::get_current_season_info,
        table_processing::{lookup, lookup_no_type_class},
    },
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{
        list_catalog_files_user_common, parse_csv_file_async_safe,
        sanitize_alphanumeric_and_dashes, sanitize_alphanumeric_and_dashes_and_dots,
    }, // Import the new CompanyInfo struct
};
use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Arc,
};

const CARS: &'static str = "cars";
const GLOBAL: &'static str = "global";
pub const T1: &'static str = "tables/t1.csv";
const SEASONS_YAML: &'static str = "seasons.yaml";
// const PAINT_STYLES_YAML: &'static str = "paint_styles.yaml";
// const COLORS_YAML: &'static str = "colors.yaml";

pub async fn list_car_makes(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let data = list_catalog_files_user_common(&app_state.data_dir_path, &user_email, &CARS)
        .await
        .map_err(|e| AppError::IoError(e))?;
    let car_makes: Vec<String> = data.iter().map(|s| s.replace(".yaml", "")).collect();
    Ok(Json(car_makes))
}

pub async fn list_class_body_types(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file content
    let file_path = PathBuf::from(&CLASS_TYPE_MAPPING_FILE);
    let path_in_userspace =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let string = tokio::fs::read_to_string(path_in_userspace)
        .await
        .map_err(|_e| AppError::FileNotFound)?;
    Ok(string)
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
    axum::extract::Path((class, body_type)): axum::extract::Path<(String, String)>,
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&T1);
    let cars_path =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let cars_data = crate::calc::cars::parse_csv_t1(&cars_path)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    let real_body = body_type_into_t1_entry(&body_type);
    let parts_lines: Vec<crate::calc::cars::CarPart> = cars_data
        .into_iter()
        .filter(|fld| fld.class == class && fld.type_field == real_body)
        .collect();
    if parts_lines.len() < 1 {
        return Err(AppError::InvalidData(format!(
            "Data for class {} and body type {} found: {}",
            &class,
            &real_body,
            parts_lines.len()
        )));
    }
    Ok(Json(parts_lines))
}

#[derive(Debug, Deserialize)]
pub struct LookupPartQuery {
    pub car_class: String,
    pub car_type: String,
    pub part: String,
}

#[derive(Debug, Deserialize)]
pub struct LookupPartNoTypeClassQuery {
    pub part: String,
}

pub async fn lookup_all_tables(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<LookupPartQuery>,
) -> Result<impl IntoResponse, AppError> {
    let parts_lines = lookup(
        &body_type_into_t1_entry(&q.car_type),
        &q.car_class,
        &q.part,
        &app_state.data_dir_path,
        &user_email,
        &app_state.cache,
    )
    .await?;
    Ok(Json(parts_lines))
}

pub async fn lookup_all_tables_all_types(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Query(q): Query<LookupPartNoTypeClassQuery>,
) -> Result<impl IntoResponse, AppError> {
    let parts_lines = lookup_no_type_class(
        &q.part,
        &app_state.data_dir_path,
        &user_email,
        &app_state.cache,
    )
    .await?;
    Ok(Json(parts_lines))
}

fn get_unique_values_iter(table: &Vec<HashMap<String, String>>, key: &str) -> Vec<String> {
    table
        .iter()
        .filter_map(|row| row.get(key))
        .collect::<HashSet<_>>()
        .into_iter()
        .cloned()
        .collect()
}

pub async fn list_all_parts(
    AuthenticatedUser(user_email): AuthenticatedUser, // Ensure admin is authenticated
    State(app_state): State<Arc<AppState>>,           // Extract user email from the path
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&T1);
    let t1 =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let parsed = parse_csv_file_async_safe(&app_state.data_dir_path, &t1, &app_state.cache).await?;
    Ok(Json(get_unique_values_iter(
        &parsed,
        CAR_PART_DETAIL_UKR_FIELD,
    )))
}

pub async fn get_global_file(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
    axum::extract::Path(path): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    // Read the file content
    let file_path = PathBuf::from(&GLOBAL).join(sanitize_alphanumeric_and_dashes_and_dots(&path));
    let path_in_userspace =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    let string = tokio::fs::read_to_string(path_in_userspace)
        .await
        .map_err(|_e| AppError::FileNotFound)?;
    Ok(string)
}

pub async fn get_season(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let file_path = PathBuf::from(&GLOBAL).join(&SEASONS_YAML);
    let path_in_userspace =
        crate::utils::get_file_path_user_common(&app_state.data_dir_path, &user_email, &file_path)
            .await
            .map_err(|e| AppError::IoError(e))?;
    Ok(Json(get_current_season_info(&path_in_userspace).map_err(
        |e| AppError::InternalServerError(e.to_string()),
    )?))
}
