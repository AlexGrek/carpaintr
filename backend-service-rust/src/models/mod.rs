pub mod calculations;
pub mod requests;
pub mod invite;

use crate::{
    license_manager::{GenerateLicenseByDateRequest, GenerateLicenseByDaysRequest},
    utils::money::MoneyWithCurrency,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid; // Import new structs

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
    #[serde(default)]
    pub invite: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImpersonateRequest {
    pub action: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

fn default_lang() -> String {
    "ua".to_string()
}

fn default_currency() -> String {
    MoneyWithCurrency::default().currency
}

fn default_empty_string() -> String {
    "".to_string()
}

// Struct to represent the company information stored in company.json
#[derive(Debug, Serialize, Deserialize)]
pub struct PricingPreferences {
    #[serde(default = "default_currency")]
    pub preferred_currency: String,
    #[serde(default)]
    pub norm_price: MoneyWithCurrency,
}

impl Default for PricingPreferences {
    fn default() -> Self {
        Self {
            preferred_currency: default_currency(),
            norm_price: MoneyWithCurrency::default(),
        }
    }
}

// Struct to represent the company information stored in company.json
#[derive(Debug, Serialize, Deserialize)]
pub struct CompanyInfo {
    pub email: String,
    pub license: Option<String>, // Assuming license can be null
    pub company_name: String,

    #[serde(default = "default_empty_string")]
    pub company_addr: String,
    pub current_time: DateTime<Utc>, // Use DateTime<Utc> for timestamp

    #[serde(default = "default_lang")]
    pub lang_ui: String,

    #[serde(default = "default_lang")]
    pub lang_output: String,

    // money stuff
    #[serde(default)]
    pub pricing_preferences: PricingPreferences,
}

#[derive(Debug, Serialize)]
pub struct AdminStatus {
    pub is_admin: bool,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action")] // Use the "action" field to determine which variant to deserialize
pub enum ManageUserRequest {
    #[serde(rename = "delete")]
    Delete { email: String },
    #[serde(rename = "change_pass")]
    ChangePassword { email: String, data: String },
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
