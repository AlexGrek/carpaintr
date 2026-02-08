pub mod random;
pub mod money;
pub mod stringext;
pub mod filesystem;

use csv::WriterBuilder;
use csv_async::AsyncReaderBuilder;
use indexmap::IndexMap;
use indexmap::IndexSet;
use lru::LruCache;
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::AsyncBufReadExt;
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use tokio_stream::StreamExt;

use crate::errors::AppError;

// Re-export filesystem types and functions for backward compatibility
pub use filesystem::{
    all_files_with_extension, common_directory, delete_user_data_gracefully,
    get_catalog_file_as_string, get_file_as_string_by_path, get_file_bytes_no_cache,
    get_file_path_user_common, get_file_summary, list_catalog_files_user_common,
    safe_ensure_directory_exists, safe_join, safe_read, safe_write, safe_write_overwrite,
    safety_check_only, sanitize_alphanumeric_and_dashes,
    sanitize_alphanumeric_and_dashes_and_dots, user_catalog_directory_from_email,
    user_personal_directory_from_email, SafeFsError,
};

// Directory constants
pub const COMMON: &str = "common";
pub const USERS: &str = "users";
pub const USERS_DELETED: &str = "deleted_users";
pub const CATALOG: &str = "catalog";
pub const ATTACHMENTS: &str = "attachments";

#[derive(Debug)]
pub struct DataStorageCache {
    pub as_string: Arc<RwLock<LruCache<PathBuf, String>>>,
    pub as_vec_u8: Arc<RwLock<LruCache<PathBuf, Vec<u8>>>>,
    pub as_csv: Arc<RwLock<LruCache<PathBuf, Vec<IndexMap<String, String>>>>>,
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

    pub async fn invalidate_all(&self) {
        self.as_string.write().await.clear();
        self.as_vec_u8.write().await.clear();
        self.as_csv.write().await.clear();
    }

    pub async fn get_caches_size(&self) -> Vec<(String, usize, usize)> {
        let mut sizes = Vec::new();

        let string_cache = self.as_string.read().await;
        let string_size: usize = string_cache.iter().map(|(_, v)| v.len()).sum();
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

pub async fn parse_csv_delimiter_header_async<P: AsRef<Path>>(
    path: P,
) -> Result<(String, Vec<String>), AppError> {
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

    Ok((String::from(delimiter as char), Vec::new()))
}

async fn parse_csv_file_async<P: AsRef<Path>>(
    path: P,
    cache: &DataStorageCache,
) -> Result<Vec<IndexMap<String, String>>, AppError> {
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
        let mut row_map = IndexMap::new();

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
) -> Result<Vec<IndexMap<String, String>>, AppError> {
    let safe_path = safety_check_only(&base, &target)?;
    let parsed = parse_csv_file_async(&safe_path, cache).await?;
    Ok(parsed)
}

/// Serialize Vec<HashMap<String, String>> to CSV string using csv crate
async fn serialize_to_csv_with_crate(
    data: &Vec<IndexMap<String, String>>,
) -> Result<String, Box<dyn std::error::Error>> {
    if data.is_empty() {
        return Ok(String::new());
    }

    // Collect all unique keys
    let mut all_keys: IndexSet<String> = IndexSet::new();
    for record in data {
        all_keys.extend(record.keys().cloned());
    }

    let headers: Vec<String> = all_keys.into_iter().collect();
    let mut wtr = WriterBuilder::new().from_writer(vec![]);

    // Write header
    wtr.write_record(&headers)?;

    // Write data rows
    for record in data {
        let row: Vec<String> = headers
            .iter()
            .map(|key| record.get(key).unwrap_or(&String::new()).clone())
            .collect();
        wtr.write_record(&row)?;
    }

    let csv_bytes = wtr.into_inner()?;
    Ok(String::from_utf8(csv_bytes)?)
}

// Write CSV string to file using async tokio I/O
async fn write_csv_to_file(csv_content: &str, filename: &PathBuf) -> Result<(), AppError> {
    let mut file = File::create(filename).await?;
    file.write_all(csv_content.as_bytes()).await?;
    file.flush().await?;
    Ok(())
}

// Combined function: serialize and write to file in one step
pub async fn serialize_and_write_csv(
    data: &Vec<IndexMap<String, String>>,
    filename: &PathBuf,
) -> Result<(), AppError> {
    let csv_content = serialize_to_csv_with_crate(data)
        .await
        .map_err(|err| AppError::InternalServerError(err.to_string()))?;
    write_csv_to_file(&csv_content, filename).await?;
    Ok(())
}
