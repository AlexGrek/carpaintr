use crate::{db::UserDb, auth::Auth, cache::LicenseCache};
use std::{sync::Arc, path::PathBuf};

pub struct AppState {
    pub db: UserDb,
    pub auth: Auth,
    pub license_cache: Arc<LicenseCache>,
    pub admin_file_path: PathBuf,
}