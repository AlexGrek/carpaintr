use api::v1::admin::{
    delete_user_license_handler, generate_license_handler, get_user_license_handler,
    list_user_licenses_handler,
};
use axum::{
    http::StatusCode,
    middleware::from_fn_with_state,
    response::IntoResponse,
    routing::{delete, get, post},
    Router,
};
use exlogging::{configure_log_event, log_event, LogLevel, LoggerConfig};

use crate::{
    api::v1::admin::{generate_invite_handler, list_archived_invite_handler, list_invite_handler}, auth::Auth, cache::license_cache::LicenseCache, cleanup::cleanup_task, db::users::AppDb, middleware::{admin_check_middleware, jwt_auth_middleware, license_expiry_middleware}, state::AppState, utils::DataStorageCache
};
use dotenv::dotenv;
use std::{env, path::PathBuf, sync::Arc};
use tower_http::{services::ServeDir, trace::TraceLayer};

mod api;
mod auth;
mod cache;
mod calc;
mod cleanup;
mod db;
mod errors;
mod exlogging;
mod license_manager;
mod middleware;
mod models;
mod state;
mod transactionalfs;
mod utils;

fn spawn_periodic_cleanup(state: Arc<AppState>) {
    tokio::spawn(async move {
        // Run once at startup
        cleanup_task(state.clone()).await;

        // Repeat every 3 hours
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3 * 60 * 60));
        loop {
            interval.tick().await;
            cleanup_task(state.clone()).await;
        }
    });
}

