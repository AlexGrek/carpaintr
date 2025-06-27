use std::io::{Cursor, Read};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use sled::Tree;

use crate::errors::AppError;
use crate::exlogging::{log_event, LogLevel};
use crate::models::requests::SupportRequest;

fn create_composite_key(user_email: &str, uid: &str) -> Vec<u8> {
    let mut key_bytes = Vec::new();

    // 1. Write the length of the email string (as u16, big-endian)
    // This allows us to know how many bytes to read for the email when deserializing,
    // and also ensures correct lexicographical ordering for variable-length strings.
    key_bytes
        .write_u16::<BigEndian>(user_email.len() as u16)
        .expect("Failed to write email length");

    // 2. Append the email string bytes
    key_bytes.extend_from_slice(user_email.as_bytes());

    // 3. Append the UID string bytes
    // Since UID is a fixed component after email, no further length prefix is strictly needed
    // if you always expect to have the full UID when querying for a specific (email, uid) pair.
    key_bytes.extend_from_slice(uid.as_bytes());

    key_bytes
}

fn deserialize_composite_key(key_bytes: &[u8]) -> Result<(String, String), String> {
    let mut cursor = Cursor::new(key_bytes);

    // 1. Read the email length
    let email_len = cursor
        .read_u16::<BigEndian>()
        .map_err(|e| format!("Failed to read email length: {}", e))? as usize;

    // 2. Read the email bytes
    let mut email_bytes = vec![0; email_len];
    cursor
        .read_exact(&mut email_bytes)
        .map_err(|e| format!("Failed to read email bytes: {}", e))?;
    let user_email = String::from_utf8(email_bytes)
        .map_err(|e| format!("Failed to decode email string: {}", e))?;

    // 3. Read the remaining bytes as UID
    let mut uid_bytes = Vec::new();
    cursor
        .read_to_end(&mut uid_bytes)
        .map_err(|e| format!("Failed to read UID bytes: {}", e))?;
    let uid =
        String::from_utf8(uid_bytes).map_err(|e| format!("Failed to decode UID string: {}", e))?;

    Ok((user_email, uid))
}

fn create_email_prefix(user_email: &str) -> Vec<u8> {
    let mut prefix_bytes = Vec::new();
    prefix_bytes.write_u16::<BigEndian>(user_email.len() as u16)
        .expect("Failed to write email length for prefix");
    prefix_bytes.extend_from_slice(user_email.as_bytes());
    prefix_bytes
}

pub fn insert_request(requests_tree: &Tree, req: &SupportRequest) -> Result<(), AppError> {
    let key = create_composite_key(&req.email, &req.id);
    let value = serde_json::to_vec(&req)?;

    log_event(
        LogLevel::Info,
        format!("New support request {:?}", &req),
        Some(req.email.as_str()),
    );

    if requests_tree.contains_key(&key)? {
        return Err(AppError::BadRequest("Support ticket duplicate".to_string()));
    }

    requests_tree.insert(key, value)?;
    requests_tree.flush()?;
    Ok(())
}

pub fn update_request(requests_tree: &Tree, req: &SupportRequest) -> Result<(), AppError> {
    let key = create_composite_key(&req.email, &req.id);
    let value = serde_json::to_vec(&req)?;

    // Sled's insert acts as an upsert, so we just call insert.
    requests_tree.insert(key, value)?;
    requests_tree.flush()?; // Ensure the data is written to disk
    log_event(
        LogLevel::Info,
        format!("Updated support request: {}", req.id),
        Some(req.email.as_str()),
    );
    Ok(())
}

pub fn remove_request(requests_tree: &Tree, email: &str, id: &str) -> Result<bool, AppError> {
    let key = create_composite_key(email, id);

    let removed = requests_tree.remove(&key)?;
    requests_tree.flush()?; // Ensure the change is written to disk

    if removed.is_some() {
        log_event(
            LogLevel::Info,
            format!("Successfully removed support request with email: {}, id: {}", email, id),
            Some(email),
        );
        Ok(true)
    } else {
        log_event(
            LogLevel::Warn,
            format!("Support request not found for removal: email: {}, id: {}", email, id),
            Some(email),
        );
        Ok(false)
    }
}

pub fn get_request(requests_tree: &Tree, email: &str, id: &str) -> Result<Option<SupportRequest>, AppError> {
    let key = create_composite_key(email, id);

    log_event(
        LogLevel::Info,
        format!("Attempting to get support request with email: {}, id: {}", email, id),
        Some(email),
    );

    match requests_tree.get(&key)? {
        Some(ivec) => {
            let req: SupportRequest = serde_json::from_slice(&ivec)?;
            log_event(
                LogLevel::Info,
                format!("Found support request: {}", req.id),
                Some(email),
            );
            Ok(Some(req))
        },
        None => {
            log_event(
                LogLevel::Info,
                format!("Support request not found: email: {}, id: {}", email, id),
                Some(email),
            );
            Ok(None)
        }
    }
}

pub fn list_all_requests(requests_tree: &Tree) -> Result<Vec<SupportRequest>, AppError> {
    let mut all_requests = Vec::new();
    for item_result in requests_tree.iter() {
        let (_key, value_ivec) = item_result?;
        let req: SupportRequest = serde_json::from_slice(&value_ivec)?;
        all_requests.push(req);
    }
    Ok(all_requests)
}

pub fn query_requests_by_user_email(requests_tree: &Tree, email: &str) -> Result<Vec<SupportRequest>, AppError> {
    let prefix_bytes = create_email_prefix(email);

    let mut user_requests = Vec::new();
    for item_result in requests_tree.scan_prefix(&prefix_bytes) {
        let (_key_ivec, value_ivec) = item_result?;
        let req: SupportRequest = serde_json::from_slice(&value_ivec)?;
        user_requests.push(req);
    }
    Ok(user_requests)
}

pub fn find_unresponded_requests(requests_tree: &Tree) -> Result<Vec<SupportRequest>, AppError> {
    let mut unresponded_requests = Vec::new();
    for item_result in requests_tree.iter() {
        let (_key_ivec, value_ivec) = item_result?;
        let req: SupportRequest = serde_json::from_slice(&value_ivec)?;
        if req.messages.is_empty() {
            unresponded_requests.push(req);
        }
    }
    Ok(unresponded_requests)
}
