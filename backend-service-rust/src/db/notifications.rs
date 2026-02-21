use std::io::{Cursor, Read};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use chrono::{Duration, Utc};
use sled::Tree;

use crate::errors::AppError;
use crate::exlogging::{log_event, LogLevel};
use crate::models::notifications::Notification;

fn create_composite_key(user_email: &str, uid: &str) -> Vec<u8> {
    let mut key_bytes = Vec::new();
    key_bytes
        .write_u16::<BigEndian>(user_email.len() as u16)
        .expect("Failed to write email length");
    key_bytes.extend_from_slice(user_email.as_bytes());
    key_bytes.extend_from_slice(uid.as_bytes());
    key_bytes
}

fn deserialize_composite_key(key_bytes: &[u8]) -> Result<(String, String), String> {
    let mut cursor = Cursor::new(key_bytes);
    let email_len = cursor
        .read_u16::<BigEndian>()
        .map_err(|e| format!("Failed to read email length: {}", e))? as usize;
    let mut email_bytes = vec![0; email_len];
    cursor
        .read_exact(&mut email_bytes)
        .map_err(|e| format!("Failed to read email bytes: {}", e))?;
    let user_email = String::from_utf8(email_bytes)
        .map_err(|e| format!("Failed to decode email string: {}", e))?;
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
    prefix_bytes
        .write_u16::<BigEndian>(user_email.len() as u16)
        .expect("Failed to write email length for prefix");
    prefix_bytes.extend_from_slice(user_email.as_bytes());
    prefix_bytes
}

pub fn insert_notification(
    notifications_tree: &Tree,
    notification: &Notification,
) -> Result<(), AppError> {
    let key = create_composite_key(&notification.email, &notification.id);
    let value = serde_json::to_vec(notification)?;

    log_event(
        LogLevel::Info,
        format!("New notification {:?}", notification),
        Some(notification.email.as_str()),
    );

    if notifications_tree.contains_key(&key)? {
        return Err(AppError::BadRequest("Notification duplicate".to_string()));
    }

    notifications_tree.insert(key, value)?;
    notifications_tree.flush()?;
    Ok(())
}

pub fn update_notification(
    notifications_tree: &Tree,
    notification: &Notification,
) -> Result<(), AppError> {
    let key = create_composite_key(&notification.email, &notification.id);
    let value = serde_json::to_vec(notification)?;

    notifications_tree.insert(key, value)?;
    notifications_tree.flush()?;
    log_event(
        LogLevel::Info,
        format!("Updated notification: {}", notification.id),
        Some(notification.email.as_str()),
    );
    Ok(())
}

pub fn remove_notification(
    notifications_tree: &Tree,
    email: &str,
    id: &str,
) -> Result<bool, AppError> {
    let key = create_composite_key(email, id);

    let removed = notifications_tree.remove(&key)?;
    notifications_tree.flush()?;

    if removed.is_some() {
        log_event(
            LogLevel::Info,
            format!(
                "Successfully removed notification with email: {}, id: {}",
                email, id
            ),
            Some(email),
        );
        Ok(true)
    } else {
        log_event(
            LogLevel::Warn,
            format!(
                "Notification not found for removal: email: {}, id: {}",
                email, id
            ),
            Some(email),
        );
        Ok(false)
    }
}

pub fn get_notification(
    notifications_tree: &Tree,
    email: &str,
    id: &str,
) -> Result<Option<Notification>, AppError> {
    let key = create_composite_key(email, id);

    log_event(
        LogLevel::Info,
        format!(
            "Attempting to get notification with email: {}, id: {}",
            email, id
        ),
        Some(email),
    );

    match notifications_tree.get(&key)? {
        Some(ivec) => {
            let notification: Notification = serde_json::from_slice(&ivec)?;
            log_event(
                LogLevel::Info,
                format!("Found notification: {}", notification.id),
                Some(email),
            );
            Ok(Some(notification))
        }
        None => {
            log_event(
                LogLevel::Info,
                format!("Notification not found: email: {}, id: {}", email, id),
                Some(email),
            );
            Ok(None)
        }
    }
}

pub fn list_all_notifications(
    notifications_tree: &Tree,
) -> Result<Vec<Notification>, AppError> {
    let mut all = Vec::new();
    for item_result in notifications_tree.iter() {
        let (_key, value_ivec) = item_result?;
        let notification: Notification = serde_json::from_slice(&value_ivec)?;
        all.push(notification);
    }
    Ok(all)
}

pub fn query_notifications_by_user_email(
    notifications_tree: &Tree,
    email: &str,
) -> Result<Vec<Notification>, AppError> {
    let prefix_bytes = create_email_prefix(email);
    let mut user_notifications = Vec::new();
    for item_result in notifications_tree.scan_prefix(&prefix_bytes) {
        let (_key_ivec, value_ivec) = item_result?;
        let notification: Notification = serde_json::from_slice(&value_ivec)?;
        user_notifications.push(notification);
    }
    Ok(user_notifications)
}

pub fn count_unread_by_email(notifications_tree: &Tree, email: &str) -> Result<u64, AppError> {
    let prefix_bytes = create_email_prefix(email);
    let mut count = 0u64;
    for item_result in notifications_tree.scan_prefix(&prefix_bytes) {
        let (_key_ivec, value_ivec) = item_result?;
        let notification: Notification = serde_json::from_slice(&value_ivec)?;
        if !notification.read {
            count += 1;
        }
    }
    Ok(count)
}

/// Removes notifications that are read and older than 24 hours. Returns the number removed.
pub fn cleanup_old_read_notifications(notifications_tree: &Tree) -> Result<usize, AppError> {
    let cutoff = Utc::now() - Duration::hours(24);
    let mut to_remove: Vec<(String, String)> = Vec::new();
    for item_result in notifications_tree.iter() {
        let (key_ivec, value_ivec) = item_result?;
        let notification: Notification = serde_json::from_slice(&value_ivec)?;
        if notification.read && notification.timestamp < cutoff {
            let (email, id) = deserialize_composite_key(&key_ivec)
                .map_err(|e| AppError::InternalServerError(e))?;
            to_remove.push((email, id));
        }
    }
    let mut removed = 0;
    for (email, id) in to_remove {
        if remove_notification(notifications_tree, &email, &id)? {
            removed += 1;
        }
    }
    if removed > 0 {
        log_event(
            LogLevel::Info,
            format!("Cleanup removed {} old read notification(s)", removed),
            None::<String>,
        );
    }
    Ok(removed)
}
