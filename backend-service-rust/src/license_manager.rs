use chrono::{Utc, Duration, DateTime};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, errors::ErrorKind};
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use crate::errors::AppError;
use crate::utils::user_directory_from_email; // Import the utility function
use tokio::io::AsyncReadExt; // Required for read_to_string

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
    // Expecting a date string in a format chrono can parse, e.g., "2023-10-27T10:00:00Z"
    pub expiry_date: DateTime<Utc>,
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

    encode(&header, &claims, &encoding_key).map_err(AppError::JwtError)
}

// Function to decode and validate a JWT license token
pub fn decode_license_token(token: &str, jwt_secret: &[u8]) -> Result<LicenseClaims, AppError> {
    let decoding_key = DecodingKey::from_secret(jwt_secret);
    let validation = Validation::default();

    decode::<LicenseClaims>(token, &decoding_key, &validation)
        .map(|data| data.claims)
        .map_err(|e| {
            if let ErrorKind::ExpiredSignature = e.kind() {
                AppError::LicenseExpired
            } else {
                AppError::Unauthorized
            }
        })
}

// Function to save a valid license token to a file
pub async fn save_license_file(user_email: &str, token: &str, data_dir: &PathBuf) -> Result<(), AppError> {
    // Get the user's directory
    let user_data_dir = user_directory_from_email(data_dir, user_email)?;
    // Ensure the directory exists
    fs::create_dir_all(&user_data_dir).await.map_err(AppError::IoError)?;

    // Use a unique filename, perhaps based on a timestamp or hash,
    // but for simplicity here, we'll use email + a counter or just email.
    // A simple approach for now is email + ".license"
    // For multiple licenses, you might need a more complex naming scheme.
    // Let's stick to a simple scheme for demonstrating the endpoints.
    // If you need to store multiple licenses per user, you'll need to adjust this.
    // For listing/deleting specific licenses, a naming convention like `license_YYYYMMDDHHMMSS.jwt` could work.
    // For this example, let's assume a pattern like `license_*.jwt`
    let filename = format!("license_{}.jwt", Utc::now().format("%Y%m%d%H%M%S"));
    let filepath = user_data_dir.join(filename);

    log::info!("Saving license file to: {:?}", filepath);

    fs::write(&filepath, token)
        .await
        .map_err(AppError::IoError)?;

    Ok(())
}

// Function to read a license token from a file (assuming a specific filename or pattern)
// This function might need adjustment if you store multiple licenses per user.
// For the purpose of validating the *current* license, reading the latest one might be desired.
// For admin listing, we need a different function.
pub async fn read_license_file(user_email: &str, data_dir: &PathBuf) -> Result<String, AppError> {
    let user_data_dir = user_directory_from_email(data_dir, user_email)?;
    // Find the latest license file based on naming convention, or read a specific one.
    // For now, let's assume we are looking for files matching `license_*.jwt`
    let mut entries = fs::read_dir(&user_data_dir).await.map_err(AppError::IoError)?;
    let mut latest_file: Option<PathBuf> = None;
    let mut latest_timestamp = 0;

    while let Some(entry) = entries.next_entry().await.map_err(AppError::IoError)? {
        let path = entry.path();
        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|name| name.to_str()) {
                if filename.starts_with("license_") && filename.ends_with(".jwt") {
                    // Attempt to parse timestamp from filename
                    if let Some(timestamp_str) = filename.strip_prefix("license_").and_then(|s| s.strip_suffix(".jwt")) {
                        if let Ok(timestamp) = timestamp_str.parse::<u64>() {
                             if timestamp > latest_timestamp {
                                latest_timestamp = timestamp;
                                latest_file = Some(path);
                             }
                        }
                    }
                }
            }
        }
    }

    match latest_file {
        Some(filepath) => {
            log::info!("Reading license file from: {:?}", filepath);
            let mut file = fs::File::open(&filepath).await.map_err(AppError::IoError)?;
            let mut contents = String::new();
            file.read_to_string(&mut contents).await.map_err(AppError::IoError)?;
            Ok(contents)
        },
        None => Err(AppError::FileNotFound), // No license file found for the user
    }
}

// New function to list all license files for a user
pub async fn list_license_files(user_email: &str, data_dir: &PathBuf) -> Result<Vec<String>, AppError> {
    let user_data_dir = user_directory_from_email(data_dir, user_email)?;

    // Check if the user directory exists, return empty list if not
    if !user_data_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = fs::read_dir(&user_data_dir).await.map_err(AppError::IoError)?;
    let mut license_files = Vec::new();

    while let Some(entry) = entries.next_entry().await.map_err(AppError::IoError)? {
        let path = entry.path();
        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|name| name.to_str()) {
                // Assuming license files follow a pattern, e.g., ending with ".jwt" or ".license"
                // Adjust this pattern based on your save_license_file implementation
                 if filename.ends_with(".jwt") || filename.ends_with(".license") {
                    license_files.push(filename.to_string());
                }
            }
        }
    }

    Ok(license_files)
}

// New function to delete a specific license file for a user
pub async fn delete_license_file(user_email: &str, license_filename: &str, data_dir: &PathBuf) -> Result<(), AppError> {
    let user_data_dir = user_directory_from_email(data_dir, user_email)?;
    let filepath = user_data_dir.join(license_filename);

    // Ensure the file exists and is within the user's directory to prevent directory traversal attacks
    if !filepath.exists() || !filepath.starts_with(&user_data_dir) {
        return Err(AppError::FileNotFound);
    }

    log::info!("Deleting license file: {:?}", filepath);

    fs::remove_file(&filepath).await.map_err(AppError::IoError)?;

    Ok(())
}
