use chrono::{Utc, Duration, DateTime};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, errors::ErrorKind}; // Import ErrorKind
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use crate::errors::AppError; // Assuming AppError is defined in errors.rs

// Define the claims for the JWT license
#[derive(Debug, Serialize, Deserialize)]
pub struct LicenseClaims {
    pub sub: String, // Subject (user email)
    pub exp: usize, // Expiration time as Unix timestamp
}

// Struct for generating license by lifetime in days
#[derive(Debug, Deserialize)]
pub struct GenerateLicenseByDaysRequest {
    pub email: String,
    pub days: i64,
}

// Struct for generating license by specific expiration date
#[derive(Debug, Deserialize)]
pub struct GenerateLicenseByDateRequest {
    pub email: String,
    pub expiry_date: DateTime<Utc>, // Expecting a date string in a format chrono can parse
}

// Function to generate a JWT license token
pub fn generate_license_token(email: &str, expiry_date: DateTime<Utc>, jwt_secret: &[u8]) -> Result<String, AppError> {
    let expiration = expiry_date.timestamp() as usize;

    let claims = LicenseClaims {
        sub: email.to_string(),
        exp: expiration,
    };

    let header = Header::default();
    let encoding_key = EncodingKey::from_secret(jwt_secret);

    // Use AppError::JwtError which has #[from] jsonwebtoken::errors::Error
    encode(&header, &claims, &encoding_key).map_err(AppError::JwtError)
}

// Function to decode and validate a JWT license token
pub fn decode_license_token(token: &str, jwt_secret: &[u8]) -> Result<LicenseClaims, AppError> {
    let decoding_key = DecodingKey::from_secret(jwt_secret);
    let validation = Validation::default();

    decode::<LicenseClaims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| {
            // Check if the error is specifically due to expiration
            if let ErrorKind::ExpiredSignature = e.kind() {
                AppError::LicenseExpired // Use the more specific error
            } else {
                // Use AppError::Unauthorized directly as it does not take arguments
                AppError::Unauthorized
            }
        })
}

// Function to save a valid license token to a file
pub async fn save_license_file(user_email: &str, token: &str, data_dir: &Path) -> Result<(), AppError> {
    let filename = format!("{}.license", user_email);
    let filepath = data_dir.join(filename);

    // Use AppError::IoError which has #[from] std::io::Error
    fs::write(&filepath, token)
        .await
        .map_err(AppError::IoError)?;

    Ok(())
}

// Function to read a license token from a file
pub async fn read_license_file(user_email: &str, data_dir: &Path) -> Result<String, AppError> {
    let filename = format!("{}.license", user_email);
    let filepath = data_dir.join(filename);

    if !filepath.exists() {
        return Err(AppError::FileNotFound); // Use the specific FileNotFound error
    }

    // Use AppError::IoError which has #[from] std::io::Error
    fs::read_to_string(&filepath)
        .await
        .map_err(AppError::IoError)
}
