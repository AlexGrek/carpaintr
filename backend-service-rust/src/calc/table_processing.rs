use futures_util::future::join_all;
use indexmap::IndexMap;
use std::collections::{HashMap, HashSet};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::LazyLock;
use tokio::fs::File;
use tokio::io::BufReader;

use crate::calc::constants::{self, *};
use crate::errors::AppError;
use crate::exlogging::{self, log_event};
use crate::models::table_validation::{make_basic_validation_rules, ValidationRule};
use crate::utils::{
    self, parse_csv_delimiter_header_async, parse_csv_file_async_safe, serialize_and_write_csv,
    DataStorageCache,
};
use tokio::io::AsyncBufReadExt;

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
) -> Result<Vec<(String, Option<IndexMap<String, String>>)>, AppError> {
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

fn has_leading_or_trailing_whitespace(s: &str) -> bool {
    s != s.trim()
}

fn validate_table_value(validators: &Vec<ValidationRule>, value: &str, key: &str) -> Vec<String> {
    let mut issues = vec![];
    for validator in validators {
        if validator.does_apply(value, key) {
            issues.push(validator.report());
        }
    }
    if has_leading_or_trailing_whitespace(value) {
        issues.push(format!(
            "E: Has leading or trailing whitespaces in {}",
            value
        ));
    }
    issues
}

fn fix_table_value(validators: &Vec<ValidationRule>, value: &str, key: &str) -> Option<String> {
    for validator in validators {
        if validator.does_apply(value, key) {
            return Some(validator.apply(value).trim().to_string());
        }
    }
    if has_leading_or_trailing_whitespace(value) {
        return Some(value.trim().to_string());
    }
    None
}

fn swap_keys(vec_maps: &mut Vec<IndexMap<String, String>>, replacements: &HashMap<String, String>) {
    for map in vec_maps.iter_mut() {
        for (old_key, new_key) in replacements {
            if let Some((index, _k, value)) = map.shift_remove_full(old_key) {
                map.shift_insert(index, new_key.to_string(), value);
            }
        }
    }
}

pub async fn fix_issues_with_csv_async<P: AsRef<std::path::Path>>(
    base: P,
    path: P,
    cache: &DataStorageCache,
) -> Result<Vec<String>, AppError> {
    let path_buf = path.as_ref().to_path_buf();
    let validators = make_basic_validation_rules();
    let mut issues = vec![];
    let mut replacements = HashMap::new();
    let mut keys = HashSet::new();
    let mut parsed = parse_csv_file_async_safe(base, path, cache).await?;
    let (delimiter, _) = parse_csv_delimiter_header_async(&path_buf).await?;
    if delimiter != "," {
        issues.push(format!("W: Incorrect delimiter, got: {}", delimiter));
    }
    for line in parsed.iter_mut() {
        for (key, value) in line.iter_mut() {
            if let Some(upd) = fix_table_value(&validators, &value, &key) {
                *value = upd;
                issues.push(format!("FIXED: {}", &value));
            }
            keys.insert(key.to_string());
        }
    }
    if !keys.contains(constants::CAR_PART_DETAIL_UKR_FIELD) {
        issues.push(format!(
            "E: Column {} not found in {} keys",
            constants::CAR_PART_DETAIL_UKR_FIELD,
            keys.len()
        ));
        if keys.contains("Деталь") {
            replacements.insert(
                "Деталь".to_string(),
                constants::CAR_PART_DETAIL_UKR_FIELD.to_string(),
            );
        }
    }
    if !keys.contains(constants::CAR_PART_TYPE_FIELD) {
        issues.push(format!(
            "E: Column {} not found in {} keys",
            constants::CAR_PART_TYPE_FIELD,
            keys.len()
        ));
        if keys.contains("ТИП") {
            replacements.insert(
                "ТИП".to_string(),
                constants::CAR_PART_TYPE_FIELD.to_string(),
            );
        }
    }
    if !keys.contains(constants::CAR_PART_CLASS_FIELD) {
        issues.push(format!(
            "E: Column {} not found in {} keys",
            constants::CAR_PART_CLASS_FIELD,
            keys.len()
        ));
        if keys.contains("класс") {
            replacements.insert(
                "класс".to_string(),
                constants::CAR_PART_CLASS_FIELD.to_string(),
            );
        }
    }
    if replacements.len() > 0 {
        swap_keys(&mut parsed, &replacements);
    }
    if issues.len() > 0 {
        // write file back
        exlogging::log_event(
            exlogging::LogLevel::Info,
            format!("Fixed file {path_buf:?}"),
            None::<String>,
        );
        serialize_and_write_csv(&parsed, &path_buf).await?;
    }
    cache.invalidate(&path_buf).await;
    return Ok(issues);
}

pub async fn find_issues_with_csv_async<P: AsRef<std::path::Path>>(
    base: P,
    path: P,
    cache: &DataStorageCache,
) -> Result<Vec<String>, AppError> {
    let path_buf = path.as_ref().to_path_buf();
    let validators = make_basic_validation_rules();
    let mut issues = vec![];
    let mut keys = HashSet::new();
    let parsed = parse_csv_file_async_safe(base, path, cache).await?;
    let (delimiter, _) = parse_csv_delimiter_header_async(path_buf).await?;
    if delimiter != "," {
        issues.push(format!("W: Incorrect delimiter, got: {}", delimiter));
    }
    for line in parsed.into_iter() {
        for (key, value) in line.into_iter() {
            issues.extend_from_slice(&validate_table_value(&validators, &value, &key));
            keys.insert(key);
        }
    }
    if !keys.contains(constants::CAR_PART_DETAIL_UKR_FIELD) {
        issues.push(format!(
            "E: Column {} not found in {} keys",
            constants::CAR_PART_DETAIL_UKR_FIELD,
            keys.len()
        ));
    }
    return Ok(issues);
}

pub async fn lookup_no_type_class(
    part: &str,
    data_dir: &PathBuf,
    email: &str,
    cache: &DataStorageCache,
) -> Result<Vec<(String, Vec<IndexMap<String, String>>)>, AppError> {
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

pub async fn get_csv_header(table: PathBuf) -> Result<Vec<String>, AppError> {
    let file = File::open(table).await?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    if let Some(first_line) = lines.next_line().await? {
        let headers: Vec<String> = first_line
            .split(',')
            .map(|s| s.trim().trim_matches('"').to_string())
            .collect();
        Ok(headers)
    } else {
        Err(AppError::InvalidData(
            "Empty file or unable to read first line".into(),
        ))
    }
}

pub async fn all_tables_headers(
    data_dir: &PathBuf,
    email: &str,
) -> Result<HashMap<String, Vec<String>>, AppError> {
    let all_tables = all_tables_list(data_dir, email).await?;

    // Create futures that also capture the table name/path for the HashMap key
    let futures: Vec<_> = all_tables
        .into_iter()
        .map(|table| {
            let table_name = table
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            async move {
                let headers = get_csv_header(table).await?;
                Ok::<(String, Vec<String>), AppError>((table_name, headers))
            }
        })
        .collect();

    let results = join_all(futures).await;

    // Convert Vec<Result<(String, Vec<String>), AppError>> to Result<HashMap<String, Vec<String>>, AppError>
    let mut header_map = HashMap::new();
    for result in results {
        let (table_name, headers) = result.unwrap_or(("ERROR".to_string(), vec![]));
        header_map.insert(table_name, headers);
    }

    Ok(header_map)
}

pub async fn lookup_part_in_tables(
    car_type: &str,
    car_class: &str,
    part: &str,
    tables: Vec<PathBuf>,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Vec<Result<(String, Option<IndexMap<String, String>>), AppError>> {
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
) -> Vec<Result<(String, Vec<IndexMap<String, String>>), AppError>> {
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
) -> Result<(String, Option<IndexMap<String, String>>), AppError> {
    let data = parse_csv_file_async_safe(data_dir, &file, cache).await?;
    let found = data.into_iter().find(|row| {
        // let debug_data: Vec<&String> = row.keys().into_iter().collect();
        if !row.contains_key(CAR_PART_DETAIL_UKR_FIELD) {
            return false;
        }
        if row[CAR_PART_DETAIL_UKR_FIELD] != part {
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
) -> Result<(String, Vec<IndexMap<String, String>>), AppError> {
    let data = parse_csv_file_async_safe(data_dir, &file, cache).await?;
    let found: Vec<_> = data
        .into_iter()
        .filter(|row| {
            if !row.contains_key(CAR_PART_DETAIL_UKR_FIELD) {
                return false;
            }
            if row[CAR_PART_DETAIL_UKR_FIELD] != part {
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
