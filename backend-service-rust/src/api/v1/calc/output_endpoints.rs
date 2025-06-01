use crate::api::v1::user::find_or_create_company_info;
use crate::exlogging::{log_event, LogLevel};
use crate::middleware::AuthenticatedUser;
use crate::models::calculations::CalculationData;
use crate::models::CompanyInfo;
use crate::{errors::AppError, state::AppState};
use axum::http::{HeaderMap, HeaderValue};
use axum::{extract::State, response::IntoResponse, Json};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Metadata {
    order_number: Option<String>,
    order_notes: Option<String>
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GeneratePdfRequest {
    pub custom_template_content: Option<String>,
    pub calculation: CalculationData,
    pub metadata: Metadata,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GeneratePdfInternalRequest {
    pub custom_template_content: Option<String>,
    pub company_info: CompanyInfo,
    pub calculation: CalculationData,
    pub metadata: Metadata,
}

pub async fn gen_pdf(
    AuthenticatedUser(user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<impl IntoResponse, AppError> {
    let client = Client::new();

    log_event(
        LogLevel::Info,
        format!("PDF generation {:?}", &request.calculation.digest()),
        Some(&user_email),
    );

    let internal_request = GeneratePdfInternalRequest {
        calculation: request.calculation,
        company_info: find_or_create_company_info(&app_state, &user_email).await?,
        custom_template_content: request.custom_template_content,
        metadata: request.metadata.clone(),
    };

    let res = client
        .post(format!("{}/pdf", app_state.pdf_gen_api_url_post))
        .json(&internal_request)
        .send()
        .await
        .map_err(|err| {
            log_event(LogLevel::Error, format!("Document generation request failure: {:?}", err), Some(user_email));
            AppError::InternalServerError(err.to_string())}
        )?;

    // Stream body directly
    let stream = res.bytes_stream();

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
    let client = Client::new();

    log_event(
        LogLevel::Info,
        format!("HTML table generation {:?}", &request.calculation.digest()),
        Some(&user_email),
    );

    let internal_request = GeneratePdfInternalRequest {
        calculation: request.calculation,
        company_info: find_or_create_company_info(&app_state, &user_email).await?,
        custom_template_content: request.custom_template_content,
        metadata: request.metadata.clone(),
    };

    let res = client
        .post(format!("{}/html", app_state.pdf_gen_api_url_post))
        .json(&internal_request)
        .send()
        .await
        .map_err(|err| AppError::InternalServerError(err.to_string()))?;

    // Stream body directly
    let stream = res.bytes_stream();

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("text/plain"));
    headers.insert(
        "Content-Disposition",
        HeaderValue::from_static("attachment; filename=\"streamed.html\""),
    );

    let body = axum::body::Body::from_stream(stream);

    Ok((headers, body))
}
