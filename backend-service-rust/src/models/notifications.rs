use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn generate_random_id() -> String {
    crate::utils::random::generate_random_id(6)
}

fn utc_now() -> DateTime<Utc> {
    Utc::now()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    #[serde(default = "generate_random_id")]
    pub id: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub read: bool,
    #[serde(default = "utc_now")]
    pub timestamp: DateTime<Utc>,
}
