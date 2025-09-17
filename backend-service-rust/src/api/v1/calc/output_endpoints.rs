use crate::api::v1::user::find_or_create_company_info;
use crate::calc::templating::{send_gen_doc_request, GeneratePdfInternalRequest, Metadata};
use crate::exlogging::{self, log_event, LogLevel};
use crate::middleware::AuthenticatedUser;
use crate::{errors::AppError, state::AppState};
use axum::http::{HeaderMap, HeaderValue};
use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize, Serialize)]
pub struct GeneratePdfRequest {
    pub custom_template_content: Option<String>,
    pub calculation: serde_json::Value,
    pub metadata: Metadata,
}

pub async fn gen_pdf(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<impl IntoResponse, AppError> {
    log_event(
        LogLevel::Info,
        format!("PDF generation {:?}", request.metadata),
        Some(&user_email),
    );

    let internal_request = GeneratePdfInternalRequest {
        calculation: request.calculation,
        company_info: find_or_create_company_info(&app_state, &user_email).await?,
        custom_template_content: request.custom_template_content,
        metadata: request.metadata.clone(),
    };

    log_event(
        exlogging::LogLevel::Debug,
        format!(
            "Request for document generation: {}",
            serde_json::to_string_pretty(&internal_request)?
        ),
        Some(user_email.clone()),
    );

    let stream = send_gen_doc_request(
        internal_request,
        &app_state.pdf_gen_api_url_post,
        &user_email,
        "pdf",
    )
    .await?
    .bytes_stream();

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("application/pdf"));
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"streamed.pdf\""),
    );

    let body = axum::body::Body::from_stream(stream);

    Ok((headers, body))
}

pub async fn gen_html(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<impl IntoResponse, AppError> {
    log_event(
        LogLevel::Info,
        format!("HTML table generation {:?}", &request.metadata),
        Some(&user_email),
    );

    let internal_request = GeneratePdfInternalRequest {
        calculation: request.calculation,
        company_info: find_or_create_company_info(&app_state, &user_email).await?,
        custom_template_content: request.custom_template_content,
        metadata: request.metadata.clone(),
    };

    log_event(
        exlogging::LogLevel::Info,
        format!(
            "Request for document generation: {}",
            serde_json::to_string_pretty(&internal_request)?
        ),
        Some(user_email.clone()),
    );

    let stream = send_gen_doc_request(
        internal_request,
        &app_state.pdf_gen_api_url_post,
        &user_email,
        "html",
    )
    .await?
    .bytes_stream();

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("text/plain"));
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"streamed.html\""),
    );

    let body = axum::body::Body::from_stream(stream);

    Ok((headers, body))
}
