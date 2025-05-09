use moka::sync::Cache;
use std::sync::Arc;
use crate::{
    models::LicenseData,
    errors::AppError,
    state::AppState,
};
use std::path::PathBuf;
use tokio::fs;
use serde_json;
use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

const LICENSE_CACHE_MAX_SIZE: u64 = 100; // Configurable limit
const LICENSE_FILE_NAME: &str = "license.json";

// Note: Using sync cache here because moka::async::Cache requires a tokio runtime
// to be available when methods are called, which can be tricky with Actix-web's
// threading model and state. For Axum, which is purely tokio-based, the async cache
// would also work, but the sync one is simpler if blocking is acceptable (file reads are async).
// The `get` method on the sync cache is blocking, but `get_with` (or similar async variants)
// would be needed if the loading function was blocking. Since `load_license_from_disk` is async,
// the `get` here refers to the cache lookup itself, which is fast.
// The async part comes from awaiting `load_license_from_disk` on a cache miss.

pub struct LicenseCache {
    cache: Cache<String, LicenseData>, // Key: email
    data_dir: PathBuf,
}

impl LicenseCache {
    pub fn new(data_dir: PathBuf, max_size: u64) -> Arc<Self> {
        let cache: Cache<String, LicenseData> = Cache::builder()
            .max_capacity(max_size)
            // Optionally add time-to-live or time-to-idle policies here
            // .time_to_live(Duration::from_secs(60 * 60)) // Example: 1 hour TTL
            .build();
        Arc::new(Self { cache, data_dir })
    }

    // Sanitize email for use in a file path
    // This is a basic sanitization; a production system might need more robust handling
    // to avoid path traversal issues, though percent-encoding non-alphanumeric chars helps.
    fn sanitize_email_for_path(&self, email: &str) -> String {
        percent_encode(email.as_bytes(), NON_ALPHANUMERIC).to_string()
        // A more robust approach might involve base64 encoding or UUIDs
    }

    // This function is async because it uses tokio::fs
    async fn load_license_from_disk(&self, email: &str) -> Result<LicenseData, AppError> {
        let safe_email = self.sanitize_email_for_path(email);
        let user_data_dir = self.data_dir.join(safe_email);
        let license_path = user_data_dir.join(LICENSE_FILE_NAME);

        // Use tokio::fs for async file operations
        // Check existence first to return a more specific error if file is genuinely missing
        if !tokio::fs::metadata(&license_path).await.is_ok() {
             return Err(AppError::FileNotFound);
        }

        let content = fs::read_to_string(&license_path).await.map_err(|e| AppError::IoError(e))?;
        let license_data: LicenseData = serde_json::from_str(&content)?;
        Ok(license_data)
    }

    // This method needs to be async because it might call load_license_from_disk
    // Note: Moka's sync cache `get` is synchronous. The async nature comes from
    // awaiting the potential disk load.
    pub async fn get_license(&self, email: &str) -> Result<LicenseData, AppError> {
        // Attempt to get from cache synchronously
        if let Some(license) = self.cache.get(email) {
            log::debug!("Cache hit for license: {}", email);
            return Ok(license);
        }

        log::debug!("Cache miss for license: {}", email);
        // If not in cache, load from disk asynchronously
        let license_data = self.load_license_from_disk(email).await?;
        // Insert into cache. `insert` is synchronous for the sync cache.
        self.cache.insert(email.to_string(), license_data.clone()); // Await required by moka v0.12+ for async methods
        Ok(license_data)
    }

    pub fn invalidate_license(&self, email: &str) {
        log::debug!("Invalidating cache for license: {}", email);
        self.cache.invalidate(&email.to_string());
    }

    pub fn invalidate_all(&self) {
        log::debug!("Invalidating all licenses in cache");
        self.cache.invalidate_all();
    }
}

// Helper function to access the cache from Actix State (or Axum State in the new version)
// It needs to take the correct State type depending on the framework.
// For Axum, State provides Arc<AppState>, so this helper is fine as is.
pub fn get_license_cache(data: &Arc<AppState>) -> Arc<LicenseCache> {
    Arc::clone(&data.license_cache)
}