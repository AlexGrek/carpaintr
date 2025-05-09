use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user email)
    pub exp: usize, // Expiration time
}

#[derive(Debug, Serialize, Deserialize, Clone)] // Clone needed for caching
pub struct LicenseData {
    pub expiry_date: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AdminStatus {
    pub is_admin: bool,
}