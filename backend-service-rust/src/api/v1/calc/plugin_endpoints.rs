use std::{
    ffi::OsStr, io, path::{Path, PathBuf}, sync::{Arc, LazyLock}
};

use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue},
    response::{AppendHeaders, IntoResponse},
};
use futures_util::future::try_join_all;
use tokio::fs;

use crate::{
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{self, DataStorageCache},
};

static JS_EXT: LazyLock<&'static OsStr> = LazyLock::new(|| OsStr::new("js"));
pub const PROCS: &'static str = "procs";

pub async fn bundle_plugins_as_array<I, P>(paths: I) -> Result<String, AppError>
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    // Read and pair each file with its path
    let read_futures = paths.into_iter().map(|path| {
        let pathbuf: PathBuf = path.as_ref().to_path_buf();
        async move {
            let content = fs::read_to_string(&pathbuf).await?;
            Ok::<_, io::Error>((pathbuf, content))
        }
    });

    let file_contents: Vec<(PathBuf, String)> = try_join_all(read_futures).await?;

    // Format into a single JS array
    let mut bundled = String::from("exports.default = [\n");

    for (path, content) in file_contents {
        let filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.js");

        bundled.push_str(&format!("  // {}\n  ({content}),\n", filename));
    }

    bundled.push_str("];\n");
    Ok(bundled)
}

async fn bundle_plugins_for_user(
    user_email: &str,
    data_dir: &PathBuf,
    cache: &DataStorageCache,
) -> Result<String, AppError> {
    let all_js_files = utils::all_files_with_extension(data_dir, user_email, PROCS, &JS_EXT).await?;
    Ok(bundle_plugins_as_array(all_js_files).await?)
}

pub async fn get_all_plugins(
    AuthenticatedUser(user_email): AuthenticatedUser, // Get user email from the authenticated user
    State(app_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    let bundle =
        bundle_plugins_for_user(&user_email, &app_state.data_dir_path, &app_state.cache).await?;
    let mut headers = HeaderMap::new();
    headers.insert("content-type", HeaderValue::from_static("text/javascript"));
    let resp = (headers, bundle).into_response();

    Ok(resp)
}
