use futures_util::future::join_all;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::LazyLock;
use tokio::fs::File;
use tokio::io::BufReader;
use utils::stringext;

use crate::calc::constants::{self, *};
use crate::errors::AppError;
use crate::exlogging::{self, log_event};
use crate::models::table_validation::{make_basic_validation_rules, ValidationRule};
use crate::utils::stringext::StringExt;
use crate::utils::{
    self, parse_csv_delimiter_header_async, parse_csv_file_async_safe, serialize_and_write_csv,
    DataStorageCache,
};
use tokio::io::AsyncBufReadExt;

static CSV_EXT: LazyLock<&'static OsStr> = LazyLock::new(|| OsStr::new("csv"));

pub const TABLE_T2: &'static str = "tables/t2.csv";

pub async fn t2_rows_all(
    user_email: &str,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<Vec<IndexMap<String, String>>, AppError> {
    let path_in_userspace =
        crate::utils::get_file_path_user_common(&data_dir, &user_email, &TABLE_T2.to_string())
            .await
            .map_err(|e| AppError::IoError(e))?;
    let data = parse_csv_file_async_safe(data_dir, &path_in_userspace, cache).await?;
    return Ok(data);
}

pub async fn t2_rows_by_body_type(
    car_type: &str,
    user_email: &str,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<Vec<IndexMap<String, String>>, AppError> {
    let path_in_userspace =
        crate::utils::get_file_path_user_common(&data_dir, &user_email, &TABLE_T2.to_string())
            .await
            .map_err(|e| AppError::IoError(e))?;
    let data = parse_csv_file_async_safe(data_dir, &path_in_userspace, cache).await?;
    let filtered_by_class = data
        .into_iter()
        .filter(|row| {
            for (k, v) in row.iter() {
                if k.contains(T2_BODY) && v == car_type {
                    return true;
                }
            }
            false
        })
        .collect();
    return Ok(filtered_by_class);
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

    if !REQUIRED_FIELDS.iter().all(|&field| row.contains_key(field)) {
        let missing_fields: Vec<&str> = REQUIRED_FIELDS
            .iter()
            .filter(|&&field| !row.contains_key(field))
            .copied()
            .collect();

        return Err(AppError::InvalidData(format!(
            "Missing required fields: {:?}",
            missing_fields
        )));
    }

    if row[T2_PART_1].is_empty_or_whitespace() {
        return Err(AppError::InvalidData(format!(
            "Required field is empty: {:?}",
            T2_PART_1
        )));
    }

    let mut group = Some(row[T2_PART_1].clone());
    let name = if row[T2_PART_2].is_empty_or_whitespace() {
        // if second row is empty - use first row as name, but group is empty
        group = None;
        row[T2_PART_1].clone()
    } else {
        row[T2_PART_2].clone()
    };

    return Ok(T2PartEntry {
        group,
        name,
        zone: row[T2_ZONE].clone(),
        car_blueprint: row[T2_BLUEPRINT].clone(),
        // TODO: add actions parsing
        ..T2PartEntry::default()
    });
}

pub fn parse_all_nofail(rows: Vec<IndexMap<String, String>>) -> (Vec<T2PartEntry>, Vec<AppError>) {
    let mut entries = Vec::new();
    let mut errors = Vec::new();

    for row in rows {
        match t2_parse_row(row) {
            Ok(entry) => entries.push(entry),
            Err(error) => errors.push(error),
        }
    }

    (entries, errors)
}

pub fn parse_all_fail(rows: Vec<IndexMap<String, String>>) -> Result<Vec<T2PartEntry>, AppError> {
    let mut entries = Vec::new();

    for row in rows {
        let entry = t2_parse_row(row)?;
        entries.push(entry);
    }

    Ok(entries)
}
