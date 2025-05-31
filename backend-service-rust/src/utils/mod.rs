use chrono::{DateTime, Duration, Utc};
use lexiclean::Lexiclean;
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use std::path::PathBuf;
use thiserror::Error;
use tokio::fs;
use tokio::fs::read_dir;
use tokio::io;

pub const COMMON: &'static str = "common";
pub const USERS: &'static str = "users";
pub const USERS_DELETED: &'static str = "deleted_users";
pub const CATALOG: &'static str = "catalog";

use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

#[derive(Debug, Error)]
pub enum SafeFsError {
    #[error("Path traversal attempt detected: target is outside base directory")]
    PathTraversalDetected,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub fn safety_check<P: AsRef<Path>>(base: P, target: P) -> Result<PathBuf, SafeFsError> {
    // Clean the base path lexically
    let base_clean = base.as_ref().lexiclean();

    // Create the full target path and clean it
    let full_target = base_clean.join(target.as_ref());
    let target_clean = full_target.lexiclean();

    // Check if the cleaned target is within the base directory
    if target_clean.starts_with(&base_clean) {
        Ok(target_clean)
    } else {
        Err(SafeFsError::PathTraversalDetected)
    }
}

/// Safely write content to a file, ensuring it's within user base path
pub async fn safe_write<P: AsRef<Path>>(
    base: P,
    target: P,
    content: impl AsRef<[u8]>,
) -> Result<(), SafeFsError> {
    safety_check(&base, &target)?;
    log::debug!("Safely writing file {:?}", target.as_ref());
    fs::create_dir_all(target.as_ref().parent().unwrap()).await?;
    fs::write(target, content).await?;
    Ok(())
}

pub fn safe_ensure_directory_exists<P: AsRef<Path>>(base: P, target: P) -> Result<(), SafeFsError> {
    safety_check(&base, &target)?;
    log::debug!("Safely ensuring directory {:?}", target.as_ref());
    std::fs::create_dir_all(&target)?;
    Ok(())
}

/// Safely read content from a file, ensuring it's within user base path
pub async fn safe_read<P: AsRef<Path>>(base: P, target: P) -> Result<Vec<u8>, SafeFsError> {
    safety_check(&base, &target)?;
    log::debug!("Safely reading file {:?}", target.as_ref());
    let data = fs::read(target).await?;
    Ok(data)
}

pub fn sanitize_email_for_path(email: &str) -> String {
    percent_encode(email.as_bytes(), NON_ALPHANUMERIC).to_string()
    // A more robust approach might involve base64 encoding or UUIDs
}

pub fn user_catalog_directory_from_email(
    data_dir: &PathBuf,
    email: &str,
) -> Result<PathBuf, std::io::Error> {
    let full_path = user_personal_directory_from_email(data_dir, email)?.join(CATALOG);
    std::fs::create_dir_all(&full_path)?;
    Ok(full_path)
}

pub async fn delete_user_data_gracefully(
    data_dir: &PathBuf,
    email: &str,
) -> Result<(), std::io::Error> {
    let user_catalog = user_personal_directory_from_email(data_dir, email)?;
    let deleted_user_catalog = user_deleted_directory_from_email(data_dir, email)?;

    // Create the deleted user directory if it doesn't exist
    if let Some(parent) = deleted_user_catalog.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::create_dir_all(&deleted_user_catalog).await?;

    let mut entries = fs::read_dir(&user_catalog).await?;

    while let Some(entry) = entries.next_entry().await? {
        let entry_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = deleted_user_catalog.join(file_name);

        // Remove destination if it exists (overwrite behavior)
        if dest_path.exists() {
            if dest_path.is_dir() {
                fs::remove_dir_all(&dest_path).await?;
            } else {
                fs::remove_file(&dest_path).await?;
            }
        }

        // Move the file/directory
        fs::rename(&entry_path, &dest_path).await?;

        // do nothing if user_catalog does not exist
        // move all data from user_catalog dir into deleted_user_catalog dir (create if not exist), delete user_catalog
        // if deleted_user_catalog was previously existing and non-empty - do not care, ovwerwrite whatever we need to overwrite
    }
    return Ok(());
}

pub fn user_deleted_directory_from_email(
    data_dir: &PathBuf,
    email: &str,
) -> Result<PathBuf, std::io::Error> {
    let full_path = data_dir
        .join(&USERS_DELETED)
        .join(sanitize_email_for_path(email));
    std::fs::create_dir_all(&full_path)?;
    Ok(full_path)
}

pub fn user_personal_directory_from_email(
    data_dir: &PathBuf,
    email: &str,
) -> Result<PathBuf, std::io::Error> {
    let full_path = data_dir.join(&USERS).join(sanitize_email_for_path(email));
    std::fs::create_dir_all(&full_path)?;
    Ok(full_path)
}

pub fn common_directory(data_dir: &PathBuf) -> Result<PathBuf, std::io::Error> {
    let full_path = data_dir.join(COMMON);
    std::fs::create_dir_all(&full_path)?;
    Ok(full_path)
}

pub async fn list_unique_file_names<P: AsRef<Path>>(dirs: &[P]) -> io::Result<Vec<String>> {
    let mut names_set = HashSet::new();

    for dir in dirs {
        let mut entries = match fs::read_dir(dir).await {
            Ok(entries) => entries,
            Err(e) => {
                eprintln!("Error reading directory {:?}: {}", dir.as_ref(), e);
                continue;
            }
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(file_type) = entry.file_type().await {
                if file_type.is_file() {
                    if let Some(name) = entry.file_name().to_str() {
                        names_set.insert(name.to_string());
                    }
                }
            }
        }
    }

    Ok(names_set.into_iter().collect())
}

pub async fn list_unique_file_names_two<P: AsRef<Path>>(
    dir1: &P,
    dir2: &P,
) -> io::Result<Vec<String>> {
    let dirs = vec![dir1, dir2];
    list_unique_file_names(&dirs).await
}

pub async fn list_catalog_files_user_common<P: AsRef<Path>>(
    data_dir: &PathBuf,
    email: &str,
    subpath: &P,
) -> io::Result<Vec<String>> {
    let user_dir = user_catalog_directory_from_email(data_dir, email)?.join(subpath);
    let common_dir = common_directory(data_dir)?.join(subpath);
    return list_unique_file_names_two(&user_dir, &common_dir).await;
}

// pub async fn get_file_user_common<P: AsRef<Path>>(data_dir: &PathBuf, email: &str, subpath_to_file: &P) -> io::Result<String> {
//     let user_file_path = user_directory_from_email(data_dir, email)?.join(subpath_to_file);
//     let common_file_path = common_directory(data_dir)?.join(subpath_to_file);

//     if fs::metadata(&user_file_path).await.is_ok() {
//         // File exists in user directory, read from there
//         fs::read_to_string(user_file_path).await
//     } else if fs::metadata(&common_file_path).await.is_ok() {
//         // File doesn't exist in user directory, check common directory
//         fs::read_to_string(common_file_path).await
//     } else {
//         // File not found in either location
//         Err(io::Error::new(io::ErrorKind::NotFound, "File not found in user or common directory"))
//     }
// }

pub async fn get_file_as_string_by_path<P: AsRef<Path>>(path: &P, root: &P) -> Result<String, SafeFsError> {
    safety_check(root, path)?;
    let path2 = path.as_ref().to_owned();
    log::info!("Reading file: {:?}", path2);
    if fs::metadata(&path).await.is_ok() {
        return Ok(fs::read_to_string(path).await?)
    } else {
        Err(io::Error::new(
            io::ErrorKind::NotFound,
            "File not found by path",
        ).into())
    }
}

pub async fn get_file_path_user_common<P: AsRef<Path>>(
    data_dir: &PathBuf,
    email: &str,
    subpath_to_file: &P,
) -> io::Result<PathBuf> {
    // Construct the potential path in the user's directory
    let user_file_path = user_catalog_directory_from_email(data_dir, email)?.join(subpath_to_file);

    // Check if the file exists in the user's directory
    if fs::metadata(&user_file_path).await.is_ok() {
        // File exists in user directory, return that path
        Ok(user_file_path)
    } else {
        // File doesn't exist in user directory, construct the path in the common directory
        let common_file_path = common_directory(data_dir)?.join(subpath_to_file);

        // Check if the file exists in the common directory
        if fs::metadata(&common_file_path).await.is_ok() {
            // File exists in common directory, return that path
            Ok(common_file_path)
        } else {
            // File not found in either location
            Err(io::Error::new(
                io::ErrorKind::NotFound,
                format!(
                    "File not found in user or common directory: {:?}",
                    subpath_to_file.as_ref()
                ),
            ))
        }
    }
}

pub fn sanitize_alphanumeric_and_dashes(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

pub fn sanitize_alphanumeric_and_dashes_and_dots(input: &str) -> String {
    input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect()
}

#[derive(Serialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub modified: DateTime<Utc>,
}

#[derive(Serialize, Debug)]
pub struct FileSummary {
    pub all_files: Vec<FileEntry>,
    pub modified_last_24h: Vec<FileEntry>,
    pub modified_1w_excl_24h: Vec<FileEntry>,
    pub older_than_1w: Vec<FileEntry>,
}

pub async fn get_file_summary<P: AsRef<Path>>(dir: P) -> io::Result<FileSummary> {
    let mut all_files = Vec::new();
    let mut modified_last_24h = Vec::new();
    let mut modified_1w_excl_24h = Vec::new();
    let mut older_than_1w = Vec::new();

    let now = Utc::now();
    let one_day_ago = now - Duration::days(1);
    let seven_days_ago = now - Duration::days(7);

    let mut entries = read_dir(dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        let metadata = entry.metadata().await?;
        if !metadata.is_file() {
            continue;
        }

        let path = entry.path();
        let filename = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();

        let modified: DateTime<Utc> = metadata.modified().map(DateTime::<Utc>::from)?;

        let file_entry = FileEntry {
            name: filename,
            modified,
        };

        if modified > one_day_ago {
            modified_last_24h.push(file_entry.clone());
        } else if modified > seven_days_ago {
            modified_1w_excl_24h.push(file_entry.clone());
        } else {
            older_than_1w.push(file_entry.clone());
        }

        all_files.push(file_entry);
    }

    // Sort each group by modified date (newest first)
    let sort_desc = |a: &FileEntry, b: &FileEntry| b.modified.cmp(&a.modified);

    all_files.sort_by(sort_desc);
    modified_last_24h.sort_by(sort_desc);
    modified_1w_excl_24h.sort_by(sort_desc);
    older_than_1w.sort_by(sort_desc);

    Ok(FileSummary {
        all_files,
        modified_last_24h,
        modified_1w_excl_24h,
        older_than_1w,
    })
}
