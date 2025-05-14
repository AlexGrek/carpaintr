use std::{path::PathBuf};

use percent_encoding::{percent_encode, NON_ALPHANUMERIC};

    // Sanitize email for use in a file path
    // This is a basic sanitization; a production system might need more robust handling
    // to avoid path traversal issues, though percent-encoding non-alphanumeric chars helps.
pub fn sanitize_email_for_path(email: &str) -> String {
        percent_encode(email.as_bytes(), NON_ALPHANUMERIC).to_string()
        // A more robust approach might involve base64 encoding or UUIDs
}

pub fn user_directory_from_email(data_dir: &PathBuf, email: &str) -> Result<PathBuf, std::io::Error> {
    let full_path = data_dir.join(sanitize_email_for_path(email));
    std::fs::create_dir_all(&full_path)?;
    Ok(full_path)
}