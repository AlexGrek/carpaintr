use super::{digest, get, put, random_token};
use crate::{errors::AppError, middleware::AuthenticatedUser, state::AppState};
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Redirect, Response},
    Form, Json,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

pub const SCOPES: &[&str] = &[
    "company:read",
    "company:write",
    "calculations:read",
    "calculations:write",
    "pdfs:publish",
];
#[derive(Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub owner: String,
    pub owner_id: String,
    pub name: String,
    pub scopes: Vec<String>,
    pub expires: i64,
    pub revoked: bool,
    pub kind: String,
    pub connection: Option<String>,
    pub audience: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Identity {
    pub email: String,
    pub scopes: Vec<String>,
}
#[derive(Clone, Serialize, Deserialize)]
struct Client {
    id: String,
    name: String,
    redirect_uris: Vec<String>,
    secret_hash: Option<String>,
    method: String,
}
#[derive(Clone, Serialize, Deserialize)]
struct Connection {
    id: String,
    owner: String,
    owner_id: String,
    client: Client,
    scopes: Vec<String>,
    revoked: bool,
}
#[derive(Clone, Serialize, Deserialize)]
struct Pending {
    query: Authorization,
    client: Client,
    expires: i64,
}
#[derive(Clone, Serialize, Deserialize)]
struct Code {
    connection: Connection,
    challenge: String,
    redirect: String,
    resource: String,
    expires: i64,
    used: bool,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Authorization {
    client_id: String,
    redirect_uri: String,
    response_type: String,
    code_challenge: String,
    code_challenge_method: String,
    state: Option<String>,
    scope: Option<String>,
    resource: String,
}
fn bad(message: &str) -> AppError {
    AppError::BadRequest(message.into())
}
fn validate_scopes(scopes: &[String]) -> Result<(), AppError> {
    if scopes.is_empty() || scopes.iter().any(|s| !SCOPES.contains(&s.as_str())) {
        return Err(bad("Unknown or empty MCP scopes"));
    }
    Ok(())
}
fn owner_id(state: &AppState, email: &str) -> Result<String, AppError> {
    Ok(state
        .db
        .find_user_by_email(email)?
        .ok_or(AppError::Unauthorized)?
        .id
        .to_string())
}
fn valid_redirect(value: &str) -> bool {
    url::Url::parse(value)
        .map(|u| {
            u.fragment().is_none()
                && u.username().is_empty()
                && u.password().is_none()
                && (u.scheme() == "https"
                    || u.scheme() == "http"
                        && matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")))
        })
        .unwrap_or(false)
}
fn loopback_redirect_without_port(value: &str) -> Option<String> {
    if !valid_redirect(value) {
        return None;
    }
    let url = url::Url::parse(value).ok()?;
    let host = url.host_str()?;
    if url.scheme() != "http" || !matches!(host, "localhost" | "127.0.0.1" | "[::1]") {
        return None;
    }
    // Preserve the original host, path and query spelling. RFC 8252 permits
    // only the port to differ, not URL normalization or callback host aliases.
    let remainder = value.strip_prefix("http://")?;
    let authority_end = remainder.find(['/', '?', '#']).unwrap_or(remainder.len());
    let authority = &remainder[..authority_end];
    if authority != host && !authority.strip_prefix(host)?.starts_with(':') {
        return None;
    }
    Some(format!("http://{host}{}", &remainder[authority_end..]))
}
fn redirect_matches(registered: &str, requested: &str) -> bool {
    if registered == requested {
        return true;
    }
    // Native apps obtain an available loopback port when starting OAuth.
    // Keep the exact requested URI on the code for token-exchange validation.
    match (
        loopback_redirect_without_port(registered),
        loopback_redirect_without_port(requested),
    ) {
        (Some(registered), Some(requested)) => registered == requested,
        _ => false,
    }
}
fn safe_public_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v) => {
            !v.is_private()
                && !v.is_loopback()
                && !v.is_link_local()
                && !v.is_broadcast()
                && !v.is_unspecified()
                && !v.is_multicast()
                && !v.is_documentation()
                && v.octets()[0] != 0
                && v.octets()[0] < 224
                && !(v.octets()[0] == 198 && [18, 19].contains(&v.octets()[1]))
                && !(v.octets()[0] == 192 && v.octets()[1] == 0 && v.octets()[2] == 0)
                && !(v.octets()[0] == 100 && (64..=127).contains(&v.octets()[1]))
        }
        std::net::IpAddr::V6(v) => v
            .to_ipv4_mapped()
            .map(|v| safe_public_ip(v.into()))
            .unwrap_or_else(|| {
                v.segments()[0] & 0xe000 == 0x2000
                    && ![0x2002, 0x3ffe, 0x3fff].contains(&v.segments()[0])
                    && !(v.segments()[0] == 0x2001
                        && (v.segments()[1] < 0x200 || v.segments()[1] == 0xdb8))
            }),
    }
}
async fn client(state: &AppState, id: &str) -> Result<Client, AppError> {
    if let Some(client) = get::<Client>(state, &format!("client:{id}"))? {
        return Ok(client);
    }
    let url = url::Url::parse(id).map_err(|_| bad("Unknown OAuth client"))?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err(bad("Client metadata requires a public HTTPS URL"));
    }
    let host = url
        .host_str()
        .ok_or_else(|| bad("Missing metadata host"))?
        .trim_matches(['[', ']']);
    let addresses: Vec<_> = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::lookup_host((host, url.port_or_known_default().unwrap_or(443))),
    )
    .await
    .map_err(|_| bad("Metadata DNS lookup timed out"))?
    .map_err(|_| bad("Cannot resolve metadata host"))?
    .collect();
    if addresses.is_empty() || addresses.iter().any(|a| !safe_public_ip(a.ip())) {
        return Err(bad("Client metadata host is not public"));
    }
    // Pin validated DNS addresses to prevent DNS rebinding; never follow redirects.
    let http = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .resolve_to_addrs(host, &addresses)
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|_| bad("Metadata client failed"))?;
    let response = http
        .get(url.clone())
        .send()
        .await
        .map_err(|_| bad("Cannot fetch client metadata"))?;
    if !response.status().is_success() {
        return Err(bad("Cannot fetch client metadata"));
    }
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| bad("Cannot read metadata"))?
    {
        if bytes.len() + chunk.len() > 65536 {
            return Err(bad("Client metadata too large"));
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| bad("Invalid client metadata JSON"))?;
    if value["client_id"].as_str() != Some(id) {
        return Err(bad("Client metadata ID mismatch"));
    }
    if value["token_endpoint_auth_method"]
        .as_str()
        .unwrap_or("none")
        != "none"
    {
        return Err(bad(
            "URL metadata clients must use public-client authentication",
        ));
    }
    parse_client(value, id.to_string(), None)
}
fn parse_client(value: Value, id: String, secret_hash: Option<String>) -> Result<Client, AppError> {
    let redirects: Vec<String> = serde_json::from_value(value["redirect_uris"].clone())
        .map_err(|_| bad("redirect_uris must be a list of callback URLs"))?;
    if redirects.is_empty() || redirects.len() > 20 || redirects.iter().any(|u| !valid_redirect(u))
    {
        return Err(bad("Invalid redirect URIs"));
    }
    let method = value["token_endpoint_auth_method"]
        .as_str()
        .unwrap_or("none");
    if !["none", "client_secret_post", "client_secret_basic"].contains(&method) {
        return Err(bad("Unsupported client authentication method"));
    }
    Ok(Client {
        id,
        name: value["client_name"]
            .as_str()
            .unwrap_or("MCP client")
            .chars()
            .take(120)
            .collect(),
        redirect_uris: redirects,
        secret_hash,
        method: method.into(),
    })
}
pub async fn authenticate(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    if let Some(origin) = request.headers().get(header::ORIGIN) {
        let allowed = origin.to_str().ok().is_some_and(|value| {
            state
                .mcp
                .allowed_origins
                .iter()
                .any(|origin| origin == value)
        });
        if !allowed {
            return AppError::Forbidden.into_response();
        }
    }
    let token = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split_once(' '))
        .filter(|(scheme, _)| scheme.eq_ignore_ascii_case("Bearer"))
        .map(|(_, token)| token.trim());
    let result = (|| -> Result<Identity, AppError> {
        let token = token.ok_or(AppError::Unauthorized)?;
        let credential =
            get::<Credential>(&state, &format!("credential:{}", digest(token.as_bytes())))?
                .ok_or(AppError::Unauthorized)?;
        if credential.revoked
            || credential.expires <= Utc::now().timestamp()
            || credential.kind == "refresh"
            || credential.audience != state.mcp.resource()
            || owner_id(&state, &credential.owner)? != credential.owner_id
        {
            return Err(AppError::Unauthorized);
        }
        if let Some(id) = &credential.connection {
            let connection = get::<Connection>(&state, &format!("connection:{id}"))?
                .ok_or(AppError::Unauthorized)?;
            if connection.revoked {
                return Err(AppError::Unauthorized);
            }
        }
        Ok(Identity {
            email: credential.owner,
            scopes: credential.scopes,
        })
    })();
    match result {
        Ok(identity) => {
            if request.method() == axum::http::Method::POST {
                let (parts, body) = request.into_parts();
                let body = match axum::body::to_bytes(body, 2 * 1024 * 1024).await {
                    Ok(bytes) => bytes,
                    Err(_) => return StatusCode::PAYLOAD_TOO_LARGE.into_response(),
                };
                if let Ok(value) = serde_json::from_slice::<Value>(&body) {
                    if value["method"] == "tools/call" {
                        let name = value["params"]["name"].as_str().unwrap_or("");
                        let scope = super::tools::scope(name, &value["params"]["arguments"]);
                        if !identity.scopes.iter().any(|s| s == scope) {
                            let challenge = format!("Bearer error=\"insufficient_scope\", resource_metadata=\"{}/.well-known/oauth-protected-resource/mcp\", scope=\"{}\"", state.mcp.base_url, scope);
                            return (
                                StatusCode::FORBIDDEN,
                                [(header::WWW_AUTHENTICATE, challenge)],
                                Json(json!({"error":"insufficient_scope"})),
                            )
                                .into_response();
                        }
                    }
                }
                request = Request::from_parts(parts, Body::from(body));
            }
            request.extensions_mut().insert(identity);
            next.run(request).await
        }
        Err(_) => {
            let challenge = format!("Bearer resource_metadata=\"{}/.well-known/oauth-protected-resource/mcp\", scope=\"{}\"", state.mcp.base_url, SCOPES.join(" "));
            (
                StatusCode::UNAUTHORIZED,
                [(header::WWW_AUTHENTICATE, challenge)],
                Json(json!({"error":"invalid_token"})),
            )
                .into_response()
        }
    }
}
pub async fn resource_metadata(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(
        json!({"resource":state.mcp.resource(),"authorization_servers":[state.mcp.base_url],"scopes_supported":SCOPES,"bearer_methods_supported":["header"]}),
    )
}
pub async fn server_metadata(State(state): State<Arc<AppState>>) -> Json<Value> {
    let base = &state.mcp.base_url;
    Json(
        json!({"issuer":base,"authorization_endpoint":format!("{base}/oauth/authorize"),"token_endpoint":format!("{base}/oauth/token"),"registration_endpoint":format!("{base}/oauth/register"),"revocation_endpoint":format!("{base}/oauth/revoke"),"response_types_supported":["code"],"grant_types_supported":["authorization_code","refresh_token"],"code_challenge_methods_supported":["S256"],"token_endpoint_auth_methods_supported":["none","client_secret_post","client_secret_basic"],"scopes_supported":SCOPES,"client_id_metadata_document_supported":true,"authorization_response_iss_parameter_supported":true}),
    )
}
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(value): Json<Value>,
) -> Result<Response, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let mut limit = state.mcp.registrations.lock().await;
    if limit.0.elapsed().as_secs() >= 60 {
        *limit = (std::time::Instant::now(), 0);
    }
    if limit.1 >= 100 {
        return Err(bad("OAuth registration rate limit reached"));
    }
    limit.1 += 1;
    drop(limit);
    let id = random_token();
    let secret = if value["token_endpoint_auth_method"]
        .as_str()
        .unwrap_or("none")
        != "none"
    {
        Some(random_token())
    } else {
        None
    };
    let client = parse_client(
        value,
        id.clone(),
        secret.as_ref().map(|s| digest(s.as_bytes())),
    )?;
    put(&state, &format!("client:{id}"), &client)?;
    let mut response = json!({"client_id":id,"client_name":client.name,"redirect_uris":client.redirect_uris,"token_endpoint_auth_method":client.method,"grant_types":["authorization_code","refresh_token"],"response_types":["code"]});
    response["client_id_issued_at"] = json!(Utc::now().timestamp());
    if let Some(secret) = secret {
        response["client_secret"] = json!(secret);
        response["client_secret_expires_at"] = json!(0);
    }
    Ok((
        StatusCode::CREATED,
        [(header::CACHE_CONTROL, "no-store")],
        Json(response),
    )
        .into_response())
}
pub async fn authorize(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(mut query): axum::extract::Query<Authorization>,
) -> Result<Redirect, AppError> {
    let client = client(&state, &query.client_id).await?;
    if query.state.as_ref().is_some_and(|s| s.len() > 1024) {
        return Err(bad("State too large"));
    }
    if query.response_type != "code"
        || query.code_challenge_method != "S256"
        || query.code_challenge.len() != 43
        || !query
            .code_challenge
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        || query.resource != state.mcp.resource()
        || !client
            .redirect_uris
            .iter()
            .any(|registered| redirect_matches(registered, &query.redirect_uri))
    {
        return Err(bad("Invalid authorization request"));
    }
    if query.scope.as_deref().unwrap_or("").is_empty() {
        query.scope = Some(SCOPES.join(" "));
    }
    let scopes = query
        .scope
        .as_deref()
        .unwrap_or("")
        .split_whitespace()
        .map(String::from)
        .collect::<Vec<_>>();
    validate_scopes(&scopes)?;
    let id = random_token();
    put(
        &state,
        &format!("pending:{id}"),
        &Pending {
            query,
            client,
            expires: Utc::now().timestamp() + 600,
        },
    )?;
    Ok(Redirect::to(&format!(
        "{}/app/mcp/authorize?request={id}",
        state.mcp.base_url
    )))
}
pub async fn consent(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Json(value): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let id = value["request"]
        .as_str()
        .ok_or_else(|| bad("Missing authorization request"))?;
    let pending = get::<Pending>(&state, &format!("pending:{id}"))?.ok_or(AppError::NotFound)?;
    if pending.expires <= Utc::now().timestamp() {
        return Err(AppError::NotFound);
    }
    if value["decision"].is_null() {
        return Ok(Json(
            json!({"client_name":pending.client.name,"redirect_uri":pending.query.redirect_uri,"scopes":pending.query.scope,"expires_at":pending.expires}),
        ));
    }
    state.db.mcp_tree.remove(format!("pending:{id}"))?;
    state.db.mcp_tree.flush()?;
    let mut redirect =
        url::Url::parse(&pending.query.redirect_uri).map_err(|_| bad("Invalid redirect"))?;
    let mut params = redirect.query_pairs_mut();
    params.append_pair("iss", &state.mcp.base_url);
    if let Some(s) = &pending.query.state {
        params.append_pair("state", s);
    }
    if value["decision"].as_str() == Some("approve") {
        let connection = Connection {
            id: random_token(),
            owner: email.clone(),
            owner_id: owner_id(&state, &email)?,
            client: pending.client,
            scopes: pending
                .query
                .scope
                .unwrap_or_default()
                .split_whitespace()
                .map(String::from)
                .collect(),
            revoked: false,
        };
        put(
            &state,
            &format!("connection:{}", connection.id),
            &connection,
        )?;
        let code = random_token();
        put(
            &state,
            &format!("code:{}", digest(code.as_bytes())),
            &Code {
                connection,
                challenge: pending.query.code_challenge,
                redirect: pending.query.redirect_uri,
                resource: pending.query.resource,
                expires: Utc::now().timestamp() + 300,
                used: false,
            },
        )?;
        params.append_pair("code", &code);
    } else {
        params.append_pair("error", "access_denied");
    }
    drop(params);
    Ok(Json(json!({"redirect":redirect.as_str()})))
}
#[derive(Deserialize)]
pub struct TokenRequest {
    grant_type: String,
    code: Option<String>,
    code_verifier: Option<String>,
    redirect_uri: Option<String>,
    resource: Option<String>,
    refresh_token: Option<String>,
    client_id: Option<String>,
    client_secret: Option<String>,
}
fn check_client(
    client: &Client,
    request: &TokenRequest,
    headers: &axum::http::HeaderMap,
) -> Result<(), AppError> {
    let basic = headers
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.strip_prefix("Basic "))
        .and_then(|h| STANDARD.decode(h).ok())
        .and_then(|b| String::from_utf8(b).ok())
        .and_then(|s| {
            s.split_once(':')
                .map(|(id, secret)| (id.to_string(), secret.to_string()))
        });
    let (id, secret) = if client.method == "client_secret_basic" {
        basic.ok_or(AppError::Unauthorized)?
    } else {
        (
            request.client_id.clone().unwrap_or_default(),
            request.client_secret.clone().unwrap_or_default(),
        )
    };
    if id != client.id
        || client
            .secret_hash
            .as_ref()
            .is_some_and(|hash| *hash != digest(secret.as_bytes()))
    {
        return Err(AppError::Unauthorized);
    }
    Ok(())
}
fn issue(state: &AppState, connection: &Connection) -> Result<Value, AppError> {
    let access = random_token();
    let refresh = random_token();
    let now = Utc::now().timestamp();
    for (token, kind, expires) in [
        (
            &access,
            "access",
            now + super::ACCESS_LIFETIME.as_secs() as i64,
        ),
        (&refresh, "refresh", now + 30 * 86400),
    ] {
        put(
            state,
            &format!("credential:{}", digest(token.as_bytes())),
            &Credential {
                id: random_token(),
                owner: connection.owner.clone(),
                owner_id: connection.owner_id.clone(),
                name: connection.client.name.clone(),
                scopes: connection.scopes.clone(),
                expires,
                revoked: false,
                kind: kind.into(),
                connection: Some(connection.id.clone()),
                audience: state.mcp.resource(),
            },
        )?;
    }
    Ok(
        json!({"access_token":access,"refresh_token":refresh,"token_type":"Bearer","expires_in":super::ACCESS_LIFETIME.as_secs(),"scope":connection.scopes.join(" ")}),
    )
}
pub async fn token(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Form(request): Form<TokenRequest>,
) -> Response {
    let result = token_inner(&state, headers, request).await;
    match result {
        Ok(value) => (
            [
                (header::CACHE_CONTROL, "no-store"),
                (header::PRAGMA, "no-cache"),
            ],
            Json(value),
        )
            .into_response(),
        Err(_) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_grant"})),
        )
            .into_response(),
    }
}
async fn token_inner(
    state: &Arc<AppState>,
    headers: axum::http::HeaderMap,
    request: TokenRequest,
) -> Result<Value, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    if request.resource.as_deref() != Some(&state.mcp.resource()) {
        return Err(bad("Wrong resource"));
    }
    let connection = match request.grant_type.as_str() {
        "authorization_code" => {
            let key = format!(
                "code:{}",
                digest(
                    request
                        .code
                        .as_deref()
                        .ok_or_else(|| bad("Missing code"))?
                        .as_bytes()
                )
            );
            let mut code = get::<Code>(state, &key)?.ok_or(AppError::Unauthorized)?;
            check_client(&code.connection.client, &request, &headers)?;
            let verifier = request.code_verifier.as_deref().unwrap_or("");
            if code.used
                || code.expires <= Utc::now().timestamp()
                || request.redirect_uri.as_deref() != Some(&code.redirect)
                || request.resource.as_deref() != Some(&code.resource)
                || (!(43..=128).contains(&verifier.len())
                    || !verifier
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"-._~".contains(&b)))
                || code.challenge != digest(verifier.as_bytes())
            {
                return Err(AppError::Unauthorized);
            }
            code.used = true;
            put(state, &key, &code)?;
            code.connection
        }
        "refresh_token" => {
            let key = format!(
                "credential:{}",
                digest(
                    request
                        .refresh_token
                        .as_deref()
                        .ok_or_else(|| bad("Missing refresh token"))?
                        .as_bytes()
                )
            );
            let mut credential = get::<Credential>(state, &key)?.ok_or(AppError::Unauthorized)?;
            let mut connection = get::<Connection>(
                state,
                &format!(
                    "connection:{}",
                    credential.connection.as_deref().unwrap_or("")
                ),
            )?
            .ok_or(AppError::Unauthorized)?;
            check_client(&connection.client, &request, &headers)?;
            if credential.revoked {
                connection.revoked = true;
                put(state, &format!("connection:{}", connection.id), &connection)?;
                return Err(AppError::Unauthorized);
            }
            if credential.kind != "refresh" || credential.expires <= Utc::now().timestamp() {
                return Err(AppError::Unauthorized);
            }
            credential.revoked = true;
            put(state, &key, &credential)?;
            connection
        }
        _ => return Err(bad("Unsupported grant")),
    };
    let connection = get::<Connection>(state, &format!("connection:{}", connection.id))?
        .ok_or(AppError::Unauthorized)?;
    if connection.revoked || owner_id(state, &connection.owner)? != connection.owner_id {
        return Err(AppError::Unauthorized);
    }
    issue(state, &connection)
}
pub async fn revoke_token(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Form(value): Form<std::collections::HashMap<String, String>>,
) -> Result<Json<Value>, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let key = format!(
        "credential:{}",
        digest(
            value
                .get("token")
                .map(String::as_str)
                .unwrap_or("")
                .as_bytes()
        )
    );
    if let Some(mut credential) = get::<Credential>(&state, &key)? {
        if let Some(id) = &credential.connection {
            if let Some(mut connection) = get::<Connection>(&state, &format!("connection:{id}"))? {
                let request = TokenRequest {
                    grant_type: String::new(),
                    code: None,
                    code_verifier: None,
                    redirect_uri: None,
                    resource: None,
                    refresh_token: None,
                    client_id: value.get("client_id").cloned(),
                    client_secret: value.get("client_secret").cloned(),
                };
                check_client(&connection.client, &request, &headers)?;
                connection.revoked = true;
                put(&state, &format!("connection:{id}"), &connection)?;
            }
        }
        credential.revoked = true;
        put(&state, &key, &credential)?;
    }
    Ok(Json(json!({})))
}
pub async fn create_key(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Json(value): Json<Value>,
) -> Result<Json<Value>, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let scopes: Vec<String> =
        serde_json::from_value(value.get("scopes").cloned().unwrap_or(json!(SCOPES)))
            .map_err(|_| bad("scopes must be a list"))?;
    validate_scopes(&scopes)?;
    let secret = random_token();
    let credential = Credential {
        id: random_token(),
        owner: email.clone(),
        owner_id: owner_id(&state, &email)?,
        name: value["name"]
            .as_str()
            .unwrap_or("MCP key")
            .chars()
            .take(120)
            .collect(),
        scopes,
        expires: Utc::now().timestamp() + 365 * 86400,
        revoked: false,
        kind: "key".into(),
        connection: None,
        audience: state.mcp.resource(),
    };
    put(
        &state,
        &format!("credential:{}", digest(secret.as_bytes())),
        &credential,
    )?;
    Ok(Json(
        json!({"id":credential.id,"key":secret,"name":credential.name,"expires_at":credential.expires,"mcp_url":state.mcp.resource()}),
    ))
}
pub async fn list_keys(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, AppError> {
    let id = owner_id(&state, &email)?;
    let mut keys = Vec::new();
    for entry in state.db.mcp_tree.scan_prefix("credential:") {
        let (_, v) = entry?;
        let c: Credential = serde_json::from_slice(&v)?;
        if c.kind == "key" && c.owner_id == id && !c.revoked {
            keys.push(json!({"id":c.id,"name":c.name,"scopes":c.scopes,"expires_at":c.expires}));
        }
    }
    Ok(Json(
        json!({"keys":keys,"mcp_url":state.mcp.resource(),"scopes":SCOPES}),
    ))
}
pub async fn revoke_key(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let owner = owner_id(&state, &email)?;
    for entry in state.db.mcp_tree.scan_prefix("credential:") {
        let (key, v) = entry?;
        let mut c: Credential = serde_json::from_slice(&v)?;
        if c.kind == "key" && c.id == id && c.owner_id == owner {
            c.revoked = true;
            put(&state, std::str::from_utf8(&key).unwrap(), &c)?;
            return Ok(Json(json!({"revoked":true})));
        }
    }
    Err(AppError::NotFound)
}
pub async fn list_connections(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, AppError> {
    let owner = owner_id(&state, &email)?;
    let mut entries = Vec::new();
    for entry in state.db.mcp_tree.scan_prefix("connection:") {
        let (_, v) = entry?;
        let c: Connection = serde_json::from_slice(&v)?;
        if c.owner_id == owner && !c.revoked {
            entries.push(json!({"id":c.id,"name":c.client.name,"scopes":c.scopes}));
        }
    }
    Ok(Json(json!(entries)))
}
pub async fn revoke_connection(
    AuthenticatedUser(email): AuthenticatedUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    let _lock = state.mcp.mutation.lock().await;
    let mut connection =
        get::<Connection>(&state, &format!("connection:{id}"))?.ok_or(AppError::NotFound)?;
    if connection.owner_id != owner_id(&state, &email)? {
        return Err(AppError::NotFound);
    }
    connection.revoked = true;
    put(&state, &format!("connection:{id}"), &connection)?;
    Ok(Json(json!({"revoked":true})))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_loopback_callbacks_allow_ephemeral_ports() {
        for host in ["127.0.0.1", "localhost", "[::1]"] {
            let registered = format!("http://{host}/callback");
            for port in [1, 59868, 65535] {
                assert!(redirect_matches(
                    &registered,
                    &format!("http://{host}:{port}/callback")
                ));
            }
            assert!(redirect_matches(
                &format!("http://{host}:19000/callback?client=desktop"),
                &format!("http://{host}:59868/callback?client=desktop")
            ));
        }
    }

    #[test]
    fn port_exception_keeps_other_callback_components_exact() {
        let registered = "http://127.0.0.1/callback?client=desktop";
        for requested in [
            "http://localhost:59868/callback?client=desktop",
            "http://[::1]:59868/callback?client=desktop",
            "http://127.0.0.2:59868/callback?client=desktop",
            "http://127.0.0.1.evil.example:59868/callback?client=desktop",
            "http://127.0.0.1:59868/other?client=desktop",
            "http://127.0.0.1:59868/x/../callback?client=desktop",
            "http://127.0.0.1:59868/%63allback?client=desktop",
            "http://127.0.0.1:59868/callback/?client=desktop",
            "http://127.0.0.1:59868/callback?client=other",
            "http://127.0.0.1:59868/callback?client=desktop#fragment",
            "http://user@127.0.0.1:59868/callback?client=desktop",
            "https://127.0.0.1:59868/callback?client=desktop",
        ] {
            assert!(!redirect_matches(registered, requested), "{requested}");
        }
        for registered in [
            "https://client.example/callback",
            "https://127.0.0.1/callback",
        ] {
            assert!(redirect_matches(registered, registered));
            let mut requested = url::Url::parse(registered).unwrap();
            requested.set_port(Some(59868)).unwrap();
            assert!(!redirect_matches(registered, requested.as_str()));
        }
    }

    #[tokio::test]
    async fn metadata_client_loopback_oauth_preserves_callback_and_pkce_binding() {
        let (_dir, state) = super::super::test_state();
        let client_id = "https://chatgpt.com/oauth/codex/client.json";
        let client = parse_client(
            json!({"client_name":"Codex","redirect_uris":["http://127.0.0.1/callback","http://localhost/callback"],"token_endpoint_auth_method":"none"}),
            client_id.into(),
            None,
        )
        .unwrap();
        // Cache the published metadata shape so the test needs no external DNS.
        put(&state, &format!("client:{client_id}"), &client).unwrap();
        let verifier = "x".repeat(64);
        let redirect_uri = "http://127.0.0.1:59868/callback";
        let authorization = authorize(
            State(state.clone()),
            axum::extract::Query(Authorization {
                client_id: client_id.into(),
                redirect_uri: redirect_uri.into(),
                response_type: "code".into(),
                code_challenge: digest(verifier.as_bytes()),
                code_challenge_method: "S256".into(),
                state: Some("desktop-state".into()),
                scope: Some("company:read".into()),
                resource: state.mcp.resource(),
            }),
        )
        .await
        .unwrap()
        .into_response();
        assert_eq!(authorization.status(), StatusCode::SEE_OTHER);
        let location =
            url::Url::parse(authorization.headers()[header::LOCATION].to_str().unwrap()).unwrap();
        assert_eq!(location.path(), "/app/mcp/authorize");
        let pending_id = location
            .query_pairs()
            .find(|(key, _)| key == "request")
            .unwrap()
            .1
            .into_owned();
        let Json(consented) = consent(
            AuthenticatedUser("mcp-test@example.com".into()),
            State(state.clone()),
            Json(json!({"request":pending_id,"decision":"approve"})),
        )
        .await
        .unwrap();
        let callback = url::Url::parse(consented["redirect"].as_str().unwrap()).unwrap();
        assert_eq!(callback.port(), Some(59868));
        assert_eq!(callback.path(), "/callback");
        assert!(callback
            .query_pairs()
            .any(|(key, value)| key == "state" && value == "desktop-state"));
        let code = callback
            .query_pairs()
            .find(|(key, _)| key == "code")
            .unwrap()
            .1
            .into_owned();
        let request = |redirect: &str, verifier: &str| TokenRequest {
            grant_type: "authorization_code".into(),
            code: Some(code.clone()),
            code_verifier: Some(verifier.into()),
            redirect_uri: Some(redirect.into()),
            resource: Some(state.mcp.resource()),
            refresh_token: None,
            client_id: Some(client_id.into()),
            client_secret: None,
        };
        assert!(token_inner(
            &state,
            axum::http::HeaderMap::new(),
            request("http://127.0.0.1:59869/callback", &verifier)
        )
        .await
        .is_err());
        assert!(token_inner(
            &state,
            axum::http::HeaderMap::new(),
            request(redirect_uri, &"y".repeat(64))
        )
        .await
        .is_err());
        let tokens = token_inner(
            &state,
            axum::http::HeaderMap::new(),
            request(redirect_uri, &verifier),
        )
        .await
        .unwrap();
        assert!(tokens["access_token"].is_string());
        assert!(token_inner(
            &state,
            axum::http::HeaderMap::new(),
            request(redirect_uri, &verifier)
        )
        .await
        .is_err());
    }
}
