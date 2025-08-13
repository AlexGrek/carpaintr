use std::path::Path;

use chrono::{Duration, Utc};
use tokio::fs;

use crate::{
    errors::AppError,
    license_manager::{generate_license_token, save_license_file},
    models::invite::{Invite, UsagePolicy},
    state::AppState,
};

pub const INVITES: &'static str = "invites";
pub const ARCHIVED: &'static str = "archived";
pub const ACTIVE: &'static str = "active";

async fn try_find_invite_by_path(path: &Path) -> Result<Invite, AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound);
    }
    let yaml_content = tokio::fs::read_to_string(path).await?;
    let invite: Invite = serde_yaml::from_str(&yaml_content)?;
    Ok(invite)
}

pub async fn process_invite(
    email: &str,
    invite_code: &str,
    state: &AppState,
) -> Result<(), AppError> {
    let invites_dir = state.data_dir_path.join(ACTIVE);
    let mut invite =
        try_find_invite_by_path(invites_dir.join(format!("{invite_code}.yaml")).as_path()).await?;
    if invite.evaluation_license_duration_days > 0 && !invite.evaluation_license_type.is_empty() {
        generate_license_by_invite(
            invite.evaluation_license_duration_days,
            &invite.evaluation_license_type,
            email,
            state,
        )
        .await?;
        invite.used_by.push(email.to_string());
        consume_invite(&invite, state).await?;
    }
    Ok(())
}

pub async fn consume_invite(invite: &Invite, state: &AppState) -> Result<(), AppError> {
    // Path to the invite file in the active directory
    let active_path = state
        .data_dir_path
        .join(ACTIVE)
        .join(format!("{}.yaml", invite.code));

    // Serialize the updated invite and save it to the file
    let updated_yaml_content = serde_yaml::to_string(&invite)?;
    tokio::fs::write(&active_path, updated_yaml_content).await?;

    // Check if the usage policy has been met.
    let should_archive = match invite.usage_policy {
        UsagePolicy::UseOnce => invite.used_by.len() >= 1,
        UsagePolicy::UseUpToCertainLimit(limit) => invite.used_by.len() >= limit,
        UsagePolicy::UseForever => false, // Never archive a "UseForever" invite
    };

    if should_archive {
        // Ensure the directory exists before attempting to read from it.
        fs::create_dir_all(state.data_dir_path.join(ARCHIVED)).await?;
        let archived_path = state
            .data_dir_path
            .join(ARCHIVED)
            .join(format!("{}.yaml", invite.code));

        // Move the file from the active directory to the archived directory
        tokio::fs::rename(active_path, archived_path).await?;
    }

    Ok(())
}

async fn generate_license_by_invite(
    days: isize,
    license_type: &str,
    user_email: &str,
    state: &AppState,
) -> Result<(), AppError> {
    let expiry_date = Utc::now() + Duration::days(days as i64);
    // Generate the JWT token
    let token = generate_license_token(
        &user_email,
        expiry_date,
        Some(license_type.to_string()),
        state.jwt_license_secret.as_bytes(),
    )?;

    // Save the license file
    save_license_file(&user_email, &token, &state.data_dir_path).await?;
    Ok(())
}

/// Creates a new invite and saves it to the active directory.
pub async fn create_invite(
    duration_days: isize,
    usage_policy: UsagePolicy,
    issued_by: &str,
    state: &AppState,
) -> Result<Invite, AppError> {
    let mut new_invite = Invite::new(duration_days, issued_by.to_string());
    new_invite.usage_policy = usage_policy;
    let invites_dir = state.data_dir_path.join(ACTIVE);

    // Ensure the directory exists
    fs::create_dir_all(&invites_dir).await?;

    let file_path = invites_dir.join(format!("{}.yaml", new_invite.code));
    let yaml_content = serde_yaml::to_string(&new_invite)?;
    fs::write(&file_path, yaml_content).await?;

    Ok(new_invite)
}

/// Removes an invite file from either the active or archived directory.
pub async fn remove_invite(invite_code: &str, state: &AppState) -> Result<(), AppError> {
    let active_path = state
        .data_dir_path
        .join(ACTIVE)
        .join(format!("{}.yaml", invite_code));
    let archived_path = state
        .data_dir_path
        .join(ARCHIVED)
        .join(format!("{}.yaml", invite_code));

    if fs::metadata(&active_path).await.is_ok() {
        fs::remove_file(&active_path).await?;
        return Ok(());
    }

    if fs::metadata(&archived_path).await.is_ok() {
        fs::remove_file(&archived_path).await?;
        return Ok(());
    }

    Err(AppError::FileNotFound)
}

/// Lists all active invites, parsing the content of each file.
pub async fn list_active_invites(state: &AppState) -> Result<Vec<Invite>, AppError> {
    let invites_dir = state.data_dir_path.join(ACTIVE);
    let mut invites = Vec::new();

    if !invites_dir.exists() {
        return Ok(invites);
    }

    let mut entries = fs::read_dir(&invites_dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("yaml") {
            if let Ok(invite) = try_find_invite_by_path(&path).await {
                invites.push(invite);
            }
        }
    }
    Ok(invites)
}

/// Lists all archived invite codes (filenames without the extension).
pub async fn list_archived_invites(state: &AppState) -> Result<Vec<String>, AppError> {
    let archived_dir = state.data_dir_path.join(ARCHIVED);
    let mut archived_codes = Vec::new();

    if !archived_dir.exists() {
        return Ok(archived_codes);
    }

    let mut entries = fs::read_dir(&archived_dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("yaml") {
            if let Some(file_name) = path.file_stem().and_then(|s| s.to_str()) {
                archived_codes.push(file_name.to_string());
            }
        }
    }
    Ok(archived_codes)
}
