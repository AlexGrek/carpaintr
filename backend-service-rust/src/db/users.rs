use std::string::FromUtf8Error;

use crate::{errors::AppError, exlogging::{log_event, LogLevel}, models::User};
use serde_json;
use sled::{Tree};

const USERS_TREE_NAME: &str = "users";
const REQUESTS_TREE_NAME: &str = "support_requests";
const ATTACHMENTS_TREE_NAME: &str = "attachments";

#[derive(Clone)]
pub struct AppDb {
    // db: Db,
    pub users_tree: Tree,
    pub requests_tree: Tree,
    pub attachments_tree: Tree
}

impl AppDb {
    pub fn new(db_path: &str) -> Result<Self, AppError> {
        let db = sled::open(db_path)?;
        let users_tree = db.open_tree(USERS_TREE_NAME)?;
        let requests_tree = db.open_tree(REQUESTS_TREE_NAME)?;
        let attachments_tree = db.open_tree(ATTACHMENTS_TREE_NAME)?;
        Ok(Self { users_tree, requests_tree, attachments_tree })
    }

    pub fn insert_user(&self, user: &User) -> Result<(), AppError> {
        let key = user.email.as_bytes();
        let value = serde_json::to_vec(user)?;

        log_event(LogLevel::Info, format!("Create user {:?}", user), Some(user.email.as_str()));

        if self.users_tree.contains_key(key)? {
            return Err(AppError::UserExists);
        }

        self.users_tree.insert(key, value)?;
        self.users_tree.flush()?; // Ensure data is written to disk
        Ok(())
    }

    pub fn find_user_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let key = email.as_bytes();
        match self.users_tree.get(key)? {
            Some(ivec) => {
                let user: User = serde_json::from_slice(&ivec)?;
                Ok(Some(user))
            }
            None => Ok(None),
        }
    }

    pub fn delete_user_by_email(&self, email: &str) -> Result<(), AppError> {
        let key = email.as_bytes();
        log_event(LogLevel::Info, format!("Delete user {:?}", email), Some(email));
        self.users_tree.remove(key)?;
        self.users_tree.flush()?;
        Ok(())
    }

    // New function to get all user emails
    pub fn get_all_user_emails(&self) -> Result<Vec<String>, AppError> {
        let mut emails = Vec::new();
        // Iterate over all key-value pairs in the users tree
        for item in self.users_tree.iter() {
            let (key, _) = item?; // We only need the key (email)
            let email = String::from_utf8(key.to_vec()).map_err(|e: FromUtf8Error| {
                AppError::InternalServerError(format!("Failed to convert key to string: {}", e))
            })?; // Convert key (bytes) to String
            emails.push(email);
        }
        Ok(emails)
    }

    // New function to change a user's password hash
    pub fn change_user_password_hash(
        &self,
        email: &str,
        new_password_hash: String,
    ) -> Result<(), AppError> {
        let key = email.as_bytes();

        log_event(LogLevel::Info, format!("Change password"), Some(email));
        // Retrieve the user to update
        let mut user = self
            .find_user_by_email(email)?
            .ok_or(AppError::UserNotFound)?; // Return UserNotFound if user doesn't exist

        // Update the password hash
        user.password_hash = new_password_hash;

        // Serialize the updated user and insert back into the tree
        let value = serde_json::to_vec(&user)?;
        self.users_tree.insert(key, value)?;
        self.users_tree.flush()?; // Ensure data is written to disk

        Ok(())
    }
}
