use sled::{Db, Tree};
use crate::{
    models::User,
    errors::AppError,
};
use serde_json;

const USERS_TREE_NAME: &str = "users";

#[derive(Clone)]
pub struct UserDb {
    db: Db,
    users_tree: Tree,
}

impl UserDb {
    pub fn new(db_path: &str) -> Result<Self, AppError> {
        let db = sled::open(db_path)?;
        let users_tree = db.open_tree(USERS_TREE_NAME)?;
        Ok(Self { db, users_tree })
    }

    pub fn insert_user(&self, user: &User) -> Result<(), AppError> {
        let key = user.email.as_bytes();
        let value = serde_json::to_vec(user)?;

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
         self.users_tree.remove(key)?;
         self.users_tree.flush()?;
         Ok(())
    }
}