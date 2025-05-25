use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use thiserror::Error;

use crate::transactionalfs::TransactionalFsError;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error")]
    DbError(#[from] sled::Error),
    #[error("Serialization/Deserialization error")]
    SerdeError(#[from] serde_json::Error),
    #[error("JWT error")]
    JwtError(#[from] jsonwebtoken::errors::Error),
    #[error("Password hashing error")]
    BcryptError(#[from] bcrypt::BcryptError),
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("File not found")]
    FileNotFound,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Forbidden")]
    Forbidden,
    #[error("License expired")]
    LicenseExpired,
    #[error("License not found")]
    LicenseNotFound,
    #[error("User not found")]
    UserNotFound,
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("User already exists")]
    UserExists,
    #[error("Admin check failed")] // Used internally by admin middleware
    AdminCheckFailed,
    #[error("Configuration error: {0}")]
    ConfigError(String),
    #[error("Invalid data: {0}")]
    InvalidData(String),
    #[error("Cache error: {0}")]
    CacheError(String),
    #[error("Missing expected extension: {0}")]
    MissingExtension(String),
    #[error("Unknown error")]
    Unknown,
    #[error("Internal server error: {0}")]
    InternalServerError(String),
    #[error("Bad request: {0}")]
    BadRequest(String)
}

// Implement the From trait for TransactionalFsError to AppError
impl From<TransactionalFsError> for AppError {
    fn from(err: TransactionalFsError) -> Self {
        match err {
            TransactionalFsError::Io(e) => AppError::IoError(e),
            TransactionalFsError::FileNotFound(_) => AppError::FileNotFound, // Map TransactionalFs's specific FileNotFound to AppError's
            TransactionalFsError::GitCommand(msg) => AppError::InternalServerError(format!("Git command failed: {}", msg)),
            TransactionalFsError::Path(msg) => AppError::InternalServerError(format!("Path error: {}", msg)),
            TransactionalFsError::CommitNotFound(hash) => AppError::BadRequest(format!("Git commit not found: {}", hash)), // Might be a bad request if user provided hash
            TransactionalFsError::GitLogParseError(msg) => AppError::InternalServerError(format!("Git log parsing error: {}", msg)),
            // If you added a TransactionalFs variant to AppError, it would look like:
            // _ => AppError::TransactionalFs(err.to_string()),
        }
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status_code = match &self {
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::LicenseExpired => StatusCode::FORBIDDEN,
            AppError::LicenseNotFound => StatusCode::FORBIDDEN,
            AppError::UserNotFound => StatusCode::NOT_FOUND,
            AppError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AppError::UserExists => StatusCode::CONFLICT,
            AppError::AdminCheckFailed => StatusCode::NOT_FOUND, // As requested for admin check
            AppError::FileNotFound => StatusCode::NOT_FOUND,
            AppError::ConfigError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::InvalidData(_) => StatusCode::BAD_REQUEST,
            AppError::MissingExtension(_) => StatusCode::INTERNAL_SERVER_ERROR, // Indicates a middleware setup issue
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(ErrorResponse {
            message: self.to_string(),
        });

        (status_code, body).into_response()
    }
}