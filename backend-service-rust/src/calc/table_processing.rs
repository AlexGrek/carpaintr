use futures_util::future::join_all;
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use tokio::fs;

use crate::errors::AppError;
use crate::exlogging::log_event;
use crate::utils::{
    parse_csv_file_async_safe, user_catalog_directory_from_email, DataStorageCache, COMMON,
};

/// Asynchronously reads the contents of a directory and returns a vector of relative file paths.
///
/// # Arguments
///
/// * `dir_path` - The path to the directory to read.
///
/// # Returns
///
/// A `Result` containing a vector of `PathBuf`s representing the relative paths of the files
/// in the directory, or an `std::io::Error` if the directory cannot be read.
async fn read_directory_contents(dir_path: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    let mut reader = match fs::read_dir(dir_path).await {
        Ok(reader) => reader,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };

    while let Some(entry) = reader.next_entry().await? {
        let path = entry.path();
        if path.is_file() {
            paths.push(path);
        }
    }
    Ok(paths)
}

/// Merges the contents of a "common" and a "user" directory.
///
/// Reads the file paths from both directories and merges them. If a file with the
/// same name exists in both directories, the one from the "user" directory is kept.
///
/// # Arguments
///
/// * `common_dir` - The path to the "common" directory.
/// * `user_dir` - The path to the "user" directory.
///
/// # Returns
///
/// A `Result` containing a vector of `PathBuf`s with the merged and unique file paths,
/// or an `std::io::Error` if the "common" directory cannot be read.
pub async fn merge_directories(
    common_dir: &Path,
    user_dir: &Path,
) -> std::io::Result<Vec<PathBuf>> {
    // Read the user directory first. If it doesn't exist, this will be an empty vec.
    let user_files = read_directory_contents(user_dir).await?;

    // Read the common directory. An error here will propagate.
    let common_files = read_directory_contents(common_dir).await?;

    let mut final_paths: HashMap<OsString, PathBuf> = HashMap::new();

    // Insert common files first
    for path in common_files {
        if let Some(filename) = path.file_name() {
            final_paths.insert(filename.to_os_string(), path);
        }
    }

    // Insert user files, overwriting any common files with the same name
    for path in user_files {
        if let Some(filename) = path.file_name() {
            final_paths.insert(filename.to_os_string(), path);
        }
    }

    Ok(final_paths.into_values().collect())
}

pub const TABLES: &'static str = "tables";

pub async fn all_tables_list(
    data_dir: &PathBuf,
    user_email: &str,
) -> Result<Vec<PathBuf>, AppError> {
    merge_directories(
        &data_dir.join(COMMON).join(TABLES),
        user_catalog_directory_from_email(data_dir, user_email)?.as_path(),
    )
    .await
    .map_err(|e| e.into())
}

pub async fn lookup(
    car_type: &str,
    car_class: &str,
    part: &str,
    data_dir: &PathBuf,
    email: &str,
    cache: &DataStorageCache,
) -> Result<Vec<Option<HashMap<String, String>>>, AppError> {
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

pub async fn lookup_part_in_tables(
    car_type: &str,
    car_class: &str,
    part: &str,
    tables: Vec<PathBuf>,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Vec<Result<Option<HashMap<String, String>>, AppError>> {
    let futures: Vec<_> = tables
        .into_iter()
        .map(|table| lookup_part_in_table(car_type, car_class, part, table, data_dir, cache))
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
) -> Result<Option<HashMap<String, String>>, AppError> {
    let data = parse_csv_file_async_safe(data_dir, &file, cache).await?;
    let found = data.into_iter().find(|row| {
        if !row.contains_key("Список деталь рус") {
            return false;
        }
        if row["Список деталь рус"] != part {
            return false;
        }
        if let Some(val) = row.get("Список тип") {
            if val != car_type {
                return false;
            }
        }
        if let Some(val) = row.get("Список класс") {
            if val != car_class {
                return false;
            }
        }
        return true;
    });
    Ok(found)
}

#[cfg(test)]
mod tests {
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