#[tokio::main]
async fn main() -> tokio::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::new().default_filter_or("debug"));

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "data/sled_db".to_string());
    let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "supersecretjwtkey".to_string());
    let jwt_license_secret =
        env::var("LICENSE_JWT_SECRET").unwrap_or_else(|_| "licensejwtsecretkey".to_string());
    let admin_file_path = env::var("ADMIN_FILE_PATH").unwrap_or_else(|_| "admins.txt".to_string());
    let log_file_path = env::var("LOG_FILE_PATH").unwrap_or_else(|_| "application.log".to_string());
    let data_dir_path = env::var("DATA_DIR_PATH").unwrap_or_else(|_| "data".to_string());
    let pdf_gen_api_url_post =
        env::var("PDF_GEN_URL_POST").unwrap_or_else(|_| "localhost:5000/generate".to_string());
    let license_cache_size: u64 = env::var("LICENSE_CACHE_SIZE")
        .unwrap_or_else(|_| "100".to_string())
        .parse()
        .expect("LICENSE_CACHE_SIZE must be a number");

    let config = LoggerConfig { log_file_path };
    configure_log_event(config).await.unwrap();

    std::fs::create_dir_all(&data_dir_path)?;

    check_admin_file(&admin_file_path);

    let db = AppDb::new(&database_url).expect("Failed to initialize database");
    let auth = Auth::new(jwt_secret.as_bytes());
    let license_cache = LicenseCache::new(
        PathBuf::from(data_dir_path.clone()),
        license_cache_size,
        jwt_license_secret.clone(),
    );

    let shared_state = Arc::new(AppState {
        db,
        auth,
        license_cache,
        pdf_gen_api_url_post,
        jwt_license_secret,
        data_dir_path: PathBuf::from(data_dir_path),
        admin_file_path: PathBuf::from(admin_file_path),
        cache: Arc::new(DataStorageCache::new(10, 10, 50)),
    });

    spawn_periodic_cleanup(shared_state.clone());

    let init_result = api::v1::admin_editor_endpoints::run_list_class_body_types_rebuild(
        &shared_state.data_dir_path,
        None::<String>,
    )
    .await;
    match init_result {
        Ok(_) => log_event(
            LogLevel::Debug,
            format!("Created body type class mapping at application startup."),
            None::<String>,
        ),
        Err(e) => log_event(
            LogLevel::Error,
            format!(
                "Failed to initialize body type class mapping at application startup: {}",
                e.to_string()
            ),
            None::<String>,
        ),
    }

    // Define a fallback handler for API routes that don't match
    async fn api_fallback() -> impl IntoResponse {
        (StatusCode::NOT_FOUND, "API endpoint not found").into_response()
    }

    // Define the API router with built-in error handling through Result returns
    let api_router = Router::new()
        .route("/register", post(api::v1::auth::register))
        .route("/login", post(api::v1::auth::login))
        .route("/license", get(api::v1::license::get_license))
        .route("/getlicenses", get(api::v1::license::get_license_list))
        .nest(
            "/admin",
            Router::new()
                .route(
                    "/check_admin_status",
                    get(api::v1::admin::check_admin_status),
                )
                .route("/listusers", get(api::v1::admin::list_users))
                .route("/logs", get(api::v1::admin::get_n_logs))
                .route("/logs_frontend", get(api::v1::admin::get_n_logs_frontend))
                .route("/support_message", post(api::v1::support::support_add_message))
                .route("/support_all", get(api::v1::support::support_get_all_requests))
                .route("/support_unresponded", get(api::v1::support::support_get_unresponded))
                .route("/support_delete", delete(api::v1::support::support_delete))
                .route("/support_get", get(api::v1::support::support_get))
                .route("/cache_status", get(api::v1::admin::get_cache_status))
                .route("/manageuser", post(api::v1::admin::manage_user))
                .route("/impersonate", post(api::v1::auth::impersonate))
                .route(
                    "/attachment_list",
                    get(api::v1::attachments::admin_all_attachments),
                )
                .route(
                    "/license/invalidate/{email}",
                    post(api::v1::license::invalidate_license_cache_admin),
                )
                .route("/license/generate", post(generate_license_handler))
                .route("/invite/generate", post(generate_invite_handler))
                .route("/invite/list", get(list_invite_handler))
                .route("/invite/list_archived", get(list_archived_invite_handler))
                .route(
                    "/license/list/{user_email}",
                    get(list_user_licenses_handler),
                )
                .route(
                    "/license/{user_email}/{license_filename}",
                    delete(delete_user_license_handler),
                )
                .route(
                    "/license/{user_email}/{license_filename}",
                    get(get_user_license_handler),
                )
                .route(
                    "/trigger_list_class_body_types_rebuild_global",
                    post(api::v1::admin_editor_endpoints::trigger_list_class_body_types_rebuild_global),
                )
                .nest(
                    "/editor",
                    Router::new()                        .route(
                            "/list_files",
                            get(api::v1::admin_editor_endpoints::get_file_list),
                        )
                        .route(
                            "/upload_file/{path}",
                            post(api::v1::admin_editor_endpoints::upload_file),
                        )
                        .route(
                            "/read_file/{path}",
                            get(api::v1::admin_editor_endpoints::read_file),
                        )
                        .route(
                            "/delete_file/{path}",
                            delete(api::v1::admin_editor_endpoints::delete_file),
                        ),
                )
                .layer(from_fn_with_state(
                    shared_state.clone(),
                    admin_check_middleware,
                )),
        )
        .route("/license_upload", post(api::v1::user::upload_license))
        .route("/getactivelicense", get(api::v1::user::get_active_license))
        .route("/mylicenses", get(api::v1::user::list_licenses))
        .route(
                    "/report_frontend_failure",
                    post(api::v1::support::report_frontend_failure),
                )
        .route("/getcompanyinfo", get(api::v1::user::get_company_info))
        .route(
            "/updatecompanyinfo",
            post(api::v1::user::update_company_info),
        )
        .nest(
            "/user",
            Router::new()
                .route(
                    "/support_request_submit",
                    post(api::v1::support::user_submit),
                )
                .route(
                    "/support_message",
                    post(api::v1::support::user_add_message),
                )
                .route(
                    "/attach",
                    post(api::v1::attachments::attach)
                )
                .route(
                    "/attachment/{id}",
                    get(api::v1::attachments::get_att_file),
                )
                .route(
                    "/attachment_list",
                    get(api::v1::attachments::my_attachments),
                )
                .route(
                    "/attachment_meta/{id}",
                    get(api::v1::attachments::get_att_metadata),
                )
                .route(
                    "/processors_bundle",
                    get(api::v1::calc::plugin_endpoints::get_all_plugins),
                )
                .route(
                    "/lookup_all_tables",
                    get(api::v1::calc::data_endpoints::lookup_all_tables),
                )
                .route(
                    "/lookup_all_tables_all",
                    get(api::v1::calc::data_endpoints::lookup_all_tables_all_types),
                )
                .route(
                    "/all_parts",
                    get(api::v1::calc::data_endpoints::list_all_parts),
                )
                .route(
                    "/support_request",
                    get(api::v1::support::user_get),
                )
                .route(
                    "/support_requests",
                    get(api::v1::support::user_get_all),
                )
                .route(
                    "/calculationstore",
                    get(api::v1::calc::persistence_endpoints::get_calculation_file),
                )
                .route(
                    "/calculationstore",
                    post(api::v1::calc::persistence_endpoints::save_calculation),
                )
                .route(
                    "/calculationstore/list",
                    get(api::v1::calc::persistence_endpoints::get_calculations_list),
                )
                .route("/get_calc_details", get(api::v1::user::get_calc_details))
                .route(
                    "/generate_pdf_table",
                    post(api::v1::calc::output_endpoints::gen_pdf),
                )
                .route(
                    "/generate_html_table",
                    post(api::v1::calc::output_endpoints::gen_html),
                )
                .route(
                    "/carmakes",
                    get(api::v1::calc::data_endpoints::list_car_makes),
                )
                .route(
                    "/list_class_body_types",
                    get(api::v1::calc::data_endpoints::list_class_body_types),
                )
                .route("/season", get(api::v1::calc::data_endpoints::get_season))
                .route(
                    "/global/{path}",
                    get(api::v1::calc::data_endpoints::get_global_file),
                )
                .route(
                    "/carmodels/{maker}",
                    get(api::v1::calc::data_endpoints::get_cars_by),
                )
                .route(
                    "/carparts/{class}/{body_type}",
                    get(api::v1::calc::data_endpoints::get_car_parts_by_type_class),
                )
                .layer(from_fn_with_state(
                    shared_state.clone(),
                    license_expiry_middleware,
                )),
        )
        .nest(
            "/editor",
            Router::new()
                .route(
                    "/list_user_files",
                    get(api::v1::editor_endpoints::get_user_file_list),
                )
                .route(
                    "/list_common_files",
                    get(api::v1::editor_endpoints::get_common_file_list),
                )
                .route(
                    "/read_user_file/{path}",
                    get(api::v1::editor_endpoints::read_user_file),
                )
                .route(
                    "/delete_user_file/{path}",
                    delete(api::v1::editor_endpoints::delete_user_file),
                )
                .route(
                    "/upload_user_file/{path}",
                    post(api::v1::editor_endpoints::upload_user_file),
                )
                .route("/list_commits", get(api::v1::editor_endpoints::list_commits))
                .route("/revert_commit", post(api::v1::editor_endpoints::revert_commit))
                .route(
                    "/read_common_file/{path}",
                    get(api::v1::editor_endpoints::read_common_file),
                ),
        )
        .layer(from_fn_with_state(
            shared_state.clone(),
            jwt_auth_middleware,
        ))
        // Add the API fallback here
        .fallback(api_fallback);

    // We need a special fallback handler for React Router
    // This fallback handler will serve index.html for any non-API, non-file routes
    async fn spa_fallback() -> impl IntoResponse {
        // Serve the index.html content for client-side routing
        let index_content = match tokio::fs::read_to_string("static/index.html").await {
            Ok(content) => content,
            Err(_) => return (StatusCode::NOT_FOUND, "Not Found").into_response(),
        };

        (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "text/html")],
            index_content,
        )
            .into_response()
    }

    // Define our combined app properly for SPA + API:
    let spa_fallback_service = Router::new().fallback(spa_fallback);

    let app = Router::new()
        .nest("/api/v1", api_router) // API routes with proper 404 handling
        // Add the static files service as a fallback before the SPA fallback
        .fallback_service(ServeDir::new("static").fallback(spa_fallback_service))
        .with_state(shared_state)
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    log::info!("Starting server at http://0.0.0.0:8080");
    log_event(LogLevel::Info, "Application started", None::<&str>);
    axum::serve(listener, app).await?;

    Ok(())
}

// check if admins file is available, if not - print error into the log, if yes - print info with admins file path
fn check_admin_file(path: &str) {
    let admin_file_path = PathBuf::from(path);
    if admin_file_path.exists() {
        log::info!("Admin file found at: {}", admin_file_path.display());
    } else {
        log::error!(
            "Admin file NOT found at: {}. Admin functionality might be limited.",
            admin_file_path.display()
        );
    }
}
