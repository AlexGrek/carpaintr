use std::{path::PathBuf};
use std::collections::HashSet;
use tokio::fs;
use tokio::io;
use std::path::Path;

pub const COMMON: &'static str = "common";

use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

    // Sanitize email for use in a file path
    // This is a basic sanitization; a production system might need more robust handling
    // to avoid path traversal issues, though percent-encoding non-alphanumeric chars helps.
pub fn sanitize_email_for_path(email: &str) -> String {
        percent_encode(email.as_bytes(), NON_ALPHANUMERIC).to_string()
        // A more robust approach might involve base64 encoding or UUIDs
}

pub fn user_directory_from_email(data_dir: &PathBuf, email: &str) -> Result<PathBuf, std::io::Error> {
    let full_path = data_dir.join(sanitize_email_for_path(email));
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

pub async fn list_unique_file_names_two<P: AsRef<Path>>(dir1: &P, dir2: &P) -> io::Result<Vec<String>> {
    let dirs = vec![dir1, dir2];
    list_unique_file_names(&dirs).await
}

pub async fn list_files_user_common<P: AsRef<Path>>(data_dir: &PathBuf, email: &str, subpath: &P) -> io::Result<Vec<String>> {
    let user_dir = user_directory_from_email(data_dir, email)?.join(subpath);
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

pub async fn get_file_by_path<P: AsRef<Path>>(path: &P) -> io::Result<String> {
    if fs::metadata(&path).await.is_ok() {
        // File exists in user directory, read from there
        fs::read_to_string(path).await
    } else {
        // File not found in either location
        Err(io::Error::new(io::ErrorKind::NotFound, "File not found in user or common directory"))
    }
}

pub async fn get_file_path_user_common<P: AsRef<Path>>(data_dir: &PathBuf, email: &str, subpath_to_file: &P) -> io::Result<PathBuf> {
    // Construct the potential path in the user's directory
    let user_file_path = user_directory_from_email(data_dir, email)?.join(subpath_to_file);

    log::warn!("{user_file_path:?}");

    // Check if the file exists in the user's directory
    if fs::metadata(&user_file_path).await.is_ok() {
        // File exists in user directory, return that path
        log::warn!("{user_file_path:?} metadata is OK");
        Ok(user_file_path)
    } else {
        // File doesn't exist in user directory, construct the path in the common directory
        let common_file_path = common_directory(data_dir)?.join(subpath_to_file);

        // Check if the file exists in the common directory
        if fs::metadata(&common_file_path).await.is_ok() {
            // File exists in common directory, return that path
            log::warn!("{common_file_path:?} common is OK");
            Ok(common_file_path)
        } else {
            // File not found in either location
            Err(io::Error::new(io::ErrorKind::NotFound, format!("File not found in user or common directory: {:?}", subpath_to_file.as_ref())))
        }
    }
}

pub fn sanitize_alphanumeric_and_dashes(input: &str) -> String {
    input.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

pub fn sanitize_alphanumeric_and_dashes_and_dots(input: &str) -> String {
    input.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect()
}

