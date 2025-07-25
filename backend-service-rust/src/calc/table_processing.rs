use futures_util::future::join_all;
use std::collections::HashMap;
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::LazyLock;

use crate::calc::constants::*;
use crate::errors::AppError;
use crate::exlogging::log_event;
use crate::utils::{self, parse_csv_file_async_safe, DataStorageCache};

static CSV_EXT: LazyLock<&'static OsStr> = LazyLock::new(|| OsStr::new("csv"));

pub const TABLES: &'static str = "tables";

pub async fn all_tables_list(
    data_dir: &PathBuf,
    user_email: &str,
) -> Result<Vec<PathBuf>, AppError> {
    utils::all_files_with_extension(data_dir, user_email, TABLES, &CSV_EXT).await
}

pub async fn lookup(
    car_type: &str,
    car_class: &str,
    part: &str,
    data_dir: &PathBuf,
    email: &str,
    cache: &DataStorageCache,
) -> Result<Vec<(String, Option<HashMap<String, String>>)>, AppError> {
    let all_tables = all_tables_list(data_dir, email).await?;
    let in_tables =
        lookup_part_in_tables(car_type, car_class, part, all_tables, data_dir, cache).await;
    let collected: Vec<_> = in_tables
        .into_iter()
        .filter_map(|item| {
            match item {
                Ok(val) => Some(val), // If Ok, map it to Some(val)
                Err(e) => {
                    log_event(
                        crate::exlogging::LogLevel::Error,
                        format!("Error while parsing tables: {}", e.to_string()),
                        Some(email),
                    );
                    None
                }
            }
        })
        .collect();
    Ok(collected)
}

pub async fn lookup_no_type_class(
    part: &str,
    data_dir: &PathBuf,
    email: &str,
    cache: &DataStorageCache,
) -> Result<Vec<(String, Vec<HashMap<String, String>>)>, AppError> {
    let all_tables = all_tables_list(data_dir, email).await?;
    let in_tables = lookup_part_in_tables_any_type(part, all_tables, data_dir, cache).await;
    let collected: Vec<_> = in_tables
        .into_iter()
        .filter_map(|item| {
            match item {
                Ok(val) => Some(val), // If Ok, map it to Some(val)
                Err(e) => {
                    log_event(
                        crate::exlogging::LogLevel::Error,
                        format!("Error while parsing tables: {}", e.to_string()),
                        Some(email),
                    );
                    None
                }
            }
        })
        .collect();
    Ok(collected)
}

pub async fn lookup_part_in_tables(
    car_type: &str,
    car_class: &str,
    part: &str,
    tables: Vec<PathBuf>,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Vec<Result<(String, Option<HashMap<String, String>>), AppError>> {
    let futures: Vec<_> = tables
        .into_iter()
        .map(|table| lookup_part_in_table(car_type, car_class, part, table, data_dir, cache))
        .collect();
    join_all(futures).await
}

pub async fn lookup_part_in_tables_any_type(
    part: &str,
    tables: Vec<PathBuf>,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Vec<Result<(String, Vec<HashMap<String, String>>), AppError>> {
    let futures: Vec<_> = tables
        .into_iter()
        .map(|table| lookup_part_in_table_any_type(part, table, data_dir, cache))
        .collect();
    join_all(futures).await
}

pub async fn lookup_part_in_table(
    car_type: &str,
    car_class: &str,
    part: &str,
    file: PathBuf,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<(String, Option<HashMap<String, String>>), AppError> {
    let data = parse_csv_file_async_safe(data_dir, &file, cache).await?;
    let found = data.into_iter().find(|row| {
        let debug_data: Vec<&String> = row.keys().into_iter().collect();
        if !row.contains_key(CAR_PART_DETAIL_RUS_FIELD) {
            return false;
        }
        if row[CAR_PART_DETAIL_RUS_FIELD] != part {
            return false;
        }
        if let Some(val) = row.get(CAR_PART_TYPE_FIELD) {
            if val != car_type {
                return false;
            }
        }
        if let Some(val) = row.get(CAR_PART_CLASS_FIELD) {
            if val != car_class {
                return false;
            }
        }
        return true;
    });
    let table_file_name = file
        .as_path()
        .file_name()
        .unwrap_or(OsStr::new("Unknown path"))
        .to_string_lossy()
        .to_string();
    Ok((table_file_name, found))
}

pub async fn lookup_part_in_table_any_type(
    part: &str,
    file: PathBuf,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<(String, Vec<HashMap<String, String>>), AppError> {
    let data = parse_csv_file_async_safe(data_dir, &file, cache).await?;
    let found: Vec<_> = data
        .into_iter()
        .filter(|row| {
            if !row.contains_key(CAR_PART_DETAIL_RUS_FIELD) {
                return false;
            }
            if row[CAR_PART_DETAIL_RUS_FIELD] != part {
                return false;
            }
            return true;
        })
        .collect();
    let table_file_name = file
        .as_path()
        .file_name()
        .unwrap_or(OsStr::new("Unknown path"))
        .to_string_lossy()
        .to_string();
    Ok((table_file_name, found))
}

#[cfg(test)]
mod tests {
    use crate::utils::merge_directories;

    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_merge_directories() {
        // Create temporary directories for testing
        let common_dir = tempdir().unwrap();
        let user_dir = tempdir().unwrap();

        // Create dummy files
        File::create(common_dir.path().join("file1.txt")).unwrap();
        File::create(common_dir.path().join("file2.txt")).unwrap();
        File::create(user_dir.path().join("file2.txt")).unwrap();
        File::create(user_dir.path().join("file3.txt")).unwrap();

        let merged_files = merge_directories(common_dir.path(), user_dir.path())
            .await
            .unwrap();

        let mut merged_filenames: Vec<String> = merged_files
            .iter()
            .map(|p| p.file_name().unwrap().to_str().unwrap().to_string())
            .collect();
        merged_filenames.sort();

        assert_eq!(
            merged_filenames,
            vec!["file1.txt", "file2.txt", "file3.txt"]
        );

        // Verify that the overridden file is from the user directory
        let file2_path = merged_files
            .iter()
            .find(|p| p.file_name().unwrap() == "file2.txt")
            .unwrap();
        assert!(file2_path.starts_with(user_dir.path()));
    }

    #[tokio::test]
    async fn test_merge_with_nonexistent_user_directory() {
        let common_dir = tempdir().unwrap();
        let non_existent_user_dir = PathBuf::from("non_existent_user_dir");

        File::create(common_dir.path().join("file1.txt")).unwrap();

        let merged_files = merge_directories(common_dir.path(), &non_existent_user_dir)
            .await
            .unwrap();

        let mut merged_filenames: Vec<String> = merged_files
            .iter()
            .map(|p| p.file_name().unwrap().to_str().unwrap().to_string())
            .collect();
        merged_filenames.sort();

        assert_eq!(merged_filenames, vec!["file1.txt"]);
    }
}
