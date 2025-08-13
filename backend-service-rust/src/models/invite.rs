use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum UsagePolicy {
    UseOnce,
    UseForever,
    UseUpToCertainLimit(usize),
}

impl Default for UsagePolicy {
    fn default() -> Self {
        UsagePolicy::UseOnce
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    pub evaluation_license_type: String,
    pub evaluation_license_duration_days: isize,
    pub issued: DateTime<Utc>,
    pub code: String,
    #[serde(default)]
    pub used_by: Vec<String>,
    pub issued_by: String,
    #[serde(default)]
    pub metadata: HashMap<String, String>,
    pub usage_policy: UsagePolicy,
}

impl Invite {
    /// Creates a new Invite with a random 8-digit alphanumeric code,
    /// current UTC timestamp, and a "Basic" license type.
    pub fn new(evaluation_license_duration_days: isize, issuer: String) -> Self {
        // Generate a random 8-digit alphanumeric code.
        let code = format!("{:08}", rand::rng().random_range(0..99_999_999));

        Self {
            evaluation_license_type: "Basic".to_string(),
            evaluation_license_duration_days,
            issued: Utc::now(),
            code,
            used_by: Vec::new(),
            issued_by: issuer,
            metadata: HashMap::new(),
            usage_policy: UsagePolicy::UseOnce,
        }
    }

    /// Adds a new user's ID to the `used_by` vector.
    pub fn use_by(&mut self, user_id: &str) {
        self.used_by.push(user_id.to_string());
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateInviteRequest {
    #[serde(default)]
    pub evaluation_license_type: String,
    #[serde(default)]
    pub evaluation_license_duration_days: isize,
    #[serde(default)]
    pub usage_policy: UsagePolicy,
}
