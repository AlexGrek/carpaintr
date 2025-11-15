use std::path::PathBuf;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sled::Tree;
use tokio::fs;

use crate::{
    db::users::AppDb,
    errors::AppError,
    exlogging::{log_event, LogLevel},
    utils::random::generate_random_id,
};

#[derive(Debug, Serialize, Deserialize, Default, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum AttachmentLifecycle {
    #[default]
    TempJustUploaded,
    SupportRequestActive,
    MarkedForDeletionAfter(Duration),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentHandle {
    pub created_timestamp: DateTime<Utc>,
    #[serde(default)]
    pub lifecycle: AttachmentLifecycle,
    #[serde(default)]
    pub file_path: String,
    #[serde(default)]
    pub file_name: String,
    pub id: String,
    pub owner_user_email: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    size: Option<usize>,
    #[serde(default)]
    pub public: bool,
}

impl Default for AttachmentHandle {
    fn default() -> Self {
        AttachmentHandle {
            created_timestamp: Utc::now(),
            lifecycle: AttachmentLifecycle::default(),
            file_path: String::new(),
            file_name: String::new(),
            id: generate_random_id(12),
            owner_user_email: String::new(),
            size: Option::default(),
            public: false,
        }
    }
}

impl AttachmentHandle {
    pub fn new(
        owner_user_email: String,
        file_path: String,
        file_name: String,
        size: Option<usize>,
    ) -> Self {
        AttachmentHandle {
            created_timestamp: Utc::now(),
            lifecycle: AttachmentLifecycle::default(),
            file_path,
            file_name,
            id: generate_random_id(12),
            owner_user_email,
            size,
            public: false,
        }
    }
}

pub fn set_attachment_lifecycle_checked(
    attachment_id: &str,
    user_email: Option<String>,
    attachments_tree: &Tree,
    new_lifecycle: AttachmentLifecycle,
    public: Option<bool>,
) -> Result<AttachmentHandle, AppError> {
    let att = try_get_by_id_checked(attachments_tree, attachment_id, user_email)?;
    match att {
        Some(mut data) => {
            data.lifecycle = new_lifecycle; // update lifecycle
                                            // and update the attachment in db
            if let Some(publicity) = public {
                data.public = publicity;
            }
            update_attachment(attachments_tree, &data)?;
            Ok(data)
        }
        _ => {
            Err(AppError::BadRequest(format!(
                "Attachment not found by id={}",
                attachment_id
            )))
        }
    }
}

pub fn try_get_by_id_checked(
    attachments_tree: &Tree,
    id: &str,
    user_email: Option<String>,
) -> Result<Option<AttachmentHandle>, AppError> {
    let att = try_get_by_id(attachments_tree, id)?;
    match att {
        Some(data) => {
            if let Some(user_to_check_access) = user_email {
                if data.owner_user_email != user_to_check_access {
                    log_event(
                        LogLevel::Warn,
                        "Forbidden: attempt to access attachment owned by another user",
                        Some(user_to_check_access),
                    );
                    return Err(AppError::Forbidden);
                }
                Ok(Some(data))
            } else {
                Ok(Some(data))
            }
        }
        _ => Ok(None),
    }
}

pub async fn cleanup_old_unused_attachments(
    attachments_tree: &Tree,
) -> Result<(), AppError> {
    let all = list_all_attachments_for_all_users(attachments_tree)?;
    for (key, handle) in all.into_iter() {
        if should_be_cleaned(&handle) {
            log_event(
                LogLevel::Info,
                format!("Attachment {} set to be cleaned up", key),
                None::<String>,
            );
            let file_path = handle.file_path.clone();
            match fs::remove_file(&file_path).await {
                Ok(_) => {
                    log_event(
                        LogLevel::Info,
                        format!("Deleted file {}", file_path),
                        None::<String>,
                    );
                }
                Err(err) => {
                    log_event(
                        LogLevel::Error,
                        format!("Failed to delete file {}: {}", file_path, err),
                        None::<String>,
                    );
                }
            };
            // now remove the handle even if deletion failed
            attachments_tree.remove(key)?;
        }
    }
    Ok(())
}

