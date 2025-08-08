pub mod random;

use chrono::{DateTime, Duration, Utc};
use csv_async::AsyncReader;
use csv_async::AsyncReaderBuilder;
use lexiclean::Lexiclean;
use lru::LruCache;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::ffi::OsString;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use thiserror::Error;
use tokio::fs;
use tokio::fs::read_dir;
use tokio::io;
use tokio::io::AsyncBufRead;
use tokio::io::AsyncBufReadExt;
use tokio::io::AsyncReadExt;
use tokio::sync::RwLock;
use tokio_stream::StreamExt;

use crate::errors::AppError;
use crate::exlogging::log_event;
use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

pub mod money;

pub const COMMON: &'static str = "common";
pub const USERS: &'static str = "users";
pub const USERS_DELETED: &'static str = "deleted_users";
pub const CATALOG: &'static str = "catalog";
pub const ATTACHMENTS: &'static str = "attachments";

#[derive(Debug)]
pub struct DataStorageCache {
    as_string: Arc<RwLock<LruCache<PathBuf, String>>>,
    as_vec_u8: Arc<RwLock<LruCache<PathBuf, Vec<u8>>>>,
    as_csv: Arc<RwLock<LruCache<PathBuf, Vec<HashMap<String, String>>>>>,
}

impl DataStorageCache {
    pub fn new(string_cache_size: usize, vec_u8_cache_size: usize, csv_cache_size: usize) -> Self {
        DataStorageCache {
            as_string: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(string_cache_size).unwrap_or(NonZeroUsize::new(1).unwrap()),
            ))),
            as_vec_u8: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(vec_u8_cache_size).unwrap_or(NonZeroUsize::new(1).unwrap()),
            ))),
            as_csv: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(csv_cache_size).unwrap_or(NonZeroUsize::new(1).unwrap()),
            ))),
        }
    }

    pub async fn invalidate(&self, path: &Path) {
        self.as_string.write().await.pop(path);
        self.as_vec_u8.write().await.pop(path);
        self.as_csv.write().await.pop(path);
    }

    pub async fn get_caches_size(&self) -> Vec<(String, usize, usize)> {
        let mut sizes = Vec::new();

        let string_cache = self.as_string.read().await;
        let string_size: usize = string_cache.iter().map(|(_, v)| v.as_bytes().len()).sum();
        sizes.push(("String".to_string(), string_cache.len(), string_size));

        let vec_u8_cache = self.as_vec_u8.read().await;
        let vec_u8_size: usize = vec_u8_cache.iter().map(|(_, v)| v.len()).sum();
        sizes.push(("Vec<u8>".to_string(), vec_u8_cache.len(), vec_u8_size));

        let csv_cache = self.as_csv.read().await;
        let csv_size: usize = csv_cache
            .iter()
            .map(|(_, v)| {
                v.iter()
                    .map(|row| row.iter().map(|(k, v)| k.len() + v.len()).sum::<usize>())
                    .sum::<usize>()
            })
            .sum();
        sizes.push(("CSV".to_string(), csv_cache.len(), csv_size));

        sizes
    }
}

// Helper function for string-based delimiter detection
fn detect_separator_from_string(content: &str) -> u8 {
    let separators = [b',', b';', b'\t', b'|'];
    let mut max_count = 0;
    let mut best_sep = b',';

    // Only check first few lines for efficiency
    let sample: String = content.lines().take(2).collect::<Vec<_>>().join("\n");

    for &sep in &separators {
        let count = sample.bytes().filter(|&b| b == sep).count();
        if count > max_count {
            max_count = count;
            best_sep = sep;
        }
    }

    best_sep
}

