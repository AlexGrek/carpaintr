use std::sync::Arc;

use crate::{db::attachment, exlogging::{self, log_event}, state::AppState};

pub async fn cleanup_task(state: Arc<AppState>) {
    exlogging::log_event(exlogging::LogLevel::Info, "Cleanup initiated", None::<String>);
    let attachments_clean_result = attachment::cleanup_old_unused_attachments(&state.db.attachments_tree).await;
    if let Err(e) = attachments_clean_result {
        log_event(exlogging::LogLevel::Error, format!("Error during attachments cleanup: {}", e), None::<String>);
    }
}