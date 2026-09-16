use chrono::{DateTime, Utc};
use sled::Tree;

use crate::errors::AppError;

/// Records `now` as the last-visit time for `email`. Not flushed on every
/// call (this tree is updated on every authenticated request, so we rely on
/// sled's periodic background flush rather than an fsync per request).
pub fn record_visit(last_visit_tree: &Tree, email: &str) -> Result<(), AppError> {
    let now = Utc::now();
    let value = serde_json::to_vec(&now)?;
    last_visit_tree.insert(email.as_bytes(), value)?;
    Ok(())
}

pub fn get_last_visit(
    last_visit_tree: &Tree,
    email: &str,
) -> Result<Option<DateTime<Utc>>, AppError> {
    match last_visit_tree.get(email.as_bytes())? {
        Some(ivec) => Ok(Some(serde_json::from_slice(&ivec)?)),
        None => Ok(None),
    }
}

/// Returns up to `limit` (email, last_visit) pairs, most recent first.
pub fn list_recent_visits(
    last_visit_tree: &Tree,
    limit: usize,
) -> Result<Vec<(String, DateTime<Utc>)>, AppError> {
    let mut visits = Vec::new();
    for item in last_visit_tree.iter() {
        let (key, value) = item?;
        let email = String::from_utf8(key.to_vec()).map_err(|e| {
            AppError::InternalServerError(format!("Failed to decode email: {}", e))
        })?;
        let timestamp: DateTime<Utc> = serde_json::from_slice(&value)?;
        visits.push((email, timestamp));
    }
    visits.sort_by(|a, b| b.1.cmp(&a.1));
    visits.truncate(limit);
    Ok(visits)
}
