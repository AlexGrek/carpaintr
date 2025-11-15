use moka::sync::Cache;
use std::{sync::Arc, time::Duration};
use crate::{
    errors::AppError, exlogging::log_event, license_manager::LicenseData, state::AppState
};
use std::path::PathBuf;

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
    jwt_license_secret: String
}

impl LicenseCache {
    pub fn new(data_dir: PathBuf, max_size: u64, secret: String) -> Arc<Self> {
        let cache: Cache<String, LicenseData> = Cache::builder()
            .max_capacity(max_size)
            .time_to_live(Duration::from_secs(60 * 60))
            .build();
        Arc::new(Self { cache, data_dir, jwt_license_secret: secret })
    }

    // This function is async because it uses tokio::fs
    async fn load_license_from_disk(&self, email: &str) -> Result<LicenseData, AppError> {
        let token = crate::license_manager::read_latest_license_file(email, &self.data_dir).await?;
        let data = crate::license_manager::decode_license_token(&token, self.jwt_license_secret.as_bytes())?;
        let license_data = LicenseData::new(data);
        log_event(crate::exlogging::LogLevel::Trace, format!("License read from disk: {}", license_data.to_json_pretty()?), Some(email));
        Ok(license_data)
    }

    pub async fn get_license(&self, email: &str) -> Result<LicenseData, AppError> {

        // Attempt to get from cache synchronously
        if let Some(mut license) = self.cache.get(email) {
            license.refresh_days_left();
            return Ok(license);
        }

        let license_data = self.load_license_from_disk(email).await?;        
        self.cache.insert(email.to_string(), license_data.clone());
        Ok(license_data)
    }

    pub fn invalidate_license(&self, email: &str) {
        log::debug!("Invalidating cache for license: {}", email);
        self.cache.invalidate(&email.to_string());
    }

    // pub fn invalidate_all(&self) {
    //     log::debug!("Invalidating all licenses in cache");
    //     self.cache.invalidate_all();
    // }
}

pub fn get_license_cache(data: &Arc<AppState>) -> Arc<LicenseCache> {
    Arc::clone(&data.license_cache)
}