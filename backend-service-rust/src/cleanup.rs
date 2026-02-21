use std::sync::Arc;

use crate::{
    db::{attachment, notifications},
    exlogging::{log_event, LogLevel},
    state::AppState,
};

pub async fn cleanup_task(state: Arc<AppState>) {
    log_event(LogLevel::Info, "Cleanup initiated".to_string(), None::<String>);

    let attachments_clean_result =
        attachment::cleanup_old_unused_attachments(&state.db.attachments_tree).await;
    if let Err(e) = attachments_clean_result {
        log_event(
            LogLevel::Error,
            format!("Error during attachments cleanup: {}", e),
            None::<String>,
        );
    }

    let notifications_clean_result =
        notifications::cleanup_old_read_notifications(&state.db.notifications_tree);
    if let Err(e) = notifications_clean_result {
        log_event(
            LogLevel::Error,
            format!("Error during notifications cleanup: {}", e),
            None::<String>,
        );
    }
}