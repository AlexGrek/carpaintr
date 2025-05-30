use chrono::{Utc, DateTime};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, errors::ErrorKind};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::time::SystemTime;
use tokio::fs;
use crate::errors::AppError;
use crate::exlogging::{log_event, LogLevel};
use crate::utils::{user_personal_directory_from_email}; // Required for read_to_string

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseData {
    /// Standard JWT claims
    pub claims: LicenseClaims,
    /// Expiration date as ISO 8601 string
    pub expiration_date: String,
    /// Days remaining until expiration (calculated at serialization time)
    pub days_left: i64,
}

impl LicenseData {
    /// Creates a new LicenseData from JWT claims
    pub fn new(claims: LicenseClaims) -> Self {
        let expiration_datetime = DateTime::<Utc>::from_timestamp(claims.exp.try_into().unwrap(), 0)
            .expect("Invalid expiration timestamp");
        
        // Calculate days left
        let now = Utc::now();
        let duration = expiration_datetime.signed_duration_since(now);
        let days_left = duration.num_days();
        
        // Format expiration date as ISO 8601 string
        let expiration_date = expiration_datetime.to_rfc3339();
        
        Self {
            claims,
            expiration_date,
            days_left,
        }
    }

    /// Creates LicenseData instance from a JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        // Parse the JSON into LicenseData, but recalculate days_left
        let mut license_data: LicenseData = serde_json::from_str(json)?;
        
        // Parse the expiration date string back to DateTime
        let expiration_datetime = DateTime::parse_from_rfc3339(&license_data.expiration_date)
            .expect("Invalid expiration date format")
            .with_timezone(&Utc);
        
        // Update days_left based on current time
        let now = Utc::now();
        let duration = expiration_datetime.signed_duration_since(now);
        license_data.days_left = duration.num_days();
        
        Ok(license_data)
    }
    
    /// Serializes LicenseData to a JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        // Create a copy with updated days_left
        let mut updated = self.clone();
        
        // Parse the expiration date string back to DateTime
        let expiration_datetime = DateTime::parse_from_rfc3339(&updated.expiration_date)
            .expect("Invalid expiration date format")
            .with_timezone(&Utc);
        
        // Update days_left based on current time
        let now = Utc::now();
        let duration = expiration_datetime.signed_duration_since(now);
        updated.days_left = duration.num_days();
        
        serde_json::to_string(&updated)
    }
    
    /// Serializes LicenseData to a pretty-printed JSON string
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        // Create a copy with updated days_left
        let mut updated = self.clone();
        
        // Parse the expiration date string back to DateTime
        let expiration_datetime = DateTime::parse_from_rfc3339(&updated.expiration_date)
            .expect("Invalid expiration date format")
            .with_timezone(&Utc);
        
        // Update days_left based on current time
        let now = Utc::now();
        let duration = expiration_datetime.signed_duration_since(now);
        updated.days_left = duration.num_days();
        
        serde_json::to_string_pretty(&updated)
    }
    
    /// Refreshes the days_left field based on current time
    pub fn refresh_days_left(&mut self) {
        let expiration_datetime = DateTime::parse_from_rfc3339(&self.expiration_date)
            .expect("Invalid expiration date format")
            .with_timezone(&Utc);
        
        let now = Utc::now();
        let duration = expiration_datetime.signed_duration_since(now);
        self.days_left = duration.num_days();
    }

    /// Checks if the license is expired
    pub fn is_expired(&self) -> bool {
        self.days_left < 0
    }
    
    /// Checks if the license will expire within the specified number of days
    pub fn expires_within_days(&self, days: i64) -> bool {
        self.days_left >= 0 && self.days_left <= days
    }
    
    /// Gets expiration date as DateTime<Utc>
    pub fn get_expiration_datetime(&self) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(&self.expiration_date)
            .expect("Invalid expiration date format")
            .with_timezone(&Utc)
    }
}

// Define the claims for the JWT license
#[derive(Debug, Serialize, Deserialize, Clone)]
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

    log_event(LogLevel::Info, format!("License generated: {:?}; expiry date: {:?}", claims, expiry_date), None::<&str>);

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
    let user_data_dir = ensure_license_path(user_email, data_dir)?;

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

