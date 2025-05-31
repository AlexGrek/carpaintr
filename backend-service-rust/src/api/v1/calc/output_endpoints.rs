use crate::middleware::AuthenticatedUser;
use crate::models::GeneratePdfRequest;
use crate::utils::{
    safe_ensure_directory_exists, safe_read, safe_write, sanitize_alphanumeric_and_dashes,
    user_personal_directory_from_email,
};
use crate::{errors::AppError, state::AppState};
use axum::extract::Query;
use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderMap, HeaderValue, Response};
use axum::{extract::State, response::IntoResponse, Json};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub async fn gen_pdf(
    AuthenticatedUser(_user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<impl IntoResponse, AppError> {
    let client = Client::new();

    let res = client
        .post(format!("{}/pdf", app_state.pdf_gen_api_url_post))
        .json(&request)
        .send()
        .await
        .map_err(|err| AppError::InternalServerError(err.to_string()))?;

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
    AuthenticatedUser(_user_email): AuthenticatedUser,
    State(app_state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<impl IntoResponse, AppError> {
    let client = Client::new();

    let res = client
        .post(format!("{}/html", app_state.pdf_gen_api_url_post))
        .json(&request)
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