async fn parse_csv_file_async<P: AsRef<Path>>(
    path: P,
    cache: &DataStorageCache,
) -> Result<Vec<HashMap<String, String>>, AppError> {
    let path_buf = path.as_ref().to_path_buf();
    if let Some(cached_data) = cache.as_csv.write().await.get(&path_buf) {
        return Ok(cached_data.clone());
    }

    // First pass: detect delimiter by reading only first two lines
    let file = tokio::fs::File::open(&path).await?;
    let mut buf_reader = tokio::io::BufReader::new(file);

    let mut first_line = String::new();
    let mut second_line = String::new();

    // Read first line
    if buf_reader.read_line(&mut first_line).await? == 0 {
        return Err(AppError::InvalidData("Empty file".to_string()));
    }

    // Read second line
    buf_reader.read_line(&mut second_line).await?;

    // Detect delimiter from first two lines
    let sample = format!("{}{}", first_line, second_line);
    let delimiter = detect_separator_from_string(&sample);

    // Second pass: reopen file and parse with detected delimiter
    let file = tokio::fs::File::open(&path).await?;
    let buf_reader = tokio::io::BufReader::new(file);

    let mut csv_reader = AsyncReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(true)
        .create_reader(buf_reader);

    let mut records = Vec::new();
    let headers = csv_reader.headers().await?.clone();
    let mut record_stream = csv_reader.records();

    while let Some(result) = record_stream.next().await {
        let record = result?;
        let mut row_map = HashMap::new();

        for (i, field) in record.iter().enumerate() {
            let header = headers.get(i);
            row_map.insert(
                header
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("column_{}", i)),
                field.to_string(),
            );
        }
        records.push(row_map);
    }

    cache.as_csv.write().await.put(path_buf, records.clone());

    Ok(records)
}

pub async fn parse_csv_file_async_safe<P: AsRef<Path>>(
    base: P,
    target: P,
    cache: &DataStorageCache,
) -> Result<Vec<HashMap<String, String>>, AppError> {
    let safe_path = safety_check_only(&base, &target)?;
    let parsed = parse_csv_file_async(&safe_path, cache).await?;
    return Ok(parsed);
}

