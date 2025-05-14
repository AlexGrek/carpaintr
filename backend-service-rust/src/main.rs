use axum::{
    http::StatusCode,
    middleware::from_fn_with_state,
    response::IntoResponse,
    routing::{get, post},
    Router,
};

use crate::{
    auth::Auth,
    cache::LicenseCache,
    db::UserDb,
    middleware::{
        admin_check_middleware, jwt_auth_middleware, license_expiry_middleware,
    },
    state::AppState,
};
use dotenv::dotenv;
use std::{env, path::PathBuf, sync::Arc};
use tower_http::
    trace::TraceLayer
;

mod api;
mod auth;
mod cache;
mod db;
mod errors;
mod middleware;
mod models;
mod state;
mod license_manager;
mod utils;

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "data/sled_db".to_string());
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "supersecretjwtkey".to_string());
    let jwt_license_secret = env::var("LICENSE_JWT_SECRET").unwrap_or_else(|_| "licensejwtsecretkey".to_string());
    let admin_file_path = env::var("ADMIN_FILE_PATH").unwrap_or_else(|_| "admins.txt".to_string());
    let data_dir_path = env::var("DATA_DIR_PATH").unwrap_or_else(|_| "data".to_string());
    let license_cache_size: u64 = env::var("LICENSE_CACHE_SIZE")
        .unwrap_or_else(|_| "100".to_string())
        .parse()
        .expect("LICENSE_CACHE_SIZE must be a number");

    std::fs::create_dir_all(&data_dir_path)?;

    let db = UserDb::new(&database_url).expect("Failed to initialize database");
    let auth = Auth::new(jwt_secret.as_bytes());
    let license_cache = LicenseCache::new(PathBuf::from(data_dir_path.clone()), license_cache_size);

    let shared_state = Arc::new(AppState {
        db,
        auth,
        license_cache,
        jwt_license_secret,
        data_dir_path: PathBuf::from(data_dir_path),
        admin_file_path: PathBuf::from(admin_file_path),
    });

    // Define the API router with built-in error handling through Result returns
    let api_router = Router::new()
        .route("/register", post(api::v1::auth::register))
        .route("/login", post(api::v1::auth::login))
        .route("/license", get(api::v1::license::get_license))
        .nest(
            "/admin",
            Router::new()
                .route(
                    "/check_admin_status",
                    get(api::v1::admin::check_admin_status),
                )
                .route(
                    "/license/invalidate/{email}",
                    post(api::v1::license::invalidate_license_cache_admin),
                )
                .route("/gen_license", post(api::v1::admin::generate_license))
                .layer(from_fn_with_state(
                    shared_state.clone(),
                    admin_check_middleware,
                )),
        )
        .route("/license_upload", post(api::v1::user::upload_license))
        .route("/getcompanyinfo", get(api::v1::user::get_company_info))
        .nest(
            "/user",
            Router::new()
                .route("/get_calc_details", get(api::v1::user::get_calc_details))
                .layer(from_fn_with_state(
                    shared_state.clone(),
                    license_expiry_middleware,
                )),
        )
        .layer(from_fn_with_state(
            shared_state.clone(),
            jwt_auth_middleware,
        ));

    // We need a special fallback handler for React Router
    // This fallback handler will serve index.html for any non-API, non-file routes
    async fn spa_fallback() -> impl IntoResponse {
        // Serve the index.html content for client-side routing
        let index_content = match tokio::fs::read_to_string("static/index.html").await {
            Ok(content) => content,
            Err(_) => return (StatusCode::NOT_FOUND, "Not Found").into_response(),
        };

        (StatusCode::OK, [(axum::http::header::CONTENT_TYPE, "text/html")], index_content).into_response()
    }

    // Define our combined app properly for SPA + API:
let spa_router = Router::new()
    .fallback(spa_fallback); // SPA fallback only applies to non-API routes

let app = Router::new()
    .nest("/api/v1", api_router) // API routes with proper 404 handling
    .merge(spa_router)           // Merge non-API fallback routes
    .with_state(shared_state)
    .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    log::info!("Starting server at http://127.0.0.1:8080");
    axum::serve(listener, app).await?;

    Ok(())
}