fn should_be_cleaned(att: &AttachmentHandle) -> bool {
    let created = att.created_timestamp;
    let now = Utc::now();
    match att.lifecycle {
        AttachmentLifecycle::TempJustUploaded => now - created > Duration::minutes(30),
        AttachmentLifecycle::SupportRequestActive => false,
        AttachmentLifecycle::MarkedForDeletionAfter(time_delta) => now - created > time_delta,
    }
}

pub fn try_get_by_id_checked_or_public(
    attachments_tree: &Tree,
    id: &str,
    user_email: Option<String>,
) -> Result<Option<AttachmentHandle>, AppError> {
    let att = try_get_by_id(attachments_tree, id)?;
    match att {
        Some(data) => {
            if data.public {
                return  Ok(Some(data));
            }
            if let Some(user_to_check_access) = user_email {
                if data.owner_user_email != user_to_check_access {
                    log_event(
                        LogLevel::Warn,
                        "Forbidden: attempt to access attachment owned by another user",
                        Some(user_to_check_access),
                    );
                    return Err(AppError::Forbidden);
                }
                Ok(Some(data))
            } else {
                Ok(Some(data))
            }
        }
        _ => Ok(None),
    }
}

pub fn list_all_attachments_for_all_users(
    attachments_tree: &Tree,
) -> Result<Vec<(String, AttachmentHandle)>, AppError> {
    let mut all = Vec::new();
    for item_result in attachments_tree.iter() {
        let (key, value_ivec) = item_result?;
        let a: AttachmentHandle = serde_json::from_slice(&value_ivec)?;
        all.push((String::from_utf8(key.to_vec()).unwrap(), a));
    }
    Ok(all)
}

pub fn list_all_attachments_for_user(
    attachments_tree: &Tree,
    user_email: &str,
) -> Result<Vec<AttachmentHandle>, AppError> {
    let mut all = Vec::new();
    for item_result in attachments_tree.iter() {
        let (_key, value_ivec) = item_result?;
        let a: AttachmentHandle = serde_json::from_slice(&value_ivec)?;
        if a.owner_user_email == user_email {
            all.push(a);
        }
    }
    Ok(all)
}

pub fn try_get_by_id(
    attachments_tree: &Tree,
    id: &str,
) -> Result<Option<AttachmentHandle>, AppError> {
    let key = id;

    match attachments_tree.get(key)? {
        Some(ivec) => {
            let req: AttachmentHandle = serde_json::from_slice(&ivec)?;
            Ok(Some(req))
        }
        None => Ok(None),
    }
}

pub fn handle_attachment(
    file_path: &PathBuf,
    file_name: &str,
    user_email: &str,
    db: &AppDb,
    size: Option<usize>,
) -> Result<AttachmentHandle, AppError> {
    let handle = AttachmentHandle::new(
        user_email.to_string(),
        file_path.to_string_lossy().to_string(),
        file_name.to_string(),
        size,
    );
    insert_attachment(&db.attachments_tree, &handle)?;
    Ok(handle)
}

fn insert_attachment(requests_tree: &Tree, a: &AttachmentHandle) -> Result<(), AppError> {
    let key = a.id.clone();
    let value = serde_json::to_vec(&a)?;

    log_event(
        LogLevel::Debug,
        format!("New attachment handle {:?}", &a),
        Some(a.owner_user_email.as_str()),
    );

    if requests_tree.contains_key(&key)? {
        return Err(AppError::BadRequest("Attachment ID duplicate".to_string()));
    }

    requests_tree.insert(key, value)?;
    requests_tree.flush()?;
    Ok(())
}

fn update_attachment(requests_tree: &Tree, a: &AttachmentHandle) -> Result<(), AppError> {
    let key = a.id.clone();
    let value = serde_json::to_vec(&a)?;

    // Sled's insert acts as an upsert, so we just call insert.
    requests_tree.insert(key, value)?;
    requests_tree.flush()?; // Ensure the data is written to disk
    log_event(
        LogLevel::Info,
        format!("Updated support request: {}", a.id),
        Some(a.owner_user_email.as_str()),
    );
    Ok(())
}
