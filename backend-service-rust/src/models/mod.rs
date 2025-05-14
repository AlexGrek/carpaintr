use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::license_manager::{GenerateLicenseByDaysRequest, GenerateLicenseByDateRequest}; // Import new structs

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


// Struct to represent the company information stored in company.json
#[derive(Debug, Serialize, Deserialize)]
pub struct CompanyInfo {
    pub email: String,
    pub license: Option<String>, // Assuming license can be null
    pub company_name: String,
    pub current_time: DateTime<Utc>, // Use DateTime<Utc> for timestamp
}

#[derive(Debug, Serialize)]
pub struct AdminStatus {
    pub is_admin: bool,
}

// Add the new license generation request structs here
pub mod license_requests {
    use super::*;

    #[derive(Debug, Deserialize)]
    #[serde(untagged)] // Allows deserialization from either format
    pub enum GenerateLicenseRequest {
        ByDays(GenerateLicenseByDaysRequest),
        ByDate(GenerateLicenseByDateRequest),
    }
}