#[derive(Debug, Error)]
pub enum SafeFsError {
    #[error("Path traversal attempt detected: target is outside base directory")]
    PathTraversalDetected,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub fn safety_check_only<P: AsRef<Path>, P2: AsRef<Path>>(base: P, target: P2) -> Result<P2, SafeFsError> {
    let base_clean = base.as_ref().lexiclean();
    let full_target = target.as_ref().lexiclean();
    let target_clean = full_target.lexiclean();

    if target_clean.starts_with(&base_clean) {
        Ok(target)
    } else {
        log_event(
            crate::exlogging::LogLevel::Warn,
            format!(
                "Path traversal detected: {} <- {}",
                base_clean.to_string_lossy(),
                target_clean.to_string_lossy()
            ),
            None::<&str>,
        );
        Err(SafeFsError::PathTraversalDetected)
    }
}

pub fn safe_join<P: AsRef<Path>>(base: P, target: P) -> Result<PathBuf, SafeFsError> {
    let base_clean = base.as_ref().lexiclean();
    let full_target = base_clean.join(target.as_ref());
    let target_clean = full_target.lexiclean();

    if target_clean.starts_with(&base_clean) {
        Ok(full_target)
    } else {
        Err(SafeFsError::PathTraversalDetected)
    }
}

pub async fn safe_write<P: AsRef<Path>>(
    base: P,
    target_relative: P,
    content: impl AsRef<[u8]>,
    cache: &DataStorageCache,
) -> Result<PathBuf, SafeFsError> {
    let safe_path = safe_join(&base, &target_relative)?;
    log::debug!("Safely writing file {:?}", safe_path);
    if let Some(parent) = safe_path.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(&safe_path, content).await?;
    cache.invalidate(&safe_path.as_ref()).await;
    Ok(safe_path)
}

pub fn safe_ensure_directory_exists<P: AsRef<Path>>(base: P, target: P) -> Result<(), SafeFsError> {
    let safe_path = safe_join(&base, &target)?;
    log::debug!("Safely ensuring directory {:?}", safe_path);
    std::fs::create_dir_all(&safe_path)?;
    Ok(())
}

pub async fn safe_read<P: AsRef<Path>>(
    base: P,
    target: P,
    cache: &DataStorageCache,
) -> Result<Vec<u8>, SafeFsError> {
    let safe_path = safe_join(&base, &target)?;
    let path_buf = safe_path.to_path_buf();

    if let Some(data) = cache.as_vec_u8.write().await.get(&path_buf) {
        return Ok(data.clone());
    }

    log::debug!("Safely reading file {:?}", safe_path);
    let data = fs::read(&safe_path).await?;
    cache.as_vec_u8.write().await.put(path_buf, data.clone());
    Ok(data)
}

pub fn sanitize_email_for_path(email: &str) -> String {
    percent_encode(email.as_bytes(), NON_ALPHANUMERIC).to_string()
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
    cache: &DataStorageCache,
) -> Result<(), std::io::Error> {
    let user_catalog = user_personal_directory_from_email(data_dir, email)?;
    let deleted_user_catalog = user_deleted_directory_from_email(data_dir, email)?;

    if let Some(parent) = deleted_user_catalog.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::create_dir_all(&deleted_user_catalog).await?;

    let mut entries = fs::read_dir(&user_catalog).await?;

    while let Some(entry) = entries.next_entry().await? {
        let entry_path = entry.path();
        let file_name = entry.file_name();
        let dest_path = deleted_user_catalog.join(file_name);

        if dest_path.exists() {
            if dest_path.is_dir() {
                fs::remove_dir_all(&dest_path).await?;
            } else {
                fs::remove_file(&dest_path).await?;
            }
        }

        cache.invalidate(&entry_path).await;
        fs::rename(&entry_path, &dest_path).await?;
    }
    Ok(())
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

pub async fn get_file_as_string_by_path<P: AsRef<Path>>(
    path: &P,
    root: &P,
    cache: &DataStorageCache,
) -> Result<String, SafeFsError> {
    let safe_path = safety_check_only(root, path)?;
    let path_buf = safe_path.as_ref().to_path_buf();

    if let Some(data) = cache.as_string.write().await.get(&path_buf) {
        return Ok(data.clone());
    }

    log::info!("Reading file: {:?}", path_buf);
    if fs::metadata(&path_buf).await.is_ok() {
        let content = fs::read_to_string(&path_buf).await?;
        cache.as_string.write().await.put(path_buf, content.clone());
        return Ok(content);
    } else {
        Err(io::Error::new(io::ErrorKind::NotFound, "File not found by path").into())
    }
}

pub async fn get_file_bytes<P: AsRef<Path>>(
    path: &P,
    root: &P,
    cache: &DataStorageCache,
) -> Result<Vec<u8>, SafeFsError> {
    let safe_path = safety_check_only(root, path)?;
    let path_buf = safe_path.as_ref().to_path_buf();

    if let Some(data) = cache.as_vec_u8.write().await.get(&path_buf) {
        return Ok(data.clone());
    }

    log::debug!("Safely reading file {:?}", path_buf);
    let data = fs::read(&safe_path).await?;
    cache.as_vec_u8.write().await.put(path_buf, data.clone());
    Ok(data)
}

pub async fn get_file_bytes_no_cache<P: AsRef<Path>, P2: AsRef<Path>>(
    path: &P,
    root: &P2,
) -> Result<Vec<u8>, SafeFsError> {
    let safe_path = safety_check_only(root, path)?;
    let path_buf = safe_path.as_ref().to_path_buf();

    log::debug!("Safely reading file {:?}", path_buf);
    let data = fs::read(&safe_path).await?;
    Ok(data)
}

pub async fn get_file_path_user_common<P: AsRef<Path>>(
    data_dir: &PathBuf,
    email: &str,
    subpath_to_file: &P,
) -> io::Result<PathBuf> {
    let user_file_path = user_catalog_directory_from_email(data_dir, email)?.join(subpath_to_file);

    if fs::metadata(&user_file_path).await.is_ok() {
        Ok(user_file_path)
    } else {
        let common_file_path = common_directory(data_dir)?.join(subpath_to_file);
        if fs::metadata(&common_file_path).await.is_ok() {
            Ok(common_file_path)
        } else {
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

pub async fn all_files_with_extension(
    data_dir: &PathBuf,
    user_email: &str,
    subdir: &str,
    extension: &OsStr,
) -> Result<Vec<PathBuf>, AppError> {
    merge_directories(
        &data_dir.join(COMMON).join(subdir),
        user_catalog_directory_from_email(data_dir, user_email)?
            .join(subdir)
            .as_path(),
    )
    .await
    .map(|lst| {
        lst.into_iter()
            .filter(|p| p.extension().map(|ext| ext == extension).unwrap_or(false))
            .collect()
    })
    .map_err(|e| e.into())
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
