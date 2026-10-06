use super::{digest, get, random_token};
use crate::{
    api::v1::{calc::output_endpoints::GeneratePdfRequest, user::find_or_create_company_info},
    calc::templating::{send_gen_doc_request, GeneratePdfInternalRequest, TEMPLATES},
    errors::AppError,
    middleware::AuthenticatedUser,
    state::AppState,
    utils::{
        get_catalog_file_as_string, safe_read, safe_write_overwrite,
        user_personal_directory_from_email,
    },
};
use axum::{
    extract::{Path, State},
    http::header,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use std::{path::PathBuf, sync::Arc};
const SHARE_SECONDS: i64 = 30 * 86400;
#[derive(Serialize, Deserialize, Clone)]
pub struct SavedPdf {
    pub id: String,
    pub owner: String,
    pub owner_id: String,
    pub created_at: i64,
    pub calculation_id: Option<String>,
    pub revision: Option<u64>,
    pub filename: String,
    pub share_nonce: String,
    pub token_hash: String,
    pub expires_at: i64,
    pub revoked: bool,
}
fn capability(state: &AppState, pdf: &SavedPdf) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(&state.mcp.share_secret)
        .expect("HMAC supports any key length");
    mac.update(b"autolab-public-pdf-v1:");
    mac.update(pdf.id.as_bytes());
    mac.update(b":");
    mac.update(pdf.share_nonce.as_bytes());
    URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
}
fn view(state: &AppState, pdf: &SavedPdf) -> Value {
    json!({"document_id":pdf.id,"filename":pdf.filename,"created_at":pdf.created_at,"calculation_id":pdf.calculation_id,"revision":pdf.revision,"expires_at":pdf.expires_at,"revoked":pdf.revoked,"public_url":if pdf.revoked || pdf.expires_at<=Utc::now().timestamp(){None}else{Some(format!("{}/public/pdfs/{}.pdf",state.mcp.base_url,capability(state,pdf)))},"download_url":format!("{}/api/v1/pdfs/{}",state.mcp.base_url,pdf.id)})
}
fn publish(
    state: &AppState,
    pdf: &SavedPdf,
    old_hash: Option<&str>,
    dedup_key: Option<&str>,
) -> Result<(), AppError> {
    let encoded = serde_json::to_vec(pdf)?;
    let id = serde_json::to_vec(&pdf.id)?;
    let result: Result<(), sled::transaction::TransactionError<()>> =
        state.db.mcp_tree.transaction(|tree| {
            if let Some(hash) = old_hash {
                tree.remove(format!("pdf-token:{hash}").as_bytes())?;
            }
            tree.insert(format!("pdf:{}", pdf.id).as_bytes(), encoded.as_slice())?;
            if !pdf.revoked {
                tree.insert(
                    format!("pdf-token:{}", pdf.token_hash).as_bytes(),
                    id.as_slice(),
                )?;
            }
            if let Some(key) = dedup_key {
                tree.insert(key.as_bytes(), id.as_slice())?;
            }
            Ok(())
        });
    result.map_err(|_| AppError::InternalServerError("Cannot publish PDF metadata".into()))?;
    state.db.mcp_tree.flush()?;
    Ok(())
}
pub async fn save_generated(
    state: &Arc<AppState>,
    email: &str,
    request: GeneratePdfRequest,
    calculation_id: Option<String>,
    revision: Option<u64>,
) -> Result<Value, AppError> {
    super::licensed(state, email).await?;
    let owner = state
        .db
        .find_user_by_email(email)?
        .ok_or(AppError::Unauthorized)?
        .id
        .to_string();
    let identity = digest(&serde_json::to_vec(
        &json!({"request":&request,"calculation_id":calculation_id,"revision":revision}),
    )?);
    let key = format!("pdf-dedup:{owner}:{identity}");
    if let Some(id) = get::<String>(state, &key)? {
        if let Some(pdf) = get::<SavedPdf>(state, &format!("pdf:{id}"))? {
            return Ok(view(state, &pdf));
        }
    }
    let mut template = request.custom_template_content;
    if let Some(name) = request.template_name {
        template = Some(
            get_catalog_file_as_string(
                email,
                &state.cache,
                &state.data_dir_path,
                TEMPLATES,
                ".html",
                name,
            )
            .await?,
        );
    }
    let internal = GeneratePdfInternalRequest {
        calculation: request.calculation,
        company_info: find_or_create_company_info(state, email).await?,
        custom_template_content: template,
        metadata: request.metadata,
    };
    let mut response = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        send_gen_doc_request(internal, &state.pdf_gen_api_url_post, email, "pdf"),
    )
    .await
    .map_err(|_| AppError::InternalServerError("PDF generation timed out".into()))??;
    if !response.status().is_success() {
        return Err(AppError::InternalServerError(
            "PDF service rejected generation".into(),
        ));
    }
    let mut bytes = Vec::new();
    let read = async {
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| AppError::InternalServerError("PDF response interrupted".into()))?
        {
            if bytes.len() + chunk.len() > 32 * 1024 * 1024 {
                return Err(AppError::InvalidData("PDF exceeds 32 MiB".into()));
            }
            bytes.extend_from_slice(&chunk);
        }
        Ok::<(), AppError>(())
    };
    tokio::time::timeout(std::time::Duration::from_secs(60), read)
        .await
        .map_err(|_| AppError::InternalServerError("PDF transfer timed out".into()))??;
    if !bytes.starts_with(b"%PDF") {
        return Err(AppError::InternalServerError(
            "PDF service returned invalid PDF bytes".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let path = user_personal_directory_from_email(&state.data_dir_path, email)?;
    safe_write_overwrite(
        path,
        PathBuf::from(format!("pdfs/{id}.pdf")),
        bytes,
        &state.cache,
    )
    .await?;
    let mut pdf = SavedPdf {
        id: id.clone(),
        owner: email.into(),
        owner_id: owner,
        created_at: Utc::now().timestamp(),
        calculation_id,
        revision,
        filename: format!("autolab-{id}.pdf"),
        share_nonce: random_token(),
        token_hash: String::new(),
        expires_at: Utc::now().timestamp() + SHARE_SECONDS,
        revoked: false,
    };
    pdf.token_hash = digest(capability(state, &pdf).as_bytes());
    publish(state, &pdf, None, Some(&key))?;
    crate::exlogging::log_event(
        crate::exlogging::LogLevel::Info,
        "Saved PDF with expiring public capability",
        Some(email),
    );
    Ok(view(state, &pdf))
}
pub async fn save(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Json(request): Json<GeneratePdfRequest>,
) -> Result<Json<Value>, AppError> {
    let account_lock = state.mcp.account_lock(&email).await;
    let _lock = account_lock.lock().await;
    Ok(Json(
        save_generated(&state, &email, request, None, None).await?,
    ))
}
fn owned(state: &AppState, email: &str, id: &str) -> Result<SavedPdf, AppError> {
    let pdf = get::<SavedPdf>(state, &format!("pdf:{id}"))?.ok_or(AppError::NotFound)?;
    let owner = state
        .db
        .find_user_by_email(email)?
        .ok_or(AppError::Unauthorized)?;
    if pdf.owner_id != owner.id.to_string() {
        return Err(AppError::NotFound);
    }
    Ok(pdf)
}
pub async fn list(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, AppError> {
    let owner = state
        .db
        .find_user_by_email(&email)?
        .ok_or(AppError::Unauthorized)?
        .id
        .to_string();
    let mut results = Vec::new();
    for entry in state.db.mcp_tree.scan_prefix("pdf:") {
        let (_, bytes) = entry?;
        let pdf: SavedPdf = serde_json::from_slice(&bytes)?;
        if pdf.owner_id == owner {
            results.push(view(&state, &pdf));
        }
    }
    results.sort_by_key(|p| std::cmp::Reverse(p["created_at"].as_i64().unwrap_or_default()));
    Ok(Json(json!(results)))
}
async fn bytes(state: &Arc<AppState>, pdf: SavedPdf) -> Result<Response, AppError> {
    let path = user_personal_directory_from_email(&state.data_dir_path, &pdf.owner)?;
    let content = safe_read(
        &path,
        &PathBuf::from(format!("pdfs/{}.pdf", pdf.id)),
        &state.cache,
    )
    .await
    .map_err(|_| AppError::NotFound)?;
    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf".into()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", pdf.filename),
            ),
            (header::CACHE_CONTROL, "private, no-store, max-age=0".into()),
            (header::REFERRER_POLICY, "no-referrer".into()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".into()),
        ],
        Arc::unwrap_or_clone(content),
    )
        .into_response())
}
pub async fn download(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    bytes(&state, owned(&state, &email, &id)?).await
}
pub async fn public_download(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Response, AppError> {
    let token = token.strip_suffix(".pdf").ok_or(AppError::NotFound)?;
    if token.len() != 43
        || !token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(AppError::NotFound);
    }
    let hash = digest(token.as_bytes());
    let id = get::<String>(&state, &format!("pdf-token:{hash}"))?.ok_or(AppError::NotFound)?;
    let pdf = get::<SavedPdf>(&state, &format!("pdf:{id}"))?.ok_or(AppError::NotFound)?;
    if pdf.revoked
        || pdf.expires_at <= Utc::now().timestamp()
        || pdf.token_hash != hash
        || !state
            .db
            .find_user_by_email(&pdf.owner)?
            .is_some_and(|u| u.id.to_string() == pdf.owner_id)
    {
        return Err(AppError::NotFound);
    }
    bytes(&state, pdf).await
}
pub async fn share(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let account_lock = state.mcp.account_lock(&email).await;
    let _lock = account_lock.lock().await;
    super::licensed(&state, &email).await?;
    let mut pdf = owned(&state, &email, &id)?;
    let old = pdf.token_hash.clone();
    pdf.share_nonce = random_token();
    pdf.token_hash = digest(capability(&state, &pdf).as_bytes());
    pdf.revoked = false;
    pdf.expires_at = Utc::now().timestamp() + SHARE_SECONDS;
    publish(&state, &pdf, Some(&old), None)?;
    Ok(Json(view(&state, &pdf)))
}
pub async fn revoke(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let account_lock = state.mcp.account_lock(&email).await;
    let _lock = account_lock.lock().await;
    let mut pdf = owned(&state, &email, &id)?;
    pdf.revoked = true;
    publish(&state, &pdf, Some(&pdf.token_hash), None)?;
    Ok(Json(view(&state, &pdf)))
}
#[cfg(test)]
mod tests {
    use super::*;
    async fn stored(state: &Arc<AppState>) -> SavedPdf {
        let email = "mcp-test@example.com";
        let mut pdf = SavedPdf {
            id: uuid::Uuid::new_v4().to_string(),
            owner: email.into(),
            owner_id: state
                .db
                .find_user_by_email(email)
                .unwrap()
                .unwrap()
                .id
                .to_string(),
            created_at: Utc::now().timestamp(),
            calculation_id: None,
            revision: None,
            filename: "test.pdf".into(),
            share_nonce: random_token(),
            token_hash: String::new(),
            expires_at: Utc::now().timestamp() + SHARE_SECONDS,
            revoked: false,
        };
        pdf.token_hash = digest(capability(state, &pdf).as_bytes());
        let path = user_personal_directory_from_email(&state.data_dir_path, email).unwrap();
        safe_write_overwrite(
            path,
            PathBuf::from(format!("pdfs/{}.pdf", pdf.id)),
            b"%PDF-1.4 test",
            &state.cache,
        )
        .await
        .unwrap();
        publish(state, &pdf, None, None).unwrap();
        pdf
    }
    #[tokio::test]
    async fn expires_at_boundary_and_owner_retains_download() {
        let (_dir, state) = super::super::test_state();
        let mut pdf = stored(&state).await;
        let token = format!("{}.pdf", capability(&state, &pdf));
        assert!(public_download(State(state.clone()), Path(token.clone()))
            .await
            .is_ok());
        pdf.expires_at = Utc::now().timestamp();
        publish(&state, &pdf, None, None).unwrap();
        assert!(matches!(
            public_download(State(state.clone()), Path(token)).await,
            Err(AppError::NotFound)
        ));
        assert!(download(
            AuthenticatedUser(pdf.owner.clone()),
            State(state),
            Path(pdf.id)
        )
        .await
        .is_ok());
    }
    #[tokio::test]
    async fn deletion_and_email_reuse_do_not_restore_public_access() {
        let (_dir, state) = super::super::test_state();
        let pdf = stored(&state).await;
        let token = format!("{}.pdf", capability(&state, &pdf));
        state.db.delete_user_by_email(&pdf.owner).unwrap();
        state
            .db
            .insert_user(&crate::models::User {
                id: uuid::Uuid::new_v4(),
                email: pdf.owner.clone(),
                password_hash: "test".into(),
            })
            .unwrap();
        assert!(matches!(
            public_download(State(state.clone()), Path(token)).await,
            Err(AppError::NotFound)
        ));
        assert!(matches!(
            download(AuthenticatedUser(pdf.owner), State(state), Path(pdf.id)).await,
            Err(AppError::NotFound)
        ));
    }
    #[tokio::test]
    async fn failed_generation_does_not_publish_a_document() {
        for successful_http in [false, true] {
            let (_dir, mut state) = super::super::test_state();
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let address = listener.local_addr().unwrap();
            Arc::get_mut(&mut state).unwrap().pdf_gen_api_url_post =
                format!("http://{address}/generate");
            let status = if successful_http {
                axum::http::StatusCode::OK
            } else {
                axum::http::StatusCode::BAD_GATEWAY
            };
            let app = axum::Router::new().route(
                "/generate/pdf",
                axum::routing::post(move || async move { (status, "not a PDF") }),
            );
            let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
            let request = serde_json::from_value(json!({"calculation":{},"metadata":{}})).unwrap();
            assert!(
                save_generated(&state, "mcp-test@example.com", request, None, None)
                    .await
                    .is_err()
            );
            assert_eq!(state.db.mcp_tree.scan_prefix("pdf:").count(), 0);
            assert_eq!(state.db.mcp_tree.scan_prefix("pdf-token:").count(), 0);
            server.abort();
        }
    }
}
