use crate::{db::UserDb, auth::Auth, cache::LicenseCache};
use std::{path::{PathBuf}, sync::Arc};

pub struct AppState {
    pub db: UserDb,
    pub auth: Auth,
    pub license_cache: Arc<LicenseCache>,
    pub admin_file_path: PathBuf,
    pub data_dir_path: PathBuf,
    pub jwt_license_secret: String,
}