use std::{
    collections::HashSet,
    path::PathBuf,
};

use tokio::io::{AsyncBufReadExt, BufReader}; // Import AsyncBufReadExt and BufReader from tokio::io
use tokio::fs::File; // Import File from tokio::fs

use crate::errors::AppError;

pub async fn is_admin_async(
    email: &str,
    admin_file_path: &PathBuf,
) -> Result<bool, AppError> {
    // Open the file asynchronously using tokio::fs::File
    let admins_file = File::open(admin_file_path)
        .await // Await the asynchronous file opening
        .map_err(|e| AppError::ConfigError(format!("Could not open admins.txt: {}", e)))?; // Provide more detailed error

    let reader = BufReader::new(admins_file); // Use tokio::io::BufReader
    let mut admins: HashSet<String> = HashSet::new(); // Initialize an empty HashSet

    // Read lines asynchronously
    let mut lines = reader.lines();
    while let Some(line) = lines.next_line().await? {
        if line == email {
            return Ok(true);
        }
        admins.insert(line);
    }

    if admins.contains(email) {
        Ok(true)
    } else {
        Ok(false)
    }
}
