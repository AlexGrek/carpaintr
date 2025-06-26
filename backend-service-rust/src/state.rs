use crate::{auth::Auth, cache::license_cache::LicenseCache, db::users::UserDb, utils};
use std::{path::{PathBuf}, sync::Arc};

pub struct AppState {
    pub db: UserDb,
    pub auth: Auth,
    pub license_cache: Arc<LicenseCache>,
    pub admin_file_path: PathBuf,
    pub data_dir_path: PathBuf,
    pub jwt_license_secret: String,
    pub pdf_gen_api_url_post: String,
    pub cache: Arc<utils::DataStorageCache>
}