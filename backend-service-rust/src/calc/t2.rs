use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::LazyLock;

use crate::calc::constants::*;
use crate::errors::AppError;
use crate::exlogging::{log_event, LogLevel};
use crate::utils::stringext::StringExt;
use crate::utils::{parse_csv_file_async_safe, DataStorageCache};

static CSV_EXT: LazyLock<&'static OsStr> = LazyLock::new(|| OsStr::new("csv"));

pub const TABLE_T2: &str = "tables/t2.csv";

pub async fn t2_rows_all(
    user_email: &str,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<Vec<IndexMap<String, String>>, AppError> {
    log_event(
        LogLevel::Debug,
        format!("t2_rows_all: Loading T2 table for user: {}", user_email),
        Some(user_email),
    );

    let path_in_userspace =
        crate::utils::get_file_path_user_common(data_dir, user_email, &TABLE_T2.to_string())
            .await
            .map_err(AppError::IoError)?;

    log_event(
        LogLevel::Debug,
        format!("t2_rows_all: Resolved path: {:?}", path_in_userspace),
        Some(user_email),
    );

    let data = parse_csv_file_async_safe(data_dir, &path_in_userspace, cache).await?;

    log_event(
        LogLevel::Debug,
        format!("t2_rows_all: Loaded {} rows from T2 table", data.len()),
        Some(user_email),
    );

    if let Some(first_row) = data.first() {
        log_event(
            LogLevel::Trace,
            format!("t2_rows_all: First row keys: {:?}", first_row.keys().collect::<Vec<_>>()),
            Some(user_email),
        );
    }

    Ok(data)
}

pub async fn t2_rows_by_body_type(
    car_type: &str,
    user_email: &str,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<Vec<IndexMap<String, String>>, AppError> {
    log_event(
        LogLevel::Debug,
        format!("t2_rows_by_body_type: Filtering for car_type='{}', user='{}'", car_type, user_email),
        Some(user_email),
    );

    let path_in_userspace =
        crate::utils::get_file_path_user_common(data_dir, user_email, &TABLE_T2.to_string())
            .await
            .map_err(AppError::IoError)?;

    log_event(
        LogLevel::Debug,
        format!("t2_rows_by_body_type: Resolved path: {:?}", path_in_userspace),
        Some(user_email),
    );

    let data = parse_csv_file_async_safe(data_dir, &path_in_userspace, cache).await?;

    log_event(
        LogLevel::Debug,
        format!("t2_rows_by_body_type: Loaded {} total rows before filtering", data.len()),
        Some(user_email),
    );

    let filtered_by_class: Vec<_> = data
        .into_iter()
        .filter(|row| {
            for (k, v) in row.iter() {
                if k.contains(T2_BODY) && v == car_type {
                    log_event(
                        LogLevel::Trace,
                        format!("t2_rows_by_body_type: Row matched - column='{}', value='{}'", k, v),
                        Some(user_email),
                    );
                    return true;
                }
            }
            false
        })
        .collect();

    log_event(
        LogLevel::Debug,
        format!("t2_rows_by_body_type: Filtered to {} rows matching car_type='{}'", filtered_by_class.len(), car_type),
        Some(user_email),
    );

    if filtered_by_class.is_empty() {
        log_event(
            LogLevel::Warn,
            format!("t2_rows_by_body_type: No rows matched car_type='{}'. Check T2_BODY constant='{}' and CSV column names", car_type, T2_BODY),
            Some(user_email),
        );
    }

    Ok(filtered_by_class)
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct T2PartEntry {
    pub name: String,
    pub group: Option<String>,
    pub actions: HashSet<String>,
    pub car_blueprint: String,
    pub zone: String,
}

pub fn t2_parse_row(row: IndexMap<String, String>) -> Result<T2PartEntry, AppError> {
    const REQUIRED_FIELDS: &[&str] = &[
        T2_ZONE,
        T2_PART_1,
        T2_PART_2,
        T2_BLUEPRINT,
        T2_ACTION_ASSEMBLE,
        T2_ACTION_TWIST,
        T2_ACTION_REPLACE,
        T2_ACTION_MOUNT,
        T2_ACTION_REPAIR,
        T2_ACTION_PAINT,
    ];

    log_event(
        LogLevel::Trace,
        format!("t2_parse_row: Parsing row with keys: {:?}", row.keys().collect::<Vec<_>>()),
        None::<String>,
    );

    if !REQUIRED_FIELDS.iter().all(|&field| row.contains_key(field)) {
        let missing_fields: Vec<&str> = REQUIRED_FIELDS
            .iter()
            .filter(|&&field| !row.contains_key(field))
            .copied()
            .collect();

        log_event(
            LogLevel::Warn,
            format!("t2_parse_row: Missing required fields: {:?}", missing_fields),
            None::<String>,
        );
        return Err(AppError::InvalidData(format!(
            "Missing required fields: {:?}",
            missing_fields
        )));
    }

    if row[T2_PART_1].is_empty_or_whitespace() {
        log_event(
            LogLevel::Warn,
            "t2_parse_row: T2_PART_1 field is empty".to_string(),
            None::<String>,
        );
        return Err(AppError::InvalidData(format!(
            "Required field is empty: {:?}",
            T2_PART_1
        )));
    }

    let mut group = Some(row[T2_PART_1].clone());
    let name = if row[T2_PART_2].is_empty_or_whitespace() {
        // if second row is empty - use first row as name, but group is empty
        log_event(
            LogLevel::Debug,
            "t2_parse_row: T2_PART_2 is empty, using T2_PART_1 as name without group".to_string(),
            None::<String>,
        );
        group = None;
        row[T2_PART_1].clone()
    } else {
        row[T2_PART_2].clone()
    };

    // Parse actions from action columns
    let action_fields = [
        (T2_ACTION_ASSEMBLE, "assemble"),
        (T2_ACTION_TWIST, "twist"),
        (T2_ACTION_REPLACE, "replace"),
        (T2_ACTION_MOUNT, "mount"),
        (T2_ACTION_REPAIR, "repair"),
        (T2_ACTION_PAINT, "paint"),
    ];

    let mut actions = HashSet::new();
    for (field_key, action_name) in action_fields {
        let value = &row[field_key];
        if !value.is_empty_or_whitespace() && value.trim() != "0" && value.trim().to_lowercase() != "false" {
            log_event(
                LogLevel::Debug,
                format!("t2_parse_row: Action '{}' is enabled (value='{}')", action_name, value),
                None::<String>,
            );
            actions.insert(action_name.to_string());
        }
    }

    let zone = row[T2_ZONE].clone();
    let car_blueprint = row[T2_BLUEPRINT].clone();

    log_event(
        LogLevel::Debug,
        format!(
            "t2_parse_row: Successfully parsed - name='{}', group={:?}, zone='{}', blueprint='{}', actions={:?}",
            name, group, zone, car_blueprint, actions
        ),
        None::<String>,
    );

    Ok(T2PartEntry {
        group,
        name,
        zone,
        car_blueprint,
        actions,
    })
}

pub fn parse_all_nofail(rows: Vec<IndexMap<String, String>>) -> (Vec<T2PartEntry>, Vec<AppError>) {
    log_event(
        LogLevel::Debug,
        format!("parse_all_nofail: Starting to parse {} rows", rows.len()),
        None::<String>,
    );

    let mut entries = Vec::new();
    let mut errors = Vec::new();

    for (idx, row) in rows.into_iter().enumerate() {
        match t2_parse_row(row) {
            Ok(entry) => entries.push(entry),
            Err(error) => {
                log_event(
                    LogLevel::Warn,
                    format!("parse_all_nofail: Error parsing row {}: {:?}", idx, error),
                    None::<String>,
                );
                errors.push(error);
            }
        }
    }

    log_event(
        LogLevel::Debug,
        format!(
            "parse_all_nofail: Completed - {} successful, {} errors",
            entries.len(),
            errors.len()
        ),
        None::<String>,
    );

    (entries, errors)
}

pub fn parse_all_fail(rows: Vec<IndexMap<String, String>>) -> Result<Vec<T2PartEntry>, AppError> {
    log_event(
        LogLevel::Debug,
        format!("parse_all_fail: Starting to parse {} rows (fail-fast mode)", rows.len()),
        None::<String>,
    );

    let mut entries = Vec::new();

    for (idx, row) in rows.into_iter().enumerate() {
        let entry = t2_parse_row(row)?;
        entries.push(entry);

        if (idx + 1) % 100 == 0 {
            log_event(
                LogLevel::Trace,
                format!("parse_all_fail: Processed {} rows so far", idx + 1),
                None::<String>,
            );
        }
    }

    log_event(
        LogLevel::Debug,
        format!("parse_all_fail: Successfully parsed all {} rows", entries.len()),
        None::<String>,
    );

    Ok(entries)
}
