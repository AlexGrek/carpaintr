use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn generate_random_id() -> String {
    crate::utils::random::generate_random_id(6)
}

fn utc_now() -> DateTime<Utc> {
    Utc::now()
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportRequestMessage {
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub is_support_response: bool,
    pub text: String,
    #[serde(default)]
    pub resolved: bool,
    #[serde(default = "utc_now")]
    pub timestamp: DateTime<Utc>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportRequest {
    #[serde(default = "generate_random_id")]
    pub id: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub contacts: HashMap<String,String>,
    #[serde(default)]
    pub description: String,
    pub title: String,
    #[serde(default)]
    pub req_type: String,
    #[serde(default = "utc_now")]
    pub timestamp: DateTime<Utc>,
    #[serde(default)]
    pub messages: Vec<SupportRequestMessage>
}