pub async fn find_latest_license_file(user_email: &str, data_dir: &PathBuf) -> Result<PathBuf, AppError> {
    let user_data_dir = ensure_license_path(user_email, data_dir)?;
    
    // Find the latest license file based on file metadata timestamp
    let mut entries = fs::read_dir(&user_data_dir).await.map_err(AppError::IoError)?;
    let mut latest_file: Option<PathBuf> = None;
    let mut latest_modified_time = SystemTime::UNIX_EPOCH;
    
    while let Some(entry) = entries.next_entry().await.map_err(AppError::IoError)? {
        let path = entry.path();
        if path.is_file() {
            if let Some(filename) = path.file_name().and_then(|name| name.to_str()) {
                if filename.starts_with("license_") && filename.ends_with(".jwt") {
                    // Get file metadata and check modified time
                    if let Ok(metadata) = fs::metadata(&path).await {
                        if let Ok(modified_time) = metadata.modified() {
                            if latest_file.is_none() || modified_time > latest_modified_time {
                                latest_modified_time = modified_time;
                                latest_file = Some(path);
                            }
                        }
                    }
                }
            }
        }
    }
    
    latest_file.ok_or(AppError::LicenseNotFound)
}

pub async fn read_license_file(license_path: &PathBuf) -> Result<String, AppError> {
    // Read the license file content
    fs::read_to_string(license_path)
        .await
        .map_err(|e| AppError::IoError(e))
}


pub async fn read_license_file_by_name(
    user_email: &str, 
    data_dir: &PathBuf,
    file_name: &str
) -> Result<String, AppError> {
    // Ensure user license directory exists
    let user_data_dir = ensure_license_path(user_email, data_dir)?;
    
    // Construct the full path to the license file
    let license_path = user_data_dir.join(file_name);
    
    // Check if the file exists
    if !license_path.exists() {
        return Err(AppError::LicenseNotFound);
    }
    
    // Read the license file content
    let content = fs::read_to_string(&license_path)
        .await
        .map_err(|e| AppError::IoError(e))?;
    
    // Log the license access for auditing purposes
    log::info!("License file '{}' read for user {}", file_name, user_email);
    
    Ok(content)
}

// Convenience function that combines the two operations
pub async fn read_latest_license_file(user_email: &str, data_dir: &PathBuf) -> Result<String, AppError> {
    let license_path = find_latest_license_file(user_email, data_dir).await?;
    read_license_file(&license_path).await
}

// Function to read a specific license file by timestamp
pub async fn read_license_file_by_timestamp(user_email: &str, timestamp: u64, data_dir: &PathBuf) -> Result<String, AppError> {
    let user_data_dir = ensure_license_path(user_email, data_dir)?;
    let filename = format!("license_{}.jwt", timestamp);
    let file_path = user_data_dir.join(filename);
    
    if file_path.exists() {
        read_license_file(&file_path).await
    } else {
        Err(AppError::LicenseNotFound)
    }
}

pub fn ensure_license_path(user_email: &str, data_dir: &PathBuf) -> Result<PathBuf, AppError> {
    let user_data_dir = user_personal_directory_from_email(data_dir, user_email)?;
    let licenses_dir = user_data_dir.join("licenses");
    std::fs::create_dir_all(&licenses_dir)?;
    return Ok(licenses_dir);
}

// New function to list all license files for a user
pub async fn list_license_files(user_email: &str, data_dir: &PathBuf) -> Result<Vec<String>, AppError> {
    let user_data_dir = ensure_license_path(user_email, data_dir)?;

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
    let user_data_dir = ensure_license_path(user_email, data_dir)?;
    let filepath = user_data_dir.join(license_filename);

    // Ensure the file exists and is within the user's directory to prevent directory traversal attacks
    if !filepath.exists() || !filepath.starts_with(&user_data_dir) {
        return Err(AppError::FileNotFound);
    }

    log::info!("Deleting license file: {:?}", filepath);

    fs::remove_file(&filepath).await.map_err(AppError::IoError)?;

    Ok(())
}
