use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "action")] // Use the "action" field to determine which variant to deserialize
pub enum FixAction {
    #[serde(rename = "replace")]
    Replace { replacement: String },
    #[serde(rename = "normalize_whitespace")]
    NormalizeWhitespace,
    #[serde(rename = "no_action")]
    NoAction,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationRule {
    pub matcher: String,
    key: Option<String>,
    pub fix_action: FixAction,
}

impl ValidationRule {
    pub fn does_apply(&self, other: &str, key: &str) -> bool {
        let contains = other.contains(&self.matcher);
        let key_match = self.key.as_ref().map(|k| key == k).unwrap_or(true);
        contains && key_match
    }

    pub fn report(&self) -> String {
        format!("E: matches '{}'", self.matcher)
    }

    pub fn apply(&self, other: &str) -> String {
        match &self.fix_action {
            FixAction::Replace { replacement } => {
                other.replace(&self.matcher, replacement).to_string()
            }
            FixAction::NormalizeWhitespace => other.split_whitespace().collect::<Vec<_>>().join(" "),
            FixAction::NoAction => other.to_string(),
        }
    }
}

pub fn make_basic_validation_rules() -> Vec<ValidationRule> {
    vec![
        ValidationRule {
            matcher: "багажніка".to_string(),
            key: None,
            fix_action: FixAction::Replace {
                replacement: "багажника".to_string(),
            },
        },
        ValidationRule {
            matcher: "  ".to_string(),
            key: Some("Список деталь укр".to_string()),
            fix_action: FixAction::NormalizeWhitespace,
        },
        ValidationRule {
            matcher: "  ".to_string(),
            key: Some("зона".to_string()),
            fix_action: FixAction::NormalizeWhitespace,
        },
        ValidationRule {
            matcher: "  ".to_string(),
            key: Some("деталь 1".to_string()),
            fix_action: FixAction::NormalizeWhitespace,
        },
        ValidationRule {
            matcher: "  ".to_string(),
            key: Some("деталь 2".to_string()),
            fix_action: FixAction::NormalizeWhitespace,
        },
        ValidationRule {
            matcher: "5дв.".to_string(),
            key: None,
            fix_action: FixAction::Replace {
                replacement: "5 дверей".to_string(),
            },
        },
    ]
}
