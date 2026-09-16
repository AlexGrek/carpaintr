use std::collections::HashSet;
use std::path::Path;

use uuid::Uuid;

use crate::{
    auth::Auth,
    db::users::AppDb,
    errors::AppError,
    exlogging::{log_event, LogLevel},
    models::{ServiceUserCredential, ServiceUsersFile, User},
    utils::random::generate_random_id,
};

const SERVICE_USERS_FILENAME: &str = "service_users.json";
const SERVICE_USER_DOMAIN: &str = "user.service";
const PASSWORD_LEN: usize = 48;
const LOCAL_PART_LEN: usize = 20;

/// Ensures at least one service account exists: an admin-equivalent,
/// license-exempt identity that autolab-cli authenticates as when running
/// inside the pod. Credentials are generated once and persisted under
/// DATA_DIR_PATH (PVC-backed) so they survive pod restarts - a bcrypt hash
/// can't be turned back into a password, so the plaintext has to live
/// somewhere durable for autolab-cli to read it back.
pub async fn ensure_service_users(
    db: &AppDb,
    auth: &Auth,
    data_dir_path: &Path,
) -> Result<HashSet<String>, AppError> {
    let path = data_dir_path.join(SERVICE_USERS_FILENAME);

    let mut file: ServiceUsersFile = if path.exists() {
        let content = tokio::fs::read_to_string(&path).await?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        ServiceUsersFile::default()
    };

    if file.service_users.is_empty() {
        let email = format!(
            "{}@{}",
            generate_random_id(LOCAL_PART_LEN).to_lowercase(),
            SERVICE_USER_DOMAIN
        );
        let password = generate_random_id(PASSWORD_LEN);

        log_event(
            LogLevel::Info,
            format!("Provisioning new service user: {}", email),
            None::<&str>,
        );

        file.service_users.push(ServiceUserCredential { email, password });

        let serialized = serde_json::to_string_pretty(&file)?;
        tokio::fs::write(&path, &serialized).await?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            tokio::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).await?;
        }
    }

    let mut emails = HashSet::new();
    for cred in &file.service_users {
        if db.find_user_by_email(&cred.email)?.is_none() {
            let password_hash = auth.hash_password(&cred.password)?;
            let user = User {
                id: Uuid::new_v4(),
                email: cred.email.clone(),
                password_hash,
            };
            match db.insert_user(&user) {
                Ok(()) | Err(AppError::UserExists) => {}
                Err(e) => return Err(e),
            }
        }
        emails.insert(cred.email.clone());
    }

    Ok(emails)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn creates_and_persists_a_service_user() {
        let data_dir = tempfile::tempdir().unwrap();
        let db_dir = tempfile::tempdir().unwrap();
        let db = AppDb::new(db_dir.path().join("sled_db").to_str().unwrap()).unwrap();
        let auth = Auth::new(b"test-secret");

        let emails = ensure_service_users(&db, &auth, data_dir.path())
            .await
            .unwrap();
        assert_eq!(emails.len(), 1);
        let email = emails.iter().next().unwrap().clone();
        assert!(email.ends_with("@user.service"));

        // The DB user was actually created with a verifiable password.
        let path = data_dir.path().join(SERVICE_USERS_FILENAME);
        let file: ServiceUsersFile =
            serde_json::from_str(&tokio::fs::read_to_string(&path).await.unwrap()).unwrap();
        let cred = &file.service_users[0];
        assert_eq!(&cred.email, &email);
        let user = db.find_user_by_email(&email).unwrap().unwrap();
        assert!(auth.verify_password(&cred.password, &user.password_hash).unwrap());

        // Restarting (re-running against the same files) must not mint a
        // second account or change the stored credentials.
        let emails_again = ensure_service_users(&db, &auth, data_dir.path())
            .await
            .unwrap();
        assert_eq!(emails_again, emails);
        let file_again: ServiceUsersFile =
            serde_json::from_str(&tokio::fs::read_to_string(&path).await.unwrap()).unwrap();
        assert_eq!(file_again.service_users[0].password, cred.password);
    }

    #[tokio::test]
    async fn recreates_db_user_if_missing_but_keeps_file_credentials() {
        // Simulates a fresh PVC where service_users.json survived but the
        // Sled DB did not (or vice versa in reverse) - the file is the
        // source of truth for the password.
        let data_dir = tempfile::tempdir().unwrap();
        let db_dir = tempfile::tempdir().unwrap();
        let db = AppDb::new(db_dir.path().join("sled_db").to_str().unwrap()).unwrap();
        let auth = Auth::new(b"test-secret");

        let emails = ensure_service_users(&db, &auth, data_dir.path())
            .await
            .unwrap();
        let email = emails.iter().next().unwrap().clone();

        db.delete_user_by_email(&email).unwrap();
        assert!(db.find_user_by_email(&email).unwrap().is_none());

        let emails_again = ensure_service_users(&db, &auth, data_dir.path())
            .await
            .unwrap();
        assert_eq!(emails_again, emails);
        assert!(db.find_user_by_email(&email).unwrap().is_some());
    }
}